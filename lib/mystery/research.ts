import { searchGoogleNewsRss } from "../common/rssNews";
import { generateText } from "../common/localAI";
import { updateProject } from "./store";
import type { MysteryProject, ResearchFinding, SourceRef, TimelineEvent, FactStatus } from "./types";

/**
 * 미스터리 사건 조사 단계.
 *
 * 경제 뉴스와 달리 미스터리는 최신 뉴스만으로는 부족하다.
 * 다음 관점으로 나눠 검색한다:
 * 1. 사건 개요
 * 2. 공식 기록
 * 3. 관련 인물
 * 4. 시간순 기록
 * 5. 증언
 * 6. 사진/영상 자료
 * 7. 공식 조사 결과
 * 8. 반론/반박
 * 9. 현재 연구
 * 10. 미스터리 주장
 */
const RESEARCH_QUERY_SUFFIXES = [
  { key: "overview", label: "사건 개요", suffix: "사건 개요 배경" },
  { key: "official", label: "공식 기록", suffix: "공식 기록 정부 군" },
  { key: "persons", label: "관련 인물", suffix: "주요 인물 등장인물" },
  { key: "timeline", label: "사건 기록", suffix: "사건 시간순서 연대기" },
  { key: "testimony", label: "증언", suffix: "증언 목격자 진술" },
  { key: "evidence", label: "증거 자료", suffix: "증거 사진 영상 기록" },
  { key: "investigation", label: "조사 결과", suffix: "조사 결과 보고서" },
  { key: "controversy", label: "논쟁", suffix: "논쟁 의문 반박" },
  { key: "research", label: "연구", suffix: "연구 분석 학술" },
  { key: "theories", label: "미스터리 주장", suffix: "미스터리 설명 가설" },
] as const;

function synthesisPrompt(
  topic: string,
  suffix: string,
  articles: { title: string; source: string; pubDate?: string; snippet: string }[]
): string {
  return `당신은 미스터리 사건 조사 담당자입니다. 아래는 "${topic}"의 "${suffix}"에 대해
실제로 검색된 기사 및 자료 목록입니다. 이 자료들만 근거로 3~5문장으로 정리하세요.

[검색된 자료]
${articles.length === 0 ? "(검색 결과 없음)" : articles.map((a, i) => `[${i + 1}] ${a.title} (${a.source}${a.pubDate ? `, ${a.pubDate}` : ""})\n${a.snippet}`).join("\n\n")}

[규칙]
- 기사 문장을 그대로 옮기지 말고, 위 자료들에서 확인한 사실을 재정리하세요.
- 위 목록에 없는 날짜·숫자·사실을 지어내지 마세요.
- 출처마다 내용이 다르면 그 차이를 명시하세요.
- 요약 본문만 출력하세요.`;
}

function timelinePrompt(topic: string, research: ResearchFinding[]): string {
  const researchBlock = research
    .map((f) => `## ${f.query}\n${f.summary}`)
    .join("\n\n");

  return `당신은 미스터리 사건의 타임라인을 정리하는 담당자입니다.

아래는 "${topic}"에 대한 리서치 결과입니다:

${researchBlock}

이 정보만 근거로 사건의 타임라인을 JSON 형식으로 정렬하세요.
각 이벤트는 다음 형식이어야 합니다:
{
  "events": [
    {
      "date": "YYYY-MM-DD 또는 YYYY-MM 또는 YYYY",
      "title": "사건 제목",
      "description": "설명",
      "status": "FACT|SUPPORTED|TESTIMONY|CLAIM|DISPUTED|UNVERIFIED"
    }
  ]
}

[규칙]
- 날짜는 문헌에서 확인된 것만 포함하세요.
- 불명확한 날짜는 "YYYY-?" 형식으로 표기하세요.
- status: FACT(공식 기록), TESTIMONY(증언만), CLAIM(주장), DISPUTED(의견 상충), UNVERIFIED(미확인)
- 연대순으로 정렬하세요.
- 최대 20개 이벤트.`;
}

