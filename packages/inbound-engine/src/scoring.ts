import type { InboundConfig } from "@kanso/config";

export function computeScore(
  config: InboundConfig,
  answers: Record<string, unknown>,
): number {
  let total = 0;
  for (const [questionId, weight] of Object.entries(config.scoring.weights)) {
    const value = answers[questionId];
    if (value === undefined || value === null || value === "") continue;
    switch (weight.kind) {
      case "choice_map":
        total += weight.points[String(value)] ?? 0;
        break;
      case "boolean":
        total += value === true ? weight.true_points : weight.false_points;
        break;
      case "number_range": {
        const n = Number(value);
        const hit = weight.ranges.find((r) => n >= r.min && n <= r.max);
        total += hit?.points ?? 0;
        break;
      }
      case "free_text":
        if (String(value).trim().length > 0) total += weight.points_if_non_empty;
        break;
    }
  }
  return Math.min(config.scoring.max_score, total);
}
