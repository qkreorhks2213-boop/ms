import { coerceJsonArray, generateJson } from "../common/localAI";
import { formatResearchForPrompt } from "./research";
import { updateProject } from "./store";
import type { EconomicProject, Scene, SceneVisualType, ScriptSection } from "./types";

/**
 * 대본을 장면(Scene) 단위로 쪼갠다. 야담 버전과 가장 크게 다른 지점: 여기서는 장면마다
 * "어울리는 삽화체"를 정하는 게 아니라 "이 장면에서 무엇을 보여줘야 하는가"부터 판단한다
 * (요청 STEP6). Gemini에게 장면 텍스트 + 리서치 결과를 함께 주고, 장면마다 다음을 정하게
 * 한다:
 * - visualType: 실제 사진/로고/차트/그래프/지도/데이터시각화 중 무엇이 가장 적절한가
 * - visualQuery: 그 자료를 찾기 위한 구체적 검색어(사진/로고/지도) 또는
 * - visualHeadline/visualLabel: 차트·그래프·데이터시각화라면 리서치에서 확인된 실제 수치
 *
 * 실제 자료 검색/렌더링 자체는 visuals.ts가 담당한다 — 이 모듈은 "무엇을 보여줄지"만 정한다.
 */

const SCENES_PER_BATCH = 8;
const HOOK_MONTAGE_SIZE = 10;

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
  isHookWorthy?: boolean;
}

const VISUAL_TYPE_VALUES: SceneVisualType[] = [
  "news_photo",
  "company_logo",
  "stock_chart",
  "stat_graph",
  "map",
  "data_viz",
  "fallback_graphic",
];

async function planScenesVisualsBatch(sceneTexts: string[], researchText: string): Promise<VisualPlanItem[]> {
  const prompt = `당신은 경제 뉴스 영상의 영상 편집 디렉터입니다. 아래 장면별 내레이션 문장을
보고, 각 장면에서 화면에 무엇을 보여줄지 정하세요. "이 장면이 실제로 어떤 그림을 필요로
하는가"부터 판단하고, 그 종류에 맞는 값을 채우세요.

[시각자료 종류]
- news_photo: 실제 인물/사건/장소 사진이 필요한 경우 → visualQuery에 구체적 검색어(인물명+직함, 사건명 등)
- company_logo: 특정 기업이 중심인 경우 → visualQuery에 회사명(영문 정식명 권장)
- map: 국가/지역이 중심인 경우 → visualQuery에 지역명
- stock_chart: 주가·환율·금리 등 시계열 수치가 핵심인 경우 → visualHeadline(리서치에서 확인된
  실제 수치, 예: "1,480원")과 visualLabel(그 수치의 이름, 예: "원/달러 환율")을 리서치 결과에서
  그대로 가져와 채우세요. 리서치에 해당 수치가 없으면 이 타입을 고르지 마세요.
- stat_graph: 통계/경제지표가 핵심인 경우 → stock_chart와 동일한 방식으로 visualHeadline/visualLabel
- data_viz: 비교·요약 수치가 핵심인 경우 → 동일
- fallback_graphic: 위 어디에도 해당하지 않는 추상적 설명 장면 → visualQuery에 간단한 개념 설명

isHookWorthy: 이 장면이 특히 시선을 끄는 핵심 장면이면(가장 충격적인 수치, 가장 상징적인
장면 등) true로 표시하세요(전체 장면의 15% 이내로만 표시).

[리서치 결과 — 수치는 반드시 여기서 확인된 값만 사용, 지어내지 말 것]
${researchText}

[장면 목록]
${sceneTexts.map((t, i) => `${i + 1}. ${t}`).join("\n")}

JSON 배열로, 정확히 ${sceneTexts.length}개의 객체만 출력하세요(장면 순서 그대로 하나씩 대응):
[{ "visualType": "...", "visualQuery": "...", "visualHeadline": "...", "visualLabel": "...", "isHookWorthy": false }, ...]`;

  const raw = await generateJson<unknown>({ prompt, temperature: 0.6 });
  const result = coerceJsonArray<VisualPlanItem>(raw);
  if (!result || result.length !== sceneTexts.length) {
    // 개수가 어긋나면 안전하게 fallback_graphic으로 채워 렌더링이 막히지 않게 한다.
    return sceneTexts.map((t) => ({
      visualType: "fallback_graphic" as SceneVisualType,
      visualQuery: t.slice(0, 120),
    }));
  }
  return result.map((item, i) => ({
    visualType: VISUAL_TYPE_VALUES.includes(item.visualType) ? item.visualType : "fallback_graphic",
    visualQuery: item.visualQuery || sceneTexts[i].slice(0, 120),
    visualHeadline: item.visualHeadline,
    visualLabel: item.visualLabel,
    isHookWorthy: item.isHookWorthy,
  }));
}

