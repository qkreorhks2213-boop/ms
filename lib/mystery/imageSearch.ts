/**
 * 실제 인물/기업/장소 사진, 로고, 지도 이미지를 웹에서 검색해 가져오는 기능이다.
 *
 * 기본 경로는 위키미디어 공용(Wikimedia Commons) 검색 API다 — 키 발급도, 결제도, 요청 한도
 * 걱정도 없는 완전 무료 공개 API라 이 프로젝트를 "구글 API 없이도 되게" 만드는 목표에 맞는
 * 기본값이다. 다만 위키미디어에는 최신 뉴스 사진(예: 오늘 열린 기자회견 사진)이 없는 경우가
 * 많다 — 백과사전형 공용 저장소라 인물/기업 로고/지도/역사적 사진에는 강하지만 "이번 주
 * 뉴스 현장 사진" 커버리지는 약하다. 검색 결과가 없으면 visuals.ts가 데이터 카드로 대체한다.
 *
 * Google Custom Search(선택, 유료 가능성 있음)는 여전히 지원한다 — 설정되어 있으면 위키미디어
 * 에서 못 찾았을 때 두 번째로 시도한다. 설정 안 하면 완전히 건너뛴다(기본값이 아니므로 무료
 * 흐름에 영향 없음).
 */

export interface ImageSearchResult {
  imageUrl: string;
  contextUrl: string;
  title: string;
}

export function isImageSearchConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CSE_API_KEY && process.env.GOOGLE_CSE_CX);
}

/** 위키미디어 공용에서 이미지를 검색한다. 키 불필요, 완전 무료. */
export async function searchWikimediaImage(query: string): Promise<ImageSearchResult | null> {
  try {
    const searchUrl = new URL("https://commons.wikimedia.org/w/api.php");
    searchUrl.searchParams.set("action", "query");
    searchUrl.searchParams.set("list", "search");
    searchUrl.searchParams.set("srnamespace", "6"); // File: 네임스페이스만
    searchUrl.searchParams.set("srlimit", "1");
    searchUrl.searchParams.set("srsearch", `${query} filetype:bitmap`);
    searchUrl.searchParams.set("format", "json");

    const searchRes = await fetch(searchUrl.toString(), {
      headers: { "User-Agent": "EconomicDocuStudio/1.0 (local video pipeline)" },
    });
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const title: string | undefined = searchData?.query?.search?.[0]?.title;
    if (!title) return null;

    const infoUrl = new URL("https://commons.wikimedia.org/w/api.php");
    infoUrl.searchParams.set("action", "query");
    infoUrl.searchParams.set("titles", title);
    infoUrl.searchParams.set("prop", "imageinfo");
    infoUrl.searchParams.set("iiprop", "url");
    infoUrl.searchParams.set("iiurlwidth", "1600");
    infoUrl.searchParams.set("format", "json");

    const infoRes = await fetch(infoUrl.toString(), {
      headers: { "User-Agent": "EconomicDocuStudio/1.0 (local video pipeline)" },
    });
    if (!infoRes.ok) return null;
    const infoData = await infoRes.json();
    const pages = infoData?.query?.pages || {};
    const page: any = Object.values(pages)[0];
    const info = page?.imageinfo?.[0];
    const imageUrl: string | undefined = info?.thumburl || info?.url;
    if (!imageUrl) return null;

    return {
      imageUrl,
      contextUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
      title: title.replace(/^File:/, ""),
    };
  } catch {
    return null;
  }
}

export async function searchGoogleCseImage(query: string): Promise<ImageSearchResult | null> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX;
  if (!apiKey || !cx) return null;

  try {
    const url = new URL("https://customsearch.googleapis.com/customsearch/v1");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("cx", cx);
    url.searchParams.set("q", query);
    url.searchParams.set("searchType", "image");
    url.searchParams.set("num", "1");
    url.searchParams.set("safe", "active");

    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    const item = data?.items?.[0];
    if (!item?.link) return null;
    return { imageUrl: item.link, contextUrl: item.image?.contextLink || item.link, title: item.title || query };
  } catch {
    return null;
  }
}

export async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`이미지 다운로드 실패(HTTP ${res.status}): ${url}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
