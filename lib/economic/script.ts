import { coerceJsonArray, generateJson, generateText } from "../common/localAI";
import { formatResearchForPrompt } from "./research";
import { updateProject } from "./store";
import {
  ANGLE_LABEL,
  CHARS_PER_MINUTE,
  NARRATIVE_ANGLE_INFO,
  type EconomicAngle,
  type EconomicInput,
  type EconomicProject,
  type ScriptSection,
  type SourceRef,
  type TitleCandidate,
  type EconomicScript,
} from "./types";

/**
 * 대본 생성 파이프라인. 사용자가 요청한 9단계 구조(훅 → 지금 무슨 일 → 왜 → 과거 사례 →
 * 영향 → 숫자 → 전문가 관점 → 향후 전망 → 핵심 정리)를 그대로 옮기되, 목표 길이에 따라
 * 2번~8번(EconomicAngle 7개)을 몇 개의 챕터에 나눠 담을지 유동적으로 정한다 — 5분짜리는
 * 앵글 여러 개를 챕터 하나에 압축하고, 110분짜리는 앵글마다 챕터를 여러 개 배정한다.
 *
 * 아주 긴 대본을 한 번의 AI 호출로 만들면 문맥이 흐트러지고 실패 시 처음부터 다시 해야
 * 하므로, 야담 버전과 동일하게 아웃라인 → 훅 → 챕터(배치 단위) → 결말 순으로 나눠 생성하고,
 * 섹션 하나가 끝날 때마다 즉시 디스크에 저장한다(체크포인트).
 */

const MIN_HOOK_SECONDS = 20;
const MAX_HOOK_SECONDS = 90;
const HOOK_SHARE = 0.08; // 전체 길이의 약 8%를 훅에 배정

const MIN_ENDING_MINUTES = 1;
const MAX_ENDING_MINUTES = 4;
const ENDING_SHARE = 0.04;

const MIN_CHAPTERS = 2;
const MAX_CHAPTERS = 20;
const IDEAL_CHAPTER_MINUTES = 6;
const CHAPTER_BATCH_SIZE = 3;

const ALL_ANGLES: EconomicAngle[] = ["situation", "cause", "history", "impact", "numbers", "expert", "outlook"];

/** 리서치 결과의 "query" 라벨(researchTopic이 만든 3개 그룹) 중 이 앵글과 가장 관련 있는 것. */
const ANGLE_TO_RESEARCH_QUERY: Record<EconomicAngle, string> = {
  situation: "최신 동향",
  cause: "배경·원인",
  history: "배경·원인",
  impact: "영향·전망",
  numbers: "영향·전망",
  expert: "영향·전망",
  outlook: "영향·전망",
};

function estimateSeconds(charCount: number): number {
  return Math.round((charCount / CHARS_PER_MINUTE) * 60);
}

function hookSecondsFor(targetMinutes: number): number {
  return Math.round(Math.min(MAX_HOOK_SECONDS, Math.max(MIN_HOOK_SECONDS, targetMinutes * 60 * HOOK_SHARE)));
}

function endingMinutesFor(targetMinutes: number): number {
  return Math.min(MAX_ENDING_MINUTES, Math.max(MIN_ENDING_MINUTES, targetMinutes * ENDING_SHARE));
}

function chapterCountFor(targetMinutes: number): number {
  const bodyMinutes = Math.max(1, targetMinutes - hookSecondsFor(targetMinutes) / 60 - endingMinutesFor(targetMinutes));
  const count = Math.round(bodyMinutes / IDEAL_CHAPTER_MINUTES);
  return Math.max(MIN_CHAPTERS, Math.min(MAX_CHAPTERS, count));
}

/** 7개 앵글을 챕터 개수만큼 고르게 분배한다(챕터가 적으면 앵글을 묶고, 많으면 앵글을 반복). */
function assignAnglesToChapters(chapterCount: number): EconomicAngle[][] {
  const result: EconomicAngle[][] = Array.from({ length: chapterCount }, () => []);
  if (chapterCount >= ALL_ANGLES.length) {
    ALL_ANGLES.forEach((angle, i) => result[i % chapterCount].push(angle));
    // 남는 챕터(앵글보다 챕터가 많은 경우)는 뒤쪽 앵글(영향/전망 계열)을 한 번 더 반복 배정한다.
    for (let i = ALL_ANGLES.length; i < chapterCount; i++) {
      result[i].push(ALL_ANGLES[(i - ALL_ANGLES.length) % ALL_ANGLES.length]);
    }
  } else {
    ALL_ANGLES.forEach((angle, i) => result[i % chapterCount].push(angle));
  }
  return result;
}

