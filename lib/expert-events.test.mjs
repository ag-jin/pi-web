import assert from "node:assert/strict";
import test from "node:test";

async function loadSubject() {
  return import("./expert-events.ts");
}

function assistantMsg(content, timestamp = 1000) {
  return { role: "assistant", id: `a${timestamp}`, content, timestamp };
}

function toolCall(toolCallId, toolName, input) {
  return { type: "toolCall", toolCallId, toolName, input };
}

function toolResult(toolCallId, text, isError = false, timestamp = 2000) {
  return {
    role: "toolResult",
    toolCallId,
    content: [{ type: "text", text }],
    isError,
    timestamp,
  };
}

test("parses spawn/send/consult calls into turns per agent", async () => {
  const { parseExpertEvents } = await loadSubject();
  const messages = [
    assistantMsg([
      toolCall("c1", "subagent_spawn", { agent: "scout", task: "recon" }),
      toolCall("c2", "subagent_consult", { agent: "flow-router", task: "route this" }),
    ]),
    toolResult("c1", "done recon"),
    toolResult("c2", "route: implement"),
  ];

  const map = parseExpertEvents(messages);
  assert.equal(map.size, 2);
  const scout = map.get("scout");
  assert.ok(scout);
  assert.equal(scout.turns.length, 1);
  assert.equal(scout.turns[0].status, "done");
  assert.equal(scout.turns[0].output, "done recon");
  const router = map.get("flow-router");
  assert.equal(router.turns[0].task, "route this");
  assert.equal(router.turns[0].status, "done");
});

test("running turn has no result and stays running", async () => {
  const { parseExpertEvents } = await loadSubject();
  const messages = [assistantMsg([toolCall("c1", "subagent_spawn", { agent: "implementer", task: "write code" })])];
  const map = parseExpertEvents(messages);
  const turn = map.get("implementer").turns[0];
  assert.equal(turn.status, "running");
  assert.equal(turn.completedAt, undefined);
});

test("failed result marks turn as failed with error output", async () => {
  const { parseExpertEvents } = await loadSubject();
  const messages = [
    assistantMsg([toolCall("c1", "subagent_spawn", { agent: "bug-hunter", task: "find bug" })]),
    toolResult("c1", "failed: no repro", true),
  ];
  const map = parseExpertEvents(messages);
  assert.equal(map.get("bug-hunter").turns[0].status, "failed");
});

test("management tools become small events, not turns", async () => {
  const { parseExpertEvents } = await loadSubject();
  const messages = [
    assistantMsg([
      toolCall("c1", "subagent_manage", { action: "list", agentId: "implementer" }),
      toolCall("c2", "subagent_mailbox", { action: "read", agentId: "implementer" }),
    ]),
  ];
  const map = parseExpertEvents(messages);
  const record = map.get("implementer");
  assert.ok(record);
  assert.equal(record.turns.length, 0);
  assert.equal(record.management.length, 2);
});

test("agentId fallback and unknown agent", async () => {
  const { parseExpertEvents } = await loadSubject();
  const messages = [
    assistantMsg([toolCall("c1", "subagent_send", { agentId: "reviewer", task: "review" })]),
    assistantMsg([toolCall("c2", "subagent_spawn", { task: "no agent field" })]),
  ];
  const map = parseExpertEvents(messages);
  assert.ok(map.has("reviewer"));
  assert.ok(map.has("unknown"));
});

test("participatedExperts returns first-seen order", async () => {
  const { parseExpertEvents, participatedExperts } = await loadSubject();
  const messages = [
    assistantMsg([toolCall("c1", "subagent_spawn", { agent: "b", task: "x" })], 2000),
    assistantMsg([toolCall("c2", "subagent_spawn", { agent: "a", task: "y" })], 1000),
  ];
  const map = parseExpertEvents(messages);
  assert.deepEqual(participatedExperts(map), ["a", "b"]);
});

test("latestExpertStatus reflects the newest turn", async () => {
  const { parseExpertEvents, latestExpertStatus } = await loadSubject();
  const messages = [
    assistantMsg([
      toolCall("c1", "subagent_spawn", { agent: "a", task: "t1" }),
      toolCall("c2", "subagent_spawn", { agent: "a", task: "t2" }),
    ]),
    toolResult("c1", "ok", false),
  ];
  const map = parseExpertEvents(messages);
  assert.equal(latestExpertStatus(map.get("a")), "running");
  assert.equal(latestExpertStatus(undefined), "done");
});

test("truncates oversized turn output", async () => {
  const { parseExpertEvents } = await loadSubject();
  const big = "x".repeat(5000);
  const messages = [
    assistantMsg([toolCall("c1", "subagent_spawn", { agent: "a", task: "t" })]),
    toolResult("c1", big),
  ];
  const map = parseExpertEvents(messages);
  const output = map.get("a").turns[0].output;
  assert.ok(output.length < 4100);
  assert.ok(output.endsWith("(截断)"));
});
