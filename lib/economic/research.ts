import { searchGoogleNewsRss } from "../common/rssNews";
import { generateText } from "../common/localAI";
import { updateProject } from "./store";
import type { EconomicProject, ResearchFinding, SourceRef } from "./types";

/**
 * 대본을 쓰기 전에 실제 뉴스를 조사하는 단계. 사용자 요청 STEP5 "최신성"·STEP4 "사실관계
 * 추적" 요구사항을 만족하려면 대본 생성이 시작되기 전에 반드시 실행되어야 한다.
 *
 * 한 번의 검색이 아니라 관점별로 나눠 여러 번 검색한다 — "여러 출처를 비교해서 사실관계를
 * 확인"(요청 STEP5)하려면 최소한 최신 동향/배경·원인/영향·전망을 각각 따로 물어봐야 한 번의
 * 검색 결과에 쏠리지 않는다.
 *
 * 검색 자체는 구글 뉴스 RSS(완전 무료, API 키·한도 없음)가 맡고, 그 결과(실제 기사 제목·
 * 언론사·날짜·링크·요약)를 근거로 로컬 LLM(Ollama)이 5~8문장 요약을 쓴다 — "검색은 항상 실제
 * 자료 기반, AI는 그걸 종합해서 설명하는 역할만"이라는 원래 설계를 그대로 유지하면서 Gemini
 * 그라운딩(하루 요청 한도가 매우 낮음)을 무료·무제한 조합으로 대체한 것이다.
 */
const RESEARCH_QUERY_SUFFIXES = [
  { key: "latest", label: "최신 동향", suffix: "최신 뉴스 현재 상황" },
  { key: "background", label: "배경·원인", suffix: "배경 원인" },
  { key: "impact", label: "영향·전망", suffix: "영향 전망 전문가" },
] as const;

function synthesisPrompt(topic: string, suffix: string, articles: { title: string; source: string; pubDate?: string; snippet: string }[]): string {
  const articleBlock = articles
    .map((a, i) => `[${i + 1}] ${a.title} (${a.source}${a.pubDate ? `, ${a.pubDate}` : ""})\n${a.snippet}`)
    .join("\n\n");
  return `당신은 경제 뉴스 방송의 리서치 담당자입니다. 아래는 "${topic}"의 "${suffix}"에 대해
실제로 검색된 기사 목록입니다. 이 기사들만 근거로 5~8문장으로 요약하세요.

[검색된 기사]
${articleBlock || "(검색 결과 없음)"}

[규칙]
- 기사 문장을 그대로 옮기지 말고, 위 기사들에서 확인한 사실을 당신의 말로 재정리하세요.
- 위 기사 목록에 없는 날짜·숫자·수치를 지어내지 마세요. 기사에 없으면 "정확한 수치 미확인"
  이라고 명시하세요.
- 기사끼리 내용이 다르면 어느 쪽이 맞는지 판단하지 말고 둘 다 언급하세요.
- 요약 본문만 출력하세요(제목/머리말 없이).`;
}

export async function researchTopic(projectId: string, project: EconomicProject): Promise<void> {
  const { topic } = project.input;
  const existing = project.research || [];
  const doneKeys = new Set(existing.map((r) => r.query));

  const findings: ResearchFinding[] = [...existing];

  for (const { key, label, suffix } of RESEARCH_QUERY_SUFFIXES) {
    if (doneKeys.has(label)) continue;

    const articles = await searchGoogleNewsRss(`${topic} ${suffix}`, 8);
    const summary =
      articles.length === 0
        ? "이 관점으로는 관련 뉴스를 찾지 못했습니다."
        : (await generateText({ prompt: synthesisPrompt(topic, suffix, articles), temperature: 0.3 })).trim();

    const sources: SourceRef[] = articles.map((a) => ({
      title: a.title,
      publisher: a.source,
      publishedAt: a.pubDate,
      url: a.link,
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

  updateProject(projectId, (p) => {
    p.stage = "script";
  });
}

/** 리서치 결과 전체를 대본 생성 프롬프트에 붙여넣을 텍스트 블록으로 합친다. */
export function formatResearchForPrompt(research: ResearchFinding[]): string {
  if (research.length === 0) return "(리서치 결과 없음 — 일반적으로 알려진 사실 범위에서만 서술하세요.)";
  return research
    .map((f) => {
      const sourceLines = f.sources
        .slice(0, 6)
        .map((s, i) => `  [출처${i + 1}] ${s.publisher} · ${s.title} · ${s.url}`)
        .join("\n");
      return `## ${f.query}\n${f.summary}\n${sourceLines}`;
    })
    .join("\n\n");
}

/** 대본에 인용된 출처를 URL 기준으로 리서치 결과에서 찾아 SourceRef로 되돌린다. */
export function resolveSourcesByUrl(research: ResearchFinding[], urls: string[]): SourceRef[] {
  const all = research.flatMap((f) => f.sources);
  const byUrl = new Map(all.map((s) => [s.url, s]));
  return urls.map((u) => byUrl.get(u)).filter((s): s is SourceRef => Boolean(s));
}

