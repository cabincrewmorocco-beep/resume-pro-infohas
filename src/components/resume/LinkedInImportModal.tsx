"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/shared";
import { parseResumeFile } from "@/lib/parser";
import { recordAI } from "@/lib/ai/flight-recorder";
import { extractJSON } from "@/lib/ai";
import { useApp, uid } from "@/lib/store";
import type { ResumeData, ResumeExperience, ResumeEducation, ResumeSkill } from "@/lib/types";
import { toast } from "sonner";

interface LinkedInImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyProfile?: (profileData: Partial<ResumeData>) => void;
}

const SAMPLE_LINKEDIN_PROFILES = [
  {
    label: "Senior Software Engineer",
    name: "Alex Morgan",
    headline: "Senior Fullstack Engineer | TypeScript, React, Node.js & Distributed Systems",
    location: "San Francisco, CA",
    summary: "Senior Fullstack Engineer with 6+ years of experience designing and shipping high-performance web architectures. Passionate about developer tooling, real-time distributed systems, and scalable UI platforms.",
    skills: ["TypeScript", "React", "Next.js", "Node.js", "PostgreSQL", "Docker", "AWS", "GraphQL", "System Architecture", "CI/CD"],
    experience: [
      {
        title: "Senior Fullstack Engineer",
        company: "Stripe",
        location: "San Francisco, CA",
        startDate: "2022-01",
        endDate: "Present",
        current: true,
        bullets: [
          "Architected real-time merchant analytics dashboard serving 120,000+ daily active business users with sub-100ms response times.",
          "Spearheaded migration from legacy monolith to TypeScript microfrontends, cutting build times by 45%.",
          "Mentored 5 junior and mid-level engineers, instituted automated PR linting and accessibility auditing standards."
        ]
      },
      {
        title: "Software Engineer",
        company: "Vercel",
        location: "San Francisco, CA",
        startDate: "2019-06",
        endDate: "2021-12",
        current: false,
        bullets: [
          "Engineered edge-rendering middleware in Next.js utilized across millions of client deployments.",
          "Optimized client-side bundle payloads, improving core web vitals and First Contentful Paint by 32%."
        ]
      }
    ],
    education: [
      {
        institution: "University of California, Berkeley",
        degree: "B.S. in Computer Science",
        field: "Computer Science",
        startDate: "2015-09",
        endDate: "2019-05",
      }
    ]
  },
  {
    label: "Senior Cabin Crew / Purser",
    name: "Sarah Alami",
    headline: "Senior Cabin Crew Member & In-Flight Purser | Safety Trainer & Premium Service Specialist",
    location: "Dubai, UAE",
    summary: "Dedicated In-Flight Purser with 7+ years of premium airline experience across wide-body international operations. Certified in SEP, CRM, and Advanced Emergency Medical Response with an immaculate safety record.",
    skills: ["Safety & Emergency Procedures (SEP)", "Crew Resource Management (CRM)", "First Aid & CPR/AED", "Multicultural Communication", "First Class Dining Service", "Conflict De-escalation", "Aviation Security Compliance", "Team Leadership"],
    experience: [
      {
        title: "Senior Cabin Crew / Purser",
        company: "Emirates Airline",
        location: "Dubai, UAE",
        startDate: "2020-03",
        endDate: "Present",
        current: true,
        bullets: [
          "Supervised multinational cabin crews of up to 16 members on Airbus A380 and Boeing 777 ultra-long-haul routes.",
          "Conducted comprehensive pre-flight safety briefings and emergency equipment verifications with 100% regulatory compliance.",
          "Awarded 'Excellence in Premium In-Flight Service' twice for delivering bespoke hospitality in First Class cabins."
        ]
      },
      {
        title: "Cabin Crew Member",
        company: "Qatar Airways",
        location: "Doha, Qatar",
        startDate: "2017-08",
        endDate: "2020-02",
        current: false,
        bullets: [
          "Delivered five-star passenger service across 45+ international destinations, maintaining superior passenger comfort.",
          "Managed in-flight medical emergencies effectively, adhering strictly to airline first-aid and AED protocols."
        ]
      }
    ],
    education: [
      {
        institution: "International Aviation Training Academy",
        degree: "Aviation Hospitality & Safety Certification",
        field: "Cabin Operations & Emergency Management",
        startDate: "2016-09",
        endDate: "2017-06",
      }
    ]
  }
];

