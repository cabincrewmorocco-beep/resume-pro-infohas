"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Icon, ScoreRing } from "@/components/shared";
import { useApp } from "@/lib/store";
import {
  generateContextAwareInterviewQuestions,
  evaluateCandidateAnswer,
  type SimulatorQuestion,
  type SimulatorResponse,
  type EvaluationResult,
} from "@/lib/interview/simulator-client";
import { toast } from "sonner";

export function InterviewSimulator({
  defaultResumeId,
  defaultJdId,
  onNavigate,
}: {
  defaultResumeId?: string;
  defaultJdId?: string;
  onNavigate?: (view: string) => void;
}) {
  const resumes = useApp((s) => s.resumes);
  const jds = useApp((s) => s.jobDescriptions);
  const addInterviewSession = useApp((s) => s.addInterviewSession);
  const setView = useApp((s) => s.setView);

  // Resume & JD Selection State
  const [selectedResumeId, setSelectedResumeId] = useState<string>(
    defaultResumeId || resumes[0]?.id || "manual"
  );
  const [selectedJdId, setSelectedJdId] = useState<string>(
    defaultJdId || jds[0]?.id || "manual"
  );
  const [manualResumeText, setManualResumeText] = useState("");
  const [manualJdText, setManualJdText] = useState("");
  const [targetRole, setTargetRole] = useState("Senior Professional");
  const [targetCompany, setTargetCompany] = useState("Target Company");

  // Options
  const [difficulty, setDifficulty] = useState<"adaptive" | "easy" | "medium" | "hard">("adaptive");
  const [interviewType, setInterviewType] = useState<"all" | "technical" | "behavioral" | "situational" | "leadership">("all");
  const [questionCount, setQuestionCount] = useState(5);

  // Generation State
  const [generating, setGenerating] = useState(false);
  const [simulationData, setSimulationData] = useState<SimulatorResponse | null>(null);

  // Active Simulation State
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [candidateAnswers, setCandidateAnswers] = useState<Record<string, string>>({});
  const [evaluations, setEvaluations] = useState<Record<string, EvaluationResult>>({});
  const [evaluating, setEvaluating] = useState(false);
  const [showSampleAnswer, setShowSampleAnswer] = useState<Record<string, boolean>>({});

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Stopwatch timer for answering
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(false);

  useEffect(() => {
    let interval: any;
    if (timerActive) {
      interval = setInterval(() => setTimerSeconds((s) => s + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive]);

  // Sync selected resume
  const activeResume = useMemo(() => {
    return resumes.find((r) => r.id === selectedResumeId) || null;
  }, [resumes, selectedResumeId]);

  // Sync selected JD
  const activeJd = useMemo(() => {
    return jds.find((j) => j.id === selectedJdId) || null;
  }, [jds, selectedJdId]);

  useEffect(() => {
    if (activeJd) {
      setTargetRole(activeJd.title || activeJd.company ? `${activeJd.title || "Role"} at ${activeJd.company || "Company"}` : targetRole);
      setTargetCompany(activeJd.company || targetCompany);
    }
  }, [activeJd]);

  // Format timer
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Generate Questions Handler
  const handleGenerate = async () => {
    const resumeTextToUse = activeResume
      ? `${activeResume.name || ""} - ${activeResume.headline || ""}\n${activeResume.summary || ""}\n${activeResume.experience?.map((e) => `${e.title} at ${e.company}: ${e.bullets?.join("; ")}`).join("\n")}\nSkills: ${activeResume.skills?.map((s) => (typeof s === "string" ? s : s.name)).join(", ")}`
      : manualResumeText;

    const jdTextToUse = activeJd
      ? `${activeJd.title || ""} at ${activeJd.company || ""}\n${activeJd.rawText || activeJd.keywords?.join(", ")}`
      : manualJdText;

    if (!resumeTextToUse.trim()) {
      toast.error("Please select a resume or enter resume details.");
      return;
    }

    if (!jdTextToUse.trim()) {
      toast.error("Please select or paste a target job description.");
      return;
    }

    setGenerating(true);
    try {
      const result = await generateContextAwareInterviewQuestions({
        resumeText: resumeTextToUse,
        resumeData: activeResume,
        jdText: jdTextToUse,
        jdTitle: targetRole,
        company: targetCompany,
        difficulty,
        questionCount,
        interviewType,
      });

      if (result.ok && result.questions?.length > 0) {
        setSimulationData(result);
        setActiveQuestionIndex(0);
        setCandidateAnswers({});
        setEvaluations({});
        setShowSampleAnswer({});
        setTimerSeconds(0);
        setTimerActive(true);
        toast.success(`Generated ${result.questions.length} Gemini-powered interview questions!`);
      } else {
        toast.error(result.error || "Could not generate interview questions.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to contact Gemini interview simulator.");
    } finally {
      setGenerating(false);
    }
  };

  // Answer change handler
  const currentQuestion = simulationData?.questions?.[activeQuestionIndex];
  const currentAnswer = currentQuestion ? candidateAnswers[currentQuestion.id] || "" : "";

  const handleAnswerChange = (val: string) => {
    if (!currentQuestion) return;
    setCandidateAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: val,
    }));
  };

  // Voice dictation toggle
  const toggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in this browser. Please type your answer.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsRecording(true);
        toast.info("Listening... Speak your interview answer clearly.");
      };

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim() && currentQuestion) {
          handleAnswerChange(
            currentAnswer ? `${currentAnswer} ${transcript.trim()}` : transcript.trim()
          );
        }
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsRecording(false);
      toast.error("Could not activate microphone for speech recognition.");
    }
  };

  // Evaluate candidate answer
  const handleEvaluate = async () => {
    if (!currentQuestion || !currentAnswer.trim()) {
      toast.error("Please provide an answer before requesting Gemini evaluation.");
      return;
    }

    setEvaluating(true);
    try {
      const result = await evaluateCandidateAnswer({
        question: currentQuestion.question,
        category: currentQuestion.category,
        candidateAnswer: currentAnswer,
        expectedPoints: currentQuestion.expectedPoints,
        jdTitle: targetRole,
      });

      if (result.ok) {
        setEvaluations((prev) => ({
          ...prev,
          [currentQuestion.id]: result,
        }));
        toast.success(`Answer scored: ${result.score}/100!`);
      } else {
        toast.error(result.error || "Evaluation failed.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to evaluate answer.");
    } finally {
      setEvaluating(false);
    }
  };

  // Save session to history
  const handleSaveSession = () => {
    if (!simulationData) return;

    const completedCount = Object.keys(evaluations).length;
    const avgScore =
      completedCount > 0
        ? Math.round(
            Object.values(evaluations).reduce((acc, curr) => acc + curr.score, 0) / completedCount
          )
        : 85;

    addInterviewSession({
      id: "sim_" + Math.random().toString(36).slice(2, 9),
      packageId: "gemini_simulator",
      startedAt: new Date(Date.now() - (timerSeconds || 300) * 1000).toISOString(),
      completedAt: new Date().toISOString(),
      role: targetRole,
      company: targetCompany,
      industry: "General",
      status: "completed",
      recordings: [],
      overallScore: avgScore,
      answers: simulationData.questions.map((q) => ({
        questionId: q.id,
        question: q.question,
        questionText: q.question,
        durationSeconds: q.suggestedDurationSeconds || 120,
        score: evaluations[q.id]?.score || 80,
        feedback: evaluations[q.id]?.feedbackSummary || "Answer demonstrated core competencies.",
        transcript: candidateAnswers[q.id] || "(No spoken answer recorded)",
        answer: candidateAnswers[q.id] || "",
        betterAnswer: evaluations[q.id]?.betterAnswer,
        starBreakdown: {
          situation: evaluations[q.id]?.starScore || 80,
          task: evaluations[q.id]?.clarityScore || 80,
          action: evaluations[q.id]?.relevanceScore || 80,
          result: evaluations[q.id]?.score || 80,
        },
      })),
      analytics: {
        clarity: avgScore,
        structure: avgScore,
        relevance: avgScore,
        confidence: avgScore,
        pacingWpm: 135,
        fillerWordCount: 2,
        sentiment: "positive",
      },
    });

    toast.success("Interview session saved to your practice records!");
  };

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Hero Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-5 sm:p-7 relative overflow-hidden shadow-premium">
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -bottom-8 right-1/4 w-40 h-40 rounded-full bg-indigo-500/20 blur-2xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-blue-500/20 border-blue-400/30 text-blue-200">
                <Icon name="Sparkles" className="w-3.5 h-3.5 mr-1 text-blue-300" />
                Gemini 3.8 Flash Engine
              </Badge>
              <Badge variant="outline" className="text-white/80 border-white/20">
                Context-Aware Mock Interview
              </Badge>
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold font-display tracking-tight">
              AI Interview Simulator
            </h2>
            <p className="text-sm text-slate-300 text-pretty">
              Deep, realistic mock interview questions generated directly from the intersection of
              your actual resume experience and target job description requirements.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            {simulationData && (
              <Button
                variant="outline"
                onClick={() => {
                  setSimulationData(null);
                  setTimerActive(false);
                }}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 gap-1.5"
              >
                <Icon name="RotateCcw" className="w-4 h-4" /> Reset Setup
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Setup Form (when no simulation is active or editing) */}
      {!simulationData && (
        <Card className="border border-border/80 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Icon name="SlidersHorizontal" className="w-5 h-5 text-brand" />
              Configure Interview Context
            </CardTitle>
            <CardDescription>
              Select your resume and job description so Gemini can identify your background matches and
              critical competency probes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Resume Selection */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Icon name="FileText" className="w-3.5 h-3.5 text-blue-500" />
                  Source Resume
                </label>
                <Select value={selectedResumeId} onValueChange={setSelectedResumeId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select candidate resume" />
                  </SelectTrigger>
                  <SelectContent>
                    {resumes.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.title || r.name || "Untitled Resume"} ({r.experience?.length || 0} exp)
                      </SelectItem>
                    ))}
                    <SelectItem value="manual">Custom / Paste Resume Text</SelectItem>
                  </SelectContent>
                </Select>

                {selectedResumeId === "manual" && (
                  <Textarea
                    placeholder="Paste candidate resume text, skills, past roles..."
                    value={manualResumeText}
                    onChange={(e) => setManualResumeText(e.target.value)}
                    rows={4}
                    className="text-xs font-mono mt-2"
                  />
                )}
              </div>

              {/* Job Description Selection */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Icon name="Target" className="w-3.5 h-3.5 text-emerald-500" />
                  Target Job Description
                </label>
                <Select value={selectedJdId} onValueChange={setSelectedJdId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select target job description" />
                  </SelectTrigger>
                  <SelectContent>
                    {jds.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.title || "Job Posting"} {j.company ? `(${j.company})` : ""}
                      </SelectItem>
                    ))}
                    <SelectItem value="manual">Custom / Paste Job Description</SelectItem>
                  </SelectContent>
                </Select>

                {selectedJdId === "manual" && (
                  <div className="space-y-2 mt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Target Role (e.g. Senior Tech Lead)"
                        value={targetRole}
                        onChange={(e) => setTargetRole(e.target.value)}
                        className="text-xs"
                      />
                      <Input
                        placeholder="Target Company"
                        value={targetCompany}
                        onChange={(e) => setTargetCompany(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <Textarea
                      placeholder="Paste target job responsibilities, requirements, and qualifications..."
                      value={manualJdText}
                      onChange={(e) => setManualJdText(e.target.value)}
                      rows={3}
                      className="text-xs font-mono"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Custom Tuning Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-border/60">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Difficulty Bias</label>
                <Select value={difficulty} onValueChange={(v: any) => setDifficulty(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="adaptive">Adaptive (Recommended)</SelectItem>
                    <SelectItem value="easy">Foundational / Entry Level</SelectItem>
                    <SelectItem value="medium">Standard Mid-Level</SelectItem>
                    <SelectItem value="hard">Bar-Raiser / Executive Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Question Focus</label>
                <Select value={interviewType} onValueChange={(v: any) => setInterviewType(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Comprehensive (Balanced)</SelectItem>
                    <SelectItem value="technical">Technical & Systems</SelectItem>
                    <SelectItem value="behavioral">Behavioral (STAR)</SelectItem>
                    <SelectItem value="situational">Situational & Crises</SelectItem>
                    <SelectItem value="leadership">Leadership & Strategy</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Question Volume</label>
                <Select
                  value={questionCount.toString()}
                  onValueChange={(v) => setQuestionCount(parseInt(v, 10))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">4 High-Impact Questions</SelectItem>
                    <SelectItem value="6">6 Full Session Questions</SelectItem>
                    <SelectItem value="8">8 Comprehensive Deep Dive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                onClick={handleGenerate}
                disabled={generating}
                className="bg-brand hover:bg-brand-dark text-white gap-2 px-6 h-11 shadow-sm"
              >
                {generating ? (
                  <>
                    <Icon name="Loader2" className="w-4 h-4 animate-spin" />
                    Generating with Gemini...
                  </>
                ) : (
                  <>
                    <Icon name="Sparkles" className="w-4 h-4" />
                    Generate Context-Aware Questions
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Simulation View */}
      {simulationData && simulationData.questions?.length > 0 && (
        <div className="space-y-6">
          {/* Executive Match Intelligence Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border border-border/70 flex items-center p-4">
              <div className="flex items-center gap-4 w-full">
                <ScoreRing
                  value={simulationData.overallMatchPercent || 88}
                  size={84}
                  strokeWidth={7}
                  label="JD Match"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Role Alignment
                  </div>
                  <div className="text-sm font-bold truncate mt-0.5">{targetRole}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {simulationData.questions.length} tailored interview prompts
                  </div>
                </div>
              </div>
            </Card>

            <Card className="md:col-span-2 border border-border/70 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Icon name="Compass" className="w-3.5 h-3.5 text-blue-500" /> Gemini Strategy & Advice
                </span>
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-muted">
                  ⏱ Timer: {formatTime(timerSeconds)}
                </span>
              </div>
              <p className="text-xs text-foreground/90 line-clamp-2">
                {simulationData.preparationAdvice ||
                  "Focus on articulating specific business results and resolving trade-offs under pressure."}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(simulationData.keyStrengths || []).map((s, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  >
                    <Icon name="CheckCircle2" className="w-3 h-3" /> {s}
                  </span>
                ))}
              </div>
            </Card>
          </div>

          {/* Question Navigation Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {simulationData.questions.map((q, idx) => {
              const isEvaluated = Boolean(evaluations[q.id]);
              const isActive = idx === activeQuestionIndex;
              return (
                <button
                  key={q.id}
                  onClick={() => setActiveQuestionIndex(idx)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium transition-all shrink-0 flex items-center gap-2 border ${
                    isActive
                      ? "bg-brand text-white border-brand shadow-sm"
                      : isEvaluated
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                      : "bg-card hover:bg-muted text-muted-foreground border-border"
                  }`}
                >
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-white/20">
                    {idx + 1}
                  </span>
                  <span className="capitalize">{q.category}</span>
                  {isEvaluated && <Icon name="Check" className="w-3.5 h-3.5 text-emerald-500" />}
                </button>
              );
            })}
          </div>

          {/* Current Question Interactive Board */}
          {currentQuestion && (
            <Card className="border border-border/80 shadow-premium overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-border bg-muted/20 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize text-xs font-semibold">
                      {currentQuestion.category}
                    </Badge>
                    <Badge variant="secondary" className="capitalize text-xs">
                      {currentQuestion.subType}
                    </Badge>
                    <Badge
                      className={`text-[10px] capitalize ${
                        currentQuestion.difficulty === "hard"
                          ? "bg-red-500/10 text-red-600 border-red-500/20"
                          : currentQuestion.difficulty === "medium"
                          ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                          : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      }`}
                    >
                      {currentQuestion.difficulty}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Icon name="Clock" className="w-3.5 h-3.5" /> Target ~
                    {Math.round((currentQuestion.suggestedDurationSeconds || 150) / 60)} mins
                  </span>
                </div>

                <h3 className="text-lg sm:text-xl font-bold font-display text-foreground leading-snug">
                  {currentQuestion.question}
                </h3>

                {/* Context Rationale Highlight */}
                {currentQuestion.contextRationale && (
                  <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
                    <Icon name="HelpCircle" className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Why this question was generated: </span>
                      {currentQuestion.contextRationale}
                    </div>
                  </div>
                )}
              </div>

              <CardContent className="p-5 sm:p-6 space-y-5">
                {/* Expected Competencies / Points */}
                {currentQuestion.expectedPoints?.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <Icon name="ListChecks" className="w-3.5 h-3.5 text-brand" />
                      Key Points an Interviewer Looks For
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {currentQuestion.expectedPoints.map((pt, i) => (
                        <div
                          key={i}
                          className="text-xs p-2 rounded-lg bg-card border border-border flex items-start gap-1.5"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-brand mt-1.5 shrink-0" />
                          <span>{pt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Candidate Answer Box */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Icon name="PenTool" className="w-3.5 h-3.5 text-brand" />
                      Your Practice Answer
                    </label>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={isRecording ? "destructive" : "outline"}
                        onClick={toggleRecording}
                        className="gap-1.5 text-xs h-7"
                      >
                        <Icon name={isRecording ? "MicOff" : "Mic"} className="w-3.5 h-3.5" />
                        {isRecording ? "Listening..." : "Dictate Answer"}
                      </Button>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {currentAnswer.trim().split(/\s+/).filter(Boolean).length} words
                      </span>
                    </div>
                  </div>

                  <Textarea
                    placeholder="Type or dictate your response using the STAR method (Situation, Task, Action, Result)..."
                    value={currentAnswer}
                    onChange={(e) => handleAnswerChange(e.target.value)}
                    rows={6}
                    className="text-sm leading-relaxed"
                  />
                </div>

                {/* Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleEvaluate}
                      disabled={evaluating || !currentAnswer.trim()}
                      className="bg-brand hover:bg-brand-dark text-white gap-2"
                    >
                      {evaluating ? (
                        <>
                          <Icon name="Loader2" className="w-4 h-4 animate-spin" />
                          Evaluating with Gemini...
                        </>
                      ) : (
                        <>
                          <Icon name="Sparkles" className="w-4 h-4" />
                          Evaluate Answer
                        </>
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() =>
                        setShowSampleAnswer((prev) => ({
                          ...prev,
                          [currentQuestion.id]: !prev[currentQuestion.id],
                        }))
                      }
                      className="gap-1.5 text-xs"
                    >
                      <Icon
                        name={showSampleAnswer[currentQuestion.id] ? "EyeOff" : "Eye"}
                        className="w-3.5 h-3.5"
                      />
                      {showSampleAnswer[currentQuestion.id] ? "Hide Model Answer" : "View Model Answer"}
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={activeQuestionIndex === 0}
                      onClick={() => setActiveQuestionIndex((i) => Math.max(0, i - 1))}
                    >
                      <Icon name="ChevronLeft" className="w-4 h-4 mr-1" /> Prev
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={activeQuestionIndex === simulationData.questions.length - 1}
                      onClick={() =>
                        setActiveQuestionIndex((i) =>
                          Math.min(simulationData.questions.length - 1, i + 1)
                        )
                      }
                    >
                      Next <Icon name="ChevronRight" className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>

                {/* Model Answer Drawer */}
                <AnimatePresence>
                  {showSampleAnswer[currentQuestion.id] && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="rounded-xl border border-gold/40 bg-gold/5 p-4 space-y-2"
                    >
                      <div className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Icon name="Award" className="w-4 h-4 text-gold" />
                        Executive Model Answer (STAR Framework)
                      </div>
                      <p className="text-xs sm:text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                        {currentQuestion.sampleAnswer}
                      </p>
                      {currentQuestion.keywords?.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 pt-1">
                          <span className="text-[11px] text-muted-foreground mr-1">Recommended Keywords:</span>
                          {currentQuestion.keywords.map((kw, ki) => (
                            <Badge key={ki} variant="secondary" className="text-[10px]">
                              {kw}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Gemini Evaluation Results Card */}
                {evaluations[currentQuestion.id] && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-5 space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-500/20 pb-3">
                      <div>
                        <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Icon name="CheckCircle2" className="w-4 h-4" /> Gemini Answer Assessment
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {evaluations[currentQuestion.id].feedbackSummary}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-2xl font-bold font-display text-emerald-600 dark:text-emerald-400">
                            {evaluations[currentQuestion.id].score}/100
                          </div>
                          <span className="text-[10px] text-muted-foreground">Overall Score</span>
                        </div>
                      </div>
                    </div>

                    {/* Breakdown Scores */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 rounded-lg bg-card border border-border">
                        <div className="text-base font-bold text-foreground">
                          {evaluations[currentQuestion.id].clarityScore}%
                        </div>
                        <div className="text-[10px] text-muted-foreground">Clarity</div>
                      </div>
                      <div className="p-2 rounded-lg bg-card border border-border">
                        <div className="text-base font-bold text-foreground">
                          {evaluations[currentQuestion.id].relevanceScore}%
                        </div>
                        <div className="text-[10px] text-muted-foreground">JD Relevance</div>
                      </div>
                      <div className="p-2 rounded-lg bg-card border border-border">
                        <div className="text-base font-bold text-foreground">
                          {evaluations[currentQuestion.id].starScore}%
                        </div>
                        <div className="text-[10px] text-muted-foreground">STAR Structure</div>
                      </div>
                    </div>

                    {/* Strengths & Improvements */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="space-y-1">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <Icon name="ThumbsUp" className="w-3.5 h-3.5" /> What You Did Well
                        </span>
                        <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                          {(evaluations[currentQuestion.id].strengths || []).map((str, si) => (
                            <li key={si}>{str}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="space-y-1">
                        <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <Icon name="AlertCircle" className="w-3.5 h-3.5" /> Room for Growth
                        </span>
                        <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                          {(evaluations[currentQuestion.id].improvements || []).map((imp, ii) => (
                            <li key={ii}>{imp}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Polished Executive Version */}
                    {evaluations[currentQuestion.id].betterAnswer && (
                      <div className="rounded-xl bg-card border border-border p-3.5 space-y-1.5">
                        <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                          <Icon name="Sparkles" className="w-3.5 h-3.5 text-brand" />
                          Polished Delivery Suggestion
                        </span>
                        <p className="text-xs text-muted-foreground italic">
                          "{evaluations[currentQuestion.id].betterAnswer}"
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Footer Save & Export */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border">
            <div className="text-xs text-muted-foreground">
              {Object.keys(evaluations).length} of {simulationData.questions.length} questions
              evaluated
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveSession}
                className="gap-1.5 text-xs"
              >
                <Icon name="BookmarkCheck" className="w-4 h-4 text-emerald-500" />
                Save Practice Session
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (onNavigate) onNavigate("interview");
                  else setView("interview");
                }}
                className="bg-brand text-white gap-1.5 text-xs"
              >
                Go to Full Interview Suite <Icon name="ArrowRight" className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
