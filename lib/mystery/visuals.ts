import fs from "fs";
import path from "path";
import { runWithConcurrency } from "../common/concurrency";
import {
  downloadImage,
  isImageSearchConfigured,
  searchGoogleCseImage,
  searchWikimediaImage,
  searchRealAssets,
  ImageSearchResult,
} from "./imageSearch";
import { renderDataCard as renderDataCardOriginal } from "./dataCard";
import { appendErrorLog, publicGeneratedDir, publicGeneratedUrl, readProject, updateProject } from "./store";
import type { MysteryProject, Scene, SceneVisual, MysteryInput } from "./types";
import * as visualAssetSelector from "./visualAssetSelector";
import * as graphicsGenerator from "./graphicsGenerator";
import * as aiPrompts from "./aiPrompts";

/**
 * 실제 자료 + AI 혼합 미스터리 장면 시각자료 생성.
 *
 * 개선 사항:
 * - 1단계: 실제 자료 검색 (다중 소스)
 * - 2단계: 자동 선택 (우선순위 기반)
 * - 3단계: 자체 제작 그래픽 또는 AI 재현
 * - 4단계: 출처 및 디스클레이머 추가
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

/**
 * ImageSearchResult를 SceneVisual로 변환.
 */
function convertSearchResultToVisual(result: ImageSearchResult): SceneVisual {
  return {
    id: `visual_${Date.now()}`,
    type: "archive_photo",
    origin: "REAL_ARCHIVE_PHOTO",
    url: result.imageUrl,
    sourceTitle: result.title,
    sourcePublisher: result.publisher,
    sourceDate: result.date,
    sourceUrl: result.contextUrl,
    sourceLabel: formatSourceLabel({
      sourceTitle: result.title,
      sourcePublisher: result.publisher,
      sourceDate: result.date,
    }),
    license: result.license,
  };
}

/**
 * 출처 표시 텍스트 생성.
 */
function formatSourceLabel(visual: Partial<SceneVisual>): string {
  const parts = [];
  if (visual.sourcePublisher) parts.push(visual.sourcePublisher);
  if (visual.sourceDate) parts.push(visual.sourceDate);
  if (visual.sourceTitle) parts.push(visual.sourceTitle);

  return parts.length > 0 ? `자료: ${parts.join(" / ")}` : "자료 출처";
}

/**
 * 한 장면의 시각자료 생성 (개선된 버전).
 *
 * 플로우:
 * 1. 실제 자료 검색 (다중 소스)
 * 2. 발견시 사용 → 아니면
 * 3. 그래픽 생성 가능? → 예면 생성 → 아니면
 * 4. AI 재현 필요? → 예면 생성 (프롬프트 기반) → 아니면
 * 5. 텍스트 카드
 */