function factcheckPrompt(topic: string, research: ResearchFinding[]): string {
  const researchBlock = research
    .map((f) => `## ${f.query}\n${f.summary}`)
    .join("\n\n");

  return `당신은 미스터리 사건의 주요 주장을 팩트체크하는 담당자입니다.

주제: "${topic}"

리서치 결과:
${researchBlock}

이 주제와 관련된 주요 주장들을 식별하고, 각 주장의 검증 상태를 판단하세요.

응답 형식 (JSON):
{
  "claims": [
    {
      "claim": "주장 내용",
      "status": "FACT|SUPPORTED|TESTIMONY|CLAIM|DISPUTED|UNVERIFIED|FALSE",
      "reason": "판단 근거"
    }
  ]
}

[status 정의]
- FACT: 공식 기록이나 여러 독립적 출처로 확인됨
- SUPPORTED: 신뢰할 수 있는 출처로 뒷받침됨
- TESTIMONY: 특정인의 증언으로만 확인됨
- CLAIM: 주장되지만 독립적 근거가 없음
- DISPUTED: 출처마다 내용이 다름
- UNVERIFIED: 확인되지 않음
- FALSE: 거짓으로 입증됨

[규칙]
- 리서치에 명시된 사실만 평가하세요.
- 최대 10개 주요 주장.`;
}

export async function researchTopic(projectId: string, project: MysteryProject): Promise<void> {
  const { topic } = project.input;
  const existing = project.research || [];
  const doneKeys = new Set(existing.map((r) => r.query));

  const findings: ResearchFinding[] = [...existing];

  // 각 관점별로 리서치 실행
  for (const { key, label, suffix } of RESEARCH_QUERY_SUFFIXES) {
    if (doneKeys.has(label)) continue;

    console.log(`[mystery] 리서칭: ${topic} - ${label}`);

    const articles = await searchGoogleNewsRss(`${topic} ${suffix}`, 8);
    const summary =
      articles.length === 0
        ? `이 관점("${suffix}")으로는 관련 자료를 찾지 못했습니다.`
        : (await generateText({ prompt: synthesisPrompt(topic, suffix, articles), temperature: 0.3 })).trim();

    const sources: SourceRef[] = articles.map((a) => ({
      title: a.title,
      publisher: a.source,
      publishedAt: a.pubDate,
      url: a.link,
      sourceType: "major_media",
      reliability: "medium",
      factUsed: a.snippet.slice(0, 200),
    }));

    const finding: ResearchFinding = {
      id: `research-${key}`,
      query: label,
      sources,
      summary,
    };
    findings.push(finding);

    updateProject(projectId, (p) => {
      p.research = [...(p.research || []).filter((f) => f.id !== finding.id), finding];
    });
  }

  // 타임라인 생성
  console.log(`[mystery] 타임라인 생성: ${topic}`);
  try {
    const timelineJson = await generateText({
      prompt: timelinePrompt(topic, findings),
      temperature: 0.2,
    });
    const parsed = JSON.parse(timelineJson);
    const timeline: TimelineEvent[] = (parsed.events || []).map((e: any, i: number) => ({
      id: `event-${i}`,
      date: e.date || "",
      title: e.title || "",
      description: e.description || "",
      sources: [],
      status: (e.status || "UNVERIFIED") as FactStatus,
    }));

    updateProject(projectId, (p) => {
      p.timeline = timeline;
    });
  } catch (err) {
    console.warn(`[mystery] 타임라인 생성 실패:`, err);
  }

  // 팩트체크 실행
  console.log(`[mystery] 팩트체크: ${topic}`);
  try {
    const factcheckJson = await generateText({
      prompt: factcheckPrompt(topic, findings),
      temperature: 0.2,
    });
    const parsed = JSON.parse(factcheckJson);
    const factcheckResults: Record<string, FactStatus> = {};
    (parsed.claims || []).forEach((c: any) => {
      if (c.claim) {
        factcheckResults[c.claim] = c.status || "UNVERIFIED";
      }
    });

    updateProject(projectId, (p) => {
      p.factcheckResults = factcheckResults;
    });
  } catch (err) {
    console.warn(`[mystery] 팩트체크 실패:`, err);
  }

  updateProject(projectId, (p) => {
    p.stage = "factcheck";
  });
}

export function formatResearchForPrompt(research: ResearchFinding[]): string {
  if (research.length === 0) return "(리서치 결과 없음)";
  return research
    .map((f) => {
      const sourceLines = f.sources
        .slice(0, 6)
        .map((s, i) => `  [${i + 1}] ${s.publisher} · ${s.title} · ${s.url}`)
        .join("\n");
      return `## ${f.query}\n${f.summary}\n${sourceLines}`;
    })
    .join("\n\n");
}

export function resolveSourcesByUrl(research: ResearchFinding[], urls: string[]): SourceRef[] {
  const all = research.flatMap((f) => f.sources);
  const byUrl = new Map(all.map((s) => [s.url, s]));
  return urls.map((u) => byUrl.get(u)).filter((s): s is SourceRef => Boolean(s));
}
