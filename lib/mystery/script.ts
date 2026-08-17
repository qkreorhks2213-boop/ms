import { generateText, generateJson } from "../common/localAI";
import { formatResearchForPrompt } from "./research";
import { updateProject } from "./store";
import { enrichSectionsWithMetadata } from "./scriptAnalysis";
import { generateOfflineScript } from "./script-offline";
import {
  CHARS_PER_MINUTE,
  type MysteryInput,
  type MysteryProject,
  type ScriptSection,
  type MysteryScript,
  type MysteryChapterType,
} from "./types";

/**
 * 미스터리 대본 생성.
 *
 * 경제 버전의 구조를 기반으로 하되, 미스터리 특화 챕터 구조를 사용한다.
 */

const MIN_HOOK_SECONDS = 20;
const MAX_HOOK_SECONDS = 60;
const HOOK_SHARE = 0.08;

const MIN_ENDING_MINUTES = 1;
const MAX_ENDING_MINUTES = 3;
const ENDING_SHARE = 0.04;

const MIN_CHAPTERS = 3;
const MAX_CHAPTERS = 16;
const IDEAL_CHAPTER_MINUTES = 6;

// 미스터리 챕터 순서
const MYSTERY_CHAPTER_TYPES: MysteryChapterType[] = [
  "background",        // 배경
  "main_event",        // 핵심 사건
  "first_mystery",     // 첫 번째 미스터리
  "evidence_1",        // 첫 번째 증거
  "new_question",      // 새로운 의문
  "hidden_background", // 숨겨진 배경
  "evidence_2",        // 추가 증거
  "unexpected",        // 예상하지 못한 전개
  "hypotheses",        // 여러 가설
  "key_evidence",      // 결정적 증거
  "twist",             // 반전
  "analysis",          // 분석
  "remaining",         // 남은 의문
];