function sourcesForAngles(research: EconomicProject["research"], angles: EconomicAngle[] | undefined): SourceRef[] {
  if (!research || !angles || angles.length === 0) return [];
  const queries = new Set(angles.map((a) => ANGLE_TO_RESEARCH_QUERY[a]));
  const seen = new Set<string>();
  const sources: SourceRef[] = [];
  for (const finding of research) {
    if (!queries.has(finding.query)) continue;
    for (const s of finding.sources) {
      if (seen.has(s.url)) continue;
      seen.add(s.url);
      sources.push(s);
    }
  }
  return sources;
}

interface OutlineResponse {
  chapters: { summary: string }[];
}

async function generateOutline(input: EconomicInput, researchText: string, chapterCount: number): Promise<OutlineResponse> {
  const angleInfo = NARRATIVE_ANGLE_INFO[input.narrativeAngle];
  const prompt = `당신은 경제·시사 뉴스 롱폼 유튜브 채널의 메인 작가입니다. 아래 리서치 결과를
근거로, 총 ${chapterCount}개 챕터로 나눌 전체 구성 아웃라인을 JSON으로만 출력하세요.

[주제]
${input.topic}

[서사 앵글]
"${angleInfo.label}" 프레임으로 구성하세요. ${angleInfo.desc}

[리서치 결과 — 반드시 이 사실관계 안에서만 서술]
${researchText}

[출력 형식]
{ "chapters": [ { "summary": "이 챕터에서 다룰 내용을 3~4문장으로(리서치에서 확인된 사실만)" }, ... 정확히 ${chapterCount}개 ] }
각 챕터 summary는 다음 챕터 작가가 이어 쓸 수 있도록 구체적인 사실/수치/출처를 담아야 합니다.
리서치에 없는 사실을 지어내지 마세요.`;

  return generateJson<OutlineResponse>({ prompt, temperature: 0.8 });
}

function hookPrompt(input: EconomicInput, outline: OutlineResponse, researchText: string, hookSeconds: number): string {
  const ctaLine = input.useEngagementCta
    ? `마지막에 "이 이슈, 여러분은 어떻게 보시나요? 댓글로 의견 남겨주세요" 같은 참여 유도
한 줄을 자연스럽게 넣으세요.`
    : "";
  const hookTargetChars = Math.round((hookSeconds / 60) * CHARS_PER_MINUTE);

  return `당신은 경제 뉴스 롱폼 채널의 오프닝(훅) 전문 작가입니다. 아래 리서치 결과에서 가장
충격적이거나 시청자의 궁금증을 자극하는 실제 사실 하나로 시작해, 이 영상이 무엇을 다룰지
강하게 예고하는 오프닝 내레이션을 쓰세요. 전체 길이는 한국어 기준 약 ${hookSeconds}초 분량
(대략 ${hookTargetChars}자 내외)입니다.

[리서치 결과 — 반드시 이 사실관계 안에서만 서술, 지어내지 말 것]
${researchText}

[전체 구성 아웃라인 — 참고용]
${outline.chapters.map((c, i) => `${i + 1}. ${c.summary}`).join("\n")}

[구조]
1. 리서치에서 확인된 가장 강력한 사실/수치를 문장 하나로 던지며 시작(추측이나 과장 금지,
   실제 확인된 사실만).
2. 이 사건이 왜 지금 중요한지 2~3문장으로 압축.
3. "오늘 영상에서 ~을 알려드립니다" 형태로 이 영상이 다룰 범위를 예고.
${ctaLine}

문어체 리포트가 아니라 실제로 말하는 톤(반말 아닌 정중한 구어체, 단문 위주)을 유지하세요.
내레이션 본문만 출력하세요.`;
}

