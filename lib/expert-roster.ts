/**
 * Expert roster for the in-session expert selector (ChatInput).
 * Mirrors the project-level expert team in `.pi/agents/` so the UI can offer
 * teams and single experts without a filesystem read.
 */

export interface ExpertRosterEntry {
  /** Agent file name (also the `agent` argument used by subagent tools). */
  name: string;
  /** Short Chinese label shown in the picker. */
  label: string;
}

export const EXPERT_ROSTER: readonly ExpertRosterEntry[] = [
  { name: "flow-router", label: "流程判定" },
  { name: "griller", label: "需求访谈" },
  { name: "spec-writer", label: "规格编写" },
  { name: "ticket-splitter", label: "拆票" },
  { name: "implementer", label: "实现" },
  { name: "spec-reviewer", label: "规格审查" },
  { name: "reviewer-terra", label: "Terra 审查" },
  { name: "bug-hunter", label: "排障" },
  { name: "researcher", label: "调研" },
  { name: "triager", label: "分诊" },
  { name: "handoff-writer", label: "交接" },
  { name: "domain-modeler", label: "领域建模" },
  { name: "architecture-scout", label: "架构勘察" },
  { name: "module-designer", label: "模块设计" },
];

export interface ExpertTeamPreset {
  id: string;
  label: string;
  members: string[];
}

export const EXPERT_TEAM_PRESETS: readonly ExpertTeamPreset[] = [
  {
    id: "team",
    label: "专家团队",
    // 成员不预设:由主 agent 根据任务自主判断调用哪些专家。
    members: [],
  },
];

export type ExpertSelection =
  | { kind: "team"; presetId: string }
  | { kind: "expert"; name: string }
  | null;

export function expertLabel(selection: ExpertSelection): string | null {
  if (!selection) return null;
  if (selection.kind === "team") {
    return EXPERT_TEAM_PRESETS.find((preset) => preset.id === selection.presetId)?.label ?? selection.presetId;
  }
  return EXPERT_ROSTER.find((entry) => entry.name === selection.name)?.label ?? selection.name;
}

/** Members referenced by a selection (used for the hover title). */
export function expertMembers(selection: ExpertSelection): string[] {
  if (!selection) return [];
  if (selection.kind === "team") {
    return EXPERT_TEAM_PRESETS.find((preset) => preset.id === selection.presetId)?.members ?? [];
  }
  return [selection.name];
}

/**
 * Text prepended to the outgoing user message so the main agent knows which
 * expert(s) the user wants invoked. Kept visible in the transcript on purpose:
 * the user confirmed the reference before sending.
 */
export function expertReferenceText(selection: ExpertSelection): string | null {
  if (!selection) return null;
  if (selection.kind === "team") {
    return "请按专家团队流程处理以下任务,由你自主判断需要调用哪些专家";
  }
  return `请调用专家 ${selection.name} 处理以下任务`;
}
