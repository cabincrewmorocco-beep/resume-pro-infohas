// Regional hiring norms and personal-data compliance engine

export type ResumeRegion = "gulf" | "us" | "uk_eu" | "apac";

export type RegionalFieldStance = "expected" | "optional" | "discouraged" | "avoid";

export interface RegionalFieldNorm {
  key: "photo" | "dateOfBirth" | "nationality" | "visaStatus" | string;
  label: string;
  stance: RegionalFieldStance;
  description?: string;
}

export interface RegionalNormIssue {
  id: string;
  kind: "add" | "remove";
  key: string;
  label: string;
  severity: "warning" | "info" | "error";
  message: string;
}

export interface RegionalNormDefinition {
  label: string;
  tagline: string;
  fields: RegionalFieldNorm[];
  advice: string[];
}

export const REGION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Select target region / market..." },
  { value: "gulf", label: "Gulf / GCC (UAE, Qatar, Saudi Arabia)" },
  { value: "us", label: "North America (US & Canada)" },
  { value: "uk_eu", label: "UK & European Union" },
  { value: "apac", label: "Asia-Pacific (APAC)" },
];

export const REGION_NORMS: Record<string, RegionalNormDefinition> = {
  gulf: {
    label: "Gulf / GCC",
    tagline: "Screening requires nationality, visa status, and professional photo",
    fields: [
      { key: "photo", label: "Professional Photo", stance: "expected" },
      { key: "nationality", label: "Nationality", stance: "expected" },
      { key: "visaStatus", label: "Visa Status", stance: "expected" },
      { key: "dateOfBirth", label: "Date of Birth", stance: "optional" },
    ],
    advice: [
      "A clear, professional business attire headshot is standard for GCC recruiters.",
      "State your nationality and current visa status (e.g., Transferable Work Visa / Visit Visa).",
      "Include valid driving license information if relevant to role mobility.",
      "List language competencies prominently.",
    ],
  },
  us: {
    label: "North America (US & Canada)",
    tagline: "Strict EEOC / anti-discrimination norms: no photo, age, or nationality",
    fields: [
      { key: "photo", label: "Professional Photo", stance: "avoid" },
      { key: "dateOfBirth", label: "Date of Birth", stance: "avoid" },
      { key: "nationality", label: "Nationality", stance: "avoid" },
      { key: "visaStatus", label: "Visa Status", stance: "optional" },
    ],
    advice: [
      "Never include a headshot or photo to prevent EEOC rejection.",
      "Omit personal details: date of birth, age, gender, marital status, religion.",
      "Only indicate work authorization (e.g., Authorized to work in US) if relevant.",
      "Focus purely on professional accomplishments, skills, and quantifiable impact.",
    ],
  },
  uk_eu: {
    label: "UK & European Union",
    tagline: "GDPR compliant; photo optional depending on country",
    fields: [
      { key: "photo", label: "Professional Photo", stance: "discouraged" },
      { key: "dateOfBirth", label: "Date of Birth", stance: "discouraged" },
      { key: "nationality", label: "Nationality", stance: "optional" },
      { key: "visaStatus", label: "Visa Status", stance: "optional" },
    ],
    advice: [
      "Photos are generally omitted in the UK, but customary in Germany/Austria/Switzerland.",
      "Omit marital status, religion, and protected characteristics under GDPR.",
      "State right to work in the UK/EU if applying from outside.",
    ],
  },
  apac: {
    label: "Asia-Pacific",
    tagline: "Comprehensive CV format highlighting mobility and languages",
    fields: [
      { key: "photo", label: "Professional Photo", stance: "optional" },
      { key: "nationality", label: "Nationality", stance: "optional" },
      { key: "dateOfBirth", label: "Date of Birth", stance: "optional" },
      { key: "visaStatus", label: "Visa Status", stance: "optional" },
    ],
    advice: [
      "State language capabilities and fluency levels clearly.",
      "Specify current residency and employment pass / visa eligibility.",
      "Quantify scope of regional responsibilities (countries covered).",
    ],
  },
};

export function getResumeRegion(resume: any): ResumeRegion | undefined {
  if (!resume) return undefined;
  const val = resume.contact?.region || resume.targetRegion || resume.region;
  if (val && val in REGION_NORMS) {
    return val as ResumeRegion;
  }
  return undefined;
}

