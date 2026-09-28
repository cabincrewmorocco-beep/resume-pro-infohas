// ============================================================================
// Structural Blueprints — Resume Section Organization Models
// ============================================================================

export interface ResumeSectionStructure {
  id: "contact" | "headline" | "summary" | "experience" | "education" | "skills" | "languages" | "additional" | "additionalInfo" | string;
  name?: string;
  label?: string;
  required?: boolean;
  order?: number;
  maxEntries?: number;
  maxBulletsPerEntry?: number;
  maxItems?: number;
  hints?: string[];
  [key: string]: any;
}

export interface StructuralBlueprint {
  id: string;
  name: string;
  description?: string;
  isBuiltIn?: boolean;
  sections: ResumeSectionStructure[];
  formattingHints?: {
    datesFormat?: string;
    bulletStyle?: string;
    entityOrder?: string;
  };
  [key: string]: any;
}

export const STRUCTURAL_BLUEPRINTS: StructuralBlueprint[] = [
  {
    id: "infohas_aviation",
    name: "InfoHAS Signature (Aviation & Hospitality)",
    description: "Official InfoHAS standard layout tailored for aviation, cabin crew, and premier hospitality roles.",
    isBuiltIn: true,
    sections: [
      { id: "contact", name: "Contact Information", label: "Contact Information", required: true, order: 1 },
      { id: "summary", name: "Professional Profile", label: "Professional Profile", required: true, order: 2, maxEntries: 1 },
      { id: "experience", name: "Work Experience", label: "Work Experience", required: true, order: 3, maxEntries: 4, maxBulletsPerEntry: 4 },
      { id: "education", name: "Education & Development", label: "Education & Development", required: true, order: 4, maxEntries: 2 },
      { id: "skills", name: "Core Competencies", label: "Core Competencies", required: true, order: 5, maxEntries: 4 },
      { id: "languages", name: "Languages", label: "Languages", required: true, order: 6, maxEntries: 5 },
      { id: "additionalInfo", name: "Additional Information", label: "Additional Information", required: false, order: 7 },
    ],
    formattingHints: {
      datesFormat: "Month Year (e.g. June 2024)",
      bulletStyle: "Quantified CAR / STAR impact bullets with active aviation & hospitality verbs",
      entityOrder: "Reverse Chronological",
    },
  },
  {
    id: "standard-chronological",
    name: "Standard Chronological",
    description: "Classic high-impact chronological resume for ATS and executive recruiters.",
    isBuiltIn: true,
    sections: [
      { id: "contact", name: "Contact Information", label: "Contact Information", required: true, order: 1 },
      { id: "headline", name: "Professional Headline", label: "Professional Headline", required: false, order: 2 },
      { id: "summary", name: "Professional Summary", label: "Professional Summary", required: true, order: 3 },
      { id: "experience", name: "Work Experience", label: "Work Experience", required: true, order: 4 },
      { id: "education", name: "Education", label: "Education", required: true, order: 5 },
      { id: "skills", name: "Technical & Soft Skills", label: "Technical & Soft Skills", required: true, order: 6 },
      { id: "languages", name: "Languages", label: "Languages", required: false, order: 7 },
      { id: "additional", name: "Additional Information", label: "Additional Information", required: false, order: 8 },
    ],
    formattingHints: {
      datesFormat: "Month Year (e.g. June 2024)",
      bulletStyle: "Action verb + accomplishment bullets",
      entityOrder: "Reverse Chronological",
    },
  },
  {
    id: "skills-first-technical",
    name: "Technical / Skills First",
    description: "Prioritizes tech stack and core competencies right below summary.",
    isBuiltIn: true,
    sections: [
      { id: "contact", name: "Contact Information", label: "Contact Information", required: true, order: 1 },
      { id: "summary", name: "Professional Summary", label: "Professional Summary", required: true, order: 2 },
      { id: "skills", name: "Technical Skills & Competencies", label: "Technical Skills & Competencies", required: true, order: 3 },
      { id: "experience", name: "Work Experience", label: "Work Experience", required: true, order: 4 },
      { id: "education", name: "Education", label: "Education", required: true, order: 5 },
      { id: "additional", name: "Projects & Certifications", label: "Projects & Certifications", required: false, order: 6 },
    ],
    formattingHints: {
      datesFormat: "YYYY-MM (e.g. 2024-06)",
      bulletStyle: "Tech-stack + metrics focused bullets",
      entityOrder: "Skills First -> Reverse Chronological",
    },
  },
  {
    id: "executive-hybrid",
    name: "Executive Leadership",
    description: "Emphasizes leadership profile, board experience, and strategic milestones.",
    isBuiltIn: true,
    sections: [
      { id: "contact", name: "Contact Information", label: "Contact Information", required: true, order: 1 },
      { id: "headline", name: "Executive Headline", label: "Executive Headline", required: true, order: 2 },
      { id: "summary", name: "Executive Profile", label: "Executive Profile", required: true, order: 3 },
      { id: "experience", name: "Leadership Experience", label: "Leadership Experience", required: true, order: 4 },
      { id: "skills", name: "Core Competencies", label: "Core Competencies", required: true, order: 5 },
      { id: "education", name: "Education & Credentials", label: "Education & Credentials", required: true, order: 6 },
    ],
    formattingHints: {
      datesFormat: "Year Only / Month Year",
      bulletStyle: "Executive narrative & P&L impact bullets",
      entityOrder: "Leadership -> Experience -> Education",
    },
  },
];

let customBlueprintsList: StructuralBlueprint[] = [];

export function isBuiltInBlueprint(id: string): boolean {
  return STRUCTURAL_BLUEPRINTS.some((b) => b.id === id);
}

function normalizeBlueprint(bp: StructuralBlueprint): StructuralBlueprint {
  return {
    ...bp,
    formattingHints: {
      datesFormat: bp.formattingHints?.datesFormat || "Month Year (e.g. June 2024)",
      bulletStyle: bp.formattingHints?.bulletStyle || "Quantified action verb bullets",
      entityOrder: bp.formattingHints?.entityOrder || "Reverse Chronological",
    },
  };
}

export function registerCustomBlueprints(blueprints: StructuralBlueprint[]): void {
  if (!Array.isArray(blueprints)) return;
  customBlueprintsList = blueprints.map(normalizeBlueprint);
  for (const bp of customBlueprintsList) {
    const idx = STRUCTURAL_BLUEPRINTS.findIndex((b) => b.id === bp.id);
    if (idx >= 0) {
      STRUCTURAL_BLUEPRINTS[idx] = bp;
    } else {
      STRUCTURAL_BLUEPRINTS.push(bp);
    }
  }
}

export function getStructuralBlueprints(): StructuralBlueprint[] {
  return [...STRUCTURAL_BLUEPRINTS, ...customBlueprintsList].map(normalizeBlueprint);
}

export function getBlueprintById(id?: string): StructuralBlueprint {
  const all = getStructuralBlueprints();
  const match = all.find((b) => b.id === id) || all[0] || STRUCTURAL_BLUEPRINTS[0];
  return normalizeBlueprint(match);
}