function chapterBatchPrompt(params: {
  input: EconomicInput;
  outline: OutlineResponse;
  angleAssignment: EconomicAngle[][];
  startIndex: number;
  count: number;
  chapterCount: number;
  targetChars: number;
  researchText: string;
  previousTailText: string;
}): string {
  const { input, outline, angleAssignment, startIndex, count, chapterCount, targetChars, researchText, previousTailText } = params;
  const indices = Array.from({ length: count }, (_, k) => startIndex + k);
  const chapterList = indices
    .map((i) => {
      const angles = angleAssignment[i] || [];
      const angleText = angles.map((a) => ANGLE_LABEL[a]).join(" + ");
      return `${i + 1}번째 챕터 [다룰 관점: ${angleText}]: ${outline.chapters[i]?.summary || ""}`;
    })
    .join("\n");

  return `당신은 경제·시사 뉴스 롱폼 채널의 본편 작가입니다. 차분하고 신뢰감 있는 리포터 톤,
정중한 구어체(설명체가 아니라 말로 전달하는 느낌)로 아래 ${count}개 챕터를 순서대로 이어
쓰세요. 전체 ${chapterCount}개 챕터 중 ${startIndex + 1}~${startIndex + count}번째입니다.

[리서치 결과 — 반드시 이 사실관계 안에서만 서술. 리서치에 없는 숫자·날짜·발언을 지어내지 말고,
확실하지 않으면 "정확한 수치는 확인되지 않았지만" 같은 표현으로 명시하세요]
${researchText}

[이번에 쓸 챕터들]
${chapterList}

[직전 내용 마지막 부분 — 첫 챕터를 자연스럽게 이어서 쓸 것]
${previousTailText || "(이번이 첫 챕터입니다. 훅 직후를 자연스럽게 이어받으세요.)"}

[규칙]
- 각 챕터는 배정된 관점(들)만 다루고, 리서치에서 확인된 사실·숫자·출처를 구체적으로
  인용하세요("업계에 따르면", "~로 알려졌다" 같은 모호한 표현보다 실제 확인된 사실 위주).
- 뉴스 기사를 그대로 베끼지 말고, 리서치 내용을 종합해 당신의 말로 재구성하세요.
- 챕터 하나의 분량은 한국어 기준 약 ${targetChars}자(공백 제외) 내외로 맞추세요.
- 배열 원소 안에는 챕터 번호/제목 표시를 넣지 말고 내레이션 본문만 담으세요.

[출력 형식]
JSON 배열로, 정확히 ${count}개의 문자열만 출력하세요:
["첫 챕터 본문...", "다음 챕터 본문...", ...]`;
}

function endingPrompt(input: EconomicInput, outline: OutlineResponse, previousTailText: string, endingMinutes: number): string {
  const toneInstruction =
    input.endingStyle === "outlook"
      ? `앞으로 어떤 시나리오가 가능한지 리서치에서 확인된 전문가 전망/시장 반응을 근거로
2~3가지 방향으로 정리하며 마무리하세요(단정적 예측이 아니라 "~할 가능성이 있다" 톤).`
      : `시청자가 이 영상에서 꼭 기억해야 할 핵심 사실 3~4가지를 간결하게 정리하며
마무리하세요.`;

  return `경제 뉴스 롱폼 채널 본편의 마지막 장면을 쓰세요. 정중한 구어체 리포터 톤을 유지하며,
${toneInstruction}

[전체 아웃라인]
${outline.chapters.map((c, i) => `${i + 1}. ${c.summary}`).join("\n")}

[직전 챕터 마지막 부분]
${previousTailText}

한국어 기준 약 ${Math.round(endingMinutes * CHARS_PER_MINUTE)}자 내외로, 내레이션 본문만
출력하세요. 리서치에 없는 사실을 지어내지 마세요.`;
}

/**
 * 제목 공식 — "떡상채널 미니북 ② 경제 채널 시장 실측"(65개 채널·6,975편, 2026-08-03) §3
 * 그대로. 야담 버전의 계모/암행어사 같은 캐릭터 키워드가 아니라 이 PDF가 실측한 문법 요소로
 * 완전히 교체한다.
 */
