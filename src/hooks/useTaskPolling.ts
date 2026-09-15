"use client";

// ============================================================================
// useTaskPolling — Client-Side Local Task State Hook
// 100% Standalone in Browser — No External Worker Required
// ============================================================================

import { useState, useEffect, useCallback, useRef } from "react";

export type TaskStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface TaskState {
  id: string;
  type?: string;
  status: TaskStatus;
  progress: number;
  message: string | null;
  error: string | null;
  result?: any;
  updated_at: number;
}

const localTasksMap = new Map<string, TaskState>();

export interface UseTaskPollingResult {
  task: TaskState | null;
  isLoading: boolean;
  error: string | null;
  isTerminal: boolean;
  cancel: () => Promise<boolean>;
  refetch: () => void;
}

function isTerminalStatus(status: TaskStatus | undefined | null): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

export function useTaskPolling(taskId: string | null): UseTaskPollingResult {
  const [task, setTask] = useState<TaskState | null>(() => (taskId ? localTasksMap.get(taskId) || null : null));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(() => {
    if (!taskId) return;
    const existing = localTasksMap.get(taskId);
    if (existing) {
      setTask({ ...existing });
      setError(null);
    }
  }, [taskId]);

  useEffect(() => {
    if (!taskId) {
      setTask(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    fetchStatus();
    setIsLoading(false);

    intervalRef.current = setInterval(() => {
      const current = localTasksMap.get(taskId);
      if (current && isTerminalStatus(current.status)) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setTask({ ...current });
        return;
      }
      fetchStatus();
    }, 500);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [taskId, fetchStatus]);

  const cancel = useCallback(async (): Promise<boolean> => {
    if (!taskId) return false;
    const existing = localTasksMap.get(taskId);
    if (existing) {
      const updated: TaskState = {
        ...existing,
        status: "cancelled",
        message: "Cancelled by user",
        updated_at: Date.now(),
      };
      localTasksMap.set(taskId, updated);
      setTask(updated);
      return true;
    }
    return false;
  }, [taskId]);

  const refetch = useCallback(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    task,
    isLoading,
    error,
    isTerminal: isTerminalStatus(task?.status),
    cancel,
    refetch,
  };
}

export interface CreateTaskInput {
  type: string;
  message?: string;
}

export interface CreateTaskResult {
  ok: boolean;
  task?: { id: string; type: string; status: string; progress: number; message: string };
  error?: string;
}

export async function createTask(input: CreateTaskInput): Promise<CreateTaskResult> {
  const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const taskRecord: TaskState = {
    id,
    type: input.type,
    status: "queued",
    progress: 0,
    message: input.message || "Task queued",
    error: null,
    updated_at: Date.now(),
  };
  localTasksMap.set(id, taskRecord);
  return {
    ok: true,
    task: {
      id,
      type: input.type,
      status: "queued",
      progress: 0,
      message: taskRecord.message || "",
    },
  };
}

export async function updateTaskProgress(
  taskId: string,
  update: {
    status?: TaskStatus;
    progress?: number;
    message?: string;
    result?: any;
    error?: string;
  }
): Promise<boolean> {
  const existing = localTasksMap.get(taskId);
  if (!existing) return false;
  const updated: TaskState = {
    ...existing,
    ...update,
    updated_at: Date.now(),
  };
  localTasksMap.set(taskId, updated);
  return true;
}

export async function getTaskResult(taskId: string): Promise<any | null> {
  const existing = localTasksMap.get(taskId);
  return existing ? existing.result ?? null : null;
}