async function generateOneSceneVisual(
  projectId: string,
  scene: Scene,
  userInput?: MysteryInput
): Promise<void> {
  updateProject(projectId, (p) => {
    const s = p.scenes?.find((x) => x.id === scene.id);
    if (s) {
      s.visualStatus = "generating";
      s.visualError = undefined;
    }
  });

  try {
    let buffer: Buffer | null = null;
    let sceneVisual: SceneVisual | null = null;
    let sourceLabel: string | undefined;

    // 1단계: 실제 자료 검색
    const realAssets: SceneVisual[] = [];

    if (["archive_photo", "location", "official_document", "newspaper", "map"].includes(scene.visualType)) {
      try {
        // 다중 소스에서 검색
        const searchResults = await searchRealAssets(scene.visualQuery);
        realAssets.push(...searchResults.map(convertSearchResultToVisual));
      } catch {
        // 검색 실패해도 계속 진행
      }
    }

    // 2단계: 자동 선택
    if (realAssets.length > 0) {
      // 실제 자료 사용
      const selectedVisual = realAssets[0];
      if (selectedVisual.url) {
        buffer = await downloadImage(selectedVisual.url);
      }
      sceneVisual = selectedVisual;
      sourceLabel = selectedVisual.sourceLabel;
    } else {
      // 2단계: 자체 제작 그래픽 (timeline, diagram, map, 및 AI Reconstruction 비활성으로 처리)
      // P0-9: AI Reconstruction은 실제 구현 없이 그래픽 생성으로 처리
      if (["timeline", "diagram", "map"].includes(scene.visualType)) {
        // 데이터 타입별 그래픽 생성
        buffer = await generateGraphic(scene);
        sceneVisual = {
          id: `graphic_${scene.id}`,
          type: scene.visualType as any,
          origin: "GENERATED_GRAPHIC",
          graphicType: scene.visualType,
        };
        sourceLabel = `${scene.visualType}`;
      } else if (["ai_reconstruction", "atmosphere", "location"].includes(scene.visualType)) {
        // P0-9: AI Reconstruction 비활성 처리 - 그래픽으로 대체
        const textCard = await renderDataCardCompat({
          headline: scene.visualHeadline || scene.visualLabel || "시각 자료",
          label: scene.visualType || "카드",
          accentColor: "5a5a9e",
        });
        buffer = textCard;

        sceneVisual = {
          id: `card_${scene.id}`,
          type: "text_card",
          origin: "GENERATED_GRAPHIC",
          graphicType: "text_card",
        };
        sourceLabel = "생성 카드";
      } else {
        // 텍스트 카드 - 그 외 모든 경우
        const textCard = await renderDataCardCompat({
          headline: scene.visualQuery || "정보",
          label: scene.visualType || "카드",
          accentColor: "5a5a9e",
        });
        buffer = textCard;

        sceneVisual = {
          id: `text_${scene.id}`,
          type: "text_card",
          origin: "GENERATED_GRAPHIC",
          graphicType: "text_card",
        };
        sourceLabel = "텍스트 카드";
      }
    }

    // 파일 저장
    if (!buffer) {
      throw new Error("시각자료 생성 실패");
    }

    const url = await writeBuffer(projectId, scene, buffer);

    // 메타데이터 업데이트
    updateProject(projectId, (p) => {
      const s = p.scenes?.find((x) => x.id === scene.id);
      if (s && sceneVisual) {
        s.visualStatus = "done";
        s.visualUrl = url;
        s.visualSourceLabel = sourceLabel;
        s.visualSourceUrl = sceneVisual.sourceUrl;
        s.visualOrigin = sceneVisual.origin;
        s.realMaterialSearched = true;
        s.realMaterialFound = realAssets.length > 0;
        // Set default duration if not already set
        if (!s.durationSeconds || s.durationSeconds <= 0) {
          s.durationSeconds = 3;
        }
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

/**
 * 자체 제작 그래픽 생성.
 */
async function generateGraphic(scene: Scene): Promise<Buffer> {
  switch (scene.visualType) {
    case "timeline":
      // TimelineEvent를 생성 (SourceRef에서 변환)
      const timelineEvents = (scene.sources || []).map((source, idx) => ({
        id: `event_${idx}`,
        date: source.publishedAt || "Unknown",
        title: source.title,
        description: source.factUsed || "",
        sources: [],
        status: "FACT" as const,
      }));
      return await graphicsGenerator.generateTimeline(timelineEvents, {
        title: scene.visualHeadline,
      });

    case "map":
      return await graphicsGenerator.generateMapBackground({
        title: scene.visualHeadline,
        locations: scene.visualLabel ? [scene.visualLabel] : undefined,
      });

    case "diagram":
      return await graphicsGenerator.generateDiagram(
        [
          { label: "시작" },
          { label: "중간" },
          { label: "종료" },
        ],
        "flow",
        { title: scene.visualHeadline }
      );

    case "data_card":
      return await graphicsGenerator.generateDataCard({
        title: scene.visualHeadline || "정보",
        subtitle: scene.visualLabel,
      });

    case "evidence":
      return await graphicsGenerator.generateEvidenceCard({
        title: scene.visualHeadline || "증거",
        description: scene.text,
        type: "document",
      });

    default:
      // 기본: 데이터 카드로 렌더링
      return await renderDataCardCompat({
        headline: scene.visualHeadline || scene.visualQuery,
        label: scene.visualLabel || scene.visualType,
        accentColor: "5a5a9e",
      });
  }
}

/**
 * 데이터 카드 렌더링 (호환성).
 */
async function renderDataCardCompat(options: {
  headline: string;
  label?: string;
  accentColor?: string;
}): Promise<Buffer> {
  return await graphicsGenerator.generateDataCard({
    title: options.headline,
    label: options.label,
    accentColor: options.accentColor,
  });
}

export async function generateAllSceneVisuals(
  projectId: string,
  project: MysteryProject,
  userInput?: MysteryInput
): Promise<void> {
  const scenes = project.scenes || [];
  const targets = scenes.filter((s) => s.visualStatus === "pending" || s.visualStatus === "error");
  await runWithConcurrency(
    targets.map((scene) => () => generateOneSceneVisual(projectId, scene, userInput)),
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

  const input = project as any as MysteryInput;
  await generateOneSceneVisual(projectId, scene, input);
}
