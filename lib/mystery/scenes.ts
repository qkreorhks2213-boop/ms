import { generateJson, coerceJsonArray } from "../common/localAI";
import { formatResearchForPrompt } from "./research";
import { updateProject } from "./store";
import type { MysteryProject, Scene, SceneVisualType, ScriptSection } from "./types";

/**
 * 미스터리 대본을 장면(Scene)별로 분할하고, 각 장면에 어떤 시각자료를 보여줄지 판단한다.
 */

const SCENES_PER_BATCH = 6;

export function splitIntoSentences(text: string): string[] {
  const normalized = text.trim();
  if (!normalized) return [];
  const matches = normalized.match(/[^.!?…]+(?:[.!?…]+|$)/g) || [normalized];
  return matches.map((s) => s.trim()).filter(Boolean);
}

function groupIntoSceneTexts(text: string, targetChars: number): string[] {
  const maxChars = targetChars * 1.3;
  const minChars = targetChars * 0.5;
  const sentences = splitIntoSentences(text);
  const scenes: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    const candidateLength = current.length + sentence.length + 1;
    if (current && candidateLength > maxChars && current.length >= minChars) {
      scenes.push(current.trim());
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current.trim()) scenes.push(current.trim());
  return scenes;
}

interface VisualPlanItem {
  visualType: SceneVisualType;
  visualQuery: string;
  visualHeadline?: string;
  visualLabel?: string;
}

const VISUAL_TYPES: SceneVisualType[] = [
  "archive_photo",
  "official_document",
  "newspaper",
  "map",
  "satellite",
  "timeline",
  "interview",
  "evidence",
  "location",
  "ai_reconstruction",
  "diagram",
  "data_card",
  "text_card",
  "atmosphere",
  "video_archive",
];

async function planScenesVisualsBatch(sceneTexts: string[], researchText: string): Promise<VisualPlanItem[]> {
  const prompt = `당신은 미스터리 다큐 영상 디렉터입니다. 각 장면에서 무엇을 보여줄지 정하세요.

[시각자료 종류]
- archive_photo: 역사적 사진, 사건 현장 사진 → visualQuery에 구체적 대상(인물명, 장소명 등)
- official_document: 공식 문서, 기록 → visualQuery에 문서 유형
- newspaper: 신문 기사 → visualQuery에 주제
- map: 사건 발생 지도 → visualQuery에 지역명
- satellite: 위성사진, 항공사진 → visualQuery에 위치
- timeline: 사건 시간대 그래픽 → 자동 생성
- interview: 인터뷰 텍스트 → visualQuery에 사람명
- evidence: 증거 그래픽 → visualQuery에 증거 유형
- location: 현장 사진 → visualQuery에 장소명
- ai_reconstruction: AI 재현 이미지 → visualQuery에 상황 설명
- diagram: 다이어그램, 도표 → visualQuery에 도표 유형
- data_card: 정보 카드 → visualHeadline/Label 사용
- text_card: 텍스트 카드 → visualQuery에 텍스트
- atmosphere: 분위기 이미지 → visualQuery에 분위기 설명
- video_archive: 영상 아카이브 → visualQuery에 주제

[리서치]
${researchText}

[장면 목록]
${sceneTexts.map((t, i) => `${i + 1}. ${t}`).join("\n")}

JSON 배열로 정확히 ${sceneTexts.length}개:
[{ "visualType": "...", "visualQuery": "..." }, ...]`;

  const raw = await generateJson<unknown>({ prompt, temperature: 0.6 });
  const result = coerceJsonArray<VisualPlanItem>(raw);
  if (!result || result.length !== sceneTexts.length) {
    return sceneTexts.map((t) => ({
      visualType: "ai_reconstruction" as SceneVisualType,
      visualQuery: t.slice(0, 120),
    }));
  }
  return result;
}

async function planAllScenesVisuals(
  sceneTexts: string[],
  researchText: string
): Promise<VisualPlanItem[]> {
  const all: VisualPlanItem[] = [];
  for (let i = 0; i < sceneTexts.length; i += SCENES_PER_BATCH) {
    const batch = sceneTexts.slice(i, i + SCENES_PER_BATCH);
    const batchPlan = await planScenesVisualsBatch(batch, researchText);
    all.push(...batchPlan);
  }
  return all;
}

