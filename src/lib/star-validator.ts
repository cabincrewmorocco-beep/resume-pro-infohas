// ============================================================================
// STAR Method Validator & Entity Protector
// ============================================================================

import type { ResumeData } from "./types";

export interface EntityViolation {
  field: string;
  originalValue: string;
  optimizedValue: string;
}

export interface STARValidationResult {
  totalBullets: number;
  starCompliantBullets: number;
  passRate: number;
  entityViolationCount: number;
  entityViolations: EntityViolation[];
  bulletResults: Array<{
    text: string;
    hasActionVerb: boolean;
    hasMetric: boolean;
    isCompliant: boolean;
  }>;
}

const ACTION_VERBS = /^(accelerated|achieved|built|created|delivered|designed|developed|drove|established|executed|expanded|generated|implemented|improved|increased|launched|led|managed|optimized|orchestrated|reduced|resolved|spearheaded|streamlined|transformed)/i;
const METRIC_PATTERN = /(\d+%|\$\d+|\d+\s*(users|clients|teams|projects|engineers|customers|nodes|services|percent|million|billion|k))/i;

export function validateSTAR(
  optimizedResume: ResumeData,
  originalResume?: ResumeData
): STARValidationResult {
  const bulletResults: STARValidationResult["bulletResults"] = [];
  const entityViolations: EntityViolation[] = [];

  let totalBullets = 0;
  let starCompliantBullets = 0;

  if (optimizedResume.experience) {
    for (const exp of optimizedResume.experience) {
      if (exp.bullets) {
        for (const b of exp.bullets) {
          totalBullets++;
          const hasActionVerb = ACTION_VERBS.test(b.trim());
          const hasMetric = METRIC_PATTERN.test(b);
          const isCompliant = hasActionVerb && hasMetric;
          if (isCompliant) starCompliantBullets++;
          bulletResults.push({
            text: b,
            hasActionVerb,
            hasMetric,
            isCompliant,
          });
        }
      }
    }
  }

  // Check company / title entity preservation if originalResume provided
  if (originalResume?.experience && optimizedResume.experience) {
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

  const passRate = totalBullets > 0 ? (starCompliantBullets / totalBullets) * 100 : 100;

  return {
    totalBullets,
    starCompliantBullets,
    passRate,
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
