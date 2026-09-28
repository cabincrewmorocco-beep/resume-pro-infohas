"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Icon, ScoreRing } from "@/components/shared";
import { useApp } from "@/lib/store";
import type { InterviewSessionRecord } from "@/hooks/interview/types";
import { toast } from "sonner";

export function InterviewHistoryLog({
  onStartNewSession,
}: {
  onStartNewSession?: () => void;
}) {
  const interviewSessions = useApp((s) => s.interviewSessions);
  const removeInterviewSession = useApp((s) => s.removeInterviewSession);
  const addInterviewSession = useApp((s) => s.addInterviewSession);
  const setView = useApp((s) => s.setView);

  const [selectedSession, setSelectedSession] = useState<InterviewSessionRecord | null>(null);
  const [filterRole, setFilterRole] = useState<string>("all");

  // Calculate metrics over time
  const completedSessions = interviewSessions.filter((s) => s.status === "completed" || s.answers?.length);
  const totalSessions = interviewSessions.length;
  const totalQuestionsPracticed = interviewSessions.reduce(
    (acc, s) => acc + (s.answers?.length || s.recordings?.length || 1),
    0
  );

  const scores = interviewSessions
    .map((s) => {
      if (typeof s.overallScore === "number") return s.overallScore;
      if (s.reportRef) {
        try {
          const r = JSON.parse(s.reportRef);
          if (typeof r.overallScore === "number") return r.overallScore;
        } catch {}
      }
      return 75;
    })
    .reverse();

  const averageScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;

  const scoreImprovement =
    scores.length >= 2 ? scores[scores.length - 1] - scores[0] : 0;

  // Filtered sessions
  const filteredSessions = interviewSessions.filter((s) => {
    if (filterRole === "all") return true;
    return s.role?.toLowerCase().includes(filterRole.toLowerCase());
  });

  // Export session transcript
  const handleExportTranscript = (session: InterviewSessionRecord) => {
    let transcriptText = `INTERVIEW TRANSCRIPT & FEEDBACK LOG\n`;
    transcriptText += `====================================\n`;
    transcriptText += `Role: ${session.role || "Target Role"}\n`;
    transcriptText += `Company: ${session.company || "Target Company"}\n`;
    transcriptText += `Date: ${new Date(session.startedAt).toLocaleString()}\n`;
    transcriptText += `Overall Score: ${session.overallScore || 85}/100\n\n`;

    if (session.answers && session.answers.length > 0) {
      session.answers.forEach((ans, idx) => {
        transcriptText += `--- QUESTION ${idx + 1} ---\n`;
        transcriptText += `Q: ${ans.question || ans.questionText || "Question " + (idx + 1)}\n\n`;
        transcriptText += `CANDIDATE RESPONSE:\n${ans.transcript || ans.answer || "(No transcript recorded)"}\n\n`;
        transcriptText += `AI EVALUATION (Score: ${ans.score || 80}/100):\n`;
        transcriptText += `Feedback: ${ans.feedback || "Good response"}\n`;
        if (ans.betterAnswer) {
          transcriptText += `Polished Model Answer:\n${ans.betterAnswer}\n`;
        }
        transcriptText += `\n`;
      });
    } else {
      transcriptText += `No detailed question transcripts available for this session.\n`;
    }

    const blob = new Blob([transcriptText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `interview-transcript-${(session.role || "mock").toLowerCase().replace(/\s+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Transcript exported as text file!");
  };

  // Seed sample mock sessions for demonstration
  const handleSeedSampleSessions = () => {
    const sample1: InterviewSessionRecord = {
      id: "sim_sample_1",
      packageId: "gemini_simulator",
      role: "Lead Platform Engineer",
      company: "Stripe",
      industry: "Fintech",
      status: "completed",
      startedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      completedAt: new Date(Date.now() - 86400000 * 3 + 1200000).toISOString(),
      recordings: [],
      overallScore: 78,
      answers: [
        {
          questionId: "q1",
          question: "How have you approached zero-downtime database migrations in mission-critical distributed systems?",
          transcript: "In my previous role, we utilized the expand-contract pattern. We first deployed database schema changes in a backwards-compatible manner, followed by dual-writing with safety toggles, and then verified reading from the new structure before deprecating old columns.",
          score: 82,
          feedback: "Strong architectural understanding of the expand-contract methodology. Well articulated with technical clarity.",
          betterAnswer: "At Stripe scale, I execute zero-downtime schema evolution using a three-phase deploy: 1) Additive non-breaking migrations, 2) Dual-write application rollout guarded by canary flags and latency telemetry, 3) Backfill and old column retirement.",
        },
        {
          questionId: "q2",
          question: "Tell me about a time you had a technical disagreement with a team member. How did you resolve it?",
          transcript: "A teammate wanted to rewrite an internal caching layer in Rust while I believed optimizing Redis was faster. We established measurable benchmarks and agreed to test both in staging for 48 hours.",
          score: 74,
          feedback: "Great emphasis on data-driven benchmarking. To achieve executive level, highlight empathy and the ongoing relationship post-decision.",
          betterAnswer: "I anchored our discussion on business requirements and latency SLOs rather than subjective preferences. By co-authoring an evaluation framework with shared telemetry, we determined optimizing our existing Redis deployment met our 99th-percentile SLA with 70% lower engineering risk.",
        }
      ],
      analytics: { clarity: 80, structure: 76, relevance: 78, confidence: 75 },
    };

    const sample2: InterviewSessionRecord = {
      id: "sim_sample_2",
      packageId: "gemini_simulator",
      role: "Lead Platform Engineer",
      company: "Stripe",
      industry: "Fintech",
      status: "completed",
      startedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      completedAt: new Date(Date.now() - 86400000 * 1 + 1400000).toISOString(),
      recordings: [],
      overallScore: 89,
      answers: [
        {
          questionId: "q1",
          question: "Walk me through how you diagnose an intermittent P99 latency spike in a microservices mesh.",
          transcript: "Situation: Our checkout service began experiencing random 400ms latency spikes during peak load. Task: I was tasked with finding the root cause without impacting customer transactions. Action: I used distributed tracing with OpenTelemetry to trace trace-IDs, isolating a downstream lock contention on auth token validation. I introduced a local LRU cache with jitter. Result: P99 latency stabilized at 32ms and error rate dropped to 0.001%.",
          score: 92,
          feedback: "Flawless STAR structure! Quantified metrics, clear ownership, and systematic debugging methodology.",
          betterAnswer: "Excellent delivery! The candidate clearly demonstrated command of modern telemetry tooling and structured communication.",
        },
        {
          questionId: "q2",
          question: "How do you mentor mid-level engineers to transition into principal or staff-level thinking?",
          transcript: "I transition engineers from solving assigned tasks to identifying strategic system risks before they happen. I invite them to architectural reviews, assign RFC authoring, and pair-program on high-leverage refactors.",
          score: 86,
          feedback: "Great leadership demonstration. Strong strategic maturity.",
          betterAnswer: "I coach engineers through three pillars: 1) Expanding scope from component-level code to organizational architecture, 2) Communicating business trade-offs to non-technical stakeholders, 3) Multiplying team impact through technical documentation and sponsorship.",
        }
      ],
      analytics: { clarity: 90, structure: 88, relevance: 91, confidence: 88 },
    };

    addInterviewSession(sample1);
    addInterviewSession(sample2);
    toast.success("Loaded 2 sample mock sessions with transcripts & feedback!");
  };

  return (
    <Card className="w-full max-w-full overflow-hidden border border-border/80 shadow-premium">
      <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-border/60 bg-muted/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-brand/10 text-brand">
                <Icon name="History" className="w-4 h-4" />
              </span>
              <CardTitle className="text-base sm:text-lg font-bold font-display">
                Interview History & Progress Log
              </CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm">
              Review full transcripts, question-by-question candidate responses, and AI feedback to track progress over time.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {interviewSessions.length === 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSeedSampleSessions}
                className="text-xs h-8 gap-1.5 border-dashed"
              >
                <Icon name="Sparkles" className="w-3.5 h-3.5 text-gold" />
                Load Sample History
              </Button>
            )}

            <Button
              size="sm"
              onClick={() => {
                if (onStartNewSession) onStartNewSession();
                else setView("interview-simulator");
              }}
              className="bg-brand hover:bg-brand-dark text-white text-xs h-8 gap-1.5"
            >
              <Icon name="Plus" className="w-3.5 h-3.5" />
              New Mock Interview
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-6">
        {/* Progress Analytics Over Time */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-card border border-border space-y-1">
            <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
              Total Mock Sessions
            </div>
            <div className="text-xl sm:text-2xl font-bold font-display text-foreground">
              {totalSessions}
            </div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Icon name="CheckCircle" className="w-3 h-3 text-emerald-500" />
              {completedSessions.length} completed
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-card border border-border space-y-1">
            <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
              Average Score
            </div>
            <div className="text-xl sm:text-2xl font-bold font-display text-foreground">
              {averageScore > 0 ? `${averageScore}%` : "—"}
            </div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
              {scoreImprovement > 0 ? (
                <span className="text-emerald-500 flex items-center gap-0.5 font-medium">
                  <Icon name="TrendingUp" className="w-3 h-3" /> +{scoreImprovement}% improvement
                </span>
              ) : (
                <span>Baseline established</span>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-card border border-border space-y-1">
            <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
              Questions Practiced
            </div>
            <div className="text-xl sm:text-2xl font-bold font-display text-foreground">
              {totalQuestionsPracticed}
            </div>
            <div className="text-[10px] text-muted-foreground">Across all competencies</div>
          </div>

          <div className="p-3.5 rounded-xl bg-card border border-border space-y-1">
            <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
              Top Performance
            </div>
            <div className="text-xl sm:text-2xl font-bold font-display text-emerald-600 dark:text-emerald-400">
              {scores.length > 0 ? `${Math.max(...scores)}%` : "—"}
            </div>
            <div className="text-[10px] text-muted-foreground">Executive readiness tier</div>
          </div>
        </div>

        {/* Progress Trajectory Visual Bar */}
        {scores.length > 1 && (
          <div className="p-4 rounded-xl bg-muted/30 border border-border/70 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Icon name="Activity" className="w-3.5 h-3.5 text-brand" />
                Score Trajectory Across Practice Sessions
              </span>
              <span className="text-muted-foreground font-mono text-[11px]">
                {scores.length} sessions tracked
              </span>
            </div>

            <div className="h-16 flex items-end gap-2 pt-2 pb-1 px-1">
              {scores.map((sc, i) => {
                const heightPercent = Math.max(sc, 20);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <span className="text-[10px] font-bold font-mono opacity-0 group-hover:opacity-100 transition-opacity absolute -top-5">
                      {sc}%
                    </span>
                    <div
                      className={`w-full rounded-t-md transition-all duration-300 ${
                        sc >= 85
                          ? "bg-emerald-500 hover:bg-emerald-600"
                          : sc >= 70
                          ? "bg-brand hover:bg-brand-dark"
                          : "bg-amber-500 hover:bg-amber-600"
                      }`}
                      style={{ height: `${heightPercent}%` }}
                    />
                    <span className="text-[9px] text-muted-foreground font-mono">S{i + 1}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Previous Sessions List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Icon name="List" className="w-3.5 h-3.5 text-brand" /> Logged Mock Sessions ({filteredSessions.length})
            </h4>
            {interviewSessions.length > 0 && (
              <span className="text-[11px] text-muted-foreground">Click a session to view full transcripts</span>
            )}
          </div>

          <div className="space-y-2.5">
            {filteredSessions.map((session) => {
              const sessionScore = session.overallScore || 80;
              const hasTranscripts = session.answers && session.answers.length > 0;

              return (
                <motion.div
                  key={session.id}
                  layout
                  className="rounded-xl border border-border bg-card p-3.5 sm:p-4 hover:border-brand/40 hover:shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group"
                  onClick={() => setSelectedSession(session)}
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground group-hover:text-brand transition-colors truncate">
                        {session.role || "Target Role Session"}
                      </span>
                      {session.company && (
                        <Badge variant="secondary" className="text-[10px] truncate">
                          {session.company}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-[10px] capitalize ${
                          sessionScore >= 85
                            ? "text-emerald-500 border-emerald-500/30"
                            : sessionScore >= 70
                            ? "text-blue-500 border-blue-500/30"
                            : "text-amber-500 border-amber-500/30"
                        }`}
                      >
                        {session.status}
                      </Badge>
                    </div>

                    <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span>{new Date(session.startedAt).toLocaleDateString()}</span>
                      <span>·</span>
                      <span>{session.answers?.length || session.recordings?.length || 1} questions</span>
                      {hasTranscripts && (
                        <>
                          <span>·</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
                            <Icon name="FileText" className="w-3 h-3" /> Transcripts & Feedback
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                    <div className="text-right">
                      <div className="text-lg font-bold font-display text-foreground">
                        {sessionScore}%
                      </div>
                      <span className="text-[10px] text-muted-foreground">Score</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSession(session);
                        }}
                        className="text-xs h-8 px-2.5 gap-1 text-brand"
                      >
                        <Icon name="Eye" className="w-3.5 h-3.5" /> View Log
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeInterviewSession(session.id);
                          toast.success("Session removed from history.");
                        }}
                        className="h-8 px-2 text-destructive hover:bg-destructive/10"
                        title="Delete session"
                      >
                        <Icon name="Trash2" className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {filteredSessions.length === 0 && (
              <div className="p-8 text-center rounded-2xl border border-dashed border-border bg-muted/10 space-y-3">
                <Icon name="History" className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                <h4 className="font-semibold text-foreground text-sm">No Mock Interview Logs Yet</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Practice with the Gemini Interview Simulator or load a sample history to see questions,
                  transcripts, and feedback tracked over time.
                </p>
                <div className="flex justify-center gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSeedSampleSessions}
                    className="text-xs"
                  >
                    Load Sample Sessions
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (onStartNewSession) onStartNewSession();
                      else setView("interview-simulator");
                    }}
                    className="bg-brand text-white text-xs"
                  >
                    Start First Interview
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>

      {/* Session Detail Modal with Full Transcripts and Feedback */}
      <Dialog open={Boolean(selectedSession)} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedSession && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between pr-4">
                  <DialogTitle className="text-lg font-bold font-display flex items-center gap-2">
                    <Icon name="FileText" className="w-5 h-5 text-brand" />
                    Interview Transcript & Feedback Log
                  </DialogTitle>
                  <Badge className="bg-brand text-white font-mono text-xs">
                    Score: {selectedSession.overallScore || 80}/100
                  </Badge>
                </div>
                <DialogDescription>
                  {selectedSession.role || "Target Role"} {selectedSession.company ? `@ ${selectedSession.company}` : ""} · Recorded on {new Date(selectedSession.startedAt).toLocaleString()}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-2">
                {/* Metric Strip */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-lg bg-card border border-border">
                    <div className="font-bold text-foreground">{selectedSession.answers?.length || 1}</div>
                    <div className="text-[10px] text-muted-foreground">Questions Answered</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-card border border-border">
                    <div className="font-bold text-emerald-600 dark:text-emerald-400 capitalize">
                      {selectedSession.status}
                    </div>
                    <div className="text-[10px] text-muted-foreground">Session Status</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-card border border-border">
                    <div className="font-bold text-foreground">
                      {selectedSession.analytics?.confidence ? `${selectedSession.analytics.confidence}%` : "High"}
                    </div>
                    <div className="text-[10px] text-muted-foreground">Confidence Metric</div>
                  </div>
                </div>

                {/* Question by Question Transcripts */}
                {selectedSession.answers && selectedSession.answers.length > 0 ? (
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Icon name="MessagesSquare" className="w-3.5 h-3.5 text-brand" />
                      Detailed Questions, Spoken Transcripts & Feedback
                    </h4>

                    {selectedSession.answers.map((item, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-2xs"
                      >
                        {/* Question Header */}
                        <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-2">
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-bold text-brand uppercase tracking-wider">
                              Question {idx + 1}
                            </span>
                            <div className="font-semibold text-sm text-foreground">
                              {item.question || item.questionText || "Question Prompt"}
                            </div>
                          </div>
                          {typeof item.score === "number" && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brand/10 text-brand shrink-0">
                              {item.score}/100
                            </span>
                          )}
                        </div>

                        {/* Candidate Transcript */}
                        <div className="space-y-1">
                          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                            <Icon name="User" className="w-3 h-3 text-blue-500" />
                            Your Response Transcript
                          </div>
                          <div className="p-3 rounded-lg bg-muted/40 text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed border border-border/40">
                            {item.transcript || item.answer || "(No spoken answer recorded)"}
                          </div>
                        </div>

                        {/* AI Feedback */}
                        {item.feedback && (
                          <div className="space-y-1">
                            <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                              <Icon name="Sparkles" className="w-3 h-3" />
                              AI Evaluation & Coach Feedback
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed pl-1">
                              {item.feedback}
                            </p>
                          </div>
                        )}

                        {/* Polished Model Answer */}
                        {item.betterAnswer && (
                          <div className="p-3 rounded-lg bg-gold/5 border border-gold/20 text-xs space-y-1">
                            <div className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                              <Icon name="Award" className="w-3 h-3 text-gold" />
                              Polished Model Answer (Executive Quality)
                            </div>
                            <p className="text-muted-foreground italic leading-relaxed">
                              "{item.betterAnswer}"
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-muted/30 text-xs text-muted-foreground text-center">
                    This session recorded audio telemetry without full text transcription.
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportTranscript(selectedSession)}
                  className="gap-1.5 text-xs"
                >
                  <Icon name="Download" className="w-3.5 h-3.5" /> Export Transcript (.txt)
                </Button>

                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setSelectedSession(null)}
                  className="bg-brand text-white text-xs"
                >
                  Done
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
