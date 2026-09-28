"use client";

import { useState } from "react";
import { InterviewSimulator as SimulatorCore } from "@/components/interview/InterviewSimulator";
import { InteractiveMockInterview } from "@/components/interview/InteractiveMockInterview";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/shared";
import { useApp } from "@/lib/store";

export function InterviewSimulatorModule() {
  const setView = useApp((s) => s.setView);
  const activeResumeId = useApp((s) => s.activeResumeId);
  const activeJdId = useApp((s) => s.activeJdId);
  const [activeMode, setActiveMode] = useState<"voice_mic" | "full_simulator">("voice_mic");

  return (
    <div className="max-w-6xl mx-auto py-2 space-y-4">
      {/* Mode Switcher Banner */}
      <div className="flex items-center justify-between bg-muted/40 border border-border/80 rounded-xl p-2.5">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={activeMode === "voice_mic" ? "default" : "ghost"}
            onClick={() => setActiveMode("voice_mic")}
            className={`text-xs gap-1.5 h-8 ${activeMode === "voice_mic" ? "bg-primary text-primary-foreground font-semibold" : ""}`}
          >
            <Icon name="Mic" className="w-3.5 h-3.5" />
            Interactive Voice Mock Interview (Live Microphone)
          </Button>

          <Button
            size="sm"
            variant={activeMode === "full_simulator" ? "default" : "ghost"}
            onClick={() => setActiveMode("full_simulator")}
            className={`text-xs gap-1.5 h-8 ${activeMode === "full_simulator" ? "bg-primary text-primary-foreground font-semibold" : ""}`}
          >
            <Icon name="MessagesSquare" className="w-3.5 h-3.5" />
            Full Context-Aware Simulator
          </Button>
        </div>

        <Badge variant="outline" className="hidden sm:inline-flex text-[11px] font-mono text-muted-foreground">
          Real-time Clarity & Relevance Telemetry
        </Badge>
      </div>

      {activeMode === "voice_mic" ? (
        <InteractiveMockInterview />
      ) : (
        <SimulatorCore
          defaultResumeId={activeResumeId || undefined}
          defaultJdId={activeJdId || undefined}
          onNavigate={(v) => setView(v as any)}
        />
      )}
    </div>
  );
}
