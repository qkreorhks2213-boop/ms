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
  const targetChars = Math.round((project.input.sceneVisualTarget * CHARS_PER_MINUTE) / 60);

  console.log(`[mystery] 장면 분할 시작: ${script.sections.length}개 섹션`);

  const allSceneTexts: string[] = [];
  const scenes: Scene[] = [];
  let sceneOrder = 0;

  for (const section of script.sections) {
    const sceneTexts = groupIntoSceneTexts(section.text, targetChars);
    allSceneTexts.push(...sceneTexts);
  }

  console.log(`[mystery] 시각자료 계획: ${allSceneTexts.length}개 장면`);
  const visualPlans = await planAllScenesVisuals(allSceneTexts, researchText);

  console.log(`[mystery] 장면 생성: ${visualPlans.length}개 시각자료`);
  for (let i = 0; i < script.sections.length; i++) {
    const section = script.sections[i];
    const sectionSceneTexts = groupIntoSceneTexts(section.text, targetChars);
    const sectionStartIdx = allSceneTexts.slice(0, sceneOrder).filter((t) => sectionSceneTexts.includes(t)).length;

    for (let j = 0; j < sectionSceneTexts.length; j++) {
      const visualPlan = visualPlans[sceneOrder + j] || {
        visualType: "ai_reconstruction" as SceneVisualType,
        visualQuery: sectionSceneTexts[j],
      };

      const scene: Scene = {
        id: `scene-${sceneOrder}`,
        sectionId: section.id,
        order: j,
        text: sectionSceneTexts[j],
        visualType: visualPlan.visualType,
        visualQuery: visualPlan.visualQuery,
        visualHeadline: visualPlan.visualHeadline,
        visualLabel: visualPlan.visualLabel,
        visualStatus: "pending",
        narration: [],
        // 섹션에서 메타데이터 상속
        visualOrigin: section.visualOrigin,
        factStatus: section.factStatus,
        sources: section.sources,
        aiReconstructionExplained: section.needsDisclaimer,
      };
      scenes.push(scene);
      sceneOrder++;
    }
  }

  updateProject(projectId, (p) => {
    p.scenes = scenes;
    p.stage = "scenes";
  });

  console.log(`[mystery] 장면 생성 완료: ${scenes.length}개`);
}

// 문자 기준 TTS 길이 추정
const CHARS_PER_MINUTE = 268;
