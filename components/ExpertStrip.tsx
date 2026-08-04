"use client";

import { useEffect, useRef } from "react";
import type { ExpertEventMap, ExpertRecord } from "@/lib/expert-events";
import { latestExpertStatus, participatedExperts } from "@/lib/expert-events";
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

/** Latest turn duration for the strip (running turns tick against now). */
function expertDuration(record: ExpertRecord | undefined): string {
  if (!record || record.turns.length === 0) return "";
  const last = record.turns[record.turns.length - 1];
  const end = last.completedAt ?? Date.now();
  return formatDuration(end - last.startedAt);
}

const STATUS_COLORS: Record<string, string> = {
  running: "var(--accent)",
  done: "#4ade80",
  failed: "#f87171",
};

export function ExpertStrip({
  records,
  selected,
  onSelect,
}: {
  records: ExpertEventMap;
  selected: string | null;
  onSelect: (agent: string | null) => void;
}) {
  const { t } = useI18n();
  const experts = participatedExperts(records);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the selected item visible when switching (horizontal scroll).
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || selected === null) return;
    const el = container.querySelector<HTMLElement>(`[data-expert="${CSS.escape(selected)}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [selected, experts.length]);

  if (experts.length === 0) return null;

  return (
    <div
      data-expert-strip
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexShrink: 0,
        padding: "6px 14px",
        borderTop: "1px solid var(--border)",
        background: "var(--bg-panel)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, maxWidth: 820, margin: "0 auto", width: "100%" }}>
        <span style={{ color: "var(--text-dim)", fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", flexShrink: 0 }}>
          {t("expert.experts")}
        </span>
        <div ref={scrollRef} style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", minWidth: 0, flex: 1 }}>
        <button
          type="button"
          data-expert="__main__"
          onClick={() => onSelect(null)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
            height: 26,
            padding: "0 10px",
            borderRadius: 5,
            border: selected === null ? "1px solid var(--accent)" : "1px solid var(--border)",
            background: selected === null ? "var(--accent-soft, rgba(24,139,119,0.12))" : "transparent",
            color: selected === null ? "var(--accent)" : "var(--text-muted)",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {t("expert.mainAgent")}
        </button>
        {experts.map((agent) => {
          const record = records.get(agent);
          const status = latestExpertStatus(record);
          const color = STATUS_COLORS[status] ?? "var(--text-dim)";
          const isSelected = selected === agent;
          return (
            <button
              key={agent}
              type="button"
              data-expert={agent}
              onClick={() => onSelect(agent)}
              title={`${agent} · ${status}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexShrink: 0,
                height: 26,
                padding: "0 10px",
                borderRadius: 5,
                border: isSelected ? "1px solid var(--accent)" : "1px solid var(--border)",
                background: isSelected ? "var(--accent-soft, rgba(24,139,119,0.12))" : "transparent",
                color: isSelected ? "var(--accent)" : "var(--text)",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: color,
                  boxShadow: status === "running" ? `0 0 0 3px ${color}33` : "none",
                  animation: status === "running" ? "pulse 1.5s infinite" : "none",
                  flexShrink: 0,
                }}
              />
              <span style={{ fontWeight: 550, whiteSpace: "nowrap" }}>{agent}</span>
              <span style={{ color: "var(--text-dim)", fontSize: 11, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                {expertDuration(record)}
              </span>
            </button>
          );
        })}
        </div>
      </div>
    </div>
  );
}
