/**
 * 지루함 감지 및 자동 수정 시스템
 *
 * 다큐멘터리에서 시청자가 지루해할 수 있는 장면을 자동으로 감지하고 수정합니다:
 * 1. 반복된 시각 자료
 * 2. 정적인 장면 (30초 이상 변화 없음)
 * 3. 긴 나레이션 (60초 이상 동일 주제)
 * 4. 불필요한 배경 정보
 * 5. 중복된 설명
 */

import type { Scene } from "./types";

interface BoringAnalysis {
  sceneId: string;
  reasons: string[];
  severity: "high" | "medium" | "low";
  suggestedAction: "delete" | "merge" | "shorten" | "replace_visual" | "keep";
}

/**
 * 장면의 지루함 점수 계산 결과
 */
interface BoringScoreResult {
  score: number;
  reasons: string[];
}

/**
 * 장면의 지루함 점수 계산
 * 점수가 높을수록 더 지루함
 */
function calculateBoringScore(
  scene: Scene,
  previousScenes: Scene[],
  nextScenes: Scene[]
): BoringScoreResult {
  let score = 0;
  const reasons: string[] = [];

  // 1. 반복된 시각 자료 (같은 visualType 연속 3회)
  const recentTypes = previousScenes.slice(-2).map((s) => s.visualType);
  if (recentTypes.length === 2 && recentTypes[0] === recentTypes[1] && recentTypes[1] === scene.visualType) {
    score += 30;
    reasons.push("같은 시각자료 반복 (3회 연속)");
  } else if (recentTypes.length === 1 && recentTypes[0] === scene.visualType) {
    score += 15;
    reasons.push("같은 시각자료 반복 (2회 연속)");
  }

  // 2. 정적 장면 (30초 이상 나레이션 없이 같은 visual)
  const durationSeconds = scene.durationSeconds || 0;
  if (durationSeconds > 30 && !scene.narration?.some((n) => n.text?.length > 50)) {
    score += 25;
    reasons.push("정적 장면 (30초 이상 음성 변화 없음)");
  }

  // 3. 긴 나레이션 (300자 이상 동일 주제)
  const totalNarration = scene.narration?.reduce((sum, n) => sum + (n.text?.length || 0), 0) || 0;
  if (totalNarration > 300) {
    // Check if next scenes have similar topics
    const currentTopics = extractTopics(scene.text);
    const nextTopics = nextScenes.slice(0, 2).flatMap((s) => extractTopics(s.text));
    const overlap = currentTopics.filter((t) => nextTopics.includes(t)).length;
    if (overlap > 0) {
      score += 20;
      reasons.push("긴 나레이션 + 주제 반복");
    }
  }

  // 4. 불필요한 배경 정보
  if (scene.text.includes("이는") || scene.text.includes("이것은")) {
    const isBg = !scene.text.includes("하지만") && !scene.text.includes("그런데") && !scene.text.includes("놀랍게도");
    if (isBg && previousScenes.length > 2) {
      score += 15;
      reasons.push("불필요한 설명 (이미 설명된 주제)");
    }
  }

  // 5. 중복된 설명 (같은 문구가 이전 3개 장면에 있음)
  const keywords = extractKeywords(scene.text);
  for (const kw of keywords) {
    const prevMatches = previousScenes.slice(-3).filter((s) => s.text.includes(kw)).length;
    if (prevMatches >= 2) {
      score += 10;
      reasons.push("중복된 설명");
      break;
    }
  }

  // 6. 너무 짧은 장면 (5초 미만 & 중요하지 않은 주제)
  if (durationSeconds < 5 && !isImportantKeyword(scene.text)) {
    score += 8;
    reasons.push("너무 짧은 장면 (5초 미만)");
  }

  return { score, reasons };
}

/**
 * 텍스트에서 주요 주제 추출
 */
function extractTopics(text: string): string[] {
  const patterns = [
    /사건|미스터리|의문|증거|단서/g,
    /사망|살인|범죄|수수께끼/g,
    /목격자|증인|용의자|피해자/g,
    /날짜|시간|장소|위치/g,
  ];

  const topics: string[] = [];
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      topics.push(...matches);
    }
  }
  return [...new Set(topics)];
}

/**
 * 텍스트에서 키워드 추출 (3글자 이상의 명사들)
 */
function extractKeywords(text: string): string[] {
  // Simple keyword extraction: find repeated phrases of 3+ chars
  const words = text.split(/\s+/);
  return words
    .filter((w) => w.length >= 3)
    .map((w) => w.replace(/[,.!?;:]/g, ""))
    .filter(Boolean);
}

/**
 * 중요한 키워드인지 확인 (지루한 내용이 아닌지)
 */
function isImportantKeyword(text: string): boolean {
  const importantWords = ["하지만", "그런데", "놀랍게도", "의외로", "사실은", "밝혀진", "증거", "실마리", "단서"];
  return importantWords.some((w) => text.includes(w));
}

