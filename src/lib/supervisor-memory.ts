// ============================================================================
// Supervisor Memory — Shared Structured Memory
// ============================================================================

import type { SupervisorMemory } from "./pipeline-orchestration-types";

export function createSupervisorMemory(executionId: string): SupervisorMemory {
  return {
    executionId,
    startedAt: new Date().toISOString(),
    completedAt: undefined,
    agentExecutions: [],
    scratchpad: {},
  };
}

export function writeMemory(memory: SupervisorMemory, key: string, value: any): void {
  if (!memory.scratchpad) memory.scratchpad = {};
  memory.scratchpad[key] = value;
}

export function readMemory<T = any>(memory: SupervisorMemory, key: string): T | undefined {
  return memory.scratchpad?.[key] as T | undefined;
}

export function completeMemory(memory: SupervisorMemory): void {
  memory.completedAt = new Date().toISOString();
}

export function getMemorySummary(memory: SupervisorMemory): Record<string, any> {
  return {
    executionId: memory.executionId,
    startedAt: memory.startedAt,
    completedAt: memory.completedAt,
    agentExecutionsCount: memory.agentExecutions?.length || 0,
    scratchpadKeys: Object.keys(memory.scratchpad || {}),
  };
}
