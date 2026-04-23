import type { TrustScore } from "@/lib/schemas";

const GRADE_THRESHOLDS = [
  { label: "A 90+", min: 90 },
  { label: "B 75+", min: 75 },
  { label: "C 60+", min: 60 },
  { label: "D 40+", min: 40 },
  { label: "F < 40", min: 0 },
] as const;

type FillVariant = "accent" | "warn" | "critical";

function fillVariantForGrade(grade: string): FillVariant {
  const head = grade.charAt(0).toUpperCase();
  if (head === "A" || head === "B") return "accent";
  if (head === "C") return "warn";
  return "critical";
}

export function TrustScoreCard({ trustScore }: { trustScore: TrustScore }) {
  const { score, grade } = trustScore;
  const width = Math.max(0, Math.min(100, Math.round(score)));
  const variant = fillVariantForGrade(grade);

  return (
    <div className="score-card">
      <div>
        <div className="score-card__label">Data trust score</div>
        <div className="score-card__dial">
          <span className="score-card__num">{Math.round(score)}</span>
          <span className="score-card__max">/100</span>
        </div>
        <div className="score-card__grade">Grade {grade}</div>
      </div>

      <div>
        <div className="score-bar-track">
          <div
            className={`score-bar-fill score-bar-fill--${variant}`}
            style={{ width: `${width}%` }}
          />
        </div>
        <div className="score-card__foot">
          {GRADE_THRESHOLDS.map((threshold) => (
            <span key={threshold.label}>{threshold.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
