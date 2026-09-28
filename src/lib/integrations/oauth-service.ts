/**
 * OAuth Service Layer for Third-Party Profile Data Fetching (LinkedIn, GitHub)
 * Adheres to iframe-friendly popup patterns and standard OAuth 2.0 specs.
 */

import type { OAuthProfile, OAuthAuthResult } from "./types";
import type { ResumeData, ResumeExperience, ResumeEducation, ResumeSkill } from "../types";
import { uid } from "../store";

export const LINKEDIN_SAMPLE_PROFILES: Record<string, OAuthProfile> = {
  software_lead: {
    name: "Alex Morgan",
    firstName: "Alex",
    lastName: "Morgan",
    headline: "Staff Software Architect | React, TypeScript, Node.js & Distributed Systems",
    email: "alex.morgan@example.com",
    phone: "+1 (415) 890-2345",
    location: "San Francisco, CA",
    linkedinUrl: "https://linkedin.com/in/alex-morgan-lead",
    summary: "Senior technology leader and fullstack architect with 8+ years building enterprise web platforms. Specialist in real-time distributed state, high-performance UI engines, and developer productivity tooling.",
    skills: [
      "TypeScript",
      "React",
      "Next.js",
      "Node.js",
      "System Architecture",
      "PostgreSQL",
      "AWS / Cloud Infrastructure",
      "GraphQL & REST APIs",
      "Docker & Kubernetes",
      "CI/CD Automation",
    ],
    experience: [
      {
        title: "Staff Software Architect",
        company: "Stripe",
        location: "San Francisco, CA",
        startDate: "2022-02",
        endDate: "Present",
        current: true,
        bullets: [
          "Spearheaded architectural evolution of global checkout dashboard, reducing P95 latency by 42% for 200,000+ businesses.",
          "Architected real-time telemetry pipeline processing 40M+ events daily with sub-second alerting.",
          "Established cross-team TypeScript design guidelines, accelerating pull-request review velocity by 25%.",
        ],
      },
      {
        title: "Senior Fullstack Engineer",
        company: "Vercel",
        location: "San Francisco, CA",
        startDate: "2019-06",
        endDate: "2022-01",
        current: false,
        bullets: [
          "Developed core framework edge-rendering middleware used across millions of client deployments.",
          "Optimized client bundle payloads by 35% through dynamic code-splitting and asset tree-shaking.",
        ],
      },
    ],
    education: [
      {
        institution: "University of California, Berkeley",
        degree: "B.S. in Computer Science",
        field: "Computer Systems & Algorithms",
        startDate: "2015-09",
        endDate: "2019-05",
      },
    ],
    languages: [
      { name: "English", proficiency: "Native" },
      { name: "Spanish", proficiency: "Professional" },
    ],
  },

  cabin_purser: {
    name: "Sarah Alami",
    firstName: "Sarah",
    lastName: "Alami",
    headline: "Senior In-Flight Purser & Cabin Crew Leader | Safety Trainer & Premium Service Specialist",
    email: "sarah.alami@example.com",
    phone: "+971 50 123 4567",
    location: "Dubai, United Arab Emirates",
    linkedinUrl: "https://linkedin.com/in/sarah-alami-purser",
    summary: "Dedicated In-Flight Purser with 7+ years of international airline service across wide-body fleets (A380, B777). Certified in SEP, CRM, and advanced emergency aviation medicine with an unblemished safety record.",
    skills: [
      "Safety & Emergency Procedures (SEP)",
      "Crew Resource Management (CRM)",
      "First Aid & CPR/AED Medical Response",
      "Premium Cabin Hospitality (First & Business)",
      "Multicultural Communication",
      "Conflict De-escalation",
      "Aviation Regulatory Compliance (ICAO/FAA)",
      "Team Leadership & Flight Briefings",
    ],
    experience: [
      {
        title: "Senior Cabin Purser",
        company: "Emirates Airline",
        location: "Dubai, UAE",
        startDate: "2020-03",
        endDate: "Present",
        current: true,
        bullets: [
          "Supervised multinational cabin teams of up to 16 crew members across ultra-long-haul intercontinental flights.",
          "Conducted comprehensive pre-flight safety equipment audits and crew briefings ensuring 100% regulatory compliance.",
          "Commended twice with the President's Service Excellence Award for first-class customer dining presentation.",
        ],
      },
      {
        title: "Cabin Crew Member",
        company: "Qatar Airways",
        location: "Doha, Qatar",
        startDate: "2017-08",
        endDate: "2020-02",
        current: false,
        bullets: [
          "Delivered five-star hospitality across 45+ international destinations while upholding strict flight safety protocols.",
          "Effectively stabilized in-flight medical incidents following airline physician tele-guidance.",
        ],
      },
    ],
    education: [
      {
        institution: "Aviation Safety & Hospitality Academy",
        degree: "Commercial Cabin Operations Certification",
        field: "Aviation Safety & Passenger Care",
        startDate: "2016-09",
        endDate: "2017-06",
      },
    ],
    languages: [
      { name: "English", proficiency: "Fluent" },
      { name: "French", proficiency: "Fluent" },
      { name: "Arabic", proficiency: "Native" },
    ],
  },
};

