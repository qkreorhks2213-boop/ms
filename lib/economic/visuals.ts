import fs from "fs";
import path from "path";
import { runWithConcurrency } from "../common/concurrency";
import { downloadImage, isImageSearchConfigured, searchGoogleCseImage, searchWikimediaImage } from "./imageSearch";
import { renderDataCard } from "./dataCard";
import { appendErrorLog, publicGeneratedDir, publicGeneratedUrl, readProject, updateProject } from "./store";
import type { EconomicProject, Scene, SceneVisualType } from "./types";

/**
 * 장면(Scene)마다 "무엇을 보여줄지"는 이미 장면 생성 단계(scenes.ts)에서 정해져 있다
 * (scene.visualType). 이 모듈은 그 타입에 맞는 실제 자료를 실제로 가져오는 역할만 한다:
 *
 * - news_photo / company_logo / map → 위키미디어 공용(무료, 항상 시도)에서 먼저 찾고, 없으면
 *   Google Custom Search(선택, 설정된 경우만)로 다시 시도한다. 그래도 못 찾으면 AI로 허구
 *   이미지를 만드는 대신 "실제 이미지를 찾지 못했다"고 명시한 데이터 카드로 대체한다 — 실제
 *   자료가 아닌 것을 실제처럼 보이게 만들지 않기 위함이다.
 * - stock_chart / stat_graph / data_viz / fallback_graphic → 전부 데이터 카드(ffmpeg로 직접
 *   그림, 완전 로컬·무료)로 처리한다. 예전에는 fallback_graphic만 AI 이미지 생성을 썼지만,
 *   Google API를 전혀 쓰지 않는 구성으로 바꾸면서 AI 삽화 생성 자체를 없앴다 — 대신 장면
 *   문장을 요약한 개념 카드로 보여준다(사진처럼 보이는 허구 이미지보다 "이건 요약 카드다"가
 *   명확한 편이 사실 전달에 더 적합하다는 판단).
 */
const VISUAL_CONCURRENCY = 4;

function fileNameFor(sceneId: string): string {
  return `${sceneId}.png`;
}

const ACCENT_BY_TYPE: Partial<Record<SceneVisualType, string>> = {
  stock_chart: "6fa893",
  stat_graph: "c6a468",
  data_viz: "7d97c6",
  fallback_graphic: "8b8f98",
};

/** fallback_graphic(사진/차트로 표현 불가능한 개념 설명) 장면을 위한 요약 카드 문구. */
function conceptCardHeadline(scene: Scene): string {
  const firstSentence = scene.text.split(/(?<=[.!?…])\s/)[0] || scene.text;
  return firstSentence.length > 40 ? `${firstSentence.slice(0, 40)}…` : firstSentence;
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

    if (scene.visualType === "news_photo" || scene.visualType === "company_logo" || scene.visualType === "map") {
      const found = (await searchWikimediaImage(scene.visualQuery)) || (isImageSearchConfigured() ? await searchGoogleCseImage(scene.visualQuery) : null);
      if (found) {
        const buffer = await downloadImage(found.imageUrl);
        url = await writeBuffer(projectId, scene, buffer);
        sourceLabel = `실제 이미지 · ${found.title}`.slice(0, 80);
        sourceUrl = found.contextUrl;
      } else {
        const dir = path.join(publicGeneratedDir(projectId), "scenes");
        fs.mkdirSync(dir, { recursive: true });
        const fileName = fileNameFor(scene.id);
        const outPath = path.join(dir, fileName);
        await renderDataCard(
          { headline: scene.visualQuery || "이미지 없음", label: "실제 이미지를 찾지 못함", accentColor: ACCENT_BY_TYPE.fallback_graphic },
          outPath
        );
        url = publicGeneratedUrl(projectId, `scenes/${fileName}`);
        sourceLabel = "위키미디어·검색에서 실제 이미지를 찾지 못해 안내 카드로 대체";
      }
    } else if (scene.visualType === "stock_chart" || scene.visualType === "stat_graph" || scene.visualType === "data_viz") {
      const dir = path.join(publicGeneratedDir(projectId), "scenes");
      fs.mkdirSync(dir, { recursive: true });
      const fileName = fileNameFor(scene.id);
      const outPath = path.join(dir, fileName);
      await renderDataCard(
        {
          headline: scene.visualHeadline || "수치 확인 필요",
          label: scene.visualLabel || scene.visualQuery,
          sourceLabel: "리서치 확인 수치",
          accentColor: ACCENT_BY_TYPE[scene.visualType],
        },
        outPath
      );
      url = publicGeneratedUrl(projectId, `scenes/${fileName}`);
      sourceLabel = "리서치 단계에서 확인한 실제 수치";
    } else {
      const dir = path.join(publicGeneratedDir(projectId), "scenes");
      fs.mkdirSync(dir, { recursive: true });
      const fileName = fileNameFor(scene.id);
      const outPath = path.join(dir, fileName);
      await renderDataCard(
        { headline: conceptCardHeadline(scene), label: "개념 요약", accentColor: ACCENT_BY_TYPE.fallback_graphic },
        outPath
      );
      url = publicGeneratedUrl(projectId, `scenes/${fileName}`);
      sourceLabel = "실사진/차트로 표현 불가능한 설명 장면 · 요약 카드로 대체";
    }

    updateProject(projectId, (p) => {
      const s = p.scenes?.find((x) => x.id === scene.id);
      if (s) {
        s.visualStatus = "done";
        s.visualUrl = url;
        s.visualSourceLabel = sourceLabel;
        s.visualSourceUrl = sourceUrl;
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

/** 아직 자료가 없거나(pending) 실패한(error) 장면만 골라 소싱한다. */
export async function generateAllSceneVisuals(projectId: string, project: EconomicProject): Promise<void> {
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

/** 장면 하나만 다시 소싱(검수 단계 재시도 버튼용). */
export async function regenerateSceneVisual(projectId: string, sceneId: string): Promise<void> {
  const project = readProject(projectId);
  const scene = project?.scenes?.find((s) => s.id === sceneId);
  if (!scene) throw new Error("장면을 찾을 수 없습니다.");
  await generateOneSceneVisual(projectId, scene);
}