export interface RegionalNormReport {
  score: number;
  issues: RegionalNormIssue[];
  fields: RegionalFieldNorm[];
  advice: string[];
}

export function computeRegionalNormReport(resume: any): RegionalNormReport {
  const region = getResumeRegion(resume);
  if (!region || !REGION_NORMS[region]) {
    return {
      score: 100,
      issues: [],
      fields: [],
      advice: [],
    };
  }

  const norm = REGION_NORMS[region];
  const issues: RegionalNormIssue[] = [];
  const contact = resume?.contact || {};
  const pd = contact.personalDetails || {};

  const getPdValue = (label: string): string => {
    const hit = Object.keys(pd).find((k) => k.trim().toLowerCase() === label.trim().toLowerCase());
    return hit ? String(pd[hit] || "").trim() : "";
  };

  const hasPhoto = Boolean(resume?.photoUrl && String(resume.photoUrl).trim().length > 0);
  const hasDob = Boolean(resume?.dateOfBirth && String(resume.dateOfBirth).trim().length > 0);

  for (const field of norm.fields) {
    if (field.key === "photo") {
      if ((field.stance === "avoid" || field.stance === "discouraged") && hasPhoto) {
        issues.push({
          id: `remove-${field.key}`,
          kind: "remove",
          key: "photo",
          label: field.label,
          severity: field.stance === "avoid" ? "warning" : "info",
          message: `${field.label} should be removed for ${norm.label} to align with anti-bias hiring conventions.`,
        });
      } else if (field.stance === "expected" && !hasPhoto) {
        issues.push({
          id: `add-${field.key}`,
          kind: "add",
          key: "photo",
          label: field.label,
          severity: "info",
          message: `Recruiters in ${norm.label} typically expect a professional business photo.`,
        });
      }
    } else if (field.key === "dateOfBirth") {
      if ((field.stance === "avoid" || field.stance === "discouraged") && hasDob) {
        issues.push({
          id: `remove-${field.key}`,
          kind: "remove",
          key: "dateOfBirth",
          label: field.label,
          severity: field.stance === "avoid" ? "warning" : "info",
          message: `Date of birth should be removed to comply with ${norm.label} hiring guidelines.`,
        });
      } else if (field.stance === "expected" && !hasDob) {
        issues.push({
          id: `add-${field.key}`,
          kind: "add",
          key: "dateOfBirth",
          label: field.label,
          severity: "info",
          message: `Date of birth is customary for immigration and visa processing in ${norm.label}.`,
        });
      }
    } else {
      const val = getPdValue(field.label);
      const isPresent = val.length > 0;
      if ((field.stance === "avoid" || field.stance === "discouraged") && isPresent) {
        issues.push({
          id: `remove-${field.key}`,
          kind: "remove",
          key: field.key,
          label: field.label,
          severity: field.stance === "avoid" ? "warning" : "info",
          message: `${field.label} is discouraged in ${norm.label}.`,
        });
      } else if (field.stance === "expected" && !isPresent) {
        issues.push({
          id: `add-${field.key}`,
          kind: "add",
          key: field.key,
          label: field.label,
          severity: "info",
          message: `${field.label} is standard for initial screening in ${norm.label}.`,
        });
      }
    }
  }

  // Calculate score
  let score = 100;
  for (const issue of issues) {
    if (issue.severity === "warning") score -= 20;
    else score -= 10;
  }
  score = Math.max(20, Math.min(100, score));

  return {
    score,
    issues,
    fields: norm.fields,
    advice: norm.advice,
  };
}

export function buildRegionalFixPatch(resume: any, issue: RegionalNormIssue): any {
  if (issue.kind === "remove") {
    if (issue.key === "photo") {
      return { photoUrl: "" };
    }
    if (issue.key === "dateOfBirth") {
      return { dateOfBirth: "" };
    }
    const contact = { ...(resume?.contact || {}) };
    const pd = { ...(contact.personalDetails || {}) };
    const hit = Object.keys(pd).find(
      (k) => k.trim().toLowerCase() === issue.label.trim().toLowerCase() || k.toLowerCase() === issue.key.toLowerCase()
    );
    if (hit) {
      delete pd[hit];
      return { contact: { ...contact, personalDetails: pd } };
    }
  }
  return null;
}
