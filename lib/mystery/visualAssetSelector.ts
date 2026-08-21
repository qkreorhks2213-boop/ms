/**
 * Visual Asset Selector: 실제 자료 + AI 혼합 시스템
 *
 * 각 장면의 시각자료를 선택할 때:
 * 1. 실제 자료 (아카이브 사진, 뉴스, 인터뷰 등)
 * 2. 자체 제작 그래픽 (지도, 타임라인, 다이어그램)
 * 3. AI 재현 이미지/영상
 *
 * 우선순위로 자동 선택한다.
 */

import {
  Scene,
  SceneVisual,
  VisualOrigin,
  SourceRef,
  FactStatus,
  MysteryInput,
} from "./types";

/**
 * 실제 자료 검색 결과.
 */
export interface RealAssetSearchResult {
  found: boolean;
  assets: SceneVisual[];
  searchQuery: string;
}

/**
 * 시각자료 선택 결과.
 */
export interface AssetSelectionResult {
  primary: SceneVisual;
  alternatives: SceneVisual[];
  requiresAiReconstruction: boolean;
  requiresDisclaimer: boolean;
  disclaimerText?: string;
  explanation: string;
}

/**
 * Scene별 자동 시각자료 선택.
 *
 * 질문 1: 이 장면을 보여줄 실제 자료가 있는가? YES → 실제 자료 사용
 * 질문 2: 지도/문서/그래픽으로 설명할 수 있는가? YES → 그래픽 사용
 * 질문 3: AI 재현이 설명에 도움이 되는가? YES → AI 재현
 * 질문 4: 타이포그래피만으로 가능한가? YES → 텍스트 카드
 */
export async function selectVisualAsset(
  scene: Scene,
  realAssets: SceneVisual[],
  userInput: MysteryInput
): Promise<AssetSelectionResult> {
  // 질문 1: 실제 자료가 있는가?
  if (realAssets.length > 0) {
    return selectRealAssets(scene, realAssets);
  }

  // 질문 2: 그래픽으로 설명 가능한가?
  if (canUseGraphic(scene.visualType)) {
    return selectGraphic(scene);
  }

  // 질문 3: AI 재현이 도움되는가?
  if (shouldUseAiReconstruction(scene, userInput)) {
    return selectAiReconstruction(scene);
  }

  // 질문 4: 텍스트 카드로 충분한가?
  return selectTextCard(scene);
}

/**
 * 1단계: 실제 자료 선택.
 */
function selectRealAssets(
  scene: Scene,
  realAssets: SceneVisual[]
): AssetSelectionResult {
  // 품질 기준에 따라 정렬
  const sorted = realAssets.sort((a, b) => {
    const scoreA = scoreRealAsset(a);
    const scoreB = scoreRealAsset(b);
    return scoreB - scoreA;
  });

  const primary = sorted[0];
  const alternatives = sorted.slice(1);

  return {
    primary,
    alternatives,
    requiresAiReconstruction: false,
    requiresDisclaimer: false,
    explanation: `실제 자료 사용: ${primary.sourceLabel || primary.sourceTitle}`,
  };
}

/**
 * 실제 자료의 품질 점수.
 * 더 신뢰도 높은 출처를 우선한다.
 */
function scoreRealAsset(asset: SceneVisual): number {
  let score = 100;

  // 출처 신뢰도
  if (asset.sourcePublisher) {
    if (
      ["BBC", "Reuters", "AP", "Associated Press", "NPR"].includes(
        asset.sourcePublisher
      )
    ) {
      score += 50;
    } else if (asset.sourcePublisher.includes("Official")) {
      score += 40;
    } else if (asset.sourcePublisher.includes("Government")) {
      score += 30;
    }
  }

  // 원본 자료 유형 (아카이브 > 뉴스 > 인터뷰)
  const originScore: Record<VisualOrigin, number> = {
    REAL_ARCHIVE_PHOTO: 100,
    REAL_VIDEO: 90,
    REAL_NEWS: 80,
    REAL_INTERVIEW: 75,
    REAL_DOCUMENT: 85,
    REAL_MAP: 70,
    GENERATED_GRAPHIC: 0,
    GENERATED_DIAGRAM: 0,
    GENERATED_TIMELINE: 0,
    AI_RECONSTRUCTION: 0,
    AI_RECONSTRUCTION_VIDEO: 0,
    AI_ATMOSPHERE: 0,
    TEST_FALLBACK_GRAPHIC: 0,
    MIXED: 50,
  };

  score += originScore[asset.origin] || 0;

  // 날짜가 가까울수록 높음 (최근 자료 우선)
  if (asset.sourceDate) {
    try {
      const date = new Date(asset.sourceDate);
      const now = new Date();
      const daysDiff = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
      // 최대 10점 추가 (1년 이내)
      if (daysDiff < 365) {
        score += 10 * (1 - daysDiff / 365);
      }
    } catch {}
  }

  return score;
}

/**
 * 그래픽으로 설명 가능한지 판단.
 */
function canUseGraphic(visualType: string): boolean {
  const graphicTypes = [
    "map",
    "timeline",
    "diagram",
    "data_card",
    "evidence",
    "official_document",
  ];
  return graphicTypes.includes(visualType);
}

/**
 * 2단계: 자체 제작 그래픽 선택.
 */
function selectGraphic(scene: Scene): AssetSelectionResult {
  const graphic: SceneVisual = {
    id: `graphic_${scene.id}`,
    type: scene.visualType as any,
    origin: `GENERATED_${(scene.visualType || "").toUpperCase()}` as VisualOrigin,
    graphicType: scene.visualType,
  };

  return {
    primary: graphic,
    alternatives: [],
    requiresAiReconstruction: false,
    requiresDisclaimer: false,
    explanation: `자체 제작 그래픽: ${scene.visualLabel || scene.visualType}`,
  };
}