const TITLE_FORMULA_NOTE = `
[제목 공식 — PDF §3 실측 배율]
가점: 따옴표 " " 포함(×1.4), 숫자 포함(×1.11).
감점: "충격·위기·폭락" 계열 단어(×0.93), "돈·부자·억" 계열 단어(×0.89), 물음표(×0.77), 대괄호[]【】(×0.31).
개별 키워드 가점: "됐다"(×5.88) "통합본"(×4.33) "월급"(×4.21) "1위"(×3.44) "제2의"(×2.99)
"무너진"(×2.88) "던진"(×2.87) "99"(×2.84) "뒤에"(×2.83) "전기차"(×2.6) "연봉"(×2.54) "기술"(×2.53).
개별 키워드 감점: "대신"(×0.51) "같은"(×0.49) "실제로"(×0.48) "부자들이"(×0.45) "구조"(×0.37) "매출"(×0.35).
틀: 큰 주어(나라/기업/삼성 등) + 구체적 숫자·고유명 + 붕괴/반전 신호 단언문. 질문형·설명형 금지.`;

async function generateTitleCandidates(input: EconomicInput, outline: OutlineResponse): Promise<string[]> {
  const prompt = `아래 구성으로 경제 뉴스 유튜브 영상 제목 후보 5개를 만드세요.
${TITLE_FORMULA_NOTE}

[구성]
${outline.chapters.map((c, i) => `${i + 1}. ${c.summary}`).join("\n")}

JSON 배열로만 출력하세요: ["제목1", "제목2", "제목3", "제목4", "제목5"]`;
  const raw = await generateJson<unknown>({ prompt, temperature: 1.1 });
  const titles = coerceJsonArray<string>(raw);
  if (!titles) {
    throw new Error(`제목 후보 생성 응답 형식이 올바르지 않습니다. 실제로 받은 응답: ${JSON.stringify(raw).slice(0, 500)}`);
  }
  return titles;
}

