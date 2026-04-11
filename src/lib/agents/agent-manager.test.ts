import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  getSession,
  installAgentRunStarterForTests,
  resetAgentManagerForTests,
  runAgent,
  stopAgent,
} from "./agent-manager";
import type { ProviderPromptRun } from "./provider-runtime";
import { DATA_DIR } from "../storage/path-utils";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await new Promise<void>((resolve) => setImmediate(resolve));
}

test("stopAgent cancels an in-flight run and preserves the stopped state", async (t) => {
  resetAgentManagerForTests();
  t.after(() => resetAgentManagerForTests());

  const deferred = createDeferred<string>();
  let cancelCalls = 0;

  installAgentRunStarterForTests((): ProviderPromptRun => ({
    result: deferred.promise,
    cancel() {
      cancelCalls += 1;
    },
  }));

  const id = await runAgent("Manual agent run", "Say hello");

  assert.equal(stopAgent(id), true);
  assert.equal(cancelCalls, 1);

  const stoppedSession = getSession(id);
  assert.equal(stoppedSession?.status, "failed");
  assert.ok(stoppedSession?.completedAt);

  deferred.resolve("late success");
  await flushMicrotasks();

  const sessionAfterLateCompletion = getSession(id);
  assert.equal(sessionAfterLateCompletion?.status, "failed");
  assert.equal(sessionAfterLateCompletion?.output, "");
});

test("runAgent marks a session completed when the run resolves normally", async (t) => {
  resetAgentManagerForTests();
  t.after(() => resetAgentManagerForTests());

  installAgentRunStarterForTests((): ProviderPromptRun => ({
    result: Promise.resolve("done"),
    cancel() {},
  }));

  const id = await runAgent("Manual agent run", "Say hello");
  await flushMicrotasks();

  const session = getSession(id);
  assert.equal(session?.status, "completed");
  assert.equal(session?.output, "done");
  assert.ok(session?.completedAt);
});

test("runAgent passes validated workdir inside Cabinet data", async (t) => {
  resetAgentManagerForTests();
  t.after(() => resetAgentManagerForTests());

  let capturedCwd = "";
  installAgentRunStarterForTests((input): ProviderPromptRun => {
    capturedCwd = input.cwd;
    return {
      result: Promise.resolve("done"),
      cancel() {},
    };
  });

  await runAgent("Manual agent run", "Say hello", undefined, "team/research");

  assert.equal(capturedCwd, path.join(DATA_DIR, "team", "research"));
});

test("runAgent treats /data workdirs as Cabinet data relative paths", async (t) => {
  resetAgentManagerForTests();
  t.after(() => resetAgentManagerForTests());

  let capturedCwd = "";
  installAgentRunStarterForTests((input): ProviderPromptRun => {
    capturedCwd = input.cwd;
    return {
      result: Promise.resolve("done"),
      cancel() {},
    };
  });

  await runAgent("Manual agent run", "Say hello", undefined, "/data/team/research");

  assert.equal(capturedCwd, path.join(DATA_DIR, "team", "research"));
});

test("runAgent treats /data as the Cabinet data root", async (t) => {
  resetAgentManagerForTests();
  t.after(() => resetAgentManagerForTests());

  let capturedCwd = "";
  installAgentRunStarterForTests((input): ProviderPromptRun => {
    capturedCwd = input.cwd;
    return {
      result: Promise.resolve("done"),
      cancel() {},
    };
  });

  await runAgent("Manual agent run", "Say hello", undefined, "/data");

  assert.equal(capturedCwd, path.resolve(DATA_DIR));
});

test("runAgent rejects absolute workdirs outside Cabinet data before starting provider", async (t) => {
  resetAgentManagerForTests();
  t.after(() => resetAgentManagerForTests());

  let startCalls = 0;
  installAgentRunStarterForTests((): ProviderPromptRun => {
    startCalls += 1;
    return {
      result: Promise.resolve("unexpected"),
      cancel() {},
    };
  });

  await assert.rejects(
    runAgent("Manual agent run", "Say hello", undefined, "/tmp/outside"),
    /Workdir must stay inside Cabinet data/
  );
  assert.equal(startCalls, 0);
});

test("runAgent rejects workdir traversal outside Cabinet data before starting provider", async (t) => {
  resetAgentManagerForTests();
  t.after(() => resetAgentManagerForTests());

  let startCalls = 0;
  installAgentRunStarterForTests((): ProviderPromptRun => {
    startCalls += 1;
    return {
      result: Promise.resolve("unexpected"),
      cancel() {},
    };
  });

  await assert.rejects(
    runAgent("Manual agent run", "Say hello", undefined, "../outside"),
    /Workdir must stay inside Cabinet data/
  );
  assert.equal(startCalls, 0);
});
