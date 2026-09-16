"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, Icon } from "@/components/shared";
import { useApp, uid } from "@/lib/store";
import { parseResumeFile, blankResume } from "@/lib/parser";
import { toast } from "sonner";
import type { ResumeData } from "@/lib/types";

export function MyResumes() {
  const resumes = useApp((s) => s.resumes);
  const addResume = useApp((s) => s.addResume);
  const removeResume = useApp((s) => s.removeResume);
  const setActiveResume = useApp((s) => s.setActiveResume);
  const setView = useApp((s) => s.setView);
  const incUsage = useApp((s) => s.incUsage);
  const log = useApp((s) => s.log);

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const [filter, setFilter] = useState<"all" | "upload" | "ai-optimized">("all");

  const onFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const file = files[0];
    setUploading(true);
    try {
      const parsed = await parseResumeFile(file);
      const originalEntry: ResumeData = {
        ...parsed,
        source: "upload",
        title: parsed.title || `${parsed.name || "Resume"} (Uploaded Resume)`,
        fileName: file.name,
        updatedAt: new Date().toISOString(),
      };
      addResume(originalEntry);
      incUsage("resumesGenerated");
      log({ actor: "you", action: `Uploaded resume: ${file.name}`, category: "resume", details: `${parsed.experience.length} experiences parsed`, severity: "info" });
      toast.success(`Parsed ${file.name}. ${parsed.experience.length} experiences, ${parsed.skills.length} skills extracted.`);
      setActiveResume(originalEntry.id);
      setView("builder");
    } catch (e: any) {
      toast.error(e?.message || "Failed to parse file.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const startBlank = () => {
    const r = blankResume();
    addResume(r);
    setActiveResume(r.id);
    setView("builder");
    toast.success("Started a new resume from scratch.");
  };

  const filteredResumes = resumes.filter((r) => {
    if (filter === "all") return true;
    if (filter === "upload") return r.source === "upload" || !r.source;
    if (filter === "ai-optimized") return r.source === "ai-optimized";
    return true;
  });

  const uploadCount = resumes.filter((r) => r.source === "upload" || !r.source).length;
  const optCount = resumes.filter((r) => r.source === "ai-optimized").length;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Icon name="FileText" className="w-6 h-6 text-brand" /> My Resumes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your uploaded originals and AI-optimized resumes. All documents are durably persisted in your local database.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={startBlank} className="gap-2">
            <Icon name="Plus" className="w-4 h-4" /> Blank resume
          </Button>
          <Button disabled={uploading} onClick={() => fileRef.current?.click()} className="bg-brand hover:bg-brand-dark text-white gap-2">
            {uploading ? <Icon name="Loader2" className="w-4 h-4 animate-spin" /> : <Icon name="Upload" className="w-4 h-4" />}
            {uploading ? "Parsing..." : "Upload resume"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.txt"
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
        </div>
      </div>

      {/* Upload dropzone */}
      <Card>
        <CardContent className="p-0">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); onFiles(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}
            className={`rounded-xl border-2 border-dashed m-4 p-10 text-center cursor-pointer transition ${dragOver ? "border-brand bg-brand-light/40" : "border-border hover:border-brand/50 hover:bg-secondary/40"}`}
          >
            {uploading ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3">
                <Icon name="Loader2" className="w-10 h-10 text-brand animate-spin" />
                <div className="font-medium">Parsing & Sanitizing your resume…</div>
                <div className="text-xs text-muted-foreground">Extracting text safely (5 MB max, up to 15k tokens)</div>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl gradient-brand text-white flex items-center justify-center shadow-glow">
                  <Icon name="Upload" className="w-6 h-6" />
                </div>
                <div className="font-semibold">Drop your resume here, or click to browse</div>
                <div className="text-xs text-muted-foreground">Supports PDF, DOCX, TXT — up to 5 MB</div>
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  <Badge variant="brand"><Icon name="ShieldCheck" className="w-3 h-3 mr-1" /> In-Browser Privacy</Badge>
                  <Badge variant="gold"><Icon name="Database" className="w-3 h-3 mr-1" /> Database Persisted</Badge>
                  <Badge variant="outline"><Icon name="CheckCircle" className="w-3 h-3 mr-1" /> Multi-Version Storage</Badge>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resumes list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3 pb-3">
          <div>
            <CardTitle className="text-lg">Saved Resumes ({resumes.length})</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Original uploads and optimized job-specific variants are stored separately.
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-secondary p-1 rounded-lg">
            <button
              onClick={() => setFilter("all")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${filter === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              All ({resumes.length})
            </button>
            <button
              onClick={() => setFilter("upload")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${filter === "upload" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Uploaded ({uploadCount})
            </button>
            <button
              onClick={() => setFilter("ai-optimized")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${filter === "ai-optimized" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Optimized ({optCount})
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredResumes.map((r) => (
              <div key={r.id} className="rounded-xl border border-border bg-card p-4 hover:shadow-premium transition flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0 flex-1 mr-2">
                      <div className="font-semibold truncate text-sm" title={r.title || r.name}>{r.title || r.name}</div>
                      {r.title && r.name && r.title !== r.name && (
                        <div className="text-xs text-muted-foreground truncate">{r.name}</div>
                      )}
                      {r.headline && <div className="text-xs text-muted-foreground truncate mt-0.5">{r.headline}</div>}
                    </div>
                    <Badge variant={r.source === "ai-optimized" ? "brand" : r.source === "upload" ? "gold" : "outline"} className="text-[10px] capitalize shrink-0">
                      {r.source === "ai-optimized" ? "AI Optimized" : r.source === "upload" ? "Uploaded" : (r.source?.replace("-", " ") || "Draft")}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 my-3 text-center">
                    <div className="rounded-lg bg-secondary p-2">
                      <div className="text-sm font-bold">{(r.experience || []).length}</div>
                      <div className="text-[10px] text-muted-foreground">Jobs</div>
                    </div>
                    <div className="rounded-lg bg-secondary p-2">
                      <div className="text-sm font-bold">{(r.skills || []).length}</div>
                      <div className="text-[10px] text-muted-foreground">Skills</div>
                    </div>
                    <div className="rounded-lg bg-secondary p-2">
                      <div className="text-sm font-bold">{(r.education || []).length}</div>
                      <div className="text-[10px] text-muted-foreground">Edu</div>
                    </div>
                  </div>
                  {r.targetRole && (
                    <div className="text-[11px] text-brand-dark dark:text-brand-light font-medium truncate mb-2">
                      Target: {r.targetRole}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/60">
                  <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => { setActiveResume(r.id); setView("builder"); }}>
                    <Icon name="Pencil" className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    title="Optimize this resume against a job description"
                    onClick={() => {
                      setActiveResume(r.id);
                      setView("optimizer");
                    }}
                  >
                    <Icon name="Sparkles" className="w-3.5 h-3.5 mr-1 text-brand" /> Optimize
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    title="Duplicate as Tailored Variant"
                    onClick={() => {
                      const variant: ResumeData = {
                        ...r,
                        id: uid("res"),
                        title: `${r.name} (Tailored Copy)`,
                        name: r.name,
                        headline: r.headline ? `${r.headline} - Tailored` : "Tailored Variant",
                        source: "ai-optimized" as const,
                        parentResumeId: r.id,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                      };
                      addResume(variant);
                      setActiveResume(variant.id);
                      toast.success(`Created tailored copy: "${variant.title}"`);
                    }}
                  >
                    <Icon name="Copy" className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" title="Run ATS Check" onClick={() => { setActiveResume(r.id); setView("ats-checker"); }}>
                    <Icon name="ScanText" className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => { removeResume(r.id); toast.success("Resume deleted"); }}>
                    <Icon name="Trash2" className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {filteredResumes.length === 0 && (
              <div className="col-span-full text-center py-8">
                <Icon name="FileText" className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground mt-2">
                  {filter === "all"
                    ? "No resumes yet. Upload one above or start from blank."
                    : filter === "upload"
                    ? "No uploaded resumes found."
                    : "No AI-optimized resumes found yet. Run an optimization to see it here."}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