/**
 * Fetch OAuth Authorization URL from backend or construct provider URL
 */
export async function getLinkedInAuthUrl(): Promise<string> {
  try {
    const res = await fetch("/api/oauth/linkedin/url");
    if (res.ok) {
      const data = await res.json();
      if (data.url) return data.url;
    }
  } catch {}

  // Fallback direct provider OAuth URL (standard LinkedIn OAuth 2.0)
  const clientId = "86sampleclientid";
  const redirectUri = typeof window !== "undefined" ? `${window.location.origin}/oauth-callback.html` : "http://localhost:3000/oauth-callback.html";
  const scope = encodeURIComponent("openid profile email");
  return `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=resumeai_${Date.now()}`;
}

/**
 * Fetch user profile data via OAuth token
 */
export async function fetchLinkedInProfileWithOAuth(token: string): Promise<OAuthProfile> {
  const res = await fetch("/api/oauth/linkedin/profile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ token }),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch LinkedIn profile (HTTP ${res.status})`);
  }

  const result = await res.json();
  return result.profile;
}

/**
 * Parse any raw LinkedIn profile JSON into structured ResumeData form fields
 */
export function parseLinkedInJsonToResume(json: any): Partial<ResumeData> {
  if (!json || typeof json !== "object") {
    throw new Error("Invalid LinkedIn profile JSON provided.");
  }

  // Handle various LinkedIn JSON schemas (REST API, OpenID Connect, or manual JSON export)
  const name =
    json.name ||
    (json.firstName && json.lastName ? `${json.firstName} ${json.lastName}`.trim() : "") ||
    json.formattedName ||
    json.displayName ||
    "LinkedIn Candidate";

  const headline = json.headline || json.title || json.occupation || "";

  const contact = {
    email: json.email || json.emailAddress || "",
    phone: json.phone || json.phoneNumber || "",
    location:
      typeof json.location === "string"
        ? json.location
        : json.location?.name || json.location?.country || "San Francisco, CA",
    linkedin: json.linkedinUrl || json.publicProfileUrl || json.url || "https://linkedin.com",
    github: json.github || "",
    website: json.website || "",
  };

  const summary = json.summary || json.about || json.bio || "";

  // Experiences
  const rawExp = Array.isArray(json.experience)
    ? json.experience
    : Array.isArray(json.positions)
    ? json.positions
    : Array.isArray(json.workExperience)
    ? json.workExperience
    : [];

  const experience: ResumeExperience[] = rawExp.map((e: any) => {
    let bullets: string[] = [];
    if (Array.isArray(e.bullets)) {
      bullets = e.bullets.filter(Boolean);
    } else if (typeof e.description === "string") {
      bullets = e.description
        .split(/[\n•\-]+/)
        .map((b: string) => b.trim())
        .filter((b: string) => b.length > 5);
    }

    if (bullets.length === 0) {
      bullets = ["Delivered key strategic milestones and collaborated with cross-functional teams."];
    }

    return {
      id: uid("e"),
      title: e.title || e.position || "Specialist",
      company: e.company || e.companyName || "Organization",
      location: e.location || contact.location || "",
      startDate: e.startDate || "2021-01",
      endDate: e.current ? "Present" : e.endDate || "Present",
      current: Boolean(e.current || e.endDate === "Present"),
      bullets,
    };
  });

  // Education
  const rawEdu = Array.isArray(json.education)
    ? json.education
    : Array.isArray(json.schools)
    ? json.schools
    : [];

  const education: ResumeEducation[] = rawEdu.map((ed: any) => ({
    id: uid("ed"),
    institution: ed.institution || ed.schoolName || "University",
    degree: ed.degree || ed.degreeName || "Bachelor's Degree",
    field: ed.field || ed.fieldOfStudy || "General Studies",
    startDate: ed.startDate || "2016-09",
    endDate: ed.endDate || "2020-05",
  }));

  // Skills
  const rawSkills = Array.isArray(json.skills)
    ? json.skills
    : Array.isArray(json.competencies)
    ? json.competencies
    : [];

  const skills: ResumeSkill[] = rawSkills.map((s: any) => {
    if (typeof s === "string") {
      return { id: uid("s"), name: s, level: "Advanced" as const };
    }
    return {
      id: uid("s"),
      name: s.name || s.skillName || "Skill",
      level: s.level || "Advanced",
    };
  });

  // Languages
  const rawLang = Array.isArray(json.languages) ? json.languages : [];
  const languages = rawLang.map((l: any) => ({
    id: uid("l"),
    name: typeof l === "string" ? l : l.name || "English",
    proficiency: typeof l === "string" ? "Fluent" : l.proficiency || "Fluent",
  }));

  return {
    name,
    headline,
    contact,
    summary,
    experience,
    education,
    skills,
    languages: languages.length > 0 ? languages : [{ id: uid("l"), name: "English", proficiency: "Fluent" }],
  };
}
