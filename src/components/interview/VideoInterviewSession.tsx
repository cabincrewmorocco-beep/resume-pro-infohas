"use client";

// ============================================================================
// VideoInterviewSession — Sonru-style asynchronous video interview.
//
// Per-question flow:
//   Question card → Preparation countdown (30s) → Recording countdown (3s)
//   → Record (max 2min, with live preview + audio meter + live transcript)
//   → Pause/Resume/Stop/Re-record/Delete → Review (playback + transcript)
//   → AI Analysis (evaluateAnswer with real transcript + WPM + filler count)
//   → Skip / Previous / Next → Final Report.
//
// Reuses: useDeviceCheck + useMediaRecorder + useSpeechRecognition + useFillerWordDetector
// (Phase 1 + Sonru extensions), evaluateAnswer (Phase 3), generateHiringRecommendation
// (final report), and the existing design system. Recordings are stored in
// IndexedDB (src/lib/interview/storage.ts); only metadata reaches the store/cloud.
//
// Sonru-spec features implemented here:
//   ✓ Webcam preview  ✓ Camera recording  ✓ Microphone recording
//   ✓ Video timer  ✓ Countdown timer  ✓ Preparation time
//   ✓ Retry rules (re-record)  ✓ Next/Previous/Skip
//   ✓ Fullscreen mode  ✓ Recording status  ✓ Audio level visualization
//   ✓ Video quality validation  ✓ Microphone + Camera permission handling
//   ✓ Browser compatibility banner  ✓ Mobile responsive
//   ✓ Live transcript  ✓ Filler-word / WPM signals to AI
//   ✓ Final report (hiring recommendation + ATS readiness)
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, Icon, ScoreRing } from "@/components/shared";
import { cn } from "@/lib/utils";
import {
  useDeviceCheck,
  useMediaRecorder,
  useAudioMeter,
  useSpeechRecognition,
  analyzeFillerWords,
  normalizeWpmToScore,
  normalizeFillerCountToScore,
} from "@/hooks/interview";
import { formatDuration, formatRemaining } from "@/hooks/interview/format";
import {
  evaluateAnswer,
  generateHiringRecommendation,
  buildInterviewMatchScore,
  type AnswerEvaluation,
  type VideoDerivedMetrics,
  type InterviewFinalReport,
  type InterviewMatchScore,
  type GeneratedPackage,
  type GeneratedQuestion,
} from "@/lib/interview/ai";
import { saveRecording, getRecordingObjectURL, deleteRecordingBlob, deleteRecordingMeta } from "@/lib/interview/storage";
import { uid } from "@/lib/store";
import { toast } from "sonner";
import type { InterviewRecordingMeta } from "@/hooks/interview/types";
import type { InterviewPackage, ResumeData, JobDescription } from "@/lib/types";

function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  let timeoutId: any;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      const err = new Error(errorMessage);
      err.name = "TimeoutError";
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

interface CandidateVideoAvatarProps {
  mode: "audio-only" | "simulated";
  audioLevel?: number;
  label?: string;
  subLabel?: string;
  badgeText?: string;
  badgeIcon?: string;
  overlayCountdown?: number | null;
  overlayTimer?: string | null;
  isRecording?: boolean;
}

function CandidateVideoAvatar({
  mode,
  audioLevel = 0,
  label,
  subLabel,
  badgeText,
  badgeIcon,
  overlayCountdown,
  overlayTimer,
  isRecording,
}: CandidateVideoAvatarProps) {
  const pulseScale = 1 + Math.min(0.25, audioLevel * 1.5);
  const isAudioOnly = mode === "audio-only";

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-800 to-slate-950 select-none overflow-hidden p-4">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(37,99,235,0.15),transparent_70%)] pointer-events-none" />

      {/* Top Left Badge */}
      <div className="absolute top-2 left-2 flex items-center gap-1.5 text-[10px] font-medium text-white bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/10">
        <Icon name={badgeIcon || (isAudioOnly ? "Mic" : "Sparkles")} className="w-3.5 h-3.5 text-brand" />
        <span>{badgeText || (isAudioOnly ? "Audio-Only Mode" : "Simulation / Practice Mode")}</span>
      </div>

      {/* Top Right Timer Overlay if present */}
      {overlayTimer && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5 text-[10px] font-medium text-white bg-brand/90 px-2.5 py-1 rounded-full shadow-sm">
          <Icon name="Clock" className="w-3 h-3" /> {overlayTimer}
        </div>
      )}

      {/* Avatar with reactive audio wave rings */}
      <div className="relative flex items-center justify-center my-2">
        <div
          className={cn(
            "absolute rounded-full border transition-transform duration-100 ease-out",
            isAudioOnly ? "border-emerald-500/30 bg-emerald-500/5" : "border-indigo-500/30 bg-indigo-500/5"
          )}
          style={{
            width: "120px",
            height: "120px",
            transform: `scale(${pulseScale})`,
          }}
        />
        <div
          className={cn(
            "absolute rounded-full border transition-transform duration-100 ease-out",
            isAudioOnly ? "border-emerald-500/50" : "border-indigo-500/50"
          )}
          style={{
            width: "96px",
            height: "96px",
            transform: `scale(${1 + Math.min(0.15, audioLevel)})`,
          }}
        />

        <div
          className={cn(
            "relative w-20 h-20 rounded-full flex items-center justify-center shadow-xl border",
            isAudioOnly
              ? "bg-emerald-950/80 border-emerald-500/60 text-emerald-400"
              : "bg-indigo-950/80 border-indigo-500/60 text-indigo-300"
          )}
        >
          <Icon name={isAudioOnly ? "Mic" : "UserCheck"} className="w-9 h-9" />
          {isRecording && (
            <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full ring-2 ring-slate-900 animate-ping" />
          )}
        </div>
      </div>

      <h3 className="text-sm font-semibold text-white tracking-wide mt-2">
        {label || (isAudioOnly ? "Microphone Input Active" : "Candidate Practice Mode")}
      </h3>
      <p className="text-xs text-slate-400 mt-0.5 max-w-xs text-center px-4">
        {subLabel ||
          (isAudioOnly
            ? "Your voice is captured for transcription and analysis."
            : "Camera & mic bypassed — practice your STAR delivery freely.")}
      </p>

      {/* Countdown overlay if active */}
      {overlayCountdown != null && overlayCountdown > 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[2px] pointer-events-none">
          <div className="text-center">
            <div className="text-7xl sm:text-8xl font-bold text-white tabular-nums drop-shadow-2xl animate-pulse">
              {overlayCountdown}
            </div>
            <p className="text-xs text-white/90 mt-1">Get ready to speak</p>
          </div>
        </div>
      )}
    </div>
  );
}

const PREP_MS = 30_000;
const REC_COUNTDOWN_MS = 3_000;
const MAX_REC_MS = 120_000;
// Minimum recommended capture quality (Sonru "Video quality validation").
const MIN_VIDEO_WIDTH = 640;
const MIN_VIDEO_FPS = 24;

type Phase = "prep" | "countdown" | "recording" | "review" | "analyzing" | "analysis" | "final-report";

interface QuestionRecording {
  meta?: InterviewRecordingMeta;
  objectUrl?: string;
  evaluation?: AnswerEvaluation;
  transcript?: string;
  /** Marked true when the user skipped this question without recording. */
  skipped?: boolean;
}

interface VideoSessionProps {
  pkg: InterviewPackage;
  resume?: ResumeData;
  jd?: JobDescription;
  generated?: GeneratedPackage;
  onClose: () => void;
  onComplete?: (
    sessionId: string,
    records: InterviewRecordingMeta[],
    finalReport?: InterviewFinalReport
  ) => void;
}