const SCORE_RULES: Array<{ test: (t: string) => boolean; factor: number; note: string }> = [
  { test: (t) => t.includes("됐다"), factor: 5.88, note: '"됐다" 포함 (×5.88)' },
  { test: (t) => t.includes("통합본"), factor: 4.33, note: '"통합본" 포함 (×4.33)' },
  { test: (t) => t.includes("월급"), factor: 4.21, note: '"월급" 포함 (×4.21)' },
  { test: (t) => t.includes("1위"), factor: 3.44, note: '"1위" 포함 (×3.44)' },
  { test: (t) => t.includes("제2의"), factor: 2.99, note: '"제2의" 포함 (×2.99)' },
  { test: (t) => t.includes("무너진"), factor: 2.88, note: '"무너진" 포함 (×2.88)' },
  { test: (t) => t.includes("던진"), factor: 2.87, note: '"던진" 포함 (×2.87)' },
  { test: (t) => t.includes("99"), factor: 2.84, note: '"99" 포함 (×2.84)' },
  { test: (t) => t.includes("뒤에"), factor: 2.83, note: '"뒤에" 포함 (×2.83)' },
  { test: (t) => t.includes("전기차"), factor: 2.6, note: '"전기차" 포함 (×2.6)' },
  { test: (t) => t.includes("연봉"), factor: 2.54, note: '"연봉" 포함 (×2.54)' },
  { test: (t) => t.includes("기술"), factor: 2.53, note: '"기술" 포함 (×2.53)' },
  { test: (t) => /["“][^"”]+["”]/.test(t), factor: 1.4, note: "따옴표 포함 (×1.4)" },
  { test: (t) => /\d/.test(t), factor: 1.11, note: "숫자 포함 (×1.11)" },
  { test: (t) => /충격|위기|폭락/.test(t), factor: 0.93, note: '"충격/위기/폭락" 계열 (×0.93)' },
  { test: (t) => /돈|부자|억/.test(t), factor: 0.89, note: '"돈/부자/억" 계열 (×0.89)' },
  { test: (t) => t.includes("대신"), factor: 0.51, note: '"대신" 포함 (×0.51)' },
  { test: (t) => t.includes("같은"), factor: 0.49, note: '"같은" 포함 (×0.49)' },
  { test: (t) => t.includes("실제로"), factor: 0.48, note: '"실제로" 포함 (×0.48)' },
  { test: (t) => t.includes("부자들이"), factor: 0.45, note: '"부자들이" 포함 (×0.45)' },
  { test: (t) => t.includes("구조"), factor: 0.37, note: '"구조" 포함 (×0.37)' },
  { test: (t) => t.includes("매출"), factor: 0.35, note: '"매출" 포함 (×0.35)' },
  { test: (t) => t.includes("?") || t.includes("？"), factor: 0.77, note: "물음표 포함 (×0.77)" },
  { test: (t) => /[\[【][^\]】]*[\]】]/.test(t), factor: 0.31, note: "대괄호 포함 (×0.31)" },
];

export function scoreTitle(text: string): TitleCandidate {
  let score = 1;
  const notes: string[] = [];
  for (const rule of SCORE_RULES) {
    if (rule.test(text)) {
      score *= rule.factor;
      notes.push(rule.note);
    }
  }
  notes.push(`길이 ${text.length}자`);
  return { text, score: Math.round(score * 100) / 100, notes };
}

function buildSection(
  kind: ScriptSection["kind"],
  text: string,
  sources: SourceRef[],
  index?: number,
  outlineSummary?: string,
  angles?: EconomicAngle[]
): ScriptSection {
  const charCount = text.length;
  return {
    id: index !== undefined ? `chapter-${index}` : kind,
    kind,
    index,
    angles,
    outlineSummary,
    text,
    charCount,
    estimatedSeconds: estimateSeconds(charCount),
    status: "done",
    sources,
  };
}

function tail(text: string, chars = 400): string {
  return text.length <= chars ? text : text.slice(-chars);
}

/**
 * 프로젝트의 대본 전체를 생성한다. 리서치가 아직 없으면 실패한다(사실관계 근거 없이 대본을
 * 쓰지 않기 위한 의도적 제약). 이미 "done" 상태인 섹션은 건너뛰므로 체크포인트 재개가 된다.
 */
export async function generateFullScript(projectId: string, project: EconomicProject): Promise<void> {
  const { input } = project;
  if (!project.research || project.research.length === 0) {
    throw new Error("리서치가 아직 완료되지 않았습니다. 먼저 뉴스 조사를 실행하세요.");
  }
  const researchText = formatResearchForPrompt(project.research);

  const chapterCount = chapterCountFor(input.targetMinutes);
  const hookSeconds = hookSecondsFor(input.targetMinutes);
  const endingMinutes = endingMinutesFor(input.targetMinutes);
  const bodyMinutes = input.targetMinutes - hookSeconds / 60 - endingMinutes;
  const targetCharsPerChapter = Math.round((bodyMinutes / chapterCount) * CHARS_PER_MINUTE);
  const angleAssignment = assignAnglesToChapters(chapterCount);

  let script: EconomicScript = project.script || {
    title: "",
    titleCandidates: [],
    outline: "",
    sections: [],
    totalCharCount: 0,
    estimatedMinutes: 0,
  };

  let outline: OutlineResponse;
  if (script.outline) {
    outline = JSON.parse(script.outline);
  } else {
    outline = await generateOutline(input, researchText, chapterCount);
    script = { ...script, outline: JSON.stringify(outline) };
    updateProject(projectId, (p) => {
      p.script = script;
    });
  }

  const sectionExists = (id: string) => script.sections.find((s) => s.id === id && s.status === "done");

  // 1) 훅
  if (!sectionExists("hook")) {
    const text = (await generateText({ prompt: hookPrompt(input, outline, researchText, hookSeconds), temperature: 0.9 })).trim();
    const section = buildSection("hook", text, sourcesForAngles(project.research, ["situation"]));
    script = { ...script, sections: [...script.sections.filter((s) => s.id !== "hook"), section] };
    reorderSections(script);
    updateProject(projectId, (p) => {
      p.script = script;
    });
  }

  // 2) 챕터를 CHAPTER_BATCH_SIZE개씩 묶어 순차 생성
  for (let batchStart = 0; batchStart < chapterCount; batchStart += CHAPTER_BATCH_SIZE) {
    const batchCount = Math.min(CHAPTER_BATCH_SIZE, chapterCount - batchStart);
    const batchIds = Array.from({ length: batchCount }, (_, k) => `chapter-${batchStart + k}`);
    if (batchIds.every((id) => sectionExists(id))) continue;

    const prevId = batchStart === 0 ? "hook" : `chapter-${batchStart - 1}`;
    const prevSection = script.sections.find((s) => s.id === prevId && s.status === "done");

    const rawTexts = await generateJson<unknown>({
      prompt: chapterBatchPrompt({
        input,
        outline,
        angleAssignment,
        startIndex: batchStart,
        count: batchCount,
        chapterCount,
        targetChars: targetCharsPerChapter,
        researchText,
        previousTailText: prevSection ? tail(prevSection.text) : "",
      }),
      temperature: 0.85,
    });
    const texts = coerceJsonArray<string>(rawTexts) || [];

    if (!Array.isArray(texts) || texts.length !== batchCount || texts.some((t) => !t || !t.trim())) {
      throw new Error(
        `${batchStart + 1}~${batchStart + batchCount}번째 챕터 배치 생성에 실패했습니다(응답 형식이 올바르지 않음). ` +
          `다시 시도해 주세요(로컬 모델이 JSON 형식 지시를 놓친 경우 재시도로 해결되는 경우가 많습니다. ` +
          `계속 실패하면 OLLAMA_MODEL을 더 큰 모델로 바꿔보세요).\n실제로 받은 응답: ${JSON.stringify(rawTexts).slice(0, 500)}`
      );
    }

    const newSections = batchIds.map((id, k) => {
      const i = batchStart + k;
      const angles = angleAssignment[i] || [];
      return buildSection("chapter", texts[k].trim(), sourcesForAngles(project.research, angles), i, outline.chapters[i]?.summary, angles);
    });
    script = {
      ...script,
      sections: [...script.sections.filter((s) => !batchIds.includes(s.id)), ...newSections],
    };
    reorderSections(script);
    updateProject(projectId, (p) => {
      p.script = script;
    });
  }

  // 3) 결말
  if (!sectionExists("summary")) {
    const lastChapter = script.sections.find((s) => s.id === `chapter-${chapterCount - 1}`);
    const text = (
      await generateText({
        prompt: endingPrompt(input, outline, lastChapter ? tail(lastChapter.text) : "", endingMinutes),
        temperature: 0.85,
      })
    ).trim();
    const section = buildSection("summary", text, sourcesForAngles(project.research, ["outlook"]));
    script = { ...script, sections: [...script.sections.filter((s) => s.id !== "summary"), section] };
    reorderSections(script);
    updateProject(projectId, (p) => {
      p.script = script;
    });
  }

  // 4) 제목 후보 + 점수, 전체 글자수/예상 시간 집계
  if (script.titleCandidates.length === 0) {
    const rawTitles = await generateTitleCandidates(input, outline);
    const candidates = rawTitles.map(scoreTitle).sort((a, b) => b.score - a.score);
    script = { ...script, titleCandidates: candidates, title: candidates[0]?.text || "" };
  }

  const totalCharCount = script.sections.reduce((n, s) => n + s.charCount, 0);
  script = { ...script, totalCharCount, estimatedMinutes: Math.round((totalCharCount / CHARS_PER_MINUTE) * 10) / 10 };

  updateProject(projectId, (p) => {
    p.script = script;
    p.stage = "scenes";
  });
}

function reorderSections(script: EconomicScript): void {
  const order = (s: ScriptSection) => (s.kind === "hook" ? -1 : s.kind === "summary" ? Number.MAX_SAFE_INTEGER : s.index ?? 0);
  script.sections.sort((a, b) => order(a) - order(b));
}

/**
 * 챕터는 CHAPTER_BATCH_SIZE개씩 묶어 한 번의 API 호출로 생성되므로, 챕터 섹션 하나를
 * 재생성하면 그 챕터가 속한 배치 전체가 함께 다시 생성된다(훅/결말은 단독 호출이라 무관).
 */
export async function regenerateSection(projectId: string, project: EconomicProject, sectionId: string): Promise<void> {
  if (!project.script) throw new Error("대본이 아직 생성되지 않았습니다.");
  updateProject(projectId, (p) => {
    const s = p.script?.sections.find((s) => s.id === sectionId);
    if (s) s.status = "pending";
  });
  const refreshed = {
    ...project,
    script: {
      ...project.script,
      sections: project.script.sections.map((s) => (s.id === sectionId ? { ...s, status: "pending" as const } : s)),
    },
  };
  await generateFullScript(projectId, refreshed);
}
