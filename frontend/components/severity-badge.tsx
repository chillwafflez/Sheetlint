import type { Severity } from "@/lib/schemas";

const LABELS: Record<Severity, string> = {
  critical: "Critical",
  warning: "Warning",
  info: "Info",
};

const CLASSES: Record<Severity, string> = {
  critical: "sev sev--critical",
  warning: "sev sev--warn",
  info: "sev sev--info",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={CLASSES[severity]}>{LABELS[severity]}</span>;
}
