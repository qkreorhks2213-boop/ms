/**
 * 완전 무료·API 키 불필요 실제 뉴스 검색. 구글 뉴스 RSS는 인증 없이 누구나 호출 가능한
 * 공개 엔드포인트라(공식 API는 아니지만 오랫동안 안정적으로 공개 제공되어온 방식), 이걸로
 * 실제 기사 제목·언론사·발행일·링크·요약(설명)을 가져온다. Gemini 검색 그라운딩과 달리
 * 요청 횟수 한도가 사실상 없다(일반 웹 요청과 동일하게 취급됨).
 */

export interface RssArticle {
  title: string;
  link: string;
  source: string;
  pubDate?: string;
  /** RSS <description>에서 뽑은 짧은 요약(HTML 태그 제거). */
  snippet: string;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function stripHtml(s: string): string {
  return decodeXmlEntities(s.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

function extractTag(itemXml: string, tag: string): string | undefined {
  const match = itemXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (!match) return undefined;
  const raw = match[1].trim();
  const cdataMatch = raw.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  return decodeXmlEntities((cdataMatch ? cdataMatch[1] : raw).trim());
}

function parseRssItems(xml: string): RssArticle[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  return items
    .map((itemXml) => {
      const rawTitle = extractTag(itemXml, "title") || "";
      // 구글 뉴스 제목은 보통 "기사 제목 - 언론사" 형태라, 언론사를 못 뽑았을 때의 보조 추정에 쓴다.
      const titleSourceSplit = rawTitle.split(" - ");
      const sourceTag = extractTag(itemXml, "source");
      const source = sourceTag || titleSourceSplit[titleSourceSplit.length - 1] || "출처 미상";
      // 언론사를 알아냈으면(sourceTag든 split 추정이든) 제목 끝의 "- 언론사" 중복 표기를 뗀다.
      const title = rawTitle.endsWith(` - ${source}`) ? rawTitle.slice(0, -(source.length + 3)) : rawTitle;
      const link = extractTag(itemXml, "link") || "";
      const pubDate = extractTag(itemXml, "pubDate");
      const description = extractTag(itemXml, "description") || "";
      return {
        title,
        link,
        source,
        pubDate,
        snippet: stripHtml(description) || rawTitle,
      };
    })
    .filter((a) => a.link);
}

/**
 * 구글 뉴스 RSS 검색. hl/gl/ceid를 한국어·한국으로 고정해 한국어 기사를 우선 받는다.
 * 링크는 news.google.com을 경유하는 리디렉션 URL이다(원문 URL이 아님) — 다만 실제로 원문
 * 기사로 이동은 되고, 이건 RSS 기반 무료 검색이 갖는 알려진 제약이다(README에 명시).
 */
export async function searchGoogleNewsRss(query: string, max = 8): Promise<RssArticle[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; EconomicDocuStudio/1.0)" } });
  if (!res.ok) {
    throw new Error(`뉴스 RSS 검색 실패(HTTP ${res.status}): ${url}`);
  }
  const xml = await res.text();
  return parseRssItems(xml).slice(0, max);
}
