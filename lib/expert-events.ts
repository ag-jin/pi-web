/**
 * Expert event parsing for the in-session expert team view (tickets 12-14).
 *
 * The main agent calls specialist subagents through the pi-subagents tools
 * (subagent_spawn / subagent_send / subagent_consult / subagent_manage /
 * subagent_mailbox / subagent_inspect). Those tool calls and their results
 * already live in the session message stream, so no extra data channel is
 * needed: we derive "expert events" purely from the messages array.
 *
 * Semantics:
 * - A "turn" is one spawn/send/consult call: from its tool_call to its paired
 *   tool_result. Status: running (no result yet), done, failed (result isError).
 * - Management calls (manage/mailbox/inspect) become small per-expert events,
 *   not standalone turns.
 */

import type { AgentMessage, AssistantMessage, ToolCallContent, ToolResultMessage } from "./types";

/** Tool names that count as expert turns (a full task invocation). */
const TURN_TOOLS = new Set(["subagent_spawn", "subagent_send", "subagent_consult"]);

/** Tool names that are management events attached to an expert. */
const MANAGEMENT_TOOLS = new Set([
  "subagent_manage",
  "subagent_mailbox",
  "subagent_inspect",
  "subagent",
]);

export type ExpertTurnStatus = "running" | "done" | "failed";

export interface ExpertTurn {
  toolCallId: string;
  toolName: "subagent_spawn" | "subagent_send" | "subagent_consult";
  agent: string;
  task: string;
  startedAt: number;
  completedAt?: number;
  status: ExpertTurnStatus;
  output?: string;
}

export interface ExpertManagementEvent {
  toolCallId: string;
  toolName: string;
  agent: string;
  detail: string;
  timestamp: number;
}

export interface ExpertRecord {
  turns: ExpertTurn[];
  management: ExpertManagementEvent[];
  firstSeenAt: number;
}

export type ExpertEventMap = Map<string, ExpertRecord>;

/** Cap on the tool-result text kept per turn. */
const MAX_TURN_OUTPUT = 4000;

const SUBAGENT_TOOL_RE = /^subagent(_|\b)/;

function isTurnTool(name: string): name is ExpertTurn["toolName"] {
  return TURN_TOOLS.has(name);
}

function textFromResultContent(content: ToolResultMessage["content"]): string {
  const text = content
    .filter((block) => block.type === "text")
    .map((block) => (block as { text?: string }).text ?? "")
    .join("\n");
  return text.length > MAX_TURN_OUTPUT ? `${text.slice(0, MAX_TURN_OUTPUT)}…(截断)` : text;
}

function agentFromInput(input: Record<string, unknown>, toolName: string): string {
  const agent = typeof input.agent === "string" ? input.agent : undefined;
  if (agent) return agent;
  const agentId = typeof input.agentId === "string" ? input.agentId : undefined;
  if (agentId) return agentId;
  // Legacy "subagent" tool wraps tasks in an array without a single agent name.
  return toolName === "subagent" ? "subagent" : "unknown";
}

function taskFromInput(input: Record<string, unknown>, toolName: string): string {
  const task = typeof input.task === "string" ? input.task : undefined;
  if (task) return task;
  const tasks = input.tasks;
  if (Array.isArray(tasks) && tasks.length > 0) {
    const first = tasks[0] as { agent?: unknown; task?: unknown };
    const t = typeof first?.task === "string" ? first.task : "";
    const a = typeof first?.agent === "string" ? first.agent : "";
    return t || (a ? `spawn ${a}` : toolName);
  }
  const action = typeof input.action === "string" ? input.action : undefined;
  if (action) return action;
  return toolName;
}

function detailFromInput(input: Record<string, unknown>, toolName: string): string {
  const action = typeof input.action === "string" ? input.action : undefined;
  const parts: string[] = [];
  if (action) parts.push(action);
  if (toolName === "subagent_mailbox" && input.action === "read") parts.push("读取未读消息");
  return parts.length > 0 ? parts.join(" ") : toolName;
}

/**
 * Parse the session message stream into per-expert records.
 * Tool calls are read from assistant messages; results are matched by
 * toolCallId from toolResult messages.
 */
export function parseExpertEvents(messages: readonly AgentMessage[]): ExpertEventMap {
  const map: ExpertEventMap = new Map();

  const ensureRecord = (agent: string, timestamp: number): ExpertRecord => {
    let record = map.get(agent);
    if (!record) {
      record = { turns: [], management: [], firstSeenAt: timestamp };
      map.set(agent, record);
    }
    return record;
  };

  // First pass: tool calls (turns + management events).
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    const assistant = msg as AssistantMessage;
    const timestamp = (assistant as AgentMessage & { timestamp?: number }).timestamp ?? Date.now();
    for (const block of assistant.content) {
      if (block.type !== "toolCall") continue;
      const toolCall = block as ToolCallContent;
      const name = toolCall.toolName;
      if (!SUBAGENT_TOOL_RE.test(name)) continue;
      const input = toolCall.input ?? {};
      const agent = agentFromInput(input, name);
      const record = ensureRecord(agent, timestamp);

      if (isTurnTool(name)) {
        record.turns.push({
          toolCallId: toolCall.toolCallId,
          toolName: name,
          agent,
          task: taskFromInput(input, name),
          startedAt: timestamp,
          status: "running",
        });
      } else if (MANAGEMENT_TOOLS.has(name)) {
        record.management.push({
          toolCallId: toolCall.toolCallId,
          toolName: name,
          agent,
          detail: detailFromInput(input, name),
          timestamp,
        });
      }
    }
  }

  // Second pass: pair results with turns (by toolCallId).
  const resultById = new Map<string, ToolResultMessage>();
  for (const msg of messages) {
    if (msg.role !== "toolResult") continue;
    resultById.set((msg as ToolResultMessage).toolCallId, msg as ToolResultMessage);
  }

  for (const record of map.values()) {
    for (const turn of record.turns) {
      const result = resultById.get(turn.toolCallId);
      if (!result) continue;
      turn.completedAt = (result as AgentMessage & { timestamp?: number }).timestamp ?? Date.now();
      turn.status = result.isError ? "failed" : "done";
      turn.output = textFromResultContent(result.content);
    }
  }

  return map;
}

/** Participated experts in first-seen order (for the horizontal strip). */
export function participatedExperts(map: ExpertEventMap): string[] {
  return [...map.entries()]
    .sort((a, b) => a[1].firstSeenAt - b[1].firstSeenAt)
    .map(([agent]) => agent);
}

/** Latest status of an expert record, used for the strip status dot. */
export function latestExpertStatus(record: ExpertRecord | undefined): ExpertTurnStatus {
  if (!record || record.turns.length === 0) return "done";
  const last = record.turns[record.turns.length - 1];
  return last.status;
}