export function VideoInterviewSession({ pkg, resume, jd, generated, onClose, onComplete }: VideoSessionProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const questions = (pkg.questions ?? []) as GeneratedQuestion[];
  const total = questions.length;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("prep");
  const [prepRemaining, setPrepRemaining] = useState(PREP_MS);
  const [recCountdown, setRecCountdown] = useState(REC_COUNTDOWN_MS);
  const [recordings, setRecordings] = useState<Record<string, QuestionRecording>>({});
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [finalReport, setFinalReport] = useState<InterviewFinalReport | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  // Camera & recording mode: "video" (default), "audio-only", or "simulated" (practice mode)
  const [sessionMode, setSessionMode] = useState<"video" | "audio-only" | "simulated">("video");
  // Simulated recording state when hardware recorder or permissions are bypassed
  const [isSimulatedRecording, setIsSimulatedRecording] = useState(false);
  const [simulatedElapsedMs, setSimulatedElapsedMs] = useState(0);
  const simulatedTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Camera activation state — drives the inline preview + retry button shown
  // during prep & countdown.
  const [cameraActivating, setCameraActivating] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  // Local ref to the live MediaStream — updated every time we acquire a new stream.
  const liveStreamRef = useRef<MediaStream | null>(null);

  const { snapshot: deviceSnapshot, getStream, requestCameraAndMic, stopPreview } = useDeviceCheck({
    videoRef,
    enablePreview: false, // we manage the stream manually so it persists across phases
  });

  // ---- attach a stream to whichever <video> element is currently mounted ---
  const bindStream = useCallback((stream: MediaStream) => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
      el.muted = true;
    }
    el.play().catch(() => setTimeout(() => el.play().catch(() => {}), 150));
  }, []);

  // Preview audio meter — runs during prep & countdown so the user can verify
  // their mic is picking up sound BEFORE the recording starts.
  const previewMeter = useAudioMeter(0.08);
  const { start: startMeter, stop: stopMeter } = previewMeter;

  // Live transcript for the active recording.
  const speech = useSpeechRecognition({ continuous: true, interimResults: false });
  const { start: startSpeech, stop: stopSpeech, reset: resetSpeech } = speech;

  const stopPreviewRef = useRef(stopPreview);
  useEffect(() => { stopPreviewRef.current = stopPreview; }, [stopPreview]);
  const stopSpeechRef = useRef(stopSpeech);
  useEffect(() => { stopSpeechRef.current = stopSpeech; }, [stopSpeech]);
  const stopMeterRef = useRef(stopMeter);
  useEffect(() => { stopMeterRef.current = stopMeter; }, [stopMeter]);
  const sessionModeRef = useRef(sessionMode);
  useEffect(() => { sessionModeRef.current = sessionMode; }, [sessionMode]);

  const sessionId = useMemo(() => uid("sess"), []);
  const current = questions[currentIndex];
  const isLast = currentIndex === total - 1;
  const currentRec = recordings[current?.id ?? ""];
  const percent = Math.round(((currentIndex + 1) / Math.max(total, 1)) * 100);

  // Clean up all media tracks and active timers
  const cleanUpStreams = useCallback(() => {
    try {
      if (liveStreamRef.current) {
        liveStreamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
        liveStreamRef.current = null;
      }
      stopPreviewRef.current();
      stopSpeechRef.current();
      stopMeterRef.current();
      if (simulatedTimerRef.current) {
        clearInterval(simulatedTimerRef.current);
        simulatedTimerRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    } catch (err) {
      console.warn("Stream cleanup error:", err);
    }
  }, []);

  const handleExit = useCallback(() => {
    cleanUpStreams();
    onClose();
  }, [cleanUpStreams, onClose]);

  // ---- derived: video quality warning ---------------------------------------
  const videoQualityWarning = useMemo(() => {
    const caps = deviceSnapshot.previewCapabilities;
    if (!caps) return null;
    const issues: string[] = [];
    if (caps.width > 0 && caps.width < MIN_VIDEO_WIDTH) {
      issues.push(`Low resolution (${caps.width}×${caps.height}). Recommend ≥640×480.`);
    }
    if (caps.fps > 0 && caps.fps < MIN_VIDEO_FPS) {
      issues.push(`Low frame rate (${caps.fps} fps). Recommend ≥24 fps.`);
    }
    return issues.length ? issues.join(" ") : null;
  }, [deviceSnapshot.previewCapabilities]);

  // ---- derived: browser compatibility banner --------------------------------
  const compatWarning = useMemo(() => {
    const c = deviceSnapshot.compatibility;
    if (!c.secureContext) {
      return "This page is not in a secure context (https:// or localhost). Camera and microphone will not work.";
    }
    if (!c.mediaDevices || !c.getUserMedia) {
      return "This browser does not support navigator.mediaDevices. Use an up-to-date Chrome, Edge, Safari, or Firefox.";
    }
    if (!c.mediaRecorder) {
      return "This browser does not support MediaRecorder. Recording will be simulated.";
    }
    return null;
  }, [deviceSnapshot.compatibility]);

  // ---- ensure stream when entering recording -------------------
  const ensureStream = useCallback(async () => {
    let stream = getStream();
    if (!stream || !stream.active || stream.getTracks().length === 0) {
      if (sessionMode === "audio-only") {
        stream = await requestCameraAndMic({ video: false }).catch(() => null);
      } else if (sessionMode === "video") {
        stream = await requestCameraAndMic().catch(() => null);
      }
    }
    if (stream) {
      liveStreamRef.current = stream;
    }
    return stream;
  }, [getStream, requestCameraAndMic, sessionMode]);

  // ---- activate camera early with 5s timeout & graceful fallback cascade ----
  const activateCamera = useCallback(async () => {
    setCameraActivating(true);
    setCameraError(null);
    try {
      // 1. Try Video + Audio first with a 5-second timeout
      const stream = await withTimeout(
        requestCameraAndMic(),
        5000,
        "Camera initialization timed out after 5 seconds"
      ).catch((e) => {
        console.warn("Video request error/timeout:", e);
        return null;
      });

      if (stream && stream.getVideoTracks().length > 0 && stream.getVideoTracks().some((t) => t.readyState === "live")) {
        liveStreamRef.current = stream;
        setSessionMode("video");
        bindStream(stream);
        startMeter(stream);
        setCameraError(null);
        setCameraActivating(false);
        return;
      }

      // 2. Video failed/blocked or timed out — fallback automatically to Audio-Only
      console.warn("Video stream unavailable or timed out. Falling back to Audio-Only...");
      const audioStream = await withTimeout(
        requestCameraAndMic({ video: false }),
        5000,
        "Microphone initialization timed out after 5 seconds"
      ).catch(() => null);

      if (audioStream && audioStream.getAudioTracks().length > 0 && audioStream.getAudioTracks().some((t) => t.readyState === "live")) {
        liveStreamRef.current = audioStream;
        setSessionMode("audio-only");
        startMeter(audioStream);
        setCameraError(null);
        toast.info("Camera not available or blocked. Switched to Audio-Only mode.");
      } else {
        // 3. Audio also unavailable (e.g. iframe policy or no hardware) — fallback to Simulation / Practice Mode
        console.warn("Audio stream also unavailable. Falling back to Simulation / Practice Mode...");
        setSessionMode("simulated");
        liveStreamRef.current = null;
        setCameraError("Camera & microphone unavailable. Practice Mode active.");
        toast.info("Practice Mode active. You can rehearse your response freely.");
      }
    } catch (e: any) {
      setSessionMode("simulated");
      liveStreamRef.current = null;
      setCameraError(e?.message || "Could not activate devices. Running in Practice Mode.");
    } finally {
      setCameraActivating(false);
    }
  }, [requestCameraAndMic, bindStream, startMeter]);

  const switchToAudioOnly = useCallback(async () => {
    setCameraActivating(true);
    try {
      const audioStream = await requestCameraAndMic({ video: false }).catch(() => null);
      if (audioStream && audioStream.getAudioTracks().length > 0) {
        liveStreamRef.current = audioStream;
        setSessionMode("audio-only");
        startMeter(audioStream);
        setCameraError(null);
        toast.info("Switched to Audio-Only mode.");
      } else {
        setSessionMode("simulated");
        toast.info("Switched to Practice / Simulation mode.");
      }
    } catch {
      setSessionMode("simulated");
    } finally {
      setCameraActivating(false);
    }
  }, [requestCameraAndMic, startMeter]);

  const switchToPracticeMode = useCallback(() => {
    if (liveStreamRef.current) {
      liveStreamRef.current.getTracks().forEach((t) => t.stop());
      liveStreamRef.current = null;
    }
    stopPreview();
    stopMeter();
    setSessionMode("simulated");
    setCameraError(null);
    toast.info("Switched to Practice / Simulation mode.");
  }, [stopPreview, stopMeter]);

  // On mount and whenever we return to the prep phase, request/reuse the stream.
  useEffect(() => {
    if (phase !== "prep") return;
    if (sessionMode === "simulated") return;
    const existing = liveStreamRef.current;
    if (existing && existing.active && existing.getTracks().some((t) => t.readyState === "live")) {
      if (sessionMode === "video" && existing.getVideoTracks().some((t) => t.readyState === "live")) {
        bindStream(existing);
        startMeter(existing);
        return;
      }
      if (sessionMode === "audio-only" && existing.getAudioTracks().some((t) => t.readyState === "live")) {
        startMeter(existing);
        return;
      }
    }
    void activateCamera();
  }, [phase, currentIndex, sessionMode, activateCamera, bindStream, startMeter]);

  // Re-bind the stream whenever the phase changes
  useEffect(() => {
    const stream = liveStreamRef.current;
    if (!stream || sessionMode !== "video") return;
    const id = setTimeout(() => bindStream(stream), 50);
    return () => clearTimeout(id);
  }, [phase, bindStream, sessionMode]);

  // ---- when a recording is finalized --------------------------------------
  const onRecorderComplete = useCallback(
    async (blob: Blob, mimeType: string, durationMs: number) => {
      const q = questions[currentIndex];
      if (!q) return;
      stopSpeech();
      stopMeter();
      if (simulatedTimerRef.current) {
        clearInterval(simulatedTimerRef.current);
        simulatedTimerRef.current = null;
      }
      setIsSimulatedRecording(false);
      const transcript = speech.transcript.trim();
      const id = uid("rec");
      const meta: InterviewRecordingMeta = {
        id,
        sessionId,
        questionId: q.id,
        questionNumber: currentIndex + 1,
        resumeId: resume?.id,
        jdId: jd?.id,
        mimeType: mimeType || blob.type,
        sizeBytes: blob.size,
        durationMs,
        createdAt: new Date().toISOString(),
      };
      try {
        await saveRecording(meta, blob);
        const objectUrl = URL.createObjectURL(blob);
        setRecordings((prev) => ({ ...prev, [q.id]: { meta, objectUrl, transcript } }));
        setPhase("review");
      } catch (e: any) {
        setError(e?.message || "Failed to save recording.");
      }
    },
    [currentIndex, questions, jd?.id, resume?.id, sessionId, stopSpeech, stopMeter, speech]
  );

  const recorder = useMediaRecorder({ maxDurationMs: MAX_REC_MS, onComplete: onRecorderComplete });
  const recorderRef = useRef(recorder);
  useEffect(() => { recorderRef.current = recorder; }, [recorder]);

  // ---- deterministic recorder starting with simulation fallback -----------
  const executeStartRecording = useCallback(async () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setRecCountdown(0);
    stopMeterRef.current();
    resetSpeechRef.current();
    setError(null);

    let stream = liveStreamRef.current;
    if (!stream || !stream.active || stream.getTracks().every((t) => t.readyState !== "live")) {
      try {
        if (sessionModeRef.current === "audio-only") {
          stream = await requestCameraAndMic({ video: false });
        } else if (sessionModeRef.current === "video") {
          stream = await requestCameraAndMic();
        }
      } catch (e) {
        console.warn("Could not acquire fresh stream on startRecording:", e);
        stream = null;
      }
    }

    if (stream) {
      liveStreamRef.current = stream;
    }

    const hasActiveStream = !!(
      stream &&
      stream.active &&
      stream.getTracks().some((t) => t.readyState === "live")
    );

    let startedHardwareRecorder = false;
    if (hasActiveStream && sessionModeRef.current !== "simulated") {
      try {
        const audioTracks = stream!.getAudioTracks();
        if (audioTracks.length > 0 && audioTracks.some((t) => t.readyState === "live")) {
          recorderRef.current.start(stream!);
          startedHardwareRecorder = true;
        } else {
          console.warn("Stream has no active audio tracks for MediaRecorder.");
        }
      } catch (recErr) {
        console.warn("MediaRecorder start failed, falling back to simulated recorder:", recErr);
      }
    }

    setPhase("recording");
    startSpeechRef.current();

    if (!startedHardwareRecorder) {
      setIsSimulatedRecording(true);
      setSimulatedElapsedMs(0);
      if (simulatedTimerRef.current) clearInterval(simulatedTimerRef.current);

      const startTime = performance.now();
      simulatedTimerRef.current = setInterval(() => {
        const elapsed = performance.now() - startTime;
        if (elapsed >= MAX_REC_MS) {
          if (simulatedTimerRef.current) {
            clearInterval(simulatedTimerRef.current);
            simulatedTimerRef.current = null;
          }
          void handleStopRecordingRef.current();
        } else {
          setSimulatedElapsedMs(elapsed);
        }
      }, 100);
    } else {
      setIsSimulatedRecording(false);
      setSimulatedElapsedMs(0);
    }
  }, [requestCameraAndMic]);

  const executeStartRecordingRef = useRef(executeStartRecording);
  useEffect(() => { executeStartRecordingRef.current = executeStartRecording; }, [executeStartRecording]);

  // Manual trigger: bypass remaining prep or countdown and start recording immediately
  const handleStartAnswerNow = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setRecCountdown(0);
    void executeStartRecordingRef.current();
  }, []);

  const handleStopRecording = useCallback(async () => {
    if (simulatedTimerRef.current) {
      clearInterval(simulatedTimerRef.current);
      simulatedTimerRef.current = null;
    }
    if (isSimulatedRecording) {
      setIsSimulatedRecording(false);
      const duration = simulatedElapsedMs || 1000;
      const dummyBlob = new Blob(["simulation-audio-stream"], { type: "audio/webm" });
      await onRecorderComplete(dummyBlob, "audio/webm", duration);
    } else {
      recorderRef.current.stop();
    }
  }, [isSimulatedRecording, simulatedElapsedMs, onRecorderComplete]);

  const handleStopRecordingRef = useRef(handleStopRecording);
  useEffect(() => { handleStopRecordingRef.current = handleStopRecording; }, [handleStopRecording]);

  const handlePauseRecording = useCallback(() => {
    if (isSimulatedRecording) {
      if (simulatedTimerRef.current) {
        clearInterval(simulatedTimerRef.current);
        simulatedTimerRef.current = null;
      }
    } else {
      recorderRef.current.pause();
    }
  }, [isSimulatedRecording]);

  const handleResumeRecording = useCallback(() => {
    if (isSimulatedRecording) {
      if (!simulatedTimerRef.current) {
        const resumeStart = performance.now() - simulatedElapsedMs;
        simulatedTimerRef.current = setInterval(() => {
          const elapsed = performance.now() - resumeStart;
          if (elapsed >= MAX_REC_MS) {
            if (simulatedTimerRef.current) {
              clearInterval(simulatedTimerRef.current);
              simulatedTimerRef.current = null;
            }
            void handleStopRecordingRef.current();
          } else {
            setSimulatedElapsedMs(elapsed);
          }
        }, 100);
      }
    } else {
      recorderRef.current.resume();
    }
  }, [isSimulatedRecording, simulatedElapsedMs]);

  // Active elapsed time for recording UI (hardware or simulated)
  const activeElapsed = isSimulatedRecording ? simulatedElapsedMs : recorder.elapsedMs;

  // ---- preparation countdown ----------------------------------------------
  useEffect(() => {
    if (phase !== "prep") return;
    setPrepRemaining(PREP_MS);
    const step = 250;
    const id = setInterval(() => {
      setPrepRemaining((r) => {
        if (r <= step) {
          clearInterval(id);
          setPhase("countdown");
          return 0;
        }
        return r - step;
      });
    }, step);
    return () => clearInterval(id);
  }, [phase, currentIndex]);

  // ---- recording countdown (deterministic interval cleanup) ---------------
  useEffect(() => {
    if (phase !== "countdown") {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      return;
    }

    setRecCountdown(REC_COUNTDOWN_MS);
    const step = 100;
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    countdownIntervalRef.current = setInterval(() => {
      setRecCountdown((r) => {
        if (r <= step) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          void executeStartRecordingRef.current();
          return 0;
        }
        return r - step;
      });
    }, step);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [phase]);

  // ---- re-record / delete --------------------------------------------------
  const reRecord = useCallback(async () => {
    const q = current;
    if (!q) return;
    const rec = recordings[q.id];
    if (rec?.meta) {
      await deleteRecordingBlob(rec.meta.id).catch(() => {});
      await deleteRecordingMeta(rec.meta.id).catch(() => {});
      if (rec.objectUrl) URL.revokeObjectURL(rec.objectUrl);
    }
    setRecordings((prev) => {
      const next = { ...prev };
      delete next[q.id];
      return next;
    });
    setError(null);
    speech.reset();
    setPhase("prep");
  }, [current, recordings, speech]);

  // ---- skip question (with complete stream & timer cleanup) ----------------
  const skipQuestion = useCallback(() => {
    const q = current;
    if (!q) return;

    if (simulatedTimerRef.current) {
      clearInterval(simulatedTimerRef.current);
      simulatedTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    try {
      const rec = recorderRef.current;
      if (rec && (rec.state === "recording" || rec.state === "paused")) {
        rec.stop();
      }
    } catch {}

    setIsSimulatedRecording(false);
    setSimulatedElapsedMs(0);
    stopSpeechRef.current();
    stopMeterRef.current();
    setError(null);

    setRecordings((prev) => ({
      ...prev,
      [q.id]: { skipped: true },
    }));

    if (isLast) {
      void finishSession();
    } else {
      setCurrentIndex((i) => Math.min(i + 1, total - 1));
      setPhase("prep");
    }
  }, [current, isLast, total, finishSession]);

  // ---- analyze (Part 6) ----------------------------------------------------
  const analyze = useCallback(async () => {
    const q = current;
    const rec = recordings[q?.id ?? ""];
    if (!q || !rec) return;
    setPhase("analyzing");
    try {
      const transcript = rec.transcript || "";
      const durationMs = rec.meta?.durationMs ?? 0;
      // Use the pure helper directly (no hook needed here — `analyze` is a
      // callback, not a component body, so calling the React hook variant
      // would violate the rules of hooks).
      const fillerStats = analyzeFillerWords(transcript, durationMs);
      const wpmScore = normalizeWpmToScore(fillerStats.wpm);
      const fillerScore = normalizeFillerCountToScore(fillerStats.count, fillerStats.wordCount);
      const evaluation = await evaluateAnswer({
        question: q,
        answerText: transcript || "(no speech detected — answer was non-verbal or speech recognition was unavailable)",
        resume,
        jd,
        videoMetrics: {
          videoAvailable: true,
          eyeContact: null, // vision-based gaze tracking not available without a face model
          wordsPerMinute: fillerStats.wpm || null,
          fillerWordCount: fillerStats.count,
        } as VideoDerivedMetrics,
      });
      // If the model returned nulls for the speech-derived dimensions, patch
      // them with our deterministic measurements.
      if (evaluation.speakingSpeed == null && wpmScore != null) {
        evaluation.speakingSpeed = wpmScore;
      }
      if (evaluation.fillerWords == null && fillerScore != null) {
        evaluation.fillerWords = fillerScore;
      }
      setRecordings((prev) => ({ ...prev, [q.id]: { ...rec, evaluation } }));
      setPhase("analysis");
    } catch (e: any) {
      setError(e?.message || "Analysis failed.");
      setPhase("review");
    }
  }, [current, jd, recordings, resume]);

  // ---- pre-compute match score for the final report ------------------------
  const matchScore: InterviewMatchScore | null = useMemo(() => {
    if (!resume) return null;
    return buildInterviewMatchScore(resume, jd);
  }, [resume, jd]);

  // ---- finish session: build final report and bubble up --------------------
  const finishSession = useCallback(async () => {
    setGeneratingReport(true);
    try {
      // Iterate entries directly so we have stable questionId alongside each
      // recording (avoids the fragile `Object.values` + reverse-lookup pattern).
      const entries = Object.entries(recordings);
      const metaRecords: InterviewRecordingMeta[] = [];
      const evaluations: Array<{
        questionId: string;
        category: string;
        subType?: string;
        overallScore: number;
        strengths: string[];
        weaknesses: string[];
        suggestions: string[];
      }> = [];
      let skippedCount = 0;
      for (const [questionId, rec] of entries) {
        if (rec.skipped) {
          skippedCount += 1;
          continue;
        }
        if (rec.meta) metaRecords.push(rec.meta);
        if (rec.evaluation) {
          const q = questions.find((qq) => qq.id === questionId);
          evaluations.push({
            questionId,
            category: q?.category ?? "hr",
            subType: q?.subType,
            overallScore: rec.evaluation.overallScore,
            strengths: rec.evaluation.strengths,
            weaknesses: rec.evaluation.weaknesses,
            suggestions: rec.evaluation.suggestions,
          });
        }
      }
      const report = await generateHiringRecommendation({
        evaluations,
        totalCount: total,
        skippedCount,
        matchScore,
        useAI: true,
        resumeId: resume?.id,
        jdId: jd?.id,
        company: jd?.company ?? pkg.company,
      });
      setFinalReport(report);
      setPhase("final-report");
      onComplete?.(sessionId, metaRecords, report);
    } catch (e: any) {
      // If the final-report AI call fails, still let the user exit.
      setError(e?.message || "Could not generate final report.");
      const metaRecords: InterviewRecordingMeta[] = Object.values(recordings)
        .filter((r) => !!r.meta)
        .map((r) => r.meta!) as InterviewRecordingMeta[];
      onComplete?.(sessionId, metaRecords);
      onClose();
    } finally {
      setGeneratingReport(false);
    }
  }, [recordings, questions, total, matchScore, resume?.id, jd?.id, jd?.company, pkg.company, onComplete, onClose, sessionId]);

  // ---- navigation ----------------------------------------------------------
  const goNext = useCallback(() => {
    if (isLast) {
      void finishSession();
    } else {
      setCurrentIndex((i) => Math.min(i + 1, total - 1));
      setError(null);
      speech.reset();
      setPhase("prep");
    }
  }, [isLast, finishSession, total, speech]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
    setError(null);
    speech.reset();
    setPhase("prep");
  }, [speech]);

  // ---- fullscreen mode -----------------------------------------------------
  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen?.();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen?.();
        setIsFullscreen(false);
      }
    } catch {
      /* fullscreen can be blocked by user agent settings; non-fatal */
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // ---- cleanup stream on unmount -------------------------------------------
  useEffect(
    () => () => {
      cleanUpStreams();
    },
    [cleanUpStreams]
  );

  if (!current) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Icon name="AlertCircle" className="w-10 h-10 text-amber-500 mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">No questions available.</p>
          <Button onClick={handleExit} variant="outline" className="mt-4">Back</Button>
        </CardContent>
      </Card>
    );
  }

  const cat = CATEGORY_META[current.category] ?? CATEGORY_META.hr;
  const subTypeLabel = current.subType ? SUB_TYPE_LABELS[current.subType] : null;

  // ---- FINAL REPORT PHASE --------------------------------------------------
  if (phase === "final-report" && finalReport) {
    return (
      <FinalReportView
        report={finalReport}
        matchScore={matchScore}
        onClose={handleExit}
      />
    );
  }

  return (
    <div className="space-y-4" ref={containerRef}>
      {/* Browser compatibility banner */}
      {compatWarning && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-2.5 flex items-start gap-2">
          <Icon name="AlertTriangle" className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span className="text-xs text-amber-700 dark:text-amber-400">{compatWarning}</span>
        </div>
      )}

      {/* Header + progress */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <Icon name="Video" className="w-5 h-5 text-brand shrink-0" />
              <div className="min-w-0">
                <h2 className="font-semibold text-sm sm:text-base truncate">
                  {pkg.role ?? "Video Interview"}{pkg.company ? ` at ${pkg.company}` : ""}
                </h2>
                <p className="text-xs text-muted-foreground">Asynchronous video interview (Sonru-style)</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFullscreen}
                className="gap-1.5"
                title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                <Icon name={isFullscreen ? "Minimize2" : "Maximize2"} className="w-4 h-4" />
                <span className="hidden sm:inline">{isFullscreen ? "Exit" : "Fullscreen"}</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleExit} className="gap-1.5">
                <Icon name="X" className="w-4 h-4" /> Exit
              </Button>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs mb-1.5">
            <span className="font-medium text-muted-foreground">Question {currentIndex + 1} of {total}</span>
            <span className="font-bold text-brand">{percent}%</span>
          </div>
          <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
            <motion.div className="h-full bg-gradient-to-r from-brand to-brand-dark rounded-full" animate={{ width: `${percent}%` }} transition={{ duration: 0.3 }} />
          </div>
        </CardContent>
      </Card>

      {/* Question card */}
      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: `${cat.color}15`, color: cat.color }}>
              <Icon name={cat.icon} className="w-3.5 h-3.5" /> {cat.label}
            </div>
            {subTypeLabel && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-brand/10 text-brand" title="Sonru question family">
                {subTypeLabel}
              </span>
            )}
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: `${DIFF_COLOR[current.difficulty] ?? "#888"}20`, color: DIFF_COLOR[current.difficulty] ?? "#888" }}>
              {current.difficulty}
            </span>
            {currentRec?.evaluation && (
              <Badge variant="outline" className="text-[10px] gap-1"><Icon name="CheckCircle2" className="w-3 h-3" /> Scored {currentRec.evaluation.overallScore}</Badge>
            )}
            {currentRec?.skipped && (
              <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground"><Icon name="SkipForward" className="w-3 h-3" /> Skipped</Badge>
            )}
            {current.personaName && (
              <Badge variant="outline" className="text-[10px] gap-1"><Icon name="User" className="w-3 h-3" /> {current.personaName}</Badge>
            )}
          </div>

          <p className="text-base sm:text-lg font-semibold text-pretty">{current.question}</p>

          {current.talkingPoints?.length > 0 && (
            <div className="rounded-lg bg-secondary/40 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Icon name="Lightbulb" className="w-3.5 h-3.5 text-gold" /> Talking Points
              </div>
              <ul className="space-y-1">
                {current.talkingPoints.map((t, j) => (
                  <li key={j} className="text-xs text-foreground/80 flex gap-2"><span className="text-brand shrink-0">›</span> <span>{t}</span></li>
                ))}
              </ul>
            </div>
          )}

          {/* === Live camera preview frame ===
              Rendered continuously during prep, countdown, AND recording so the
              user always sees themselves and can verify the camera is working.
              This fixes the regression where the video frame was only visible
              during the recording phase — the user had no way to confirm their
              camera/mic were active before the countdown ended. */}

          {/* PREP phase — camera preview or avatar fallback + prep timer + device status */}
          {phase === "prep" && (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                {sessionMode === "video" ? (
                  <video key="video-prep" ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
                ) : (
                  <CandidateVideoAvatar
                    mode={sessionMode}
                    audioLevel={previewMeter.level}
                    overlayTimer={formatRemaining(prepRemaining)}
                  />
                )}

                {/* Overlays for Video mode */}
                {sessionMode === "video" && (
                  <>
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 text-[10px] font-medium text-white bg-black/50 px-2 py-1 rounded-full">
                      <Icon name="Camera" className="w-3 h-3" /> Preview
                    </div>
                    <div className="absolute top-2 right-2 flex items-center gap-1.5 text-[10px] font-medium text-white bg-brand/80 px-2 py-1 rounded-full">
                      <Icon name="Clock" className="w-3 h-3" /> {formatRemaining(prepRemaining)}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-center bg-black/50 backdrop-blur-sm rounded-xl px-6 py-4">
                        <div className="text-4xl font-bold text-white tabular-nums">{formatRemaining(prepRemaining)}</div>
                        <p className="text-xs text-white/90 mt-1">Prepare your answer</p>
                      </div>
                    </div>
                  </>
                )}

                {/* Camera activating spinner / error overlay */}
                {cameraActivating && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
                    <div className="text-center">
                      <Icon name="Loader2" className="w-6 h-6 animate-spin text-white mx-auto" />
                      <p className="text-xs text-white/80 mt-2">Checking camera & audio devices…</p>
                    </div>
                  </div>
                )}
                {cameraError && !cameraActivating && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/75 z-10">
                    <div className="text-center max-w-sm px-4">
                      <Icon name="VideoOff" className="w-8 h-8 text-amber-400 mx-auto" />
                      <p className="text-xs text-white/95 mt-2 font-semibold">Webcam Not Accessible</p>
                      <p className="text-[11px] text-white/75 mt-1">{cameraError}</p>
                      <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
                        <Button size="sm" variant="outline" onClick={activateCamera} className="gap-1.5 bg-white/10 border-white/30 text-white hover:bg-white/20">
                          <Icon name="RefreshCw" className="w-3.5 h-3.5" /> Retry
                        </Button>
                        <Button size="sm" variant="outline" onClick={switchToAudioOnly} className="gap-1.5 bg-emerald-600/30 border-emerald-500/40 text-emerald-200 hover:bg-emerald-600/40">
                          <Icon name="Mic" className="w-3.5 h-3.5" /> Audio-Only
                        </Button>
                        <Button size="sm" variant="outline" onClick={switchToPracticeMode} className="gap-1.5 bg-indigo-600/30 border-indigo-500/40 text-indigo-200 hover:bg-indigo-600/40">
                          <Icon name="Sparkles" className="w-3.5 h-3.5" /> Practice Mode
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Inline device status — lets the user verify camera + mic */}
              <div className="flex items-center justify-between gap-2 flex-wrap text-[10px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <DeviceStatusPill
                    ok={sessionMode === "video" && deviceSnapshot.cameraPermission === "granted" && !!deviceSnapshot.previewActive}
                    label="Camera"
                    icon="Camera"
                    detail={sessionMode === "video" ? (deviceSnapshot.previewCapabilities ? `${deviceSnapshot.previewCapabilities.width}×${deviceSnapshot.previewCapabilities.height}` : undefined) : "bypassed"}
                  />
                  <DeviceStatusPill
                    ok={sessionMode !== "simulated" && deviceSnapshot.micPermission === "granted"}
                    label="Mic"
                    icon="Mic"
                    detail={sessionMode === "simulated" ? "simulated" : undefined}
                  />
                  <DeviceStatusPill
                    ok={previewMeter.active || sessionMode === "simulated"}
                    label="Audio"
                    icon="Activity"
                    detail={sessionMode === "simulated" ? "practice" : (previewMeter.active ? "live" : "silent")}
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground font-medium">Mode:</span>
                  <Badge variant="outline" className={cn(
                    "text-[10px] font-semibold",
                    sessionMode === "video" ? "bg-sky-500/10 text-sky-600 border-sky-500/30" :
                    sessionMode === "audio-only" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" :
                    "bg-indigo-500/10 text-indigo-600 border-indigo-500/30"
                  )}>
                    {sessionMode === "video" ? "Video + Audio" : sessionMode === "audio-only" ? "Audio-Only" : "Practice Mode"}
                  </Badge>
                </div>
              </div>

              {/* Preview audio meter */}
              {sessionMode !== "simulated" && (
                <AudioMeterBar level={previewMeter.level} />
              )}

              {/* Prep controls */}
              <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                <p className="text-xs text-muted-foreground">Recording starts automatically when the timer ends.</p>
                <div className="flex items-center gap-2">
                  {sessionMode === "video" && !cameraError && !cameraActivating && (
                    <Button size="sm" variant="ghost" onClick={activateCamera} className="gap-1.5 text-muted-foreground" title="Re-initialise camera & microphone">
                      <Icon name="RefreshCw" className="w-3.5 h-3.5" /> Retry camera
                    </Button>
                  )}
                  {sessionMode !== "video" && (
                    <Button size="sm" variant="ghost" onClick={activateCamera} className="gap-1.5 text-muted-foreground">
                      <Icon name="Camera" className="w-3.5 h-3.5" /> Try Webcam
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setPhase("countdown")} className="gap-1.5">
                    <Icon name="FastForward" className="w-4 h-4" /> Skip prep
                  </Button>
                  <Button size="sm" onClick={handleStartAnswerNow} className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5 shadow-sm">
                    <Icon name="Play" className="w-4 h-4 fill-current" /> Start Answer Now
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* COUNTDOWN phase — camera preview or avatar with big countdown overlay & instant start control */}
          {phase === "countdown" && (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                {sessionMode === "video" ? (
                  <>
                    <video key="video-countdown" ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 text-[10px] font-medium text-white bg-black/50 px-2 py-1 rounded-full">
                      <Icon name="Video" className="w-3 h-3" /> Get ready
                    </div>
                    {/* Big countdown number centered on the video feed */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-7xl sm:text-8xl font-bold text-white tabular-nums drop-shadow-2xl animate-pulse">
                        {Math.ceil(recCountdown / 1000)}
                      </div>
                    </div>
                    <div className="absolute bottom-2 left-2 right-2 text-center">
                      <p className="text-xs text-white/90 bg-black/40 inline-block px-2.5 py-1 rounded-full">Recording starts automatically</p>
                    </div>
                  </>
                ) : (
                  <CandidateVideoAvatar
                    mode={sessionMode}
                    audioLevel={previewMeter.level}
                    overlayCountdown={Math.ceil(recCountdown / 1000)}
                  />
                )}
              </div>

              {/* Countdown manual controls to avoid being trapped or stuck */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-secondary/30 rounded-xl p-3 border">
                <div>
                  <p className="text-xs font-medium text-foreground">Get ready to deliver your response</p>
                  <p className="text-[11px] text-muted-foreground">You can begin speaking immediately or skip ahead.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={skipQuestion}
                    className="gap-1.5 text-xs"
                  >
                    <Icon name="SkipForward" className="w-3.5 h-3.5" /> Skip
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleStartAnswerNow}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5 shadow-sm"
                  >
                    <Icon name="Play" className="w-4 h-4 fill-current" /> Start Answer Now
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* RECORDING phase — video frame or avatar fallback, with REC badge + simulated fallback controls */}
          {phase === "recording" && (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                {sessionMode === "video" ? (
                  <>
                    <video key="video-recording" ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 text-[10px] font-medium text-white bg-black/50 px-2 py-1 rounded-full">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> REC {formatDuration(activeElapsed)}
                    </div>
                    {MAX_REC_MS && (
                      <div className="absolute bottom-2 left-2 right-2">
                        <div className="h-1 bg-white/30 rounded-full overflow-hidden">
                          <div className="h-full bg-red-500" style={{ width: `${Math.min(100, (activeElapsed / MAX_REC_MS) * 100)}%` }} />
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <CandidateVideoAvatar
                    mode={sessionMode}
                    audioLevel={previewMeter.level || recorder.level}
                    overlayTimer={formatDuration(activeElapsed)}
                    isRecording={true}
                    badgeText={isSimulatedRecording ? "REC (PRACTICE)" : "REC"}
                    badgeIcon="Radio"
                  />
                )}
              </div>

              {/* Progress timer bar */}
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 transition-all duration-100"
                  style={{ width: `${Math.min(100, (activeElapsed / MAX_REC_MS) * 100)}%` }}
                />
              </div>

              {/* audio meter */}
              {sessionMode !== "simulated" && (
                <AudioMeterBar level={recorder.level || previewMeter.level} />
              )}

              {/* live transcript (if supported) */}
              {speech.supported && (
                <div className="rounded-lg bg-secondary/40 p-2.5 max-h-24 overflow-y-auto">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                    <Icon name="Captions" className="w-3 h-3" /> Live transcript
                    {speech.listening && <span className="text-emerald-600 ml-1">●</span>}
                  </div>
                  <p className="text-xs text-foreground/80">
                    {speech.transcript || speech.interimTranscript || <span className="italic text-muted-foreground">Listening…</span>}
                  </p>
                </div>
              )}
              {!speech.supported && (
                <p className="text-[10px] text-muted-foreground italic">
                  Live speech-to-text is not supported in this browser. You can still rehearse and analyze your answer.
                </p>
              )}

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <span>Elapsed: {formatDuration(activeElapsed)} / {formatDuration(MAX_REC_MS)}</span>
                  {isSimulatedRecording && (
                    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                      Simulated Practice Timer
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  {(recorder.state === "recording" || isSimulatedRecording) ? (
                    <Button size="sm" variant="outline" onClick={handlePauseRecording} className="gap-1.5">
                      <Icon name="Pause" className="w-4 h-4" /> Pause
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={handleResumeRecording} className="gap-1.5">
                      <Icon name="Play" className="w-4 h-4" /> Resume
                    </Button>
                  )}
                  <Button size="sm" onClick={handleStopRecording} className="bg-red-600 hover:bg-red-700 text-white gap-1.5">
                    <Icon name="Square" className="w-4 h-4" /> Stop & Review
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Phase: REVIEW */}
          {phase === "review" && currentRec?.objectUrl && (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                {sessionMode === "video" ? (
                  <video src={currentRec.objectUrl} className="w-full h-full object-cover" controls playsInline />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-slate-900">
                    <CandidateVideoAvatar
                      mode={sessionMode}
                      label="Recorded Practice Response"
                      subLabel="Your audio answer has been stored for AI evaluation."
                      badgeText="Playback Ready"
                      badgeIcon="Volume2"
                    />
                    <div className="w-full max-w-md mt-3">
                      <audio src={currentRec.objectUrl} controls className="w-full" />
                    </div>
                  </div>
                )}
              </div>

              {currentRec.transcript && (
                <div className="rounded-lg bg-secondary/40 p-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                    <Icon name="Captions" className="w-3 h-3" /> Transcript
                  </div>
                  <p className="text-xs text-foreground/80 whitespace-pre-wrap">{currentRec.transcript}</p>
                </div>
              )}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-xs text-muted-foreground">
                  {formatDuration(currentRec.meta?.durationMs ?? 0)} · {((currentRec.meta?.sizeBytes ?? 0) / 1024 / 1024).toFixed(1)} MB
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={reRecord} className="gap-1.5 text-destructive"><Icon name="RotateCcw" className="w-4 h-4" /> Re-record</Button>
                  <Button size="sm" onClick={analyze} className="bg-brand hover:bg-brand-dark text-white gap-1.5"><Icon name="Sparkles" className="w-4 h-4" /> Analyze answer</Button>
                </div>
              </div>
            </div>
          )}

          {/* Phase: ANALYZING */}
          {phase === "analyzing" && (
            <div className="text-center py-6">
              <Icon name="Loader2" className="w-6 h-6 animate-spin text-brand mx-auto" />
              <p className="text-sm text-muted-foreground mt-2">Analyzing your answer…</p>
            </div>
          )}

          {/* Phase: ANALYSIS (feedback) */}
          {phase === "analysis" && currentRec?.evaluation && (
            <>
              <EvaluationCard evaluation={currentRec.evaluation} idealAnswer={current.recommendedAnswer} />
              <div className="flex items-center justify-between gap-2 pt-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={goPrev} disabled={currentIndex === 0} className="gap-1.5">
                  <Icon name="ArrowLeft" className="w-4 h-4" /> Previous
                </Button>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={reRecord} className="gap-1.5"><Icon name="RotateCcw" className="w-4 h-4" /> Re-record</Button>
                  <Button size="sm" onClick={goNext} className="bg-brand hover:bg-brand-dark text-white gap-1.5" disabled={generatingReport}>
                    {generatingReport ? <Icon name="Loader2" className="w-4 h-4 animate-spin" /> : null}
                    {isLast ? "Finish" : "Next"} <Icon name={isLast ? "Flag" : "ArrowRight"} className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Skip button — visible in prep / countdown / review phases */}
          {(phase === "prep" || phase === "countdown" || phase === "review") && (
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" onClick={skipQuestion} className="gap-1.5 text-muted-foreground" title="Skip this question (optional)">
                <Icon name="SkipForward" className="w-3.5 h-3.5" /> Skip question
              </Button>
            </div>
          )}

          {videoQualityWarning && phase === "prep" && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-2 flex items-start gap-2">
              <Icon name="AlertTriangle" className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span className="text-[11px] text-amber-700 dark:text-amber-400">{videoQualityWarning}</span>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 p-2.5 flex items-start gap-2">
              <Icon name="AlertCircle" className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span className="text-xs text-red-700 dark:text-red-400">{error}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Final report — full-screen card shown after the last question
// ----------------------------------------------------------------------------

function FinalReportView({
  report,
  matchScore,
  onClose,
}: {
  report: InterviewFinalReport;
  matchScore: InterviewMatchScore | null;
  onClose: () => void;
}) {
  const verdictColor = VERDICT_COLORS[report.verdict];
  return (
    <Card>
      <CardContent className="p-4 sm:p-6 space-y-5">
        <div className="flex items-center gap-3 flex-wrap">
          <Icon name="Trophy" className="w-7 h-7 text-gold" />
          <div>
            <h2 className="font-display text-xl font-bold">Final Interview Report</h2>
            <p className="text-xs text-muted-foreground">
              {report.answeredCount} of {report.totalCount} answered · {report.skippedCount} skipped
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border p-3 flex flex-col items-center justify-center text-center">
            <ScoreRing value={report.overallScore} size={88} label="Score" />
            <div className="text-xs font-semibold mt-1">Interview Score</div>
          </div>
          <div className="rounded-xl border border-border p-3 flex flex-col items-center justify-center text-center">
            <div className="text-2xl font-bold" style={{ color: verdictColor }}>{report.verdictLabel.split("—")[0].trim()}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{report.verdictLabel.split("—")[1]?.trim() ?? ""}</div>
            <div className="text-xs font-semibold mt-1">Hiring Recommendation</div>
          </div>
          <div className="rounded-xl border border-border p-3 flex flex-col items-center justify-center text-center">
            <ScoreRing value={report.atsReadiness} size={88} label="ATS" />
            <div className="text-xs font-semibold mt-1">ATS Readiness</div>
          </div>
        </div>

        {matchScore && (
          <div className="rounded-xl bg-secondary/40 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Icon name="Briefcase" className="w-3.5 h-3.5" /> Resume ↔ JD Match
            </div>
            <div className="grid sm:grid-cols-5 gap-2 text-[11px]">
              <MatchBar label="Overall" value={matchScore.overall} />
              <MatchBar label="Skills" value={matchScore.skillMatch} />
              <MatchBar label="Keywords" value={matchScore.keywordMatch} />
              <MatchBar label="Experience" value={matchScore.experienceMatch} />
              <MatchBar label="Industry" value={matchScore.industryMatch} />
            </div>
            <div className="grid sm:grid-cols-2 gap-2 mt-2 text-[11px]">
              {matchScore.missingSkills.length > 0 && (
                <div>
                  <div className="font-semibold text-amber-600">Missing Skills</div>
                  <div className="text-muted-foreground">{matchScore.missingSkills.join(", ")}</div>
                </div>
              )}
              {matchScore.missingKeywords.length > 0 && (
                <div>
                  <div className="font-semibold text-amber-600">Missing ATS Keywords</div>
                  <div className="text-muted-foreground">{matchScore.missingKeywords.join(", ")}</div>
                </div>
              )}
              <div>
                <div className="font-semibold">Seniority</div>
                <div className="text-muted-foreground capitalize">{matchScore.seniority}</div>
              </div>
              <div>
                <div className="font-semibold">Industry</div>
                <div className="text-muted-foreground">{matchScore.industry}</div>
              </div>
            </div>
          </div>
        )}

        {Object.keys(report.categoryAverages).length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Category Averages</div>
            <div className="space-y-1.5">
              {Object.entries(report.categoryAverages).map(([cat, val]) => (
                <div key={cat} className="flex items-center gap-2 text-xs">
                  <span className="w-20 shrink-0 capitalize text-muted-foreground">{cat}</span>
                  <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${val}%`, background: val >= 70 ? "#10B981" : val >= 50 ? "#F59E0B" : "#DC2626" }} />
                  </div>
                  <span className="w-7 text-right font-semibold">{val}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid sm:grid-cols-3 gap-3">
          <ReportList title="Top Strengths" icon="CheckCircle2" color="text-emerald-600" items={report.topStrengths} />
          <ReportList title="Top Weaknesses" icon="AlertTriangle" color="text-amber-600" items={report.topWeaknesses} />
          <ReportList title="Action Items" icon="Lightbulb" color="text-brand" items={report.actionItems} />
        </div>

        <div className="rounded-xl bg-brand/5 dark:bg-brand/10 border border-brand/30 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-brand mb-1 flex items-center gap-1.5">
            <Icon name="Sparkles" className="w-3.5 h-3.5" /> Hiring Committee Narrative
          </div>
          <p className="text-xs text-foreground/80 leading-relaxed">{report.narrative}</p>
        </div>

        <div className="flex justify-end">
          <Button onClick={onClose} className="bg-brand hover:bg-brand-dark text-white gap-1.5">
            <Icon name="Check" className="w-4 h-4" /> Save & Exit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MatchBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{value}</span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: value >= 70 ? "#10B981" : value >= 50 ? "#F59E0B" : "#DC2626" }} />
      </div>
    </div>
  );
}

function ReportList({ title, icon, color, items }: { title: string; icon: string; color: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
        <Icon name={icon} className={`w-3.5 h-3.5 ${color}`} /> {title}
      </div>
      {items.length > 0 ? (
        <ul className="space-y-1 text-xs text-foreground/80">
          {items.map((s, i) => <li key={i} className="flex gap-1.5"><span className={color + " shrink-0"}>•</span> <span>{s}</span></li>)}
        </ul>
      ) : (
        <p className="text-[11px] italic text-muted-foreground">No items.</p>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// helpers / sub-components
// ----------------------------------------------------------------------------

/**
 * Inline device-status pill — shows a green check / red cross for camera, mic,
 * and audio level. Lets the user verify their devices work WITHOUT leaving the
 * video session for the separate Device Check tab.
 */
function DeviceStatusPill({
  ok,
  label,
  icon,
  detail,
}: {
  ok: boolean;
  label: string;
  icon: string;
  detail?: string;
}) {
  return (
    <div
      className={`flex items-center gap-1 px-2 py-1 rounded-full border ${
        ok
          ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400"
          : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-700 dark:text-red-400"
      }`}
      title={ok ? `${label}: active` : `${label}: not ready`}
    >
      <Icon name={icon} className="w-3 h-3" />
      <span className="font-medium">{label}</span>
      <Icon name={ok ? "CheckCircle2" : "XCircle"} className="w-3 h-3" />
      {detail && <span className="text-[9px] opacity-70">· {detail}</span>}
    </div>
  );
}

function AudioMeterBar({ level }: { level: number }) {
  const pct = Math.round(level * 100);
  const color = pct > 75 ? "#DC2626" : pct > 35 ? "#F59E0B" : "#10B981";
  return (
    <div className="space-y-1">
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="text-[10px] text-muted-foreground">Mic input</div>
    </div>
  );
}

function EvaluationCard({ evaluation, idealAnswer }: { evaluation: AnswerEvaluation; idealAnswer: string }) {
  const dims: { key: keyof AnswerEvaluation; label: string }[] = [
    { key: "communication", label: "Communication" },
    { key: "confidence", label: "Confidence" },
    { key: "grammar", label: "Grammar" },
    { key: "fluency", label: "Fluency" },
    { key: "professionalism", label: "Professionalism" },
    { key: "contentRelevance", label: "Content Relevance" },
    { key: "starStructure", label: "STAR Structure" },
    { key: "roleFit", label: "Role Fit" },
    { key: "eyeContact", label: "Eye Contact" },
    { key: "speakingSpeed", label: "Speaking Speed" },
    { key: "fillerWords", label: "Filler Words" },
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-brand/30 bg-brand/5 dark:bg-brand/10 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="Sparkles" className="w-4 h-4 text-brand" />
          <span className="text-sm font-semibold">AI Feedback</span>
        </div>
        <ScoreRing value={evaluation.overallScore} size={48} label="Score" />
      </div>
      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2">
        {dims.map(({ key, label }) => {
          const v = evaluation[key] as number | null;
          if (v == null) {
            return (
              <div key={label} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className="text-[10px] text-muted-foreground italic">N/A</span>
              </div>
            );
          }
          return (
            <div key={label} className="flex items-center gap-2 text-xs">
              <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
              <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${v}%`, background: v >= 70 ? "#10B981" : v >= 50 ? "#F59E0B" : "#DC2626" }} />
              </div>
              <span className="w-7 text-right font-semibold">{v}</span>
            </div>
          );
        })}
      </div>
      {evaluation.strengths.length > 0 && (
        <Expandable title="Strengths" icon="CheckCircle2" color="text-emerald-600">
          {evaluation.strengths.map((s, i) => <li key={i} className="flex gap-1.5"><span className="text-emerald-600 shrink-0">✓</span> {s}</li>)}
        </Expandable>
      )}
      {evaluation.weaknesses.length > 0 && (
        <Expandable title="Weaknesses" icon="AlertTriangle" color="text-amber-600">
          {evaluation.weaknesses.map((w, i) => <li key={i} className="flex gap-1.5"><span className="text-amber-600 shrink-0">→</span> {w}</li>)}
        </Expandable>
      )}
      {evaluation.suggestions.length > 0 && (
        <Expandable title="Suggestions" icon="Lightbulb" color="text-brand">
          {evaluation.suggestions.map((s, i) => <li key={i} className="flex gap-1.5"><span className="text-brand shrink-0">›</span> {s}</li>)}
        </Expandable>
      )}
      {idealAnswer && (
        <Expandable title="Ideal Answer" icon="Sparkles" color="text-gold">
          <li className="text-xs leading-relaxed">{idealAnswer}</li>
        </Expandable>
      )}
    </motion.div>
  );
}

function Expandable({ title, icon, color, children }: { title: string; icon: string; color: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
        <Icon name={icon} className={`w-3.5 h-3.5 ${color}`} /> {title}
      </div>
      <ul className="space-y-0.5 text-xs text-foreground/80">{children}</ul>
    </div>
  );
}

// category + difficulty presentation (mirrors Interview.tsx)
const CATEGORY_META: Record<string, { label: string; icon: string; color: string }> = {
  technical: { label: "Technical", icon: "Code2", color: "#1154A3" },
  behavioral: { label: "Behavioral", icon: "Users", color: "#F59E0B" },
  situational: { label: "Situational", icon: "GitBranch", color: "#10B981" },
  hr: { label: "HR", icon: "UserCheck", color: "#8B5CF6" },
  company: { label: "Company-specific", icon: "Building2", color: "#EC4899" },
};

const DIFF_COLOR: Record<string, string> = { easy: "#10B981", medium: "#F59E0B", hard: "#DC2626", adaptive: "#3B82F6" };

const SUB_TYPE_LABELS: Record<string, string> = {
  "hr": "HR",
  "behavioral": "Behavioral",
  "star": "STAR",
  "technical": "Technical",
  "situational": "Situational",
  "company-fit": "Company Fit",
  "leadership": "Leadership",
  "problem-solving": "Problem Solving",
  "resume-specific": "Resume-Specific",
  "jd-specific": "JD-Specific",
};

const VERDICT_COLORS: Record<string, string> = {
  "strong-yes": "#10B981",
  "yes": "#22C55E",
  "lean-yes": "#F59E0B",
  "no": "#F97316",
  "strong-no": "#DC2626",
};
