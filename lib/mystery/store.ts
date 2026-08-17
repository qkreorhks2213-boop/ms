import fs from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { DEFAULT_VOICE_NAME } from "../common/localAI";
import {
  DEFAULT_SCENE_VISUAL_TARGET,
  DEFAULT_TARGET_MINUTES,
  MAX_SCENE_VISUAL_TARGET,
  MAX_TARGET_MINUTES,
  MIN_SCENE_VISUAL_TARGET,
  MIN_TARGET_MINUTES,
  type MysteryInput,
  type MysteryProject,
  type ErrorLogEntry,
} from "./types";

/**
 * 미스터리 프로젝트 상태를 파일로 저장한다(메모리 Map이 아님).
 * 경제 버전의 저장 방식을 그대로 재사용한다.
 *
 * RACE CONDITION PREVENTION: Use a lock map to serialize updates to the same project.
 * Multiple concurrent updateProject() calls for the same projectId will be queued.
 */
const PROJECTS_DIR = path.join(process.cwd(), "data", "mystery-projects");
const PUBLIC_GENERATED_DIR = path.join(process.cwd(), "public", "generated");

const PROJECT_ID_RE = /^[a-zA-Z0-9-]+$/;

// In-progress update tracking to prevent race conditions
const projectUpdateInProgress = new Set<string>();

function waitForLock(projectId: string, maxWaitMs: number = 30000): void {
  const startTime = Date.now();
  while (projectUpdateInProgress.has(projectId)) {
    if (Date.now() - startTime > maxWaitMs) {
      throw new Error(
        `[CRITICAL] Timeout waiting for project lock on ${projectId} ` +
        `(waited ${maxWaitMs}ms). Another process may be stuck.`
      );
    }
    // Busy wait with small delay (10ms)
    const now = Date.now();
    while (Date.now() - now < 10) {
      // Busy loop
    }
  }
}

export function projectDir(projectId: string): string {
  if (!PROJECT_ID_RE.test(projectId)) {
    throw new Error("잘못된 프로젝트 id입니다.");
  }
  return path.join(PROJECTS_DIR, projectId);
}

function projectFilePath(projectId: string): string {
  return path.join(projectDir(projectId), "project.json");
}

export function publicGeneratedDir(projectId: string): string {
  return path.join(PUBLIC_GENERATED_DIR, projectId);
}

export function publicGeneratedUrl(projectId: string, relativePath: string): string {
  return `/generated/${projectId}/${relativePath.replace(/\\/g, "/")}`;
}

export function projectWorkDir(projectId: string): string {
  return path.join(projectDir(projectId), "work");
}