function estimateSeconds(charCount: number): number {
  const minutes = charCount / CHARS_PER_MINUTE;
  return Math.round(minutes * 60);
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

async function generateOutline(
  topic: string,
  caseType: string,
  researchText: string,
  chapterCount: number
): Promise<string[]> {
  const prompt = `당신은 미스터리 다큐멘터리 작가입니다. "${topic}" (${caseType})에 대한 ${chapterCount}개 챕터 아웃라인을 작성하세요.

[리서치 결과]
${researchText}

[챕터 구조]
1. 배경 - 사건의 역사적 배경과 맥락
2. 핵심 사건 - 실제로 일어난 일
3. 첫 미스터리 - 가장 이상한 점
4. 첫 증거 - 현장의 증거들
5. 새로운 의문 - 증거가 제기하는 질문
6. 숨겨진 배경 - 사건 뒤의 배경
7. 추가 증거 - 더 많은 단서들
8. 예상하지 못한 전개 - 예기치 못한 반전
9. 여러 가설 - 가능한 설명들
10. 결정적 증거 - 핵심 단서
11. 반전 - 새로운 사실의 발견
12. 분석 - 논리적 분석
13. 남은 의문 - 풀리지 않은 미스터리

각 챕터를 한 줄 요약으로 작성하세요. JSON 배열로만 출력하세요.`;

  const result = await generateJson<any>({ prompt, temperature: 0.7 });
  const outlines = Array.isArray(result) ? result : (result.chapters || result.outlines || []);
  return outlines
    .slice(0, chapterCount)
    .map((o: any) => (typeof o === "string" ? o : o.summary || o.title || ""));
}

async function generateHook(
  topic: string,
  researchText: string,
  hookSeconds: number
): Promise<string> {
  const hookTargetChars = Math.round((hookSeconds / 60) * CHARS_PER_MINUTE);

  const prompt = `당신은 미스터리 다큐 오프닝 작가입니다. "${topic}"의 가장 충격적이고 궁금증 자극적인 실제 사실로 시작해 강력한 오프닝을 작성하세요.

[리서치]
${researchText}

[규칙]
- 한국어 기준 약 ${hookSeconds}초 분량(약 ${hookTargetChars}자)
- 지어낸 사실 금지, 리서치에서 확인된 것만
- 차분한 톤, 정중한 구어체
- "이 영상에서 무엇을 다룰지" 강하게 예고

내레이션만 출력.`;

  return generateText({ prompt, temperature: 0.7 });
}

async function generateChapters(
  topic: string,
  researchText: string,
  outlines: string[],
  chapterCount: number,
  targetChars: number
): Promise<string[]> {
  const prompt = `당신은 미스터리 다큐 본편 작가입니다. 차분하고 신뢰감 있는 톤으로 ${chapterCount}개 챕터를 순서대로 작성하세요.

[리서치]
${researchText}

[각 챕터 개요]
${outlines.map((o, i) => `${i + 1}. ${o}`).join("\n")}

[규칙]
- 리서치에서 확인된 사실만, 지어낸 것 금지
- 각 챕터 약 ${targetChars}자
- 정중한 구어체
- "이 부분부터는 증언의 영역입니다" 같은 팩트체크 표현 활용
- 시청자가 계속 궁금해하도록 구성

JSON 배열로만: ["챕터1...", "챕터2...", ...]`;

  const result = await generateJson<any>({ prompt, temperature: 0.7 });
  const chapters = Array.isArray(result) ? result : (result.chapters || []);
  return chapters
    .slice(0, chapterCount)
    .map((c: any) => (typeof c === "string" ? c : c.text || c.content || ""));
}

async function generateEnding(
  topic: string,
  researchText: string,
  endingStyle: string,
  endingMinutes: number
): Promise<string> {
  let toneInstructions = "";
  if (endingStyle === "confirmed_facts") {
    toneInstructions = "현재까지 확인되는 사실을 간결하게 정리하며 마무리하세요.";
  } else if (endingStyle === "most_likely") {
    toneInstructions = "가장 가능성 높은 설명을 논리적으로 제시하며 마무리하세요.";
  } else if (endingStyle === "compare_hypotheses") {
    toneInstructions = "여러 가설의 장단점을 비교하며 마무리하세요.";
  } else if (endingStyle === "unsolved") {
    toneInstructions = "이 미스터리가 아직도 풀리지 않음을 강조하며 마무리하세요.";
  } else {
    toneInstructions = "열린 결말로 시청자의 상상의 여지를 남기며 마무리하세요.";
  }

  const prompt = `미스터리 다큐 엔딩입니다. ${toneInstructions}

[리서치]
${researchText}

한국어 기준 약 ${Math.round(endingMinutes * CHARS_PER_MINUTE)}자. 내레이션만 출력.`;

  return generateText({ prompt, temperature: 0.6 });
}

export async function generateScript(projectId: string, project: MysteryProject): Promise<void> {
  const { topic, targetMinutes, caseType, endingStyle } = project.input;
  const research = project.research || [];

  if (research.length === 0) {
    throw new Error("리서치가 완료되지 않았습니다.");
  }

  const researchText = formatResearchForPrompt(research);
  const hookSeconds = hookSecondsFor(targetMinutes);
  const endingMinutes = endingMinutesFor(targetMinutes);
  const chapterCount = chapterCountFor(targetMinutes);

  // 챕터용 목표 시간 계산 (정확한 단위 사용)
  const hookMinutes = hookSeconds / 60;
  const chaptersTotalMinutes = targetMinutes - hookMinutes - endingMinutes;
  const targetCharsPerChapter = Math.round((chaptersTotalMinutes / chapterCount) * CHARS_PER_MINUTE);

  console.log(`[mystery] 스크립트 생성 시작: ${topic} (${chapterCount}개 챕터, 목표 ${targetMinutes}분)`);

  let sections: ScriptSection[] = [];
  let outlines: string[] = [];

  // Try LLM first, fall back to offline if it fails
  try {
    // 아웃라인
    console.log(`[mystery] 아웃라인 생성...`);
    outlines = await generateOutline(topic, caseType, researchText, chapterCount);

    let sectionIndex = 0;

    // 훅 - 필수
    console.log(`[mystery] 훅 생성...`);
    let hookText = "";
    try {
      hookText = await generateHook(topic, researchText, hookSeconds);
      if (!hookText || hookText.trim().length === 0) {
        throw new Error("Hook text is empty");
      }
      const hookChars = hookText.length;
      sections.push({
        id: `hook-${sectionIndex}`,
        kind: "hook",
        text: hookText,
        charCount: hookChars,
        estimatedSeconds: estimateSeconds(hookChars),
        status: "done",
        sources: research.flatMap((r) => r.sources).slice(0, 3),
      });
      sectionIndex++;
    } catch (err: any) {
      throw new Error(`[CRITICAL] Hook generation failed: ${err?.message}`);
    }

    // 챕터 - 필수
    console.log(`[mystery] ${chapterCount}개 챕터 생성...`);
    let chapters: string[] = [];
    try {
      chapters = await generateChapters(topic, researchText, outlines, chapterCount, targetCharsPerChapter);
      if (!Array.isArray(chapters) || chapters.length === 0) {
        throw new Error("No chapters generated");
      }
      if (chapters.length !== chapterCount) {
        throw new Error(`Expected ${chapterCount} chapters, got ${chapters.length}`);
      }

      for (let i = 0; i < chapters.length; i++) {
        const chapterText = chapters[i];
        if (!chapterText || chapterText.trim().length === 0) {
          throw new Error(`Chapter ${i} is empty`);
        }
        const chapterType = MYSTERY_CHAPTER_TYPES[i % MYSTERY_CHAPTER_TYPES.length];
        sections.push({
          id: `chapter-${i}`,
          kind: "chapter",
          index: i + 1,
          chapterType,
          outlineSummary: outlines[i] || "",
          text: chapterText,
          charCount: chapterText.length,
          estimatedSeconds: estimateSeconds(chapterText.length),
          status: "done",
          sources: research.flatMap((r) => r.sources).slice(0, 3),
        });
        sectionIndex++;
      }
    } catch (err: any) {
      throw new Error(`[CRITICAL] Chapter generation failed: ${err?.message}`);
    }

    // 결말 - 필수
    console.log(`[mystery] 결말 생성...`);
    let endingText = "";
    try {
      endingText = await generateEnding(topic, researchText, endingStyle, endingMinutes);
      if (!endingText || endingText.trim().length === 0) {
        throw new Error("Ending text is empty");
      }
      sections.push({
        id: `ending-${sectionIndex}`,
        kind: "summary",
        text: endingText,
        charCount: endingText.length,
        estimatedSeconds: estimateSeconds(endingText.length),
        status: "done",
        sources: research.flatMap((r) => r.sources).slice(0, 3),
      });
    } catch (err: any) {
      throw new Error(`[CRITICAL] Ending generation failed: ${err?.message}`);
    }
  } catch (llmErr: any) {
    console.error(`[mystery] LLM 스크립트 생성 실패:`, llmErr?.message);
    throw new Error(`[CRITICAL] Script generation failed: ${llmErr?.message}. Cannot proceed with offline fallback.`);
  }

  if (sections.length === 0) {
    throw new Error("스크립트 생성에 실패했습니다.");
  }

  const totalChars = sections.reduce((sum, s) => sum + s.charCount, 0);
  const estimatedMinutes = totalChars / CHARS_PER_MINUTE;

  // 목표 길이 검증
  const minAllowedMinutes = targetMinutes * 0.9;
  const maxAllowedMinutes = targetMinutes * 1.1;

  if (estimatedMinutes < minAllowedMinutes || estimatedMinutes > maxAllowedMinutes) {
    throw new Error(
      `[CRITICAL] Script length validation failed: ` +
      `target=${targetMinutes.toFixed(1)}min, ` +
      `actual=${estimatedMinutes.toFixed(1)}min, ` +
      `allowed=${minAllowedMinutes.toFixed(1)}-${maxAllowedMinutes.toFixed(1)}min`
    );
  }

  // 섹션 메타데이터 보강 (visualOrigin, factStatus 추론)
  const enrichedSections = enrichSectionsWithMetadata(sections);

  const script: MysteryScript = {
    title: `${topic} - 미스터리 다큐`,
    outline: outlines.join("\n"),
    sections: enrichedSections,
    totalCharCount: totalChars,
    estimatedMinutes,
  };

  updateProject(projectId, (p) => {
    p.script = script;
    p.stage = "script";
  });

  console.log(`[mystery] 스크립트 생성 완료: ${sections.length}개 섹션, 총 ${estimatedMinutes.toFixed(1)}분`);
}
