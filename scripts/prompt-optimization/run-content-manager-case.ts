import fs from "fs/promises";
import path from "path";
import { buildManualConversationPrompt } from "@/lib/agents/conversation-runner";
import { parseCabinetBlock } from "@/lib/agents/conversation-store";
import {
  probeProviderSessionOptions,
  runOneShotProviderPrompt,
} from "@/lib/agents/provider-runtime";
import { getConfiguredProviderModel } from "@/lib/agents/provider-settings";
import { canonicalizeVirtualPagePath, DATA_DIR } from "@/lib/storage/path-utils";

interface ContentManagerEvalCase {
  id: string;
  split: "train" | "val";
  userMessage: string;
  mentionedPaths?: string[];
  requiredPhrases?: string[];
  timeoutMs?: number;
}

interface CaseRunResult {
  caseId: string;
  heuristicScore: number;
  score: number;
  componentScores: Record<string, number>;
  provider: {
    providerId: string;
    requestedModel?: string;
    effectiveModel?: string;
    availableModels: string[];
    fallbackReason?: string;
    probeError?: string;
  };
  judge: {
    mode: "heuristic" | "llm-acp";
    weight: number;
    score?: number;
    rationale?: string;
    strengths?: string[];
    weaknesses?: string[];
    rawOutput?: string;
    error?: string;
    provider?: ProviderExecutionPlan;
  };
  requiredPhrases: string[];
  matchedRequiredPhrases: string[];
  missingRequiredPhrases: string[];
  parsed: {
    summary?: string;
    contextSummary?: string;
    artifactPaths: string[];
  };
  actualChangedPaths: string[];
  normalizedActualChangedPaths: string[];
  output: string;
}

const PROJECT_DATA_DIR = path.resolve(process.cwd(), "data");

interface ProviderExecutionPlan {
  providerId: string;
  requestedModel?: string;
  effectiveModel?: string;
  availableModels: string[];
  fallbackReason?: string;
  probeError?: string;
}

interface JudgePayload {
  score: number;
  rationale?: string;
  strengths?: string[];
  weaknesses?: string[];
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = next;
    index += 1;
  }

  return parsed;
}

function usage(): string {
  return [
    "Usage:",
    "  npx tsx scripts/prompt-optimization/run-content-manager-case.ts \\",
    "    --dataset scripts/prompt-optimization/content-manager-cases.jsonl \\",
    "    --case-id next-blog-post \\",
    "    --candidate-file /tmp/content-manager-prompt.txt \\",
    "    --judge-mode llm-acp",
    "",
    "Safety:",
    "  Set CABINET_DATA_DIR to a disposable copy of data/ before running.",
    "  Pass --allow-live-data if you intentionally want to run against the live KB.",
  ].join("\n");
}

async function loadCases(datasetPath: string): Promise<ContentManagerEvalCase[]> {
  const raw = await fs.readFile(datasetPath, "utf8");
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ContentManagerEvalCase);
}

async function collectMarkdownState(
  rootDir: string,
  relativeDir = ""
): Promise<Map<string, string>> {
  const currentDir = relativeDir ? path.join(rootDir, relativeDir) : rootDir;
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  const state = new Map<string, string>();

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;

    const relativePath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
    if (entry.isDirectory()) {
      const nested = await collectMarkdownState(rootDir, relativePath);
      for (const [key, value] of nested) {
        state.set(key, value);
      }
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const absolutePath = path.join(rootDir, relativePath);
    state.set(relativePath, await fs.readFile(absolutePath, "utf8"));
  }

  return state;
}

