"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Icon, ScoreRing } from "@/components/shared";
import { useApp } from "@/lib/store";
import { toast } from "sonner";
import { useAudioMeter } from "@/hooks/interview/useAudioMeter";
import { analyzeFillerWords, FILLER_WORDS } from "@/hooks/interview/useFillerWordDetector";
import { callAI } from "@/lib/ai";

interface InterviewQuestion {
  id: string;
  category: "Behavioral (STAR)" | "Technical / Systems" | "Leadership & Conflict" | "Situational Judgment";
  question: string;
  context: string;
  keyCompetencies: string[];
  sampleStarFramework: {
    situation: string;
    task: string;
    action: string;
    result: string;
  };
}

const DEFAULT_QUESTIONS: InterviewQuestion[] = [
  {
    id: "q-1",
    category: "Behavioral (STAR)",
    question: "Tell me about a time you faced an unexpected technical roadblock or project deadline crisis. How did you resolve it?",
    context: "Evaluates problem-solving agility, composure under pressure, and cross-functional communication.",
    keyCompetencies: ["Crisis Management", "Root Cause Analysis", "Prioritization", "Communication"],
    sampleStarFramework: {
      situation: "Two weeks before product launch, our primary database migration failed due to schema mismatch.",
      task: "I needed to lead the rollback and implement an automated schema validation pipeline without delaying go-live.",
      action: "I convened emergency triage, authored an idempotent migration script, and ran parallel staging tests over the weekend.",
      result: "We delivered the release on schedule with zero customer data loss and 99.98% post-launch uptime."
    }
  },
  {
    id: "q-2",
    category: "Technical / Systems",
    question: "How do you ensure high performance, scalability, and reliability when designing a new feature or architectural service?",
    context: "Evaluates architectural mindset, trade-off analysis, testing philosophy, and monitoring metrics.",
    keyCompetencies: ["Scalability", "System Architecture", "Performance Tuning", "Observability"],
    sampleStarFramework: {
      situation: "Our customer analytics service started timing out as daily active users scaled 5x in 3 months.",
      task: "Redesign the query pipeline to maintain sub-100ms response times under peak load.",
      action: "Introduced Redis multi-tier caching, read-replica queries, and asynchronous background worker queues.",
      result: "Slashed 95th percentile latency from 1.4s to 85ms and cut database CPU utilization by 48%."
    }
  },
  {
    id: "q-3",
    category: "Leadership & Conflict",
    question: "Describe a situation where you had a strong disagreement with a colleague or stakeholder regarding technical or product direction. How did you handle it?",
    context: "Assesses empathy, objective data-driven decision making, conflict resolution, and commitment.",
    keyCompetencies: ["Stakeholder Management", "Diplomacy", "Data-Driven Consensus", "Team Collaboration"],
    sampleStarFramework: {
      situation: "Product leadership wanted to push an unreviewed feature before security audits were complete.",
      task: "I needed to protect customer data security while meeting product's go-to-market timeline.",
      action: "I compiled a risk matrix, isolated the high-risk endpoints, and proposed phased beta rollouts with automated feature flags.",
      result: "Both security and product signed off; the launch occurred on time with zero vulnerabilities found."
    }
  },
  {
    id: "q-4",
    category: "Situational Judgment",
    question: "If you joined our team and immediately noticed inefficiencies or technical debt slowing down releases, what steps would you take in your first 30 days?",
    context: "Assesses strategic onboarding, observation vs action balance, humility, and pragmatism.",
    keyCompetencies: ["Strategic Thinking", "Tech Debt Triage", "Listening Skills", "Incremental Progress"],
    sampleStarFramework: {
      situation: "Joining a team with 45-minute CI/CD pipelines and frequent flaky tests slowing deployments.",
      task: "Diagnose release bottlenecks without disrupting ongoing sprint deliverables.",
      action: "Interviewed engineers, profiled test suites, and parallelized Docker caching in an experimental branch.",
      result: "Reduced build times to 12 minutes within 3 weeks, increasing deployment frequency by 2.5x."
    }
  }
];

