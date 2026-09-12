// ============================================================================
// Regression Engine — Quality & Performance Baseline Guard
// ============================================================================

export interface RegressionBaseline {
  [metric: string]: number | string | unknown;
}

export interface RegressionResult {
  hasRegression: boolean;
  regressed?: boolean;
  score: number;
  suiteName: string;
  regressions: string[];
  improvements: string[];
  metrics: Record<string, { baseline: number; current: number; delta: number }>;
}

export function checkRegression(
  baseline: RegressionBaseline,
  current: Record<string, unknown>,
  suiteName: string = "default"
): RegressionResult {
  const regressions: string[] = [];
  const improvements: string[] = [];
  const metrics: Record<string, { baseline: number; current: number; delta: number }> = {};

  for (const [key, baseVal] of Object.entries(baseline)) {
    if (typeof baseVal === "number" && typeof current[key] === "number") {
      const curVal = current[key] as number;
      const delta = curVal - baseVal;
      metrics[key] = { baseline: baseVal, current: curVal, delta };

      if (delta < -5) {
        regressions.push(`${key} degraded by ${Math.abs(delta).toFixed(1)}`);
      } else if (delta > 5) {
        improvements.push(`${key} improved by ${delta.toFixed(1)}`);
      }
    }
  }

  const hasRegression = regressions.length > 0;
  return {
    hasRegression,
    regressed: hasRegression,
    score: regressions.length === 0 ? 100 : Math.max(0, 100 - regressions.length * 20),
    suiteName,
    regressions,
    improvements,
    metrics,
  };
}
