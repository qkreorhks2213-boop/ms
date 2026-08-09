import fs from "fs";
import path from "path";
import { runWithConcurrency } from "../common/concurrency";
import { downloadImage, isImageSearchConfigured, searchGoogleCseImage, searchWikimediaImage } from "./imageSearch";
import { renderDataCard } from "./dataCard";
import { appendErrorLog, publicGeneratedDir, publicGeneratedUrl, readProject, updateProject } from "./store";
import type { MysteryProject, Scene } from "./types";

/**
 * 미스터리 장면의 시각자료 생성.
 *
 * 경제 버전과 비슷하지만, 미스터리 특화 타입을 사용한다:
 * - archive_photo, location, official_document → 실제 자료 검색
 * - ai_reconstruction, atmosphere → 데이터 카드로 대체
 * - 나머지 → 설명 카드
 */

const VISUAL_CONCURRENCY = 3;

function fileNameFor(sceneId: string): string {
  return `${sceneId}.png`;
}

async function writeBuffer(projectId: string, scene: Scene, buffer: Buffer): Promise<string> {
  const dir = path.join(publicGeneratedDir(projectId), "scenes");
  fs.mkdirSync(dir, { recursive: true });
  const fileName = fileNameFor(scene.id);
  fs.writeFileSync(path.join(dir, fileName), buffer);
  return publicGeneratedUrl(projectId, `scenes/${fileName}`);
}

async function generateOneSceneVisual(projectId: string, scene: Scene): Promise<void> {
  updateProject(projectId, (p) => {
    const s = p.scenes?.find((x) => x.id === scene.id);
    if (s) {
      s.visualStatus = "generating";
      s.visualError = undefined;
    }
  });

  try {
    let url: string;
    let sourceLabel: string | undefined;
    let sourceUrl: string | undefined;
    let visualOrigin: "REAL" | "AI_RECONSTRUCTION" | "GENERATED_GRAPHIC" = "GENERATED_GRAPHIC";

    // 실제 자료를 검색하는 타입들
    if (["archive_photo", "location", "official_document", "newspaper"].includes(scene.visualType)) {
      const found =
        (await searchWikimediaImage(scene.visualQuery)) ||
        (isImageSearchConfigured() ? await searchGoogleCseImage(scene.visualQuery) : null);

      if (found) {
        const buffer = await downloadImage(found.imageUrl);
        url = await writeBuffer(projectId, scene, buffer);
        sourceLabel = `출처: ${found.title}`.slice(0, 100);
        sourceUrl = found.contextUrl;
        visualOrigin = "REAL";
      } else {
        // 실제 자료를 찾지 못한 경우 → 설명 카드
        const dir = path.join(publicGeneratedDir(projectId), "scenes");
        fs.mkdirSync(dir, { recursive: true });
        const fileName = fileNameFor(scene.id);
        const outPath = path.join(dir, fileName);
        await renderDataCard(
          {
            headline: scene.visualQuery || "자료 없음",
            label: "실제 자료를 찾을 수 없음",
            accentColor: "7d7d7d",
          },
          outPath
        );
        url = publicGeneratedUrl(projectId, `scenes/${fileName}`);
        sourceLabel = "실제 자료를 찾을 수 없어 안내로 대체됨";
        visualOrigin = "GENERATED_GRAPHIC";
      }
    }
    // 자동 생성되는 타입들
    else if (["timeline", "diagram", "data_card", "text_card"].includes(scene.visualType)) {
      const dir = path.join(publicGeneratedDir(projectId), "scenes");
      fs.mkdirSync(dir, { recursive: true });
      const fileName = fileNameFor(scene.id);
      const outPath = path.join(dir, fileName);
      await renderDataCard(
        {
          headline: scene.visualHeadline || scene.visualQuery || scene.visualType,
          label: scene.visualLabel || "정보 카드",
          accentColor: "5a5a9e",
        },
        outPath
      );
      url = publicGeneratedUrl(projectId, `scenes/${fileName}`);
      sourceLabel = `${scene.visualType}`;
      visualOrigin = "GENERATED_GRAPHIC";
    }
    // AI 재현 또는 분위기 이미지
    else if (["ai_reconstruction", "atmosphere", "satellite", "video_archive", "interview"].includes(scene.visualType)) {
      const dir = path.join(publicGeneratedDir(projectId), "scenes");
      fs.mkdirSync(dir, { recursive: true });
      const fileName = fileNameFor(scene.id);
      const outPath = path.join(dir, fileName);
      const isAiType = scene.visualType === "ai_reconstruction" || scene.visualType === "atmosphere";
      await renderDataCard(
        {
          headline: scene.visualQuery,
          label: isAiType ? "AI 재현" : "아카이브",
          accentColor: isAiType ? "a87c5c" : "6b7c99",
        },
        outPath
      );
      url = publicGeneratedUrl(projectId, `scenes/${fileName}`);
      sourceLabel = scene.visualType === "ai_reconstruction" ? "AI 재현 이미지" : "아카이브 자료";
      visualOrigin = isAiType ? "AI_RECONSTRUCTION" : "GENERATED_GRAPHIC";
    }
    // 증거, 지도 등
    else {
      const dir = path.join(publicGeneratedDir(projectId), "scenes");
      fs.mkdirSync(dir, { recursive: true });
      const fileName = fileNameFor(scene.id);
      const outPath = path.join(dir, fileName);
      await renderDataCard(
        { headline: scene.visualQuery, label: scene.visualType || "시각화", accentColor: "666666" },
        outPath
      );
      url = publicGeneratedUrl(projectId, `scenes/${fileName}`);
      sourceLabel = scene.visualType;
      visualOrigin = "GENERATED_GRAPHIC";
    }

    updateProject(projectId, (p) => {
      const s = p.scenes?.find((x) => x.id === scene.id);
      if (s) {
        s.visualStatus = "done";
        s.visualUrl = url;
        s.visualSourceLabel = sourceLabel;
        s.visualSourceUrl = sourceUrl;
        s.visualOrigin = visualOrigin;
      }
    });
  } catch (err: any) {
    const message = err?.message || String(err);
    updateProject(projectId, (p) => {
      const s = p.scenes?.find((x) => x.id === scene.id);
      if (s) {
        s.visualStatus = "error";
        s.visualError = message;
      }
    });
    appendErrorLog(projectId, { stage: "visuals", unitId: scene.id, message, retryable: true });
  }
}

export async function generateAllSceneVisuals(projectId: string, project: MysteryProject): Promise<void> {
  const scenes = project.scenes || [];
  const targets = scenes.filter((s) => s.visualStatus === "pending" || s.visualStatus === "error");
  await runWithConcurrency(
    targets.map((scene) => () => generateOneSceneVisual(projectId, scene)),
    VISUAL_CONCURRENCY
  );

  const finalProject = readProject(projectId);
  const allDone = (finalProject?.scenes || []).every((s) => s.visualStatus === "done");
  if (allDone) {
    updateProject(projectId, (p) => {
      p.stage = "narration";
    });
  }
}

export async function regenerateSceneVisual(projectId: string, sceneId: string): Promise<void> {
  const project = readProject(projectId);
  const scene = project?.scenes?.find((s) => s.id === sceneId);
  if (!scene) throw new Error("장면을 찾을 수 없습니다.");
  await generateOneSceneVisual(projectId, scene);
}
