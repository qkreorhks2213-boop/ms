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
  type EconomicInput,
  type EconomicProject,
  type ErrorLogEntry,
} from "./types";

/**
 * 프로젝트 상태를 파일로 저장한다(메모리 Map이 아님). 리서치 → 대본 생성 → 장면 분할 →
 * 시각자료 소싱(수십 건) → 전체 내레이션 TTS → 렌더링까지 오래 걸리는 여러 단계를 거치는데,
 * 그 사이 개발 서버가 재컴파일되거나 서버가 재시작되어도 진행 상황이 사라지면 안 된다.
 * 파일은 어느 프로세스/모듈 인스턴스에서 읽고 쓰든 항상 같은 디스크 경로를 가리키므로 이
 * 문제가 원천적으로 생기지 않는다.
 */
const PROJECTS_DIR = path.join(process.cwd(), "data", "economic-projects");
const PUBLIC_GENERATED_DIR = path.join(process.cwd(), "public", "generated");

// 프로젝트 id는 항상 서버에서 uuid()로 생성되지만, API 라우트의 [id] 파라미터는 URL에서
// 그대로 들어오므로("..") 같은 값이 올 수도 있다. 파일 경로를 만들기 전에 형식을 검증해
// PROJECTS_DIR 바깥 경로를 절대 조합하지 못하게 막는다.
const PROJECT_ID_RE = /^[a-zA-Z0-9-]+$/;

export function projectDir(projectId: string): string {
  if (!PROJECT_ID_RE.test(projectId)) {
    throw new Error("잘못된 프로젝트 id입니다.");
  }
  return path.join(PROJECTS_DIR, projectId);
}

function projectFilePath(projectId: string): string {
  return path.join(projectDir(projectId), "project.json");
}

/** 시각자료 등 브라우저에서 직접 미리보기 해야 하는 산출물을 두는 public 폴더. */
export function publicGeneratedDir(projectId: string): string {
  return path.join(PUBLIC_GENERATED_DIR, projectId);
}

export function publicGeneratedUrl(projectId: string, relativePath: string): string {
  return `/generated/${projectId}/${relativePath.replace(/\\/g, "/")}`;
}

/** TTS 원시 PCM 등 렌더링에만 쓰이고 브라우저에 직접 노출할 필요 없는 산출물을 두는 폴더. */
export function projectWorkDir(projectId: string): string {
  return path.join(projectDir(projectId), "work");
}

export function writeProject(project: EconomicProject): void {
  const dir = projectDir(project.id);
  fs.mkdirSync(dir, { recursive: true });
  project.updatedAt = new Date().toISOString();
  const finalPath = projectFilePath(project.id);
  const tmpPath = `${finalPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(project, null, 2), "utf-8");
  fs.renameSync(tmpPath, finalPath);
}

export function readProject(projectId: string): EconomicProject | undefined {
  try {
    return JSON.parse(fs.readFileSync(projectFilePath(projectId), "utf-8"));
  } catch {
    return undefined;
  }
}

/** userId를 넘기면 그 사용자 소유 프로젝트만 걸러 반환한다(다른 사용자 작업물은 보이지 않음). */
export function listProjects(userId?: string): EconomicProject[] {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  const ids = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  let projects = ids
    .map((id) => readProject(id))
    .filter((p): p is EconomicProject => Boolean(p));
  if (userId) {
    projects = projects.filter((p) => p.userId === userId);
  }
  projects.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return projects;
}

export interface CreateProjectParams {
  topic: string;
  targetMinutes?: number;
  narrativeAngle?: EconomicInput["narrativeAngle"];
  endingStyle?: EconomicInput["endingStyle"];
  useEngagementCta?: boolean;
  voiceName?: string;
  useBgm?: boolean;
  sceneVisualTarget?: number;
}

/** 사용자 입력(입력 화면)을 검증/정규화해 새 프로젝트를 만든다. */
export function createProject(params: CreateProjectParams, userId: string): EconomicProject {
  const topic = params.topic.trim();
  if (!topic) {
    throw new Error("경제 주제(topic)는 필수입니다.");
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

  const project: EconomicProject = {
    id: uuid(),
    name: topic.slice(0, 60),
    userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    errorLog: [],
    input: {
      topic,
      targetMinutes,
      narrativeAngle: params.narrativeAngle || "collapse",
      endingStyle: params.endingStyle || "summary",
      useEngagementCta: params.useEngagementCta ?? true,
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

export function updateProject(
  projectId: string,
  updater: (project: EconomicProject) => void
): EconomicProject {
  const project = readProject(projectId);
  if (!project) {
    throw new Error(`프로젝트를 찾을 수 없습니다: ${projectId}`);
  }
  updater(project);
  writeProject(project);
  return project;
}

/** 프로젝트 이름을 바꾼다(목록 화면 표시용 — 대본 제목과는 별개). */
export function renameProject(projectId: string, name: string): EconomicProject {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("프로젝트 이름은 비워둘 수 없습니다.");
  return updateProject(projectId, (p) => {
    p.name = trimmed.slice(0, 80);
  });
}

/** 프로젝트를 완전히 삭제한다 — 상태 파일뿐 아니라 생성된 시각자료/렌더 결과물까지 함께 지운다. */
export function deleteProject(projectId: string): void {
  fs.rmSync(projectDir(projectId), { recursive: true, force: true });
  fs.rmSync(publicGeneratedDir(projectId), { recursive: true, force: true });
  const renderPath = path.join(process.cwd(), "public", "renders", `${projectId}.mp4`);
  fs.rm(renderPath, () => {});
}

const ERROR_LOG_MAX_ENTRIES = 200;

/**
 * 오류 이력에 항목 하나를 추가한다. scene.visualError/narration[].error 같은 개별 상태와 달리,
 * 이건 나중에 재시도로 해결돼도 지워지지 않는 이력이다 — "언제·어느 단계·무슨 오류였는지"를
 * 지우지 않고 쌓아서 서버를 껐다 켜도 예전 오류를 확인할 수 있게 한다.
 */
export function appendErrorLog(
  projectId: string,
  entry: Omit<ErrorLogEntry, "at">
): void {
  updateProject(projectId, (p) => {
    if (!p.errorLog) p.errorLog = [];
    p.errorLog.push({ ...entry, at: new Date().toISOString() });
    if (p.errorLog.length > ERROR_LOG_MAX_ENTRIES) {
      p.errorLog = p.errorLog.slice(-ERROR_LOG_MAX_ENTRIES);
    }
  });
}
