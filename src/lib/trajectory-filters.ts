// ============================================================================
// Trajectory Filters — Pipeline Observability
// ============================================================================

import type { AgentEvent } from "./agent-event-bus";

export type TrajectoryFilter = "all" | "errors" | "skips" | "nodes" | string;

export function isSkipEvent(e: AgentEvent): boolean {
  return (
    e.action?.includes("skip") ||
    e.metadata?.skipped === true ||
    e.metadata?.reason?.toString().includes("skip") ||
    false
  );
}

export function isCapEvent(e: AgentEvent): boolean {
  return (
    e.action?.includes("cap") ||
    e.metadata?.reason?.toString().includes("cap") ||
    false
  );
}

export function describeSkipReason(e: AgentEvent): string {
  if (e.metadata?.reason) return String(e.metadata.reason);
  if (e.metadata?.error) return String(e.metadata.error);
  return "Provider skipped or throttled";
}

export function summarizeSkips(events: AgentEvent[]): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const e of events) {
    if (isSkipEvent(e)) {
      const reason = describeSkipReason(e);
      summary[reason] = (summary[reason] || 0) + 1;
    }
  }
  return summary;
}

export function filterTrajectory(events: AgentEvent[] = [], filter: TrajectoryFilter): AgentEvent[] {
  if (filter === "all") return events;
  if (filter === "errors") {
    return events.filter((e) => e.success === false || e.action?.includes("failed"));
  }
  if (filter === "skips") {
    return events.filter(isSkipEvent);
  }
  if (filter === "nodes") {
    return events.filter((e) => e.agent === "PipelineNode");
  }
  return events;
}
