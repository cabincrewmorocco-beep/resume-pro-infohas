"use client";

import { InterviewSimulator as SimulatorCore } from "@/components/interview/InterviewSimulator";
import { useApp } from "@/lib/store";

export function InterviewSimulatorModule() {
  const setView = useApp((s) => s.setView);
  const activeResumeId = useApp((s) => s.activeResumeId);
  const activeJdId = useApp((s) => s.activeJdId);

  return (
    <div className="max-w-5xl mx-auto py-2">
      <SimulatorCore
        defaultResumeId={activeResumeId || undefined}
        defaultJdId={activeJdId || undefined}
        onNavigate={(v) => setView(v as any)}
      />
    </div>
  );
}
