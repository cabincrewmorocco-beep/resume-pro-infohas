// ============================================================================
// STAR Method Validator & Entity Protector
// ============================================================================

import type { ResumeData } from "./types";

export interface EntityViolation {
  field: string;
  originalValue: string;
  optimizedValue: string;
}

export interface STARBulletResult {
  text: string;
  hasActionVerb: boolean;
  hasMetric: boolean;
  isCompliant: boolean;
  passes: boolean;
  experienceId?: string;
  bulletIndex: number;
  failures: string[];
}

export interface STARValidationResult {
  totalBullets: number;
  starCompliantBullets: number;
  passingBullets: number;
  passed: boolean;
  passRate: number;
  score: number;
  explanation: string;
  errors: string[];
  passiveVerbCount: number;
  noMetricCount: number;
  entityViolationCount: number;
  entityViolations: EntityViolation[];
  bulletResults: STARBulletResult[];
}

const ACTION_VERBS = /^(accelerated|achieved|built|created|delivered|designed|developed|drove|established|executed|expanded|generated|implemented|improved|increased|launched|led|managed|optimized|orchestrated|reduced|resolved|spearheaded|streamlined|transformed)/i;
const METRIC_PATTERN = /(\d+%|\$\d+|\d+\s*(users|clients|teams|projects|engineers|customers|nodes|services|percent|million|billion|k))/i;

export function validateSTAR(
  optimizedResume: ResumeData,
  originalResume?: ResumeData
): STARValidationResult {
  const bulletResults: STARBulletResult[] = [];
  const entityViolations: EntityViolation[] = [];
  const errors: string[] = [];

  let totalBullets = 0;
  let starCompliantBullets = 0;
  let passiveVerbCount = 0;
  let noMetricCount = 0;

  if (optimizedResume?.experience) {
    optimizedResume.experience.forEach((exp, expIdx) => {
      if (exp?.bullets) {
        exp.bullets.forEach((b, bIdx) => {
          if (!b) return;
          totalBullets++;
          const hasActionVerb = ACTION_VERBS.test(b.trim());
          const hasMetric = METRIC_PATTERN.test(b);
          const isCompliant = hasActionVerb && hasMetric;
          if (!hasActionVerb) passiveVerbCount++;
          if (!hasMetric) noMetricCount++;
          if (isCompliant) starCompliantBullets++;

          const failures: string[] = [];
          if (!hasActionVerb) failures.push("Missing strong action verb at start");
          if (!hasMetric) failures.push("Missing quantifiable metric or impact");

          bulletResults.push({
            text: b,
            hasActionVerb,
            hasMetric,
            isCompliant,
            passes: isCompliant,
            experienceId: exp.id || String(expIdx + 1),
            bulletIndex: bIdx,
            failures,
          });
        });
      }
    });
  }

  // Check company / title entity preservation if originalResume provided
  if (originalResume?.experience && optimizedResume?.experience) {
    originalResume.experience.forEach((orig, idx) => {
      const opt = optimizedResume.experience?.[idx];
      if (opt && orig.company && opt.company && orig.company !== opt.company) {
        entityViolations.push({
          field: "company",
          originalValue: orig.company,
          optimizedValue: opt.company,
        });
      }
    });
  }

  if (passiveVerbCount > 0) {
    errors.push(`${passiveVerbCount} bullet(s) lack a strong action verb.`);
  }
  if (noMetricCount > 0) {
    errors.push(`${noMetricCount} bullet(s) lack quantifiable metrics.`);
  }
  if (entityViolations.length > 0) {
    errors.push(`${entityViolations.length} company/entity name(s) were modified.`);
  }

  const passRate = totalBullets > 0 ? (starCompliantBullets / totalBullets) * 100 : 100;
  const score = Math.round(passRate);
  const passed = entityViolations.length === 0 && (totalBullets === 0 || passRate >= 80);

  const explanation = passed
    ? `STAR compliance verified (${starCompliantBullets}/${totalBullets} bullets compliant, ${score}% pass rate).`
    : `STAR compliance needs improvement (${starCompliantBullets}/${totalBullets} bullets compliant, ${score}% pass rate). ${errors.join(" ")}`;

  return {
    totalBullets,
    starCompliantBullets,
    passingBullets: starCompliantBullets,
    passed,
    passRate,
    score,
    explanation,
    errors,
    passiveVerbCount,
    noMetricCount,
    entityViolationCount: entityViolations.length,
    entityViolations,
    bulletResults,
  };
}

export function restoreViolatedEntities(
  optimized: ResumeData,
  original: ResumeData,
  violations: EntityViolation[]
): ResumeData {
  const restored = JSON.parse(JSON.stringify(optimized)) as ResumeData;
  if (original.experience && restored.experience) {
    restored.experience = restored.experience.map((exp, i) => {
      const orig = original.experience?.[i];
      if (orig) {
        return {
          ...exp,
          company: orig.company || exp.company,
          title: orig.title || exp.title,
        };
      }
      return exp;
    });
  }
  return restored;
}