// STAR indicator keyword patterns
const STAR_PATTERNS = {
  situation: ["when i was", "at my previous", "in my role at", "our team faced", "we were working on", "the client had", "context was", "the problem started"],
  task: ["my objective was", "i was tasked with", "the goal was", "needed to", "my responsibility was", "the requirement was", "we had to ensure"],
  action: ["i spearheaded", "i engineered", "i initiated", "i built", "i organized", "i designed", "i implemented", "i conducted", "i refactored", "i resolved"],
  result: ["as a result", "we achieved", "increased by", "reduced by", "saved", "improved", "%", "dollars", "on time", "successfully delivered", "outcome was"]
};

export function InteractiveMockInterview() {
  const resumes = useApp((s) => s.resumes);
  const jds = useApp((s) => s.jobDescriptions);
  const activeResumeId = useApp((s) => s.activeResumeId);

  // Active question selection
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);
  const currentQuestion = DEFAULT_QUESTIONS[selectedQuestionIndex] || DEFAULT_QUESTIONS[0];

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);

  // Live Transcript State
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");

  // Evaluation & Feedback State
  const [evaluating, setEvaluating] = useState(false);
  const [feedbackReport, setFeedbackReport] = useState<{
    overallScore: number;
    clarityScore: number;
    relevanceScore: number;
    praise: string[];
    improvements: string[];
    modelAnswerTip: string;
  } | null>(null);

  // Browser Speech Support
  const [speechSupported, setSpeechSupported] = useState(true);

  // MediaRecorder & Web Audio refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  // Hook for audio volume meter
  const audioMeter = useAudioMeter();

  // Check speech recognition support
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setSpeechSupported(false);
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecordingCleanup();
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
      }
    };
  }, [recordedAudioUrl]);

  // Combined full text
  const fullAnswerText = useMemo(() => {
    const combined = `${transcript} ${interimText}`.trim();
    return combined;
  }, [transcript, interimText]);

  // Real-time Clarity Metrics
  const clarityMetrics = useMemo(() => {
    const durationMs = Math.max(1000, elapsedSeconds * 1000);
    const fillerStats = analyzeFillerWords(fullAnswerText, durationMs);
    const wordCount = fillerStats.wordCount;
    const wpm = fillerStats.wpm;

    // Pace status
    let paceStatus: "Optimal" | "A Bit Slow" | "Rushed" = "Optimal";
    if (wpm > 0 && wpm < 115) paceStatus = "A Bit Slow";
    else if (wpm > 170) paceStatus = "Rushed";

    // Clarity Score (0 - 100)
    let score = 100;
    // Deduct for filler density
    if (fillerStats.count > 0) {
      score -= Math.min(35, fillerStats.count * 6);
    }
    // Deduct if rushed or sluggish
    if (paceStatus === "Rushed") score -= 15;
    if (paceStatus === "A Bit Slow") score -= 10;
    // Require substantive words for high score
    if (wordCount < 15 && isRecording) score = Math.min(60, score);

    return {
      score: Math.max(20, Math.min(100, score)),
      wpm,
      paceStatus,
      fillerCount: fillerStats.count,
      fillersFound: fillerStats.fillers,
      wordCount,
    };
  }, [fullAnswerText, elapsedSeconds, isRecording]);

  // Real-time Content Relevance Metrics
  const relevanceMetrics = useMemo(() => {
    const lower = fullAnswerText.toLowerCase();

    // Check STAR component detection
    const starDetected = {
      situation: STAR_PATTERNS.situation.some((p) => lower.includes(p)),
      task: STAR_PATTERNS.task.some((p) => lower.includes(p)),
      action: STAR_PATTERNS.action.some((p) => lower.includes(p)),
      result: STAR_PATTERNS.result.some((p) => lower.includes(p)),
    };

    const starCount = Object.values(starDetected).filter(Boolean).length;

    // Check question keyword matches
    const matchedCompetencies = currentQuestion.keyCompetencies.filter((comp) => {
      const parts = comp.toLowerCase().split(/\s+/);
      return parts.some((p) => lower.includes(p));
    });

    // Compute Relevance Score (0 - 100)
    let score = 40; // baseline
    if (fullAnswerText.length > 30) score += 20;
    score += starCount * 8; // up to +32
    score += matchedCompetencies.length * 7; // up to +28
    score = Math.max(10, Math.min(100, score));

    let status: "High Relevance" | "On Track" | "Needs Pivoting" = "On Track";
    if (score >= 80) status = "High Relevance";
    else if (score < 60) status = "Needs Pivoting";

    return {
      score,
      status,
      starDetected,
      starCount,
      matchedCompetencies,
    };
  }, [fullAnswerText, currentQuestion]);

  // Timer runner
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRecording, isPaused]);

  // Start Microphone & Speech Recognition
  const startRecording = async () => {
    try {
      setFeedbackReport(null);
      setTranscript("");
      setInterimText("");
      setElapsedSeconds(0);
      audioChunksRef.current = [];

      // Request microphone permissions
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Start Audio Volume Meter
      audioMeter.start(stream);

      // Start MediaRecorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
        const url = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(url);
      };

      mediaRecorder.start(250);

      // Start Web Speech API ASR
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event: any) => {
          let accumulatedFinal = "";
          let currentInterim = "";

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i];
            const text = res[0].transcript;
            if (res.isFinal) {
              accumulatedFinal += text + " ";
            } else {
              currentInterim += text;
            }
          }

          if (accumulatedFinal) {
            setTranscript((prev) => `${prev} ${accumulatedFinal}`.trim());
          }
          setInterimText(currentInterim);
        };

        recognition.onerror = (e: any) => {
          if (e.error !== "no-speech") {
            console.warn("[SpeechRecognition error]:", e);
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
      }

      setIsRecording(true);
      setIsPaused(false);
      toast.success("Microphone recording active! Speak your answer clearly.");
    } catch (err: any) {
      console.error("[startRecording err]", err);
      toast.error(err?.message || "Could not access microphone. Please check permissions.");
    }
  };

  // Stop Recording & Clean up
  const stopRecordingCleanup = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    audioMeter.stop();
    setIsRecording(false);
    setIsPaused(false);
  };

  const handleStopRecording = () => {
    stopRecordingCleanup();
    toast.info("Recording captured. Ready for AI evaluation!");
  };

  // Text-To-Speech of the Question
  const speakQuestion = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("Text-to-speech not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentQuestion.question);
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
    toast.info("Playing question audio...");
  };

  // Run AI Evaluation
  const evaluateAnswer = async () => {
    if (!fullAnswerText.trim() || fullAnswerText.length < 20) {
      toast.error("Please provide or dictate an answer before evaluating.");
      return;
    }

    setEvaluating(true);
    try {
      const prompt = `You are a Principal Technical Interviewer evaluating a candidate's verbal interview answer.

QUESTION ASKED:
"${currentQuestion.question}"

TARGET COMPETENCIES:
${currentQuestion.keyCompetencies.join(", ")}

CANDIDATE'S RECORDED ANSWER:
"${fullAnswerText}"

RECORDING METRICS:
- Words spoken: ${clarityMetrics.wordCount}
- Speaking Pace: ${clarityMetrics.wpm} WPM (${clarityMetrics.paceStatus})
- Filler Words: ${clarityMetrics.fillerCount} (${clarityMetrics.fillersFound.join(", ") || "none"})
- STAR Elements Detected: Situation=${relevanceMetrics.starDetected.situation}, Task=${relevanceMetrics.starDetected.task}, Action=${relevanceMetrics.starDetected.action}, Result=${relevanceMetrics.starDetected.result}

Evaluate the response objectively. Return valid JSON only:
{
  "overallScore": number (0-100),
  "clarityScore": number (0-100),
  "relevanceScore": number (0-100),
  "praise": ["strength 1", "strength 2"],
  "improvements": ["improvement 1", "improvement 2"],
  "modelAnswerTip": "A crisp 1-2 sentence recommendation on how to elevate this answer to top 1% standard"
}`;

      const res = await callAI({
        userPrompt: prompt,
        taskCategory: "interview",
        temperature: 0.3,
      });

      let parsed: any;
      try {
        const jsonMatch = res.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      } catch {}

      if (parsed && typeof parsed.overallScore === "number") {
        setFeedbackReport(parsed);
      } else {
        // Fallback structured calculation
        setFeedbackReport({
          overallScore: Math.round(clarityMetrics.score * 0.4 + relevanceMetrics.score * 0.6),
          clarityScore: clarityMetrics.score,
          relevanceScore: relevanceMetrics.score,
          praise: [
            relevanceMetrics.starCount >= 2 ? "Good adherence to STAR storytelling structure." : "Clear articulation of candidate viewpoint.",
            clarityMetrics.fillerCount <= 2 ? "Minimal filler words, strong verbal confidence." : "Engaging conversational tone.",
          ],
          improvements: [
            relevanceMetrics.starCount < 3 ? "Emphasize measurable outcomes (Result pillar) with specific numbers or metrics." : "Add a brief mention of technical trade-offs.",
            clarityMetrics.wpm > 165 ? "Slow down slightly at key transition points to highlight impactful results." : "Ensure direct alignment with the core prompt.",
          ],
          modelAnswerTip: "Start with the high-stakes context in 1 sentence, allocate 70% of time to your specific personal actions, and conclude with the quantifiable business impact.",
        });
      }

      toast.success("Answer evaluated successfully!");
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate evaluation. Showing local metrics.");
      setFeedbackReport({
        overallScore: Math.round(clarityMetrics.score * 0.4 + relevanceMetrics.score * 0.6),
        clarityScore: clarityMetrics.score,
        relevanceScore: relevanceMetrics.score,
        praise: ["Real-time audio telemetry logged successfully."],
        improvements: ["Ensure consistent microphone input levels and steady cadence."],
        modelAnswerTip: "Anchor your response in measurable STAR results.",
      });
    } finally {
      setEvaluating(false);
    }
  };

  // Format MM:SS
  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      {/* Module Title Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Icon name="Mic" className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold font-display tracking-tight text-foreground">
              Interactive Voice Mock Interview
            </h2>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
              Microphone Real-Time Telemetry
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Record your verbal answers with speech recognition and receive live telemetry on speaking clarity, pace, filler words, and content relevance.
          </p>
        </div>

        {/* Question Switcher Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {DEFAULT_QUESTIONS.map((q, idx) => (
            <button
              key={q.id}
              type="button"
              onClick={() => {
                if (isRecording) handleStopRecording();
                setSelectedQuestionIndex(idx);
                setTranscript("");
                setInterimText("");
                setFeedbackReport(null);
                setRecordedAudioUrl(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedQuestionIndex === idx
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Q{idx + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Question Card & Microphone Controls (Left) + Live Telemetry (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Question, Microphone, Transcript */}
        <div className="lg:col-span-7 space-y-5">
          {/* Active Question Card */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-[11px] font-mono">
                  {currentQuestion.category}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={speakQuestion}
                  className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <Icon name="Volume2" className="w-3.5 h-3.5" /> Read Aloud
                </Button>
              </div>
              <CardTitle className="text-base sm:text-lg font-bold font-display mt-2 text-foreground">
                "{currentQuestion.question}"
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                {currentQuestion.context}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Key Competencies Evaluated */}
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Target Competencies:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {currentQuestion.keyCompetencies.map((comp) => {
                    const isMatched = relevanceMetrics.matchedCompetencies.includes(comp);
                    return (
                      <Badge
                        key={comp}
                        variant="outline"
                        className={`text-xs py-0.5 px-2 transition-all ${
                          isMatched
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold"
                            : "bg-muted/50 text-muted-foreground border-border"
                        }`}
                      >
                        {isMatched && <Icon name="Check" className="w-3 h-3 mr-1 text-emerald-600" />}
                        {comp}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              {/* Microphone Recording Action Bar */}
              <div className="p-4 rounded-xl border border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {!isRecording ? (
                    <Button
                      onClick={startRecording}
                      className="bg-red-600 hover:bg-red-700 text-white gap-2 font-semibold shadow-sm"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                      Record with Mic
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      onClick={handleStopRecording}
                      className="gap-2 font-semibold"
                    >
                      <Icon name="Square" className="w-4 h-4 fill-current" />
                      Stop Recording
                    </Button>
                  )}

                  {/* Timer display */}
                  <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-foreground bg-background border px-2.5 py-1.5 rounded-md">
                    <Icon name="Clock" className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{formatTimer(elapsedSeconds)}</span>
                  </div>
                </div>

                {/* Live Audio Level Visualizer */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">Mic Input:</span>
                  <div className="flex items-end gap-1 h-6 w-24 px-1 py-0.5 bg-background border rounded">
                    {[0.2, 0.4, 0.6, 0.8, 1.0].map((step, i) => {
                      const isActive = isRecording && audioMeter.level >= step * 0.4;
                      return (
                        <div
                          key={i}
                          className={`w-full rounded-xs transition-all duration-75 ${
                            isActive
                              ? i >= 3
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                              : "bg-muted"
                          }`}
                          style={{
                            height: isRecording ? `${Math.max(15, Math.min(100, (audioMeter.level / step) * 100))}%` : "15%",
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Recorded Audio Playback (If finished) */}
              {recordedAudioUrl && !isRecording && (
                <div className="p-3 rounded-lg border border-border bg-card flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                    <Icon name="PlayCircle" className="w-4 h-4 text-primary" />
                    Recorded Voice Note ({formatTimer(elapsedSeconds)})
                  </div>
                  <audio controls src={recordedAudioUrl} className="h-8 max-w-xs" />
                </div>
              )}

              {/* Live Speech Recognition Transcript Box */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Icon name="FileText" className="w-3.5 h-3.5 text-primary" />
                    Live Spoken Transcript
                  </label>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {clarityMetrics.wordCount} words
                  </span>
                </div>
                <div className="relative">
                  <Textarea
                    value={fullAnswerText}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder={
                      isRecording
                        ? "Listening... Speak your answer now. Your words will appear here in real-time."
                        : "Click 'Record with Mic' to record verbally, or type your response here directly."
                    }
                    rows={6}
                    className="text-xs sm:text-sm font-sans leading-relaxed resize-y bg-background"
                  />
                  {isRecording && (
                    <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 text-[10px] font-mono font-semibold border border-red-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />
                      LISTENING
                    </div>
                  )}
                </div>
              </div>

              {/* Evaluation Action Button */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  onClick={evaluateAnswer}
                  disabled={evaluating || isRecording || !fullAnswerText.trim()}
                  className="bg-primary text-primary-foreground font-semibold gap-1.5 text-xs h-9 px-4"
                >
                  {evaluating ? (
                    <>
                      <Icon name="Loader2" className="w-4 h-4 animate-spin" /> Evaluating Answer...
                    </>
                  ) : (
                    <>
                      <Icon name="Sparkles" className="w-4 h-4" /> Evaluate Clarity & Relevance
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Real-Time Telemetry Panels */}
        <div className="lg:col-span-5 space-y-5">
          {/* Real-Time Clarity Feedback Card */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold font-display flex items-center gap-1.5">
                  <Icon name="Activity" className="w-4 h-4 text-blue-600" />
                  Live Clarity Feedback
                </CardTitle>
                <Badge
                  variant="outline"
                  className={`text-[11px] font-bold ${
                    clarityMetrics.score >= 80
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                      : "bg-amber-50 text-amber-700 border-amber-300"
                  }`}
                >
                  {clarityMetrics.score}% Clarity
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-3 space-y-3.5 text-xs">
              {/* Pace & WPM */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg border border-border bg-card">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    Speaking Pace
                  </div>
                  <div className="text-base font-bold text-foreground mt-0.5">
                    {clarityMetrics.wpm} <span className="text-[10px] font-normal text-muted-foreground">WPM</span>
                  </div>
                  <div className="text-[10px] text-primary font-medium mt-0.5">
                    {clarityMetrics.paceStatus} (Target: 120-160)
                  </div>
                </div>

                <div className="p-2.5 rounded-lg border border-border bg-card">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    Filler Words
                  </div>
                  <div className="text-base font-bold text-foreground mt-0.5">
                    {clarityMetrics.fillerCount}{" "}
                    <span className="text-[10px] font-normal text-muted-foreground">detected</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {clarityMetrics.fillerCount === 0 ? "Clean articulation" : "Try pausing instead"}
                  </div>
                </div>
              </div>

              {/* Detected Filler Words List */}
              {clarityMetrics.fillersFound.length > 0 && (
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-200">
                  <span className="font-semibold block mb-1">Detected Fillers:</span>
                  <div className="flex flex-wrap gap-1">
                    {clarityMetrics.fillersFound.map((f, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-amber-200/50 dark:bg-amber-900/50 font-mono text-[10px]">
                        "{f}"
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Real-Time Content Relevance Feedback Card */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold font-display flex items-center gap-1.5">
                  <Icon name="Target" className="w-4 h-4 text-emerald-600" />
                  Live Content Relevance
                </CardTitle>
                <Badge
                  variant="outline"
                  className={`text-[11px] font-bold ${
                    relevanceMetrics.status === "High Relevance"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                      : relevanceMetrics.status === "On Track"
                      ? "bg-blue-50 text-blue-700 border-blue-300"
                      : "bg-amber-50 text-amber-700 border-amber-300"
                  }`}
                >
                  {relevanceMetrics.status} ({relevanceMetrics.score}%)
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-3 space-y-3.5 text-xs">
              {/* STAR Framework Tracker */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-foreground">STAR Framework Detection:</span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {relevanceMetrics.starCount} of 4 components
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { key: "situation", label: "S: Situation", desc: "Context & Setup" },
                    { key: "task", label: "T: Task", desc: "Goal & Challenge" },
                    { key: "action", label: "A: Action", desc: "What YOU did" },
                    { key: "result", label: "R: Result", desc: "Metric & Impact" },
                  ].map((item) => {
                    const isDetected = (relevanceMetrics.starDetected as any)[item.key];
                    return (
                      <div
                        key={item.key}
                        className={`p-2 rounded-lg border text-center transition-all ${
                          isDetected
                            ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-semibold"
                            : "bg-muted/40 border-border text-muted-foreground opacity-60"
                        }`}
                      >
                        <div className="text-[10px] font-bold">{item.label.split(":")[0]}</div>
                        <div className="text-[9px] truncate">{item.desc}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Model STAR Framework Suggestion */}
              <div className="p-3 rounded-lg bg-muted/40 border border-border/70 space-y-1.5 text-[11px]">
                <div className="font-semibold text-foreground flex items-center gap-1">
                  <Icon name="Lightbulb" className="w-3.5 h-3.5 text-amber-500" />
                  Model Answer Strategy for this Question:
                </div>
                <div className="space-y-1 text-muted-foreground">
                  <div><strong className="text-foreground">S:</strong> {currentQuestion.sampleStarFramework.situation}</div>
                  <div><strong className="text-foreground">T:</strong> {currentQuestion.sampleStarFramework.task}</div>
                  <div><strong className="text-foreground">A:</strong> {currentQuestion.sampleStarFramework.action}</div>
                  <div><strong className="text-foreground">R:</strong> {currentQuestion.sampleStarFramework.result}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Comprehensive Feedback Post-Answer */}
          {feedbackReport && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-border shadow-md bg-card">
                <CardHeader className="pb-3 border-b border-border/60">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold font-display flex items-center gap-1.5">
                      <Icon name="CheckCheck" className="w-4 h-4 text-emerald-600" />
                      Comprehensive Evaluation
                    </CardTitle>
                    <Badge variant="outline" className="font-mono text-xs font-bold bg-primary/10 text-primary">
                      {feedbackReport.overallScore}/100 Overall
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-3 space-y-3 text-xs">
                  {/* Scores Grid */}
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-2 rounded bg-muted/50 border">
                      <div className="text-base font-bold text-blue-600">{feedbackReport.clarityScore}%</div>
                      <div className="text-[10px] text-muted-foreground">Verbal Clarity</div>
                    </div>
                    <div className="p-2 rounded bg-muted/50 border">
                      <div className="text-base font-bold text-emerald-600">{feedbackReport.relevanceScore}%</div>
                      <div className="text-[10px] text-muted-foreground">Content Relevance</div>
                    </div>
                  </div>

                  {/* Strengths */}
                  <div>
                    <span className="font-semibold text-foreground text-[11px] block mb-1">Key Strengths:</span>
                    <ul className="list-disc list-outside ml-3.5 space-y-0.5 text-slate-700 dark:text-slate-300 text-[11px]">
                      {feedbackReport.praise.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Areas for Improvement */}
                  <div>
                    <span className="font-semibold text-foreground text-[11px] block mb-1">Target Refinements:</span>
                    <ul className="list-disc list-outside ml-3.5 space-y-0.5 text-slate-700 dark:text-slate-300 text-[11px]">
                      {feedbackReport.improvements.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Top Coaching Tip */}
                  <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-[11px] text-foreground">
                    <span className="font-semibold text-primary block mb-0.5">Top Coaching Tip:</span>
                    {feedbackReport.modelAnswerTip}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
