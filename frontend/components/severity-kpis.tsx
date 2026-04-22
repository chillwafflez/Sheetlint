import { AlertOctagon, AlertTriangle, Info } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { TrustScore } from "@/lib/schemas";

const TILES = [
  {
    key: "critical",
    label: "Critical",
    Icon: AlertOctagon,
    color: "text-red-600 dark:text-red-400",
  },
  {
    key: "warning",
    label: "Warnings",
    Icon: AlertTriangle,
    color: "text-amber-600 dark:text-amber-400",
  },
  {
    key: "info",
    label: "Info",
    Icon: Info,
    color: "text-sky-600 dark:text-sky-400",
  },
] as const;

export function SeverityKpis({ trustScore }: { trustScore: TrustScore }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {TILES.map(({ key, label, Icon, color }) => (
        <Card key={key}>
          <CardContent className="flex flex-col items-start gap-2 p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className={`size-4 ${color}`} />
              {label}
            </div>
            <div className="text-3xl font-semibold tabular-nums">
              {trustScore.by_severity[key] ?? 0}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
