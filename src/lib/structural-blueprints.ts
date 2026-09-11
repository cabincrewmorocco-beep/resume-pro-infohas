// ============================================================================
// Structural Blueprints — Resume Section Organization Models
// ============================================================================

export interface ResumeSectionStructure {
  id: "contact" | "headline" | "summary" | "experience" | "education" | "skills" | "languages" | "additional" | string;
  label?: string;
  required?: boolean;
  order?: number;
  maxItems?: number;
  [key: string]: unknown;
}

export interface StructuralBlueprint {
  id: string;
  name: string;
  description?: string;
  isBuiltIn?: boolean;
  sections: ResumeSectionStructure[];
  [key: string]: unknown;
}

export const STRUCTURAL_BLUEPRINTS: StructuralBlueprint[] = [
  {
    id: "standard-chronological",
    name: "Standard Chronological",
    description: "Classic high-impact chronological resume for ATS and executive recruiters.",
    isBuiltIn: true,
    sections: [
      { id: "contact", label: "Contact Information", required: true, order: 1 },
      { id: "headline", label: "Professional Headline", required: false, order: 2 },
      { id: "summary", label: "Professional Summary", required: true, order: 3 },
      { id: "experience", label: "Work Experience", required: true, order: 4 },
      { id: "education", label: "Education", required: true, order: 5 },
      { id: "skills", label: "Technical & Soft Skills", required: true, order: 6 },
      { id: "languages", label: "Languages", required: false, order: 7 },
      { id: "additional", label: "Additional Information", required: false, order: 8 },
    ],
  },
  {
    id: "skills-first-technical",
    name: "Technical / Skills First",
    description: "Prioritizes tech stack and core competencies right below summary.",
    isBuiltIn: true,
    sections: [
      { id: "contact", label: "Contact Information", required: true, order: 1 },
      { id: "summary", label: "Professional Summary", required: true, order: 2 },
      { id: "skills", label: "Technical Skills & Competencies", required: true, order: 3 },
      { id: "experience", label: "Work Experience", required: true, order: 4 },
      { id: "education", label: "Education", required: true, order: 5 },
      { id: "additional", label: "Projects & Certifications", required: false, order: 6 },
    ],
  },
  {
    id: "executive-hybrid",
    name: "Executive Leadership",
    description: "Emphasizes leadership profile, board experience, and strategic milestones.",
    isBuiltIn: true,
    sections: [
      { id: "contact", label: "Contact Information", required: true, order: 1 },
      { id: "headline", label: "Executive Headline", required: true, order: 2 },
      { id: "summary", label: "Executive Profile", required: true, order: 3 },
      { id: "experience", label: "Leadership Experience", required: true, order: 4 },
      { id: "skills", label: "Core Competencies", required: true, order: 5 },
      { id: "education", label: "Education & Credentials", required: true, order: 6 },
    ],
  },
];

let customBlueprintsList: StructuralBlueprint[] = [];

export function registerCustomBlueprints(blueprints: StructuralBlueprint[]): void {
  if (!Array.isArray(blueprints)) return;
  customBlueprintsList = [...blueprints];
  for (const bp of blueprints) {
    if (!STRUCTURAL_BLUEPRINTS.some((b) => b.id === bp.id)) {
      STRUCTURAL_BLUEPRINTS.push(bp);
    }
  }
}

export function getStructuralBlueprints(): StructuralBlueprint[] {
  return [...STRUCTURAL_BLUEPRINTS, ...customBlueprintsList];
}
