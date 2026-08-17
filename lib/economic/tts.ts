import fs from "fs";
import path from "path";
import { runWithConcurrency } from "../common/concurrency";
import { splitIntoSentences } from "./scenes";
import { synthesizeSpeech } from "../common/localAI";
import { appendErrorLog, projectWorkDir, readProject, updateProject } from "./store";
import type { EconomicProject, NarrationChunk, Scene } from "./types";

/**
 * 전체 대본을 리포터 톤 단일 화자 내레이션으로 만든다. 장면(Scene) 하나의 텍스트가 TTS 한
 * 번의 안정적인 처리 범위를 넘길 수 있어 장면 안에서 다시 문장 단위로 더 작은 청크로 쪼갠다.
 * 청크 크기는 "TTS 안정성"과 "API 호출 횟수"의 트레이드오프다 — Gemini 무료 등급은 글자수가
 * 아니라 요청 "횟수" 자체를 하루 단위로 제한하므로, 청크를 너무 잘게 쪼개면 호출 수가
 * 급증한다.
 */
const TTS_CHUNK_TARGET_CHARS = 900;
const TTS_CHUNK_MAX_CHARS = 1400;
const TTS_CONCURRENCY = 3;

export function splitForNarration(text: string): string[] {
  const sentences = splitIntoSentences(text);
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    const candidate = current.length + sentence.length + 1;
    if (current && candidate > TTS_CHUNK_MAX_CHARS && current.length >= TTS_CHUNK_TARGET_CHARS * 0.5) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/** 16-bit mono PCM 버퍼 길이 → 초. */
function pcmDurationSeconds(buffer: Buffer, sampleRate: number): number {
  return buffer.length / (sampleRate * 2);
}

async function synthesizeChunk(
  projectId: string,
  voiceName: string,
  ownerId: string,
  chunkIndex: number,
  text: string
): Promise<NarrationChunk> {
  const id = `${ownerId}-n${chunkIndex}`;
  try {
    const { buffer, sampleRate } = await synthesizeSpeech(text, voiceName);
    const dir = path.join(projectWorkDir(projectId), "narration");
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${id}.pcm`);
    fs.writeFileSync(filePath, buffer);
    return {
      id,
      text,
      status: "done",
      filePath,
      sampleRate,
      durationSeconds: pcmDurationSeconds(buffer, sampleRate),
    };
  } catch (err: any) {
    const message = err?.message || String(err);
    appendErrorLog(projectId, { stage: "narration", unitId: id, message, retryable: true });
    return { id, text, status: "error", error: message };
  }
}

/** 장면 하나의 내레이션 청크를 전부(비어 있으면 새로, 실패분은 재시도) 합성한다. */
async function synthesizeSceneNarration(projectId: string, voiceName: string, scene: Scene): Promise<void> {
  const texts = splitForNarration(scene.text);
  const existing = scene.narration.length === texts.length ? scene.narration : [];

  const results = await Promise.all(
    texts.map((text, i) => {
      const prior = existing[i];
      if (prior && prior.status === "done") return Promise.resolve(prior);
      return synthesizeChunk(projectId, voiceName, scene.id, i, text);
    })
  );

  const durationSeconds = results.reduce((sum, c) => sum + (c.durationSeconds || 0), 0);
  updateProject(projectId, (p) => {
    const s = p.scenes?.find((x) => x.id === scene.id);
    if (s) {
      s.narration = results;
      s.durationSeconds = durationSeconds;
    }
  });
}

/** 훅 섹션의 내레이션 청크를 합성한다(장면과 별개 — project.hookNarration에 저장). */
async function synthesizeHookNarration(projectId: string, project: EconomicProject): Promise<void> {
  const hookSection = project.script?.sections.find((s) => s.kind === "hook");
  if (!hookSection) return;

  const texts = splitForNarration(hookSection.text);
  const existing = project.hookNarration && project.hookNarration.length === texts.length ? project.hookNarration : [];

  const results = await Promise.all(
    texts.map((text, i) => {
      const prior = existing[i];
      if (prior && prior.status === "done") return Promise.resolve(prior);
      return synthesizeChunk(projectId, project.input.voiceName, "hook", i, text);
    })
  );

  updateProject(projectId, (p) => {
    p.hookNarration = results;
  });
}

/**
 * 프로젝트 전체(훅 + 모든 장면)의 내레이션을 합성한다. 장면들은 서로 독립적이라 동시 실행
 * (개수 제한)하고, 이미 성공한 청크는 다시 만들지 않는다.
 */
export async function synthesizeAllNarration(projectId: string, project: EconomicProject): Promise<void> {
  await synthesizeHookNarration(projectId, project);

  const scenes = project.scenes || [];
  const targets = scenes.filter(
    (s) => s.narration.length === 0 || s.narration.some((n) => n.status === "error")
  );

  await runWithConcurrency(
    targets.map((scene) => () => synthesizeSceneNarration(projectId, project.input.voiceName, scene)),
    TTS_CONCURRENCY
  );

  const finalProject = readProject(projectId);
  const allDone =
    (finalProject?.hookNarration || []).every((n) => n.status === "done") &&
    (finalProject?.scenes || []).every((s) => s.narration.every((n) => n.status === "done"));

  if (allDone) {
    updateProject(projectId, (p) => {
      p.stage = "render";
    });
  }
}

/** 장면 하나의 내레이션만 다시 합성(검수 단계 재시도 버튼용). */
export async function regenerateSceneNarration(projectId: string, sceneId: string): Promise<void> {
  const project = readProject(projectId);
  const scene = project?.scenes?.find((s) => s.id === sceneId);
  if (!scene || !project) throw new Error("장면을 찾을 수 없습니다.");
  updateProject(projectId, (p) => {
    const s = p.scenes?.find((x) => x.id === sceneId);
    if (s) s.narration = [];
  });
  await synthesizeSceneNarration(projectId, project.input.voiceName, { ...scene, narration: [] });
}