function getChangedMarkdownPaths(
  before: Map<string, string>,
  after: Map<string, string>
): string[] {
  const changed = new Set<string>();

  for (const [filePath, content] of before) {
    if (!after.has(filePath) || after.get(filePath) !== content) {
      changed.add(filePath);
    }
  }

  for (const filePath of after.keys()) {
    if (!before.has(filePath)) {
      changed.add(filePath);
    }
  }

  return Array.from(changed).sort();
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function extractPlainAnswer(output: string): string {
  const cabinetMatch = output.match(/([\s\S]*?)```cab[a-z]*[\s\S]*$/i);
  return (cabinetMatch ? cabinetMatch[1] : output).trim();
}

function scoreKeywordCoverage(text: string, requiredPhrases: string[]): {
  score: number;
  matched: string[];
  missing: string[];
} {
  if (requiredPhrases.length === 0) {
    return { score: 1, matched: [], missing: [] };
  }

  const normalized = normalizeText(text);
  const matched = requiredPhrases.filter((phrase) => normalized.includes(normalizeText(phrase)));
  const missing = requiredPhrases.filter((phrase) => !matched.includes(phrase));

  return {
    score: matched.length / requiredPhrases.length,
    matched,
    missing,
  };
}

function scoreArtifacts(parsedArtifacts: string[], actualChangedPaths: string[]): number {
  const parsed = new Set(parsedArtifacts.map((entry) => canonicalizeVirtualPagePath(entry)));
  const actual = new Set(actualChangedPaths.map((entry) => canonicalizeVirtualPagePath(entry)));

  if (parsed.size === 0 && actual.size === 0) {
    return 1;
  }

  if (parsed.size === 0 || actual.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const artifactPath of parsed) {
    if (actual.has(artifactPath)) {
      overlap += 1;
    }
  }

  return (2 * overlap) / (parsed.size + actual.size);
}

function scoreCabinetBlock(
  output: string,
  summary?: string,
  artifactPaths: string[] = []
): number {
  const hasFence = /```cab[a-z]*/i.test(output);
  const hasSummary = Boolean(summary);

  if (hasFence && hasSummary) {
    return 1;
  }

  if (hasSummary || artifactPaths.length > 0) {
    return 0.6;
  }

  return 0;
}

function scoreAnswerPresence(answer: string): number {
  if (answer.length >= 80) return 1;
  if (answer.length >= 30) return 0.6;
  return 0;
}

function clampScore(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  const lines = trimmed.split("\n");
  if (lines[0]?.startsWith("```")) {
    lines.shift();
  }
  if (lines[lines.length - 1]?.trim() === "```") {
    lines.pop();
  }
  return lines.join("\n").trim();
}

function buildJudgePrompt(input: {
  userMessage: string;
  requiredPhrases: string[];
  plainAnswer: string;
  summary?: string;
  contextSummary?: string;
  artifactPaths: string[];
  actualChangedPaths: string[];
  heuristicScore: number;
  componentScores: Record<string, number>;
  output: string;
}): string {
  return [
    "You are grading a Cabinet content-manager run for prompt optimization.",
    "Return JSON only with this exact shape:",
    '{"score": 0.0, "rationale": "short explanation", "strengths": ["..."], "weaknesses": ["..."]}',
    "",
    "Scoring rules:",
    "- score must be between 0 and 1.",
    "- reward a direct plain-English answer before the cabinet block.",
    "- reward selecting the expected recommendation when the response supports it.",
    "- penalize placeholders, malformed cabinet metadata, or unsupported artifact claims.",
    "- treat ACTUAL_CHANGED_PATHS as the source of truth for what the agent really edited.",
    "- keep rationale concise and specific.",
    "",
    `USER_REQUEST: ${input.userMessage}`,
    `REQUIRED_PHRASES: ${JSON.stringify(input.requiredPhrases)}`,
    `HEURISTIC_SCORE: ${input.heuristicScore}`,
    `HEURISTIC_COMPONENT_SCORES: ${JSON.stringify(input.componentScores)}`,
    `PLAIN_ANSWER: ${JSON.stringify(input.plainAnswer)}`,
    `CABINET_SUMMARY: ${JSON.stringify(input.summary || "")}`,
    `CABINET_CONTEXT: ${JSON.stringify(input.contextSummary || "")}`,
    `CABINET_ARTIFACTS: ${JSON.stringify(input.artifactPaths)}`,
    `ACTUAL_CHANGED_PATHS: ${JSON.stringify(input.actualChangedPaths)}`,
    `FULL_OUTPUT: ${JSON.stringify(input.output)}`,
  ].join("\n");
}

function parseJudgePayload(rawOutput: string): JudgePayload {
  const cleaned = stripCodeFences(rawOutput);
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;
  return {
    score: clampScore(parsed.score),
    rationale: typeof parsed.rationale === "string" ? parsed.rationale.trim() : undefined,
    strengths: Array.isArray(parsed.strengths)
      ? parsed.strengths.filter((entry): entry is string => typeof entry === "string")
      : [],
    weaknesses: Array.isArray(parsed.weaknesses)
      ? parsed.weaknesses.filter((entry): entry is string => typeof entry === "string")
      : [],
  };
}

function isRetryableProviderError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /ACP connection closed|session .*closed|ECONNRESET|broken pipe/i.test(message);
}

async function runProviderPromptWithRetry(
  input: Parameters<typeof runOneShotProviderPrompt>[0],
  maxAttempts = 2
): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await runOneShotProviderPrompt(input);
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isRetryableProviderError(error)) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000 * attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function pickFallbackModel(options: string[], currentModelId?: string): string | undefined {
  if (options.length === 0) return undefined;
  if (options.includes("default")) return "default";
  if (currentModelId && options.includes(currentModelId)) return currentModelId;
  return options[0];
}

