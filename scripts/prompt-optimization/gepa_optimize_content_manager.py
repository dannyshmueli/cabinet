#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import tempfile
import textwrap
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATASET = ROOT / "scripts" / "prompt-optimization" / "content-manager-cases.jsonl"
DEFAULT_PERSONA = ROOT / "data" / ".agents" / "content-manager" / "persona.md"
DEFAULT_DATA_DIR = ROOT / "data"
DEFAULT_OUTPUT_DIR = ROOT / "scripts" / "prompt-optimization" / "out" / "content-manager"
CANDIDATE_COMPONENT = "persona_body"
OBJECTIVE = (
    "Improve Cabinet's content-manager system prompt so it answers content-planning "
    "questions correctly, leaves a valid cabinet block, and reports artifact paths "
    "that match the KB files it actually changed."
)
BACKGROUND = (
    "The candidate is the body text of data/.agents/content-manager/persona.md. "
    "Cabinet wraps this with shared instructions that tell the agent to work in /data "
    "and end with a ```cabinet block containing SUMMARY, CONTEXT, and ARTIFACT lines. "
    "Good candidates should prefer using existing KB planning pages when possible, "
    "answer plainly before the cabinet block, and only claim artifacts for KB markdown "
    "files that were actually created or updated."
)


@dataclass
class ContentManagerRolloutOutput:
    case_id: str
    score: float
    summary: str | None
    context_summary: str | None
    artifact_paths: list[str]
    actual_changed_paths: list[str]
    provider: dict[str, Any]


@dataclass
class ContentManagerTrajectory:
    case_id: str
    user_message: str
    mentioned_paths: list[str]
    required_phrases: list[str]
    plain_answer: str
    parsed_summary: str | None
    parsed_context_summary: str | None
    parsed_artifacts: list[str]
    actual_changed_paths: list[str]
    component_scores: dict[str, float]
    matched_required_phrases: list[str]
    missing_required_phrases: list[str]
    provider: dict[str, Any]
    output_excerpt: str
    error: str | None = None


def parse_frontmatter_body(markdown_text: str) -> str:
    if markdown_text.startswith("---\n"):
        parts = markdown_text.split("---\n", 2)
        if len(parts) == 3:
            return parts[2].strip()
    return markdown_text.strip()


def load_cases(dataset_path: Path) -> list[dict[str, Any]]:
    cases: list[dict[str, Any]] = []
    for line in dataset_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            cases.append(json.loads(line))
    return cases


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def truncate_text(value: str, limit: int = 4000) -> str:
    value = value.strip()
    if len(value) <= limit:
        return value
    return f"{value[:limit].rstrip()}\n...[truncated]..."


def strip_code_fences(value: str) -> str:
    value = value.strip()
    if not value.startswith("```"):
        return value

    lines = value.splitlines()
    if lines and lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].strip() == "```":
        lines = lines[:-1]
    return "\n".join(lines).strip()


def is_retryable_case_runner_error(message: str) -> bool:
    return bool(
        re.search(r"ACP connection closed|session .*closed|ECONNRESET|broken pipe|timed out", message, re.I)
    )