/**
 * 전체 장면 리스트에서 지루한 장면들을 분석
 */
export function detectBoringScenes(scenes: Scene[]): BoringAnalysis[] {
  const analysis: BoringAnalysis[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const previousScenes = scenes.slice(Math.max(0, i - 3), i);
    const nextScenes = scenes.slice(i + 1, Math.min(scenes.length, i + 4));

    const { score, reasons } = calculateBoringScore(scene, previousScenes, nextScenes);

    if (score > 25) {
      let severity: "high" | "medium" | "low" = "low";
      if (score > 50) severity = "high";
      else if (score > 35) severity = "medium";

      let suggestedAction: BoringAnalysis["suggestedAction"] = "keep";
      if (score > 50) {
        suggestedAction = previousScenes.length > 0 ? "merge" : "delete";
      } else if (score > 35) {
        suggestedAction = "shorten";
      } else if (reasons.some((r) => r.includes("시각자료"))) {
        suggestedAction = "replace_visual";
      }

      analysis.push({
        sceneId: scene.id,
        reasons,
        severity,
        suggestedAction,
      });
    }
  }

  return analysis;
}

/**
 * 자동으로 지루한 장면들을 수정
 */
export function optimizeBoringScenes(scenes: Scene[], analyses: BoringAnalysis[]): Scene[] {
  if (analyses.length === 0) return scenes;

  let optimized = [...scenes];

  // 1단계: 높은 심각도의 장면들 삭제
  const toDelete = new Set(analyses.filter((a) => a.severity === "high" && a.suggestedAction === "delete").map((a) => a.sceneId));

  optimized = optimized.filter((s) => !toDelete.has(s.id));

  // 2단계: 병합 가능한 장면들 통합
  const toMerge = analyses.filter((a) => a.severity === "high" && a.suggestedAction === "merge");
  if (toMerge.length > 0) {
    const mergedIds = new Set<string>();

    for (const analysis of toMerge) {
      if (mergedIds.has(analysis.sceneId)) continue;

      const sceneIdx = optimized.findIndex((s) => s.id === analysis.sceneId);
      if (sceneIdx < 0 || sceneIdx === 0) continue;

      const prevScene = optimized[sceneIdx - 1];
      const currScene = optimized[sceneIdx];

      // 이전 장면의 텍스트에 현재 장면의 텍스트 추가
      const mergedScene: Scene = {
        ...prevScene,
        text: `${prevScene.text} ${currScene.text}`,
        order: prevScene.order,
        narration: [...(prevScene.narration || []), ...(currScene.narration || [])],
      };

      optimized[sceneIdx - 1] = mergedScene;
      optimized.splice(sceneIdx, 1);
      mergedIds.add(analysis.sceneId);
    }
  }

  // 3단계: 시각자료 교체 필요한 장면들 표시
  for (const analysis of analyses) {
    if (analysis.suggestedAction === "replace_visual") {
      const scene = optimized.find((s) => s.id === analysis.sceneId);
      if (scene) {
        // 다양한 시각자료로 변경 시도 (deterministic: scene ID 기반)
        const alternativeVisuals: typeof scene.visualType[] = [
          "diagram",
          "data_card",
          "timeline",
          "evidence",
          "ai_reconstruction",
        ];
        // Use scene id hash for deterministic selection (not random)
        const sceneIdHash = Array.from(scene.id).reduce((hash, char) => hash + char.charCodeAt(0), 0);
        const altIndex = sceneIdHash % alternativeVisuals.length;
        scene.visualType = alternativeVisuals[altIndex];
      }
    }
  }

  return optimized;
}

/**
 * 지루함 리포트 생성
 */
export function generateBoredumReport(analyses: BoringAnalysis[]): string {
  if (analyses.length === 0) {
    return "✅ 지루한 장면이 없습니다.";
  }

  const highCount = analyses.filter((a) => a.severity === "high").length;
  const mediumCount = analyses.filter((a) => a.severity === "medium").length;
  const lowCount = analyses.filter((a) => a.severity === "low").length;

  const report = [
    `⚠️ 지루함 감지 결과:`,
    `- 높음: ${highCount}개 장면`,
    `- 중간: ${mediumCount}개 장면`,
    `- 낮음: ${lowCount}개 장면`,
    ``,
    `조치 계획:`,
    `- 삭제: ${analyses.filter((a) => a.suggestedAction === "delete").length}개`,
    `- 병합: ${analyses.filter((a) => a.suggestedAction === "merge").length}개`,
    `- 단축: ${analyses.filter((a) => a.suggestedAction === "shorten").length}개`,
    `- 시각자료 교체: ${analyses.filter((a) => a.suggestedAction === "replace_visual").length}개`,
  ].join("\n");

  return report;
}
