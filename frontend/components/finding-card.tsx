import { SeverityBadge } from "@/components/severity-badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Finding } from "@/lib/schemas";

const BORDER: Record<Finding["severity"], string> = {
  critical: "border-l-red-600",
  warning: "border-l-amber-500",
  info: "border-l-sky-500",
};

export function FindingCard({ finding }: { finding: Finding }) {
  return (
    <Card
      className={cn(
        "border-l-4 transition-colors",
        BORDER[finding.severity],
      )}
    >
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-start gap-3">
          <SeverityBadge severity={finding.severity} />
          <p className="text-sm font-medium leading-tight text-foreground">
            {finding.message}
          </p>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            Detector: <b className="text-foreground">{finding.detector}</b>
          </span>
          <span>
            Sheet:{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-foreground">
              {finding.sheet}
            </code>
          </span>
          {finding.column ? (
            <span>
              Column:{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-foreground">
                {finding.column}
              </code>
            </span>
          ) : null}
          {finding.row_count > 0 ? (
            <span>
              Rows affected:{" "}
              <b className="text-foreground">{finding.row_count}</b>
            </span>
          ) : null}
        </div>

        {finding.suggested_fix ? (
          <p className="text-xs italic text-emerald-700 dark:text-emerald-300">
            Fix: {finding.suggested_fix}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