def summarize_case_feedback(case: dict[str, Any], result: dict[str, Any]) -> str:
    component_scores = result.get("componentScores", {})
    provider = result.get("provider", {})
    parsed = result.get("parsed", {})
    judge = result.get("judge", {})

    feedback = [
        f"Overall score: {float(result.get('score', 0.0)):.3f}",
        f"Heuristic score: {float(result.get('heuristicScore', result.get('score', 0.0))):.3f}",
        "Component scores:",
        f"- cabinetBlock: {float(component_scores.get('cabinetBlock', 0.0)):.3f}",
        f"- answerPresence: {float(component_scores.get('answerPresence', 0.0)):.3f}",
        f"- keywordCoverage: {float(component_scores.get('keywordCoverage', 0.0)):.3f}",
        f"- artifactConsistency: {float(component_scores.get('artifactConsistency', 0.0)):.3f}",
    ]

    matched = result.get("matchedRequiredPhrases", [])
    missing = result.get("missingRequiredPhrases", [])
    if matched:
        feedback.append(f"Matched required phrases: {', '.join(matched)}")
    if missing:
        feedback.append(f"Missing required phrases: {', '.join(missing)}")

    parsed_artifacts = parsed.get("artifactPaths", [])
    actual_changed_paths = result.get("normalizedActualChangedPaths") or result.get("actualChangedPaths", [])
    if parsed_artifacts != actual_changed_paths:
        feedback.append(
            "Artifact mismatch: parsed cabinet artifacts are "
            f"{parsed_artifacts or '[]'} but the KB changes were {actual_changed_paths or '[]'}."
        )

    parsed_summary = parsed.get("summary")
    if parsed_summary:
        feedback.append(f"Parsed summary: {parsed_summary}")
    else:
        feedback.append("Parsed summary is missing.")

    fallback_reason = provider.get("fallbackReason")
    if fallback_reason:
        feedback.append(f"Provider fallback: {fallback_reason}")
    probe_error = provider.get("probeError")
    if probe_error:
        feedback.append(f"Provider probe error: {probe_error}")

    if judge.get("mode") == "llm-acp":
        if isinstance(judge.get("score"), (int, float)):
            feedback.append(
                f"LLM judge score ({judge.get('weight', 0.0)} weight): {float(judge['score']):.3f}"
            )
        if judge.get("rationale"):
            feedback.append(f"LLM judge rationale: {judge['rationale']}")
        if judge.get("strengths"):
            feedback.append(f"LLM judge strengths: {', '.join(judge['strengths'])}")
        if judge.get("weaknesses"):
            feedback.append(f"LLM judge weaknesses: {', '.join(judge['weaknesses'])}")
        if judge.get("error"):
            feedback.append(f"LLM judge error: {judge['error']}")

    error = result.get("error")
    if error:
        feedback.append(f"Evaluator error: {error}")

    if not result.get("output", "").strip():
        feedback.append("The provider returned an empty output.")

    if case.get("requiredPhrases") and not matched:
        feedback.append("The response did not mention the intended recommendation.")

    return "\n".join(feedback)