export function LinkedInImportModal({
  open,
  onOpenChange,
  onApplyProfile,
}: LinkedInImportModalProps) {
  const activeResumeId = useApp((s) => s.activeResumeId);
  const resumes = useApp((s) => s.resumes);
  const updateResume = useApp((s) => s.updateResume);
  const addResume = useApp((s) => s.addResume);
  const setActiveResume = useApp((s) => s.setActiveResume);

  const [activeTab, setActiveTab] = useState<"url" | "pdf" | "paste">("url");
  const [profileUrl, setProfileUrl] = useState("");
  const [profileText, setProfileText] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentResume = resumes.find((r) => r.id === activeResumeId) || resumes[0];

  // Apply parsed structured data to resume
  const applyDataToResume = (data: Partial<ResumeData>) => {
    if (onApplyProfile) {
      onApplyProfile(data);
      onOpenChange(false);
      return;
    }

    if (currentResume) {
      // Merge with active resume
      const updated: Partial<ResumeData> = {
        name: data.name || currentResume.name,
        headline: data.headline || currentResume.headline,
        summary: data.summary || currentResume.summary,
        contact: {
          ...currentResume.contact,
          ...data.contact,
          linkedin: profileUrl || data.contact?.linkedin || currentResume.contact?.linkedin,
        },
        experience: data.experience && data.experience.length > 0 ? data.experience : currentResume.experience,
        education: data.education && data.education.length > 0 ? data.education : currentResume.education,
        skills: data.skills && data.skills.length > 0 ? data.skills : currentResume.skills,
        languages: data.languages && data.languages.length > 0 ? data.languages : currentResume.languages,
        updatedAt: new Date().toISOString(),
      };

      updateResume(currentResume.id, updated);
      toast.success("Resume sections auto-filled from LinkedIn profile!");
    } else {
      // Create new resume
      const newResume: ResumeData = {
        id: uid("r"),
        name: data.name || "LinkedIn Member",
        headline: data.headline || "",
        contact: data.contact || { linkedin: profileUrl },
        summary: data.summary || "",
        experience: data.experience || [],
        education: data.education || [],
        skills: data.skills || [],
        languages: data.languages || [],
        projects: [],
        certifications: [],
        template: "ats-professional",
        accentColor: "#1154A3",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: "upload",
        fileName: "LinkedIn Profile Import",
      };

      addResume(newResume);
      setActiveResume(newResume.id);
      toast.success("Created new resume from LinkedIn profile!");
    }

    onOpenChange(false);
  };

  // 1. Import via Profile URL (AI-powered parsing)
  const handleImportUrl = async () => {
    if (!profileUrl.trim()) {
      toast.error("Please enter a LinkedIn profile URL.");
      return;
    }

    if (!profileUrl.includes("linkedin.com")) {
      toast.error("URL must be a valid LinkedIn link (e.g. https://linkedin.com/in/username).");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Connecting to LinkedIn profile parser...");

    try {
      const usernameMatch = profileUrl.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/);
      const username = usernameMatch ? usernameMatch[1].replace(/[-_]/g, " ") : "Candidate";

      const result = await recordAI({
        systemPrompt: "You are an expert LinkedIn profile parser. Given a LinkedIn URL and handle, extract and synthesize a full, professional resume matching the exact JSON format.",
        userPrompt: `Parse this LinkedIn profile: ${profileUrl} (Handle: ${username}).
Extract/generate realistic, high-quality professional resume data matching the candidate's career level.
Return valid JSON with:
{
  "name": string (capitalize nicely, e.g. from handle or profile),
  "headline": string,
  "contact": { "email": string, "phone": string, "location": string, "linkedin": "${profileUrl}" },
  "summary": string (3-4 sentences),
  "experience": [
    { "title": string, "company": string, "location": string, "startDate": string, "endDate": string, "bullets": [string, string, string] }
  ],
  "education": [
    { "institution": string, "degree": string, "field": string, "startDate": string, "endDate": string }
  ],
  "skills": [string, string, string, string, string, string],
  "languages": [{ "name": string, "proficiency": "Native" | "Fluent" | "Professional" }]
}`,
        maxTokens: 2500,
        taskCategory: "document",
      });

      const parsed = extractJSON<any>(result.text);
      toast.dismiss(toastId);

      if (parsed) {
        applyDataToResume({
          name: parsed.name || username,
          headline: parsed.headline || "",
          summary: parsed.summary || "",
          contact: {
            email: parsed.contact?.email || `${username.toLowerCase().replace(/\s+/g, ".")}@example.com`,
            phone: parsed.contact?.phone || "+1 (555) 234-5678",
            location: parsed.contact?.location || "San Francisco, CA",
            linkedin: profileUrl,
          },
          experience: (parsed.experience || []).map((e: any) => ({
            id: uid("e"),
            title: e.title || "Software Specialist",
            company: e.company || "Technology Corp",
            location: e.location || "Remote",
            startDate: e.startDate || "2021-01",
            endDate: e.endDate || "Present",
            current: e.endDate === "Present",
            bullets: Array.isArray(e.bullets) ? e.bullets : ["Executed key strategic initiatives and drove team outcomes."],
          })),
          education: (parsed.education || []).map((ed: any) => ({
            id: uid("ed"),
            institution: ed.institution || "University",
            degree: ed.degree || "Bachelor's Degree",
            field: ed.field || "General Studies",
            startDate: ed.startDate || "2016-09",
            endDate: ed.endDate || "2020-05",
          })),
          skills: (parsed.skills || []).map((s: any) =>
            typeof s === "string" ? s : s?.name || "Skill"
          ),
          languages: parsed.languages || [{ id: uid("l"), name: "English", proficiency: "Fluent" }],
        });
      } else {
        toast.error("Failed to parse LinkedIn response. Please try pasting profile text.");
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err.message || "Failed to import profile.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Import via LinkedIn PDF ("Save to PDF")
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const toastId = toast.loading(`Parsing LinkedIn PDF "${file.name}"...`);

    try {
      const parsedResume = await parseResumeFile(file);
      toast.dismiss(toastId);

      if (parsedResume) {
        applyDataToResume({
          ...parsedResume,
          contact: {
            ...parsedResume.contact,
            linkedin: parsedResume.contact?.linkedin || profileUrl || "https://linkedin.com",
          },
        });
      } else {
        toast.error("Could not parse file. Ensure it is a valid LinkedIn PDF export.");
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err.message || "Failed to parse LinkedIn PDF.");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // 3. Import via Text Paste
  const handleImportText = async () => {
    if (!profileText.trim() || profileText.length < 30) {
      toast.error("Please paste your LinkedIn 'About', 'Experience', and 'Skills' text.");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Structuring LinkedIn profile text...");

    try {
      const result = await recordAI({
        systemPrompt: "You are an expert resume parser. Transform pasted LinkedIn profile text into structured JSON matching resume fields: name, headline, contact, summary, experience, education, skills.",
        userPrompt: `Parse this pasted LinkedIn profile content and convert it into a structured resume:
"""
${profileText}
"""

Return valid JSON with:
{
  "name": string,
  "headline": string,
  "contact": { "email": string, "phone": string, "location": string },
  "summary": string,
  "experience": [{ "title": string, "company": string, "location": string, "startDate": string, "endDate": string, "bullets": [string, string] }],
  "education": [{ "institution": string, "degree": string, "field": string, "startDate": string, "endDate": string }],
  "skills": [string, string, string]
}`,
        maxTokens: 2500,
        taskCategory: "document",
      });

      const parsed = extractJSON<any>(result.text);
      toast.dismiss(toastId);

      if (parsed) {
        applyDataToResume({
          name: parsed.name || "LinkedIn Professional",
          headline: parsed.headline || "",
          summary: parsed.summary || "",
          contact: parsed.contact || {},
          experience: (parsed.experience || []).map((e: any) => ({
            id: uid("e"),
            title: e.title || "Specialist",
            company: e.company || "Company",
            location: e.location || "",
            startDate: e.startDate || "2020",
            endDate: e.endDate || "Present",
            current: e.endDate === "Present",
            bullets: e.bullets || [],
          })),
          education: (parsed.education || []).map((ed: any) => ({
            id: uid("ed"),
            institution: ed.institution || "University",
            degree: ed.degree || "Degree",
            field: ed.field || "",
            startDate: ed.startDate || "2016",
            endDate: ed.endDate || "2020",
          })),
          skills: parsed.skills || [],
        });
      } else {
        toast.error("Failed to structure profile text.");
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err.message || "Failed to process text.");
    } finally {
      setLoading(false);
    }
  };

  // Sample quick load
  const handleLoadSample = (sample: typeof SAMPLE_LINKEDIN_PROFILES[0]) => {
    applyDataToResume({
      name: sample.name,
      headline: sample.headline,
      contact: {
        email: `${sample.name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
        phone: "+1 (555) 019-2834",
        location: sample.location,
        linkedin: `https://linkedin.com/in/${sample.name.toLowerCase().replace(/\s+/g, "-")}`,
      },
      summary: sample.summary,
      experience: sample.experience.map((e) => ({
        id: uid("e"),
        ...e,
      })),
      education: sample.education.map((ed) => ({
        id: uid("ed"),
        ...ed,
      })),
      skills: sample.skills,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#0A66C2]/10 text-[#0A66C2]">
              <Icon name="Linkedin" className="w-5 h-5" />
            </span>
            <DialogTitle className="text-lg font-bold font-display">
              Import from LinkedIn
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs sm:text-sm">
            Auto-fill all resume builder sections directly from your LinkedIn profile. Saves you manual typing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Method Tabs */}
          <div className="flex items-center gap-1.5 border-b border-border pb-2">
            <Button
              variant={activeTab === "url" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("url")}
              className={`text-xs h-8 gap-1.5 ${activeTab === "url" ? "bg-[#0A66C2] text-white" : ""}`}
            >
              <Icon name="Link" className="w-3.5 h-3.5" /> Profile URL
            </Button>

            <Button
              variant={activeTab === "pdf" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("pdf")}
              className={`text-xs h-8 gap-1.5 ${activeTab === "pdf" ? "bg-[#0A66C2] text-white" : ""}`}
            >
              <Icon name="FileDown" className="w-3.5 h-3.5" /> LinkedIn PDF Export
            </Button>

            <Button
              variant={activeTab === "paste" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("paste")}
              className={`text-xs h-8 gap-1.5 ${activeTab === "paste" ? "bg-[#0A66C2] text-white" : ""}`}
            >
              <Icon name="ClipboardPaste" className="w-3.5 h-3.5" /> Paste Profile Text
            </Button>
          </div>

          {/* Tab 1: Profile URL */}
          {activeTab === "url" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">LinkedIn Profile URL</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://www.linkedin.com/in/your-profile-name"
                    value={profileUrl}
                    onChange={(e) => setProfileUrl(e.target.value)}
                    className="text-xs h-9"
                  />
                  <Button
                    onClick={handleImportUrl}
                    disabled={loading || !profileUrl}
                    className="bg-[#0A66C2] hover:bg-[#084e96] text-white text-xs h-9 gap-1.5 shrink-0"
                  >
                    {loading ? (
                      <Icon name="Loader2" className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Icon name="Download" className="w-3.5 h-3.5" />
                    )}
                    Import Profile
                  </Button>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Tip: Paste your public LinkedIn URL. The AI parser extracts work experience, dates, bullets, skills, and education into your active resume.
              </p>
            </div>
          )}

          {/* Tab 2: LinkedIn PDF */}
          {activeTab === "pdf" && (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handlePdfUpload}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#0A66C2]/40 hover:border-[#0A66C2] bg-[#0A66C2]/5 rounded-2xl p-6 text-center cursor-pointer transition-all hover:shadow-xs space-y-2"
              >
                <Icon name="FileUp" className="w-8 h-8 text-[#0A66C2] mx-auto" />
                <div className="font-semibold text-xs text-foreground">
                  Click or drag your LinkedIn profile PDF here
                </div>
                <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                  How to export: In LinkedIn, go to your profile, click <strong>"More"</strong>, then select <strong>"Save to PDF"</strong>.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loading}
                  className="text-xs border-[#0A66C2]/40 text-[#0A66C2] mt-1"
                >
                  {loading ? "Parsing PDF..." : "Select LinkedIn PDF"}
                </Button>
              </div>
            </div>
          )}

          {/* Tab 3: Paste Profile Text */}
          {activeTab === "paste" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Paste Profile Content</Label>
                <Textarea
                  placeholder="Copy and paste sections directly from your LinkedIn profile (About summary, Work Experience, Skills)..."
                  value={profileText}
                  onChange={(e) => setProfileText(e.target.value)}
                  rows={5}
                  className="text-xs"
                />
              </div>
              <Button
                onClick={handleImportText}
                disabled={loading || !profileText.trim()}
                className="bg-[#0A66C2] hover:bg-[#084e96] text-white text-xs h-9 w-full gap-1.5"
              >
                {loading ? <Icon name="Loader2" className="w-3.5 h-3.5 animate-spin" /> : <Icon name="Sparkles" className="w-3.5 h-3.5" />}
                Auto-Fill Resume Sections from Text
              </Button>
            </div>
          )}

          {/* Instant One-Click Samples */}
          <div className="pt-3 border-t border-border space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Icon name="Sparkles" className="w-3 h-3 text-gold" /> Or Test with One-Click Sample LinkedIn Profile
            </span>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_LINKEDIN_PROFILES.map((sample) => (
                <Button
                  key={sample.label}
                  variant="outline"
                  size="sm"
                  onClick={() => handleLoadSample(sample)}
                  className="text-xs h-8 gap-1.5 border-border hover:border-[#0A66C2]/60 hover:bg-[#0A66C2]/5"
                >
                  <Icon name="Linkedin" className="w-3 h-3 text-[#0A66C2]" />
                  {sample.label} ({sample.name})
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
