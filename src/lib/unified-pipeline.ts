// ============================================================================
// Unified Pipeline — Final Resume Cleanup and Integrity Guard
// ============================================================================

import type { ResumeData } from "./types";

export function finalizeResume(candidate: ResumeData, source: ResumeData): ResumeData {
  if (!candidate) return source;

  const result: ResumeData = JSON.parse(JSON.stringify(candidate));

  // 1. Lock identity and core contact fields from source
  if (source.name) result.name = source.name;
  if (source.contact) {
    result.contact = {
      ...source.contact,
      ...result.contact,
      name: source.contact.name || source.name,
      email: source.contact.email,
      phone: source.contact.phone,
    };
  }

  // 2. Preserve education from source if candidate was truncated
  if (source.education && (!result.education || result.education.length === 0)) {
    result.education = JSON.parse(JSON.stringify(source.education));
  }

  // 3. Clean up summary (deduplicate duplicate sentences, fix punctuation)
  if (result.summary) {
    let s = result.summary.replace(/\s{2,}/g, " ").replace(/\.{2,}/g, ".");
    const sentences = s.split(/(?<=[.!?])\s+/);
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      const norm = trimmed.toLowerCase();
      if (!seen.has(norm) && norm.length > 5) {
        seen.add(norm);
        deduped.push(trimmed);
      }
    }
    result.summary = deduped.join(" ");
  }

  // 4. Deduplicate skills
  if (result.skills && Array.isArray(result.skills)) {
    const seenSkills = new Set<string>();
    result.skills = result.skills.filter((sk) => {
      const name = typeof sk === "string" ? sk : sk?.name || "";
      const norm = name.toLowerCase().trim();
      if (!norm || seenSkills.has(norm)) return false;
      seenSkills.add(norm);
      return true;
    });
  }

  // 5. Clean experience bullets
  if (result.experience) {
    result.experience.forEach((exp) => {
      if (exp.bullets) {
        const seenBullets = new Set<string>();
        exp.bullets = exp.bullets
          .map((b) => b.trim().replace(/\s{2,}/g, " "))
          .filter((b) => {
            const norm = b.toLowerCase();
            if (!norm || seenBullets.has(norm)) return false;
            seenBullets.add(norm);
            return true;
          });
      }
    });
  }

  return result;
}