def run_case(
    candidate_text: str,
    case: dict[str, Any],
    dataset_path: Path,
    source_data_dir: Path,
    provider_id: str | None = None,
    provider_model: str | None = None,
    judge_mode: str = "heuristic",
    judge_provider_id: str | None = None,
    judge_provider_model: str | None = None,
    judge_weight: float = 0.4,
) -> dict[str, Any]:
    timeout_seconds = (int(case.get("timeoutMs", 120000)) / 1000.0) + (
        150 if judge_mode == "llm-acp" else 45
    )
    max_attempts = 3 if judge_mode == "llm-acp" else 2

    for attempt in range(1, max_attempts + 1):
        with tempfile.TemporaryDirectory(prefix="cabinet-gepa-") as temp_dir:
            temp_root = Path(temp_dir)
            temp_data_dir = temp_root / "data"
            shutil.copytree(source_data_dir, temp_data_dir)

            candidate_path = temp_root / "candidate.txt"
            candidate_path.write_text(candidate_text, encoding="utf-8")

            env = os.environ.copy()
            env["CABINET_DATA_DIR"] = str(temp_data_dir)

            command = [
                "npx",
                "tsx",
                "scripts/prompt-optimization/run-content-manager-case.ts",
                "--dataset",
                str(dataset_path),
                "--case-id",
                str(case["id"]),
                "--candidate-file",
                str(candidate_path),
            ]
            if provider_id:
                command.extend(["--provider-id", provider_id])
            if provider_model:
                command.extend(["--provider-model", provider_model])
            command.extend(["--judge-mode", judge_mode])
            if judge_provider_id:
                command.extend(["--judge-provider-id", judge_provider_id])
            if judge_provider_model:
                command.extend(["--judge-provider-model", judge_provider_model])
            command.extend(["--judge-weight", str(judge_weight)])

            try:
                completed = subprocess.run(
                    command,
                    cwd=ROOT,
                    env=env,
                    text=True,
                    capture_output=True,
                    timeout=timeout_seconds,
                    check=False,
                )
            except subprocess.TimeoutExpired as error:
                message = f"Timed out after {timeout_seconds:.1f}s"
                if attempt < max_attempts and is_retryable_case_runner_error(message):
                    continue
                return {
                    "caseId": case["id"],
                    "score": 0.0,
                    "componentScores": {
                        "cabinetBlock": 0.0,
                        "answerPresence": 0.0,
                        "keywordCoverage": 0.0,
                        "artifactConsistency": 0.0,
                    },
                    "provider": {
                        "providerId": provider_id or "default",
                        "requestedModel": provider_model,
                        "effectiveModel": provider_model,
                        "availableModels": [],
                    },
                    "judge": {
                        "mode": judge_mode,
                        "weight": judge_weight,
                    },
                    "error": message,
                }

            if completed.returncode == 0:
                return json.loads(completed.stdout)

            error_message = completed.stderr.strip() or completed.stdout.strip()
            if attempt < max_attempts and is_retryable_case_runner_error(error_message):
                continue

            return {
                "caseId": case["id"],
                "score": 0.0,
                "componentScores": {
                    "cabinetBlock": 0.0,
                    "answerPresence": 0.0,
                    "keywordCoverage": 0.0,
                    "artifactConsistency": 0.0,
                },
                "provider": {
                    "providerId": provider_id or "default",
                    "requestedModel": provider_model,
                    "effectiveModel": provider_model,
                    "availableModels": [],
                },
                "judge": {
                    "mode": judge_mode,
                    "weight": judge_weight,
                },
                "error": error_message,
            }

    return {
        "caseId": case["id"],
        "score": 0.0,
        "componentScores": {
            "cabinetBlock": 0.0,
            "answerPresence": 0.0,
            "keywordCoverage": 0.0,
            "artifactConsistency": 0.0,
        },
        "provider": {
            "providerId": provider_id or "default",
            "requestedModel": provider_model,
            "effectiveModel": provider_model,
            "availableModels": [],
        },
        "judge": {
            "mode": judge_mode,
            "weight": judge_weight,
        },
        "error": "Case runner exhausted retries.",
    }


def evaluate_candidate(
    candidate_text: str,
    example: dict[str, Any],
    dataset_path: Path,
    data_dir: Path,
    provider_id: str | None = None,
    provider_model: str | None = None,
    judge_mode: str = "heuristic",
    judge_provider_id: str | None = None,
    judge_provider_model: str | None = None,
    judge_weight: float = 0.4,
) -> tuple[float, dict[str, Any], dict[str, Any]]:
    result = run_case(
        candidate_text,
        example,
        dataset_path,
        data_dir,
        provider_id,
        provider_model,
        judge_mode,
        judge_provider_id,
        judge_provider_model,
        judge_weight,
    )
    parsed = result.get("parsed", {})
    side_info = {
        "case_id": result.get("caseId", example["id"]),
        "heuristic_score": result.get("heuristicScore"),
        "component_scores": result.get("componentScores", {}),
        "matched_required_phrases": result.get("matchedRequiredPhrases", []),
        "missing_required_phrases": result.get("missingRequiredPhrases", []),
        "parsed_summary": parsed.get("summary"),
        "parsed_context_summary": parsed.get("contextSummary"),
        "parsed_artifacts": parsed.get("artifactPaths", []),
        "actual_changed_paths": result.get("actualChangedPaths", []),
        "normalized_actual_changed_paths": result.get("normalizedActualChangedPaths", []),
        "provider": result.get("provider", {}),
        "judge": result.get("judge", {}),
        "error": result.get("error"),
    }
    return float(result.get("score", 0.0)), side_info, result


