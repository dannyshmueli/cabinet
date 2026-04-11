import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import type { AgentProvider } from "./provider-interface";
import {
  checkAcpProviderHealth,
  normalizeAcpSessionModelMetadata,
  normalizeAllowedRoots,
} from "./acp-runtime";
import type * as schema from "@agentclientprotocol/sdk/dist/schema/types.gen";
import { DATA_DIR } from "../storage/path-utils";

test("normalizeAcpSessionModelMetadata prefers stable configOptions over unstable models", () => {
  const configOptions = [
    {
      id: "model",
      name: "Model",
      type: "select",
      category: "model",
      currentValue: "gpt-5.4",
      options: [
        {
          value: "gpt-5.4",
          name: "GPT-5.4",
          description: "Default model",
        },
      ],
    },
  ] satisfies schema.SessionConfigOption[];
  const models = {
    currentModelId: "ignored",
    availableModels: [
      {
        modelId: "ignored",
        name: "Ignored",
        description: "Should not win",
      },
    ],
  } satisfies schema.SessionModelState;

  const normalized = normalizeAcpSessionModelMetadata({ configOptions, models });

  assert.deepEqual(normalized, {
    currentModelId: "gpt-5.4",
    options: [
      {
        id: "gpt-5.4",
        name: "GPT-5.4",
        description: "Default model",
      },
    ],
    source: "configOptions",
  });
});

test("normalizeAcpSessionModelMetadata falls back to unstable models when configOptions are absent", () => {
  const normalized = normalizeAcpSessionModelMetadata({
    models: {
      currentModelId: "opus",
      availableModels: [
        {
          modelId: "default",
          name: "Default",
          description: "Recommended",
        },
        {
          modelId: "opus",
          name: "Opus",
          description: "Most capable",
        },
      ],
    },
  });

  assert.deepEqual(normalized, {
    currentModelId: "opus",
    options: [
      {
        id: "default",
        name: "Default",
        description: "Recommended",
      },
      {
        id: "opus",
        name: "Opus",
        description: "Most capable",
      },
    ],
    source: "models",
  });
});

test("normalizeAllowedRoots drops roots outside Cabinet data", () => {
  const dataRoot = path.resolve(DATA_DIR);
  const cwd = path.join(dataRoot, "team");
  const outsideSibling = path.join(path.dirname(dataRoot), `${path.basename(dataRoot)}-outside`);

  const roots = normalizeAllowedRoots(cwd, [
    path.join(cwd, "nested"),
    outsideSibling,
  ]);

  assert.deepEqual(roots, [cwd]);
});

test("normalizeAllowedRoots intersects ancestor roots to Cabinet data root", () => {
  const dataRoot = path.resolve(DATA_DIR);
  const repoRoot = path.dirname(dataRoot);

  const roots = normalizeAllowedRoots(repoRoot, [
    path.join(dataRoot, "nested"),
  ]);

  assert.deepEqual(roots, [dataRoot]);
});

test("checkAcpProviderHealth reports unauthenticated when initialize succeeds but newSession requires auth", async () => {
  const provider: AgentProvider = {
    id: "test-auth-required-provider",
    name: "Auth Required Test Provider",
    type: "cli",
    runtime: "acp",
    adapterKind: "adapter",
    icon: "bot",
    command: process.execPath,
    commandCandidates: [process.execPath],
    commandArgs: [path.join(process.cwd(), "test", "fixtures", "acp-auth-required-agent.mjs")],
    async isAvailable() {
      return true;
    },
    async healthCheck() {
      throw new Error("unused");
    },
  };

  const status = await checkAcpProviderHealth(provider);

  assert.equal(status.available, true);
  assert.equal(status.authenticated, false);
  assert.match(status.error || "", /requires authentication/i);
});

test("checkAcpProviderHealth reports spawn failures without uncaught process errors", async () => {
  const missingCommand = path.join(process.cwd(), "node_modules", ".bin", "missing-acp-adapter");
  const provider: AgentProvider = {
    id: "test-missing-acp-provider",
    name: "Missing ACP Test Provider",
    type: "cli",
    runtime: "acp",
    adapterKind: "adapter",
    icon: "bot",
    installMessage: "Install the missing ACP adapter",
    command: missingCommand,
    commandCandidates: [missingCommand],
    async isAvailable() {
      return true;
    },
    async healthCheck() {
      throw new Error("unused");
    },
  };

  const status = await checkAcpProviderHealth(provider);

  assert.equal(status.available, false);
  assert.equal(status.authenticated, false);
  assert.match(status.error || "", /Install the missing ACP adapter/);
  assert.match(status.error || "", /ENOENT/);
});