async function buildScenesForSection(
  section: ScriptSection,
  researchText: string,
  targetCharsPerScene: number
): Promise<Scene[]> {
  const sceneTexts = groupIntoSceneTexts(section.text, targetCharsPerScene);
  const scenes: Scene[] = [];

  for (let batchStart = 0; batchStart < sceneTexts.length; batchStart += SCENES_PER_BATCH) {
    const batch = sceneTexts.slice(batchStart, batchStart + SCENES_PER_BATCH);
    const plans = await planScenesVisualsBatch(batch, researchText);
    batch.forEach((text, i) => {
      const order = batchStart + i;
      const plan = plans[i];
      scenes.push({
        id: `${section.id}-scene-${order}`,
        sectionId: section.id,
        order,
        text,
        visualType: plan.visualType,
        visualQuery: plan.visualQuery,
        visualHeadline: plan.visualHeadline,
        visualLabel: plan.visualLabel,
        visualStatus: "pending",
        isHookWorthy: plan.isHookWorthy,
        narration: [],
      });
    });
  }
  return scenes;
}

/** 훅 몽타주용 장면을 고른다 — isHookWorthy로 표시된 장면 우선, 부족하면 전체에 고루 퍼진 장면으로 채움. */
export function selectHookMontageScenes(scenes: Scene[]): string[] {
  if (scenes.length === 0) return [];
  const marked = scenes.filter((s) => s.isHookWorthy);
  const target = Math.max(6, Math.min(HOOK_MONTAGE_SIZE, Math.round(scenes.length * 0.15)));

  const picked = new Set<string>(marked.slice(0, target).map((s) => s.id));
  if (picked.size < target) {
    const remainingSlots = target - picked.size;
    const step = Math.max(1, Math.floor(scenes.length / remainingSlots));
    for (let i = 0; i < scenes.length && picked.size < target; i += step) {
      picked.add(scenes[i].id);
    }
  }
  const order = new Map(scenes.map((s, i) => [s.id, i]));
  return [...picked].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
}

/**
 * 프로젝트의 모든 장면을 만든다. 섹션(챕터/결말) 단위로 체크포인트를 남기므로, 중간에 실패해도
 * 이미 장면이 만들어진 섹션은 건너뛰고 이어서 진행된다.
 */
export async function buildAllScenes(projectId: string, project: EconomicProject): Promise<void> {
  const script = project.script;
  if (!script) throw new Error("대본이 아직 생성되지 않았습니다.");
  const researchText = formatResearchForPrompt(project.research || []);

  const bodySections = script.sections.filter((s) => s.kind === "chapter" || s.kind === "summary");

  const totalBodyChars = bodySections.reduce((n, s) => n + s.charCount, 0);
  const targetCharsPerScene = Math.max(200, Math.round(totalBodyChars / Math.max(1, project.input.sceneVisualTarget)));

  let scenes: Scene[] = project.scenes ? [...project.scenes] : [];
  const doneSectionIds = new Set(scenes.map((s) => s.sectionId));

  for (const section of bodySections) {
    if (doneSectionIds.has(section.id)) continue;
    const newScenes = await buildScenesForSection(section, researchText, targetCharsPerScene);
    scenes = [...scenes, ...newScenes];
    updateProject(projectId, (p) => {
      p.scenes = scenes;
    });
  }

  const hookMontageSceneIds = selectHookMontageScenes(scenes);
  updateProject(projectId, (p) => {
    p.scenes = scenes;
    p.hookMontageSceneIds = hookMontageSceneIds;
    p.stage = "visuals";
  });
}