def mean_score(results: list[dict[str, Any]]) -> float:
    if not results:
        return 0.0
    return sum(float(result.get("score", 0.0)) for result in results) / len(results)


def run_candidate_suite(
    candidate_text: str,
    cases: list[dict[str, Any]],
    dataset_path: Path,
    data_dir: Path,
    provider_id: str | None,
    provider_model: str | None,
    judge_mode: str,
    judge_provider_id: str | None,
    judge_provider_model: str | None,
    judge_weight: float,
) -> list[dict[str, Any]]:
    return [
        run_case(
            candidate_text,
            case,
            dataset_path,
            data_dir,
            provider_id,
            provider_model,
            judge_mode,
            judge_provider_id,
            judge_provider_model,
            judge_weight,
        )
        for case in cases
    ]


def build_baseline_report(
    seed_candidate: str,
    train_cases: list[dict[str, Any]],
    val_cases: list[dict[str, Any]],
    dataset_path: Path,
    data_dir: Path,
    provider_id: str | None,
    provider_model: str | None,
    judge_mode: str,
    judge_provider_id: str | None,
    judge_provider_model: str | None,
    judge_weight: float,
) -> dict[str, Any]:
    baseline_train = run_candidate_suite(
        seed_candidate,
        train_cases,
        dataset_path,
        data_dir,
        provider_id,
        provider_model,
        judge_mode,
        judge_provider_id,
        judge_provider_model,
        judge_weight,
    )
    baseline_val = run_candidate_suite(
        seed_candidate,
        val_cases,
        dataset_path,
        data_dir,
        provider_id,
        provider_model,
        judge_mode,
        judge_provider_id,
        judge_provider_model,
        judge_weight,
    )
    return {
        "train_mean": mean_score(baseline_train),
        "val_mean": mean_score(baseline_val),
        "train": baseline_train,
        "val": baseline_val,
    }


def build_codex_rewrite_prompt(
    component_name: str,
    current_text: str,
    reflective_records: list[dict[str, Any]],
) -> str:
    reflective_json = json.dumps(reflective_records, indent=2, ensure_ascii=False)
    return textwrap.dedent(
        f"""
        Rewrite one Cabinet prompt component to improve its GEPA evaluation score.

        Objective:
        {OBJECTIVE}

        Background:
        {BACKGROUND}

        Component name:
        {component_name}

        Current component text:
        <current_component>
        {current_text}
        </current_component>

        Recent evaluation diagnostics:
        <reflective_dataset>
        {reflective_json}
        </reflective_dataset>

        Requirements:
        - Return only the rewritten component text.
        - Do not add markdown fences, labels, XML tags, or explanations.
        - This text is only the persona body, not the full Cabinet wrapper prompt.
        - Optimize for direct plain-English answers before the cabinet block.
        - Prefer using existing KB planning pages when possible instead of inventing new plans.
        - Ensure cabinet ARTIFACT lines correspond to KB markdown files the agent actually changes.
        - Keep the prompt concise, specific, and action-oriented.
        """
    ).strip()