export async function generateScenes(projectId: string, project: MysteryProject): Promise<void> {
  const script = project.script;
  if (!script) throw new Error("대본이 없습니다.");

  const research = project.research || [];
  const researchText = formatResearchForPrompt(research);
  const targetSceneCount = project.input.sceneVisualTarget || 50;

  console.log(`[mystery] 장면 분할 시작: ${script.sections.length}개 섹션, 목표: ${targetSceneCount}개`);

  // Generate all script text
  const fullScriptText = script.sections.map((s) => s.text).join(" ");
  let targetChars = Math.round((targetSceneCount * CHARS_PER_MINUTE) / 60);

  // Ensure minimum scene count by adjusting targetChars
  let allSceneTexts: string[] = [];
  let attempts = 0;
  const maxAttempts = 10;

  while (allSceneTexts.length < targetSceneCount && attempts < maxAttempts) {
    allSceneTexts = [];
    for (const section of script.sections) {
      const sceneTexts = groupIntoSceneTexts(section.text, targetChars);
      allSceneTexts.push(...sceneTexts);
    }

    // If still below target, reduce targetChars to create more scenes
    if (allSceneTexts.length < targetSceneCount) {
      targetChars = Math.max(100, Math.floor(targetChars * 0.85));
      attempts++;
    }
  }

  // If still below target after reduction, split longest scenes
  while (allSceneTexts.length < targetSceneCount) {
    let longestIdx = 0;
    let longestLength = allSceneTexts[0].length;

    for (let i = 1; i < allSceneTexts.length; i++) {
      if (allSceneTexts[i].length > longestLength) {
        longestLength = allSceneTexts[i].length;
        longestIdx = i;
      }
    }

    const longestScene = allSceneTexts[longestIdx];
    const sentences = splitIntoSentences(longestScene);

    if (sentences.length < 2) break; // Can't split further

    // Split at midpoint
    const midpoint = Math.ceil(sentences.length / 2);
    const firstHalf = sentences.slice(0, midpoint).join(" ");
    const secondHalf = sentences.slice(midpoint).join(" ");

    allSceneTexts[longestIdx] = firstHalf;
    allSceneTexts.splice(longestIdx + 1, 0, secondHalf);
  }

  console.log(`[mystery] 시각자료 계획: ${allSceneTexts.length}개 장면 (목표: ${targetSceneCount}개)`);
  const visualPlans = await planAllScenesVisuals(allSceneTexts, researchText);

  console.log(`[mystery] 장면 생성: ${visualPlans.length}개 시각자료`);
  const scenes: Scene[] = [];
  let sceneOrder = 0;

  // Map each scene to its original section for metadata inheritance
  for (const sceneText of allSceneTexts) {
    // Find which section this scene came from
    let sectionId = script.sections[0].id;
    let sectionMetadata = script.sections[0];

    for (const section of script.sections) {
      if (section.text.includes(sceneText) || sceneText.includes(section.text.slice(0, 50))) {
        sectionId = section.id;
        sectionMetadata = section;
        break;
      }
    }

    const visualPlan = visualPlans[sceneOrder] || {
      visualType: "ai_reconstruction" as SceneVisualType,
      visualQuery: sceneText,
    };

    const scene: Scene = {
      id: `scene-${sceneOrder}`,
      sectionId,
      order: sceneOrder,
      text: sceneText,
      visualType: visualPlan.visualType,
      visualQuery: visualPlan.visualQuery,
      visualHeadline: visualPlan.visualHeadline,
      visualLabel: visualPlan.visualLabel,
      visualStatus: "pending",
      narration: [],
      visualOrigin: sectionMetadata.visualOrigin,
      factStatus: sectionMetadata.factStatus,
      sources: sectionMetadata.sources,
      aiReconstructionExplained: sectionMetadata.needsDisclaimer,
    };
    scenes.push(scene);
    sceneOrder++;
  }

  updateProject(projectId, (p) => {
    p.scenes = scenes;
    p.stage = "scenes";
  });

  console.log(`[mystery] 장면 생성 완료: ${scenes.length}개 (목표: ${targetSceneCount}개)`);
}

// 문자 기준 TTS 길이 추정
const CHARS_PER_MINUTE = 268;