/**
 * AI 재현이 도움되는 장면인지 판단.
 */
function shouldUseAiReconstruction(
  scene: Scene,
  userInput: MysteryInput
): boolean {
  // 사용자가 AI 재현을 허용했는가?
  if (!userInput.useAiReconstruction) {
    return false;
  }

  // 재현 가능한 장면 타입
  const reconstructibleTypes = [
    "location",
    "atmosphere",
    "ai_reconstruction",
  ];

  if (!reconstructibleTypes.includes(scene.visualType)) {
    return false;
  }

  // 팩트 상태에 따른 판단
  if (scene.visualType === "location") {
    return true; // 장소는 항상 재현 가능
  }

  if (scene.visualType === "atmosphere") {
    return true; // 분위기도 항상 재현 가능
  }

  return false;
}

/**
 * 3단계: AI 재현 선택.
 */
function selectAiReconstruction(scene: Scene): AssetSelectionResult {
  // 프롬프트는 팩트체크된 정보에서만 생성
  const prompt = generateAiPrompt(scene);

  const aiAsset: SceneVisual = {
    id: `ai_${scene.id}`,
    type: scene.visualType as any,
    origin: "AI_RECONSTRUCTION",
    aiGeneration: {
      model: "claude-3.5-sonnet", // 또는 DALL-E, Midjourney 등
      prompt,
      generatedAt: new Date().toISOString(),
      displayDisclaimer: true,
      disclaimerText: "AI 재현",
    },
  };

  return {
    primary: aiAsset,
    alternatives: [],
    requiresAiReconstruction: true,
    requiresDisclaimer: true,
    disclaimerText: "AI 재현",
    explanation: `AI 재현 이미지: ${scene.visualLabel}`,
  };
}

/**
 * AI 프롬프트 생성 (팩트체크된 정보 기반).
 */
function generateAiPrompt(scene: Scene): string {
  // Scene의 내용에서 맥락 추출
  const context = extractContext(scene);

  return `
Generate a cinematic documentary reconstruction image.

Context: ${context}

Style requirements:
- Realistic but clearly artistic
- Documentary photography aesthetic
- Natural lighting
- Historically accurate if period-specific
- Muted, professional colors
- 16:9 aspect ratio
- No text, no watermarks
- Subtle film grain for authenticity

This is a historical reconstruction for documentary purposes.
Do not include people or animals unless explicitly mentioned.
Focus on atmosphere and setting.
  `.trim();
}

/**
 * Scene에서 맥락 추출.
 */
function extractContext(scene: Scene): string {
  const parts: string[] = [];

  if (scene.visualHeadline) {
    parts.push(`Headline: ${scene.visualHeadline}`);
  }

  if (scene.visualLabel) {
    parts.push(`Setting: ${scene.visualLabel}`);
  }

  if (scene.text) {
    parts.push(`Description: ${scene.text.slice(0, 100)}`);
  }

  if (scene.sources && scene.sources.length > 0) {
    const dates = scene.sources
      .map((s) => s.publishedAt)
      .filter(Boolean)
      .slice(0, 2);
    if (dates.length > 0) {
      parts.push(`Time period: ${dates[0]}`);
    }
  }

  return parts.join(" | ");
}

/**
 * 4단계: 텍스트 카드 선택.
 */
function selectTextCard(scene: Scene): AssetSelectionResult {
  const textAsset: SceneVisual = {
    id: `text_${scene.id}`,
    type: "text_card",
    origin: "GENERATED_GRAPHIC",
    graphicType: "text_card",
  };

  return {
    primary: textAsset,
    alternatives: [],
    requiresAiReconstruction: false,
    requiresDisclaimer: false,
    explanation: "타이포그래피 + 내레이션",
  };
}

/**
 * 실제 자료와 AI를 혼합해야 하는지 판단.
 *
 * 예: 실제 사진 + AI 영상 + 지도 등
 */
export function shouldMixAssets(scene: Scene): boolean {
  // 장면이 여러 요소를 포함하는 경우
  if (scene.text && scene.text.length > 200) {
    return true; // 긴 내레이션은 여러 자료 필요
  }

  // 명시적으로 혼합 표시된 경우
  if (scene.visualType === "diagram" || scene.visualType === "evidence") {
    return true;
  }

  return false;
}

/**
 * 화면에 표시할 AI 재현 디스클레이머 텍스트 생성.
 */
export function generateDisclaimer(
  scene: Scene,
  factStatus?: FactStatus
): string | undefined {
  if (!scene.aiReconstructionExplained) {
    return undefined;
  }

  if (factStatus === "CLAIM" || factStatus === "UNVERIFIED") {
    return "기록을 바탕으로 재현한 이미지입니다";
  }

  if (factStatus === "TESTIMONY") {
    return "증언에 기반한 재현 이미지입니다";
  }

  return "AI 재현";
}

/**
 * 최종 출처 표시 텍스트 생성.
 */
export function formatSourceLabel(asset: SceneVisual): string {
  if (!asset.sourcePublisher && !asset.sourceDate) {
    return asset.sourceLabel || asset.sourceTitle || "";
  }

  const parts = [];
  if (asset.sourceTitle) parts.push(asset.sourceTitle);
  if (asset.sourcePublisher) parts.push(asset.sourcePublisher);
  if (asset.sourceDate) parts.push(asset.sourceDate);

  return `자료: ${parts.join(" / ")}`;
}