def run_codex_exec(
    prompt: str,
    codex_command: str,
    codex_model: str | None,
    timeout_seconds: int,
) -> str:
    with tempfile.TemporaryDirectory(prefix="cabinet-gepa-codex-") as temp_dir:
        temp_root = Path(temp_dir)
        output_path = temp_root / "last-message.txt"
        command = [
            codex_command,
            "exec",
            "-",
            "--skip-git-repo-check",
            "--sandbox",
            "read-only",
            "--ephemeral",
            "--color",
            "never",
            "--output-last-message",
            str(output_path),
            "-C",
            temp_dir,
        ]
        if codex_model:
            command.extend(["-m", codex_model])

        completed = subprocess.run(
            command,
            cwd=ROOT,
            input=prompt,
            text=True,
            capture_output=True,
            timeout=timeout_seconds,
            check=False,
            env={
                **os.environ,
                "NO_COLOR": "1",
            },
        )

        raw_output = output_path.read_text(encoding="utf-8") if output_path.exists() else ""
        rewritten = strip_code_fences(raw_output).strip()
        if completed.returncode != 0:
            stderr = truncate_text(completed.stderr or completed.stdout or raw_output, 2000)
            raise RuntimeError(
                f"Codex CLI proposer failed with exit code {completed.returncode}: {stderr}"
            )
        if not rewritten:
            stderr = truncate_text(completed.stderr or completed.stdout, 2000)
            raise RuntimeError(
                "Codex CLI proposer returned an empty prompt body."
                + (f" Diagnostics: {stderr}" if stderr else "")
            )
        return rewritten


def build_codex_cli_proposer(
    codex_command: str,
    codex_model: str | None,
    timeout_seconds: int,
):
    def proposer(
        candidate: dict[str, str],
        reflective_dataset: dict[str, list[dict[str, Any]]],
        components_to_update: list[str],
    ) -> dict[str, str]:
        updated = dict(candidate)
        for component_name in components_to_update:
            current_text = candidate.get(component_name, "")
            prompt = build_codex_rewrite_prompt(
                component_name=component_name,
                current_text=current_text,
                reflective_records=reflective_dataset.get(component_name, []),
            )
            updated[component_name] = run_codex_exec(
                prompt=prompt,
                codex_command=codex_command,
                codex_model=codex_model,
                timeout_seconds=timeout_seconds,
            )
        return updated

    return proposer


