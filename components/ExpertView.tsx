"use client";

import { useState } from "react";
import type { ExpertRecord, ExpertTurnStatus } from "@/lib/expert-events";
import { latestExpertStatus } from "@/lib/expert-events";
import { useI18n } from "@/hooks/useI18n";

function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return "–";
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const STATUS_META: Record<ExpertTurnStatus, { labelKey: string; color: string }> = {
  running: { labelKey: "expert.running", color: "var(--accent)" },
  done: { labelKey: "expert.done", color: "#4ade80" },
  failed: { labelKey: "expert.failed", color: "#f87171" },
};

function TurnGroup({
  index,
  turn,
  t,
}: {
  index: number;
  turn: ExpertRecord["turns"][number];
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [expanded, setExpanded] = useState(index === 0);
  const meta = STATUS_META[turn.status];
  const duration = formatDuration(
    turn.completedAt !== undefined ? turn.completedAt - turn.startedAt : undefined,
  );

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 7, overflow: "hidden", background: "var(--bg-panel)" }}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          minHeight: 36,
          padding: "0 11px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          textAlign: "left",
          fontSize: 12,
          color: "var(--text)",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.15s", color: "var(--text-dim)" }}>
          <polyline points="4 2.5 7.5 6 4 9.5" />
        </svg>
        <span style={{ color: "var(--text-dim)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
          #{index + 1}
        </span>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: meta.color,
            animation: turn.status === "running" ? "pulse 1.5s infinite" : "none",
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {turn.task || t("expert.task")}
        </span>
        <span style={{ color: "var(--text-dim)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
          {duration}
        </span>
      </button>
      {expanded && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "10px 12px", display: "grid", gap: 8 }}>
          {turn.task && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {turn.task}
            </div>
          )}
          {turn.output ? (
            <pre
              style={{
                margin: 0,
                padding: 8,
                maxHeight: "min(55vh, 520px)",
                overflow: "auto",
                border: "1px solid var(--border)",
                borderRadius: 5,
                background: "var(--bg)",
                color: "var(--text-muted)",
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {turn.output}
            </pre>
          ) : turn.status === "running" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--accent)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", animation: "pulse 1.5s infinite", flexShrink: 0 }} />
              {t("expert.running")}…
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{t("expert.noTurns")}</div>
          )}
        </div>
      )}
    </div>
  );
}

export function ExpertView({ agent, record }: { agent: string; record: ExpertRecord | undefined }) {
  const { t } = useI18n();
  const status = latestExpertStatus(record);
  const meta = STATUS_META[status];
  const turns = record?.turns ?? [];
  const management = record?.management ?? [];
  const totalMs = turns.reduce((acc, turn) => acc + (turn.completedAt !== undefined ? turn.completedAt - turn.startedAt : 0), 0);

  return (
    <div data-expert-view style={{ minWidth: 0, padding: "20px 16px 24px", maxWidth: 820, margin: "0 auto", display: "grid", gap: 14 }}>
      {/* Identity card */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px", background: "var(--bg-panel)", display: "grid", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: meta.color,
              animation: status === "running" ? "pulse 1.5s infinite" : "none",
            }}
          />
          <span style={{ fontWeight: 650, fontSize: 14 }}>{agent}</span>
          <span style={{ color: meta.color, fontSize: 11, fontWeight: 600 }}>{t(meta.labelKey)}</span>
        </div>
        <div style={{ display: "flex", gap: 16, color: "var(--text-dim)", fontSize: 11.5 }}>
          <span>
            {t("expert.turns")}: {turns.length}
          </span>
          {management.length > 0 && (
            <span>
              {t("expert.managementEvents")}: {management.length}
            </span>
          )}
          {turns.some((turn) => turn.completedAt !== undefined) && (
            <span>
              {t("expert.duration")}: {formatDuration(totalMs)}
            </span>
          )}
        </div>
      </div>

      {/* Turns */}
      {turns.length === 0 ? (
        <div style={{ padding: "18px 14px", textAlign: "center", color: "var(--text-dim)", fontSize: 12, border: "1px dashed var(--border)", borderRadius: 8 }}>
          {t("expert.noTurns")}
        </div>
      ) : (
        [...turns].reverse().map((turn, index) => (
          <TurnGroup key={turn.toolCallId} index={index} turn={turn} t={t} />
        ))
      )}

      {/* Management events */}
      {management.length > 0 && (
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ color: "var(--text-dim)", fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            {t("expert.managementEvents")}
          </div>
          {management.map((evt) => (
            <div key={evt.toolCallId} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "var(--text-muted)", padding: "3px 0" }}>
              <span style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 11, flexShrink: 0 }}>{evt.toolName.replace("subagent_", "")}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{evt.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
