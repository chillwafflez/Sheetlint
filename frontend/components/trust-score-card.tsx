import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TrustScore } from "@/lib/schemas";

const GRADE_COLORS: Record<string, string> = {
  "A+": "text-emerald-600 dark:text-emerald-400",
  A: "text-emerald-600 dark:text-emerald-400",
  B: "text-sky-600 dark:text-sky-400",
  C: "text-amber-600 dark:text-amber-400",
  D: "text-orange-600 dark:text-orange-400",
  F: "text-red-600 dark:text-red-400",
};

export function TrustScoreCard({ trustScore }: { trustScore: TrustScore }) {
  const gradeColor = GRADE_COLORS[trustScore.grade] ?? "text-foreground";

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col items-center gap-2 p-8 text-center bg-gradient-to-br from-blue-50 to-slate-50 dark:from-slate-900/60 dark:to-slate-900/30">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Data Trust Score
        </div>
        <div className="text-7xl font-bold leading-none tabular-nums text-blue-700 dark:text-blue-300">
          {Math.round(trustScore.score)}
        </div>
        <div className={cn("text-lg font-semibold", gradeColor)}>
          Grade {trustScore.grade}
        </div>
      </CardContent>
    </Card>
  );
}