def import_gepa_runtime():
    try:
        from gepa import optimize
        from gepa.core.adapter import EvaluationBatch
        return optimize, EvaluationBatch
    except ImportError as first_error:
        try:
            from gepa.api import optimize
            from gepa.core.adapter import EvaluationBatch
            return optimize, EvaluationBatch
        except ImportError as second_error:
            raise SystemExit(
                "GEPA is not installed. Run `pip install gepa` (or `pip install gepa[full]`) first."
            ) from second_error if second_error is not None else first_error


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Optimize the content-manager system prompt with GEPA against local Cabinet cases."
    )
    parser.add_argument(
        "--dataset",
        type=Path,
        default=DEFAULT_DATASET,
        help="JSONL dataset of prompt-evaluation cases.",
    )
    parser.add_argument(
        "--persona-file",
        type=Path,
        default=DEFAULT_PERSONA,
        help="Persona markdown file whose body is the seed candidate.",
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=DEFAULT_DATA_DIR,
        help="Source Cabinet data directory to copy for each evaluation.",
    )
    parser.add_argument(
        "--provider-id",
        default=os.environ.get("CABINET_PROMPTOPT_PROVIDER_ID"),
        help="Optional provider id override for evaluator runs.",
    )
    parser.add_argument(
        "--provider-model",
        default=os.environ.get("CABINET_PROMPTOPT_PROVIDER_MODEL"),
        help="Optional provider model override for evaluator runs.",
    )
    parser.add_argument(
        "--judge-mode",
        choices=("heuristic", "llm-acp"),
        default=os.environ.get("CABINET_PROMPTOPT_JUDGE_MODE", "llm-acp"),
        help="How to score each run: heuristics only or a local ACP LLM judge blended with heuristics.",
    )
    parser.add_argument(
        "--judge-provider-id",
        default=os.environ.get("CABINET_PROMPTOPT_JUDGE_PROVIDER_ID"),
        help="Optional provider id override for the ACP judge. Defaults to the evaluator provider.",
    )
    parser.add_argument(
        "--judge-provider-model",
        default=os.environ.get("CABINET_PROMPTOPT_JUDGE_PROVIDER_MODEL"),
        help="Optional model override for the ACP judge.",
    )
    parser.add_argument(
        "--judge-weight",
        type=float,
        default=float(os.environ.get("CABINET_PROMPTOPT_JUDGE_WEIGHT", "0.4")),
        help="Weight assigned to the ACP judge score when --judge-mode=llm-acp.",
    )
    parser.add_argument(
        "--proposer",
        choices=("codex-cli", "api"),
        default=os.environ.get("GEPA_PROPOSER", "codex-cli"),
        help="How GEPA should propose candidate mutations.",
    )
    parser.add_argument(
        "--reflection-lm",
        default=os.environ.get("GEPA_REFLECTION_LM", "openai/gpt-5"),
        help="Reflection model passed to GEPA when --proposer=api.",
    )
    parser.add_argument(
        "--codex-command",
        default=os.environ.get("GEPA_CODEX_COMMAND", "codex"),
        help="Codex CLI executable used when --proposer=codex-cli.",
    )
    parser.add_argument(
        "--codex-model",
        default=os.environ.get("GEPA_CODEX_MODEL"),
        help="Optional Codex CLI model override for proposer runs.",
    )
    parser.add_argument(
        "--codex-timeout-seconds",
        type=int,
        default=int(os.environ.get("GEPA_CODEX_TIMEOUT_SECONDS", "300")),
        help="Timeout for each Codex CLI proposer call.",
    )
    parser.add_argument(
        "--max-metric-calls",
        type=int,
        default=8,
        help="Optimization budget for GEPA.",
    )
    parser.add_argument(
        "--reflection-minibatch-size",
        type=int,
        default=2,
        help="How many train examples to include in each reflective update.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="Directory for optimization artifacts.",
    )
    parser.add_argument(
        "--baseline-only",
        action="store_true",
        help="Only run the seed prompt on train/val without invoking GEPA.",
    )
    args = parser.parse_args()

    cases = load_cases(args.dataset)
    train_cases = [case for case in cases if case.get("split") == "train"]
    val_cases = [case for case in cases if case.get("split") == "val"]
    if not train_cases:
        raise SystemExit("Dataset must include at least one train case.")

    seed_candidate = parse_frontmatter_body(args.persona_file.read_text(encoding="utf-8"))
    args.output_dir.mkdir(parents=True, exist_ok=True)

    baseline_report = build_baseline_report(
        seed_candidate=seed_candidate,
        train_cases=train_cases,
        val_cases=val_cases,
        dataset_path=args.dataset,
        data_dir=args.data_dir,
        provider_id=args.provider_id,
        provider_model=args.provider_model,
        judge_mode=args.judge_mode,
        judge_provider_id=args.judge_provider_id,
        judge_provider_model=args.judge_provider_model,
        judge_weight=args.judge_weight,
    )
    write_json(args.output_dir / "baseline.json", baseline_report)

    if args.baseline_only:
        print(json.dumps({"baseline": baseline_report}, indent=2))
        return

    optimize, EvaluationBatch = import_gepa_runtime()

    class ContentManagerGEPAAdapter:
        propose_new_texts = None

        def evaluate(
            self,
            batch: list[dict[str, Any]],
            candidate: dict[str, str],
            capture_traces: bool = False,
        ):
            candidate_text = candidate[CANDIDATE_COMPONENT]
            outputs: list[ContentManagerRolloutOutput] = []
            scores: list[float] = []
            trajectories: list[ContentManagerTrajectory] | None = [] if capture_traces else None

            for case in batch:
                score, _side_info, result = evaluate_candidate(
                    candidate_text=candidate_text,
                    example=case,
                    dataset_path=args.dataset,
                    data_dir=args.data_dir,
                    provider_id=args.provider_id,
                    provider_model=args.provider_model,
                    judge_mode=args.judge_mode,
                    judge_provider_id=args.judge_provider_id,
                    judge_provider_model=args.judge_provider_model,
                    judge_weight=args.judge_weight,
                )
                parsed = result.get("parsed", {})
                outputs.append(
                    ContentManagerRolloutOutput(
                        case_id=result.get("caseId", case["id"]),
                        score=score,
                        summary=parsed.get("summary"),
                        context_summary=parsed.get("contextSummary"),
                        artifact_paths=parsed.get("artifactPaths", []),
                        actual_changed_paths=result.get("actualChangedPaths", []),
                        provider=result.get("provider", {}),
                    )
                )
                scores.append(score)

                if capture_traces and trajectories is not None:
                    trajectories.append(
                        ContentManagerTrajectory(
                            case_id=result.get("caseId", case["id"]),
                            user_message=case.get("userMessage", ""),
                            mentioned_paths=case.get("mentionedPaths", []) or [],
                            required_phrases=case.get("requiredPhrases", []) or [],
                            plain_answer=truncate_text(
                                re.sub(r"```cab[a-z]*[\s\S]*$", "", result.get("output", ""), flags=re.I)
                            ),
                            parsed_summary=parsed.get("summary"),
                            parsed_context_summary=parsed.get("contextSummary"),
                            parsed_artifacts=parsed.get("artifactPaths", []),
                            actual_changed_paths=result.get("normalizedActualChangedPaths", [])
                            or result.get("actualChangedPaths", []),
                            component_scores=result.get("componentScores", {}),
                            matched_required_phrases=result.get("matchedRequiredPhrases", []),
                            missing_required_phrases=result.get("missingRequiredPhrases", []),
                            provider=result.get("provider", {}),
                            output_excerpt=truncate_text(result.get("output", "")),
                            error=result.get("error"),
                        )
                    )

            return EvaluationBatch(
                outputs=outputs,
                scores=scores,
                trajectories=trajectories,
            )

        def make_reflective_dataset(
            self,
            candidate: dict[str, str],
            eval_batch,
            components_to_update: list[str],
        ) -> dict[str, list[dict[str, Any]]]:
            traces = eval_batch.trajectories or []
            reflective_dataset: dict[str, list[dict[str, Any]]] = {}

            for component_name in components_to_update:
                reflective_dataset[component_name] = []
                for trace in traces:
                    reflective_dataset[component_name].append(
                        {
                            "Inputs": {
                                "case_id": trace.case_id,
                                "user_message": trace.user_message,
                                "mentioned_paths": trace.mentioned_paths,
                                "required_phrases": trace.required_phrases,
                            },
                            "Generated Outputs": {
                                "plain_answer": trace.plain_answer,
                                "cabinet_summary": trace.parsed_summary,
                                "cabinet_context": trace.parsed_context_summary,
                                "cabinet_artifacts": trace.parsed_artifacts,
                                "actual_changed_paths": trace.actual_changed_paths,
                                "provider": trace.provider,
                                "output_excerpt": trace.output_excerpt,
                            },
                            "Feedback": summarize_case_feedback(
                                {
                                    "id": trace.case_id,
                                    "requiredPhrases": trace.required_phrases,
                                },
                                {
                                    "score": next(
                                        (
                                            output.score
                                            for output in eval_batch.outputs
                                            if output.case_id == trace.case_id
                                        ),
                                        0.0,
                                    ),
                                    "componentScores": trace.component_scores,
                                    "matchedRequiredPhrases": trace.matched_required_phrases,
                                    "missingRequiredPhrases": trace.missing_required_phrases,
                                    "parsed": {
                                        "summary": trace.parsed_summary,
                                        "contextSummary": trace.parsed_context_summary,
                                        "artifactPaths": trace.parsed_artifacts,
                                    },
                                    "actualChangedPaths": trace.actual_changed_paths,
                                    "provider": trace.provider,
                                    "output": trace.output_excerpt,
                                    "error": trace.error,
                                },
                            ),
                        }
                    )

            return reflective_dataset

    optimize_kwargs: dict[str, Any] = {
        "seed_candidate": {CANDIDATE_COMPONENT: seed_candidate},
        "trainset": train_cases,
        "valset": val_cases or None,
        "adapter": ContentManagerGEPAAdapter(),
        "max_metric_calls": args.max_metric_calls,
        "module_selector": "all",
        "reflection_minibatch_size": min(
            max(args.reflection_minibatch_size, 1),
            len(train_cases),
        ),
        "run_dir": str(args.output_dir / "gepa-run"),
        "display_progress_bar": False,
    }
    if args.proposer == "codex-cli":
        optimize_kwargs["custom_candidate_proposer"] = build_codex_cli_proposer(
            codex_command=args.codex_command,
            codex_model=args.codex_model,
            timeout_seconds=args.codex_timeout_seconds,
        )
    else:
        optimize_kwargs["reflection_lm"] = args.reflection_lm

    try:
        result = optimize(**optimize_kwargs)
    except Exception as error:
        failure_report = {
            "status": "failed",
            "proposer": args.proposer,
            "reflection_lm": args.reflection_lm if args.proposer == "api" else None,
            "codex_command": args.codex_command if args.proposer == "codex-cli" else None,
            "codex_model": args.codex_model if args.proposer == "codex-cli" else None,
            "max_metric_calls": args.max_metric_calls,
        "baseline": baseline_report,
        "judge_mode": args.judge_mode,
        "judge_provider_id": args.judge_provider_id,
        "judge_provider_model": args.judge_provider_model,
        "judge_weight": args.judge_weight,
        "error": error.__class__.__name__,
        "message": str(error),
        }
        write_json(args.output_dir / "result.json", failure_report)
        print(json.dumps(failure_report, indent=2))
        raise SystemExit(1)

    best_candidate_dict = getattr(result, "best_candidate", {}) or {}
    best_candidate = str(best_candidate_dict.get(CANDIDATE_COMPONENT, seed_candidate))
    best_prompt_path = args.output_dir / "best-persona-body.md"
    best_prompt_path.write_text(best_candidate, encoding="utf-8")

    best_train = run_candidate_suite(
        best_candidate,
        train_cases,
        args.dataset,
        args.data_dir,
        args.provider_id,
        args.provider_model,
        args.judge_mode,
        args.judge_provider_id,
        args.judge_provider_model,
        args.judge_weight,
    )
    best_val = run_candidate_suite(
        best_candidate,
        val_cases,
        args.dataset,
        args.data_dir,
        args.provider_id,
        args.provider_model,
        args.judge_mode,
        args.judge_provider_id,
        args.judge_provider_model,
        args.judge_weight,
    )

    result_report = {
        "status": "completed",
        "proposer": args.proposer,
        "reflection_lm": args.reflection_lm if args.proposer == "api" else None,
        "codex_command": args.codex_command if args.proposer == "codex-cli" else None,
        "codex_model": args.codex_model if args.proposer == "codex-cli" else None,
        "max_metric_calls": args.max_metric_calls,
        "reflection_minibatch_size": min(max(args.reflection_minibatch_size, 1), len(train_cases)),
        "baseline": baseline_report,
        "judge_mode": args.judge_mode,
        "judge_provider_id": args.judge_provider_id,
        "judge_provider_model": args.judge_provider_model,
        "judge_weight": args.judge_weight,
        "best_candidate_path": str(best_prompt_path),
        "best_score": getattr(result, "best_score", None),
        "best_train_mean": mean_score(best_train),
        "best_val_mean": mean_score(best_val),
        "best_train": best_train,
        "best_val": best_val,
    }
    write_json(args.output_dir / "result.json", result_report)
    print(json.dumps(result_report, indent=2))


if __name__ == "__main__":
    main()