async function buildProviderExecutionPlan(input: {
  providerId: string;
  requestedModel?: string;
  cwd: string;
  allowedRoots?: string[];
}): Promise<ProviderExecutionPlan> {
  try {
    const probe = await probeProviderSessionOptions({
      providerId: input.providerId,
      cwd: input.cwd,
      allowedRoots: input.allowedRoots,
    });
    const availableModels = probe.modelMetadata?.options.map((option) => option.id) || [];
    const currentModelId = probe.modelMetadata?.currentModelId;
    const requestedModel = input.requestedModel?.trim();

    if (!requestedModel || availableModels.length === 0 || availableModels.includes(requestedModel)) {
      return {
        providerId: input.providerId,
        requestedModel,
        effectiveModel: requestedModel,
        availableModels,
      };
    }

    const fallbackModel = pickFallbackModel(availableModels, currentModelId);
    return {
      providerId: input.providerId,
      requestedModel,
      effectiveModel: fallbackModel,
      availableModels,
      fallbackReason: fallbackModel
        ? `Requested model "${requestedModel}" is not available from ${input.providerId}; falling back to "${fallbackModel}".`
        : `Requested model "${requestedModel}" is not available from ${input.providerId}; running with the adapter default.`,
    };
  } catch (error) {
    return {
      providerId: input.providerId,
      requestedModel: input.requestedModel?.trim(),
      effectiveModel: input.requestedModel?.trim(),
      availableModels: [],
      probeError: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const datasetPath = typeof args.dataset === "string" ? path.resolve(String(args.dataset)) : "";
  const caseId = typeof args["case-id"] === "string" ? String(args["case-id"]) : "";
  const candidateFile =
    typeof args["candidate-file"] === "string" ? path.resolve(String(args["candidate-file"])) : "";
  const allowLiveData = args["allow-live-data"] === true;
  const providerIdOverride =
    typeof args["provider-id"] === "string" ? String(args["provider-id"]).trim() : undefined;
  const providerModelOverride =
    typeof args["provider-model"] === "string" ? String(args["provider-model"]).trim() : undefined;
  const judgeMode =
    args["judge-mode"] === "llm-acp" ? "llm-acp" : "heuristic";
  const judgeProviderIdOverride =
    typeof args["judge-provider-id"] === "string"
      ? String(args["judge-provider-id"]).trim()
      : undefined;
  const judgeProviderModelOverride =
    typeof args["judge-provider-model"] === "string"
      ? String(args["judge-provider-model"]).trim()
      : undefined;
  const judgeWeight =
    typeof args["judge-weight"] === "string"
      ? clampScore(Number(args["judge-weight"]))
      : 0.4;

  if (!datasetPath || !caseId || !candidateFile) {
    throw new Error(usage());
  }

  if (!allowLiveData && path.resolve(DATA_DIR) === PROJECT_DATA_DIR) {
    throw new Error(
      `Refusing to run against live data at ${PROJECT_DATA_DIR}. Set CABINET_DATA_DIR to a disposable copy or pass --allow-live-data.`
    );
  }

  const cases = await loadCases(datasetPath);
  const evalCase = cases.find((entry) => entry.id === caseId);
  if (!evalCase) {
    throw new Error(`Case not found: ${caseId}`);
  }

  const candidateBody = (await fs.readFile(candidateFile, "utf8")).trim();
  const beforeState = await collectMarkdownState(DATA_DIR);

  const conversation = await buildManualConversationPrompt({
    agentSlug: "content-manager",
    userMessage: evalCase.userMessage,
    mentionedPaths: evalCase.mentionedPaths || [],
    personaOverride: {
      body: candidateBody,
      ...(providerIdOverride ? { provider: providerIdOverride } : {}),
      ...(providerModelOverride ? { providerModel: providerModelOverride } : {}),
    },
  });
  const providerId = providerIdOverride || conversation.providerId;
  const requestedModel =
    providerModelOverride ||
    conversation.providerModel ||
    getConfiguredProviderModel(providerId);
  const providerPlan = await buildProviderExecutionPlan({
    providerId,
    requestedModel,
    cwd: conversation.cwd || DATA_DIR,
    allowedRoots: conversation.allowedRoots,
  });

  const output = await runProviderPromptWithRetry({
    providerId,
    providerModel: providerPlan.effectiveModel,
    prompt: conversation.prompt,
    cwd: conversation.cwd || DATA_DIR,
    allowedRoots: conversation.allowedRoots,
    timeoutMs: evalCase.timeoutMs || 120_000,
  });

  const afterState = await collectMarkdownState(DATA_DIR);
  const actualChangedPaths = getChangedMarkdownPaths(beforeState, afterState);
  const normalizedActualChangedPaths = actualChangedPaths.map((entry) =>
    canonicalizeVirtualPagePath(entry)
  );
  const parsed = parseCabinetBlock(output, conversation.prompt);
  const plainAnswer = extractPlainAnswer(output);
  const keywordScore = scoreKeywordCoverage(
    [plainAnswer, parsed.summary || "", parsed.contextSummary || ""].join("\n"),
    evalCase.requiredPhrases || []
  );
  const componentScores = {
    cabinetBlock: scoreCabinetBlock(output, parsed.summary, parsed.artifactPaths),
    answerPresence: scoreAnswerPresence(plainAnswer),
    keywordCoverage: keywordScore.score,
    artifactConsistency: scoreArtifacts(parsed.artifactPaths, actualChangedPaths),
  };
  const heuristicScore =
    componentScores.cabinetBlock * 0.2 +
    componentScores.answerPresence * 0.2 +
    componentScores.keywordCoverage * 0.3 +
    componentScores.artifactConsistency * 0.3;
  let judge: CaseRunResult["judge"] = {
    mode: judgeMode,
    weight: judgeWeight,
  };
  let score = heuristicScore;

  if (judgeMode === "llm-acp") {
    const judgeProviderId = judgeProviderIdOverride || providerId;
    const judgeRequestedModel =
      judgeProviderModelOverride || getConfiguredProviderModel(judgeProviderId);
    const judgeProviderPlan = await buildProviderExecutionPlan({
      providerId: judgeProviderId,
      requestedModel: judgeRequestedModel,
      cwd: conversation.cwd || DATA_DIR,
      allowedRoots: conversation.allowedRoots,
    });
    const judgePrompt = buildJudgePrompt({
      userMessage: evalCase.userMessage,
      requiredPhrases: evalCase.requiredPhrases || [],
      plainAnswer,
      summary: parsed.summary,
      contextSummary: parsed.contextSummary,
      artifactPaths: parsed.artifactPaths,
      actualChangedPaths: normalizedActualChangedPaths,
      heuristicScore,
      componentScores,
      output,
    });

    try {
      const judgeOutput = await runProviderPromptWithRetry({
        providerId: judgeProviderId,
        providerModel: judgeProviderPlan.effectiveModel,
        prompt: judgePrompt,
        cwd: conversation.cwd || DATA_DIR,
        allowedRoots: conversation.allowedRoots,
        timeoutMs: Math.max(evalCase.timeoutMs || 120_000, 90_000),
      });
      const judgePayload = parseJudgePayload(judgeOutput);
      judge = {
        mode: judgeMode,
        weight: judgeWeight,
        score: judgePayload.score,
        rationale: judgePayload.rationale,
        strengths: judgePayload.strengths,
        weaknesses: judgePayload.weaknesses,
        rawOutput: judgeOutput,
        provider: judgeProviderPlan,
      };
      score = heuristicScore * (1 - judgeWeight) + judgePayload.score * judgeWeight;
    } catch (error) {
      judge = {
        mode: judgeMode,
        weight: judgeWeight,
        error: error instanceof Error ? error.message : String(error),
        provider: judgeProviderPlan,
      };
    }
  }

  const result: CaseRunResult = {
    caseId: evalCase.id,
    heuristicScore,
    score,
    componentScores,
    provider: providerPlan,
    judge,
    requiredPhrases: evalCase.requiredPhrases || [],
    matchedRequiredPhrases: keywordScore.matched,
    missingRequiredPhrases: keywordScore.missing,
    parsed,
    actualChangedPaths,
    normalizedActualChangedPaths,
    output,
  };

  console.log(JSON.stringify(result, null, 2));
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
