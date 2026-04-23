export type RiskLevel = "high" | "medium" | "low" | "none" | "unknown";

interface Props {
  level: RiskLevel;
  label?: string;
}

const STYLES: Record<RiskLevel, { bg: string; text: string; label: string }> = {
  high: { bg: "bg-danger", text: "text-white", label: "高" },
  medium: { bg: "bg-warn", text: "text-white", label: "中" },
  low: { bg: "bg-ok", text: "text-white", label: "低" },
  none: { bg: "bg-ink/10", text: "text-ink/70", label: "想定なし" },
  unknown: { bg: "bg-ink/10", text: "text-ink/70", label: "要確認" },
};

export default function RiskBadge({ level, label }: Props) {
  const s = STYLES[level];
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${s.bg} ${s.text}`}
    >
      {label ?? s.label}
    </span>
  );
}