export function writeProject(project: MysteryProject): void {
  const dir = projectDir(project.id);
  fs.mkdirSync(dir, { recursive: true });
  project.updatedAt = new Date().toISOString();
  const finalPath = projectFilePath(project.id);
  const tmpPath = `${finalPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(project, null, 2), "utf-8");
  fs.renameSync(tmpPath, finalPath);
}

export function readProject(projectId: string): MysteryProject | undefined {
  try {
    return JSON.parse(fs.readFileSync(projectFilePath(projectId), "utf-8"));
  } catch {
    return undefined;
  }
}

export function listProjects(userId?: string): MysteryProject[] {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  const ids = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  let projects = ids
    .map((id) => readProject(id))
    .filter((p): p is MysteryProject => Boolean(p));
  if (userId) {
    projects = projects.filter((p) => p.userId === userId);
  }
  projects.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return projects;
}

export interface CreateProjectParams {
  topic: string;
  caseType?: string;
  targetMinutes?: number;
  angles?: string[];
  endingStyle?: string;
  useRealPhotos?: boolean;
  useAiReconstruction?: boolean;
  voiceName?: string;
  useBgm?: boolean;
  sceneVisualTarget?: number;
}

/**
 * 사용자 입력을 검증/정규화해 새 미스터리 프로젝트를 만든다.
 */
export function createProject(params: CreateProjectParams, userId: string): MysteryProject {
  const topic = params.topic.trim();
  if (!topic) {
    throw new Error("사건/주제(topic)는 필수입니다.");
  }
  if (!userId) {
    throw new Error("로그인이 필요합니다.");
  }
  const targetMinutes = Math.round(
    Math.min(MAX_TARGET_MINUTES, Math.max(MIN_TARGET_MINUTES, params.targetMinutes || DEFAULT_TARGET_MINUTES))
  );
  const sceneVisualTarget = Math.round(
    Math.min(
      MAX_SCENE_VISUAL_TARGET,
      Math.max(MIN_SCENE_VISUAL_TARGET, params.sceneVisualTarget || DEFAULT_SCENE_VISUAL_TARGET)
    )
  );

  const project: MysteryProject = {
    id: uuid(),
    name: topic.slice(0, 60),
    userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    errorLog: [],
    input: {
      topic,
      caseType: (params.caseType as any) || "unsolved_case",
      targetMinutes,
      angles: (params.angles as any) || ["case_focused"],
      endingStyle: (params.endingStyle as any) || "confirmed_facts",
      useRealPhotos: params.useRealPhotos ?? true,
      useAiReconstruction: params.useAiReconstruction ?? true,
      voiceName: params.voiceName || DEFAULT_VOICE_NAME,
      useBgm: params.useBgm ?? false,
      sceneVisualTarget,
    },
    stage: "research",
    render: { status: "idle" },
  };
  writeProject(project);
  return project;
}

/**
 * Update project with race condition protection.
 * Serializes concurrent updates to prevent data loss from partial overwrites.
 */
export function updateProject(
  projectId: string,
  updater: (project: MysteryProject) => void
): MysteryProject {
  // Wait for any in-progress update to complete
  waitForLock(projectId);

  projectUpdateInProgress.add(projectId);
  try {
    // Always re-read the project to get latest state
    // (prevents losing changes from other workers)
    const project = readProject(projectId);
    if (!project) {
      throw new Error(`프로젝트 ${projectId}를 찾을 수 없습니다.`);
    }

    // Apply the update to the latest project state
    updater(project);

    // Write with atomic operation (temp file + rename)
    // This ensures the file is never in a partial/corrupted state
    writeProject(project);

    return project;
  } finally {
    // Always release the lock
    projectUpdateInProgress.delete(projectId);
  }
}

export function renameProject(projectId: string, newName: string): MysteryProject {
  return updateProject(projectId, (p) => {
    p.name = newName.slice(0, 60).trim() || p.input.topic;
  });
}

export function deleteProject(projectId: string): void {
  const dir = projectDir(projectId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
  }
}

export function recordError(
  projectId: string,
  stage: PipelineStage,
  message: string,
  unitId?: string,
  retryable = true
): void {
  updateProject(projectId, (p) => {
    const entry: ErrorLogEntry = {
      at: new Date().toISOString(),
      stage,
      message,
      retryable,
      unitId,
    };
    p.errorLog.push(entry);
  });
}

import type { PipelineStage } from "./types";

export function clearProjectStage(projectId: string, stage: PipelineStage): MysteryProject {
  return updateProject(projectId, (p) => {
    if (stage === "research") {
      p.research = undefined;
    } else if (stage === "factcheck") {
      p.factcheckResults = undefined;
    } else if (stage === "timeline") {
      p.timeline = undefined;
    } else if (stage === "script") {
      p.script = undefined;
    } else if (stage === "scenes") {
      p.scenes = undefined;
    } else if (stage === "visuals") {
      p.scenes?.forEach((s) => {
        s.visualStatus = "pending";
        s.visualUrl = undefined;
      });
    } else if (stage === "narration") {
      p.scenes?.forEach((s) => {
        s.narration = [];
      });
    }
  });
}

export function appendErrorLog(
  projectId: string,
  entry: Partial<ErrorLogEntry>
): void {
  updateProject(projectId, (p) => {
    p.errorLog.push({
      at: new Date().toISOString(),
      stage: entry.stage || "research",
      message: entry.message || "Unknown error",
      retryable: entry.retryable !== false,
      unitId: entry.unitId,
    });
  });
}
