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
  source?: "wikimedia" | "archive" | "government" | "museum" | "google";
  publisher?: string;
  date?: string;
  license?: string;
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

/**
 * Archive.org에서 역사 자료 검색.
 *
 * 신문, 사진, 문서 등 역사 아카이브 자료를 검색한다.
 */
export async function searchArchiveOrgImage(
  query: string
): Promise<ImageSearchResult | null> {
  try {
    const searchUrl = new URL("https://archive.org/advancedsearch.php");
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("fl", ["identifier", "title", "date", "mediatype"].join(","));
    searchUrl.searchParams.set("output", "json");
    searchUrl.searchParams.set("rows", "1");

    const res = await fetch(searchUrl.toString());
    if (!res.ok) return null;
    const data = await res.json();

    const doc = data?.response?.docs?.[0];
    if (!doc) return null;

    // Archive.org에서 이미지 URL 구성
    const imageUrl = `https://archive.org/download/${doc.identifier}/`;
    const contextUrl = `https://archive.org/details/${doc.identifier}/`;

    return {
      imageUrl,
      contextUrl,
      title: doc.title || query,
      source: "archive",
      date: doc.date,
      publisher: "archive.org",
    };
  } catch {
    return null;
  }
}

/**
 * 정부 오픈 데이터에서 자료 검색.
 *
 * 미국 국립기록청(NARA), 영국 국립기록보관소 등에서 검색.
 */
export async function searchGovernmentArchives(
  query: string
): Promise<ImageSearchResult | null> {
  try {
    // 미국 NARA 검색
    const nara = await searchNARA(query);
    if (nara) return nara;

    // 영국 국립기록보관소
    const ukna = await searchUKNA(query);
    if (ukna) return ukna;

    return null;
  } catch {
    return null;
  }
}

/**
 * NARA (National Archives and Records Administration) 검색.
 */
async function searchNARA(query: string): Promise<ImageSearchResult | null> {
  try {
    const searchUrl = new URL("https://catalog.archives.gov/api/v1/");
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("rows", "1");

    const res = await fetch(searchUrl.toString());
    if (!res.ok) return null;
    const data = await res.json();

    const doc = data?.opaResponse?.docs?.[0];
    if (!doc) return null;

    // 썸네일 이미지 구성
    const imageUrl = doc.thumbnail || `https://catalog.archives.gov/thumb/${doc.naId}`;
    const contextUrl = `https://catalog.archives.gov/id/${doc.naId}`;

    return {
      imageUrl,
      contextUrl,
      title: doc.title || query,
      source: "government",
      date: doc.createdAt,
      publisher: "National Archives (US)",
    };
  } catch {
    return null;
  }
}

/**
 * 영국 국립기록보관소 검색.
 */
async function searchUKNA(query: string): Promise<ImageSearchResult | null> {
  try {
    const searchUrl = new URL("https://discovery.nationalarchives.gov.uk/api/search");
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("rows", "1");

    const res = await fetch(searchUrl.toString());
    if (!res.ok) return null;
    const data = await res.json();

    const doc = data?.hits?.hits?.[0];
    if (!doc) return null;

    const source = doc._source;
    return {
      imageUrl: source.image_url || "",
      contextUrl: `https://discovery.nationalarchives.gov.uk/details/r/${source.reference}`,
      title: source.title || query,
      source: "government",
      date: source.date,
      publisher: "The National Archives (UK)",
    };
  } catch {
    return null;
  }
}

/**
 * 박물관 API에서 검색.
 *
 * 스미소니언, 대영박물관 등의 개방형 수집품 검색.
 */
export async function searchMuseumArchives(
  query: string
): Promise<ImageSearchResult | null> {
  try {
    // 스미소니언 검색
    const smithsonian = await searchSmithsonian(query);
    if (smithsonian) return smithsonian;

    // 대영박물관
    const british = await searchBritishMuseum(query);
    if (british) return british;

    return null;
  } catch {
    return null;
  }
}

/**
 * 스미소니언 박물관 검색.
 */
async function searchSmithsonian(
  query: string
): Promise<ImageSearchResult | null> {
  try {
    const searchUrl = new URL("https://api.si.edu/openaccess/api/v1.0/search");
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("api_key", process.env.SMITHSONIAN_API_KEY || "DEMO_KEY");

    const res = await fetch(searchUrl.toString());
    if (!res.ok) return null;
    const data = await res.json();

    const item = data?.response?.docs?.[0];
    if (!item) return null;

    const imageUrl = item.images?.[0]?.thumbnail || "";
    const contextUrl = item.url || "";

    return {
      imageUrl,
      contextUrl,
      title: item.title || query,
      source: "museum",
      date: item.date,
      publisher: "Smithsonian Institution",
      license: item.rights || "CC0",
    };
  } catch {
    return null;
  }
}

/**
 * 대영박물관 검색.
 */
async function searchBritishMuseum(
  query: string
): Promise<ImageSearchResult | null> {
  try {
    const searchUrl = new URL("https://collection.britishmuseum.org/api/search");
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("limit", "1");

    const res = await fetch(searchUrl.toString());
    if (!res.ok) return null;
    const data = await res.json();

    const object = data?.results?.[0];
    if (!object) return null;

    const imageUrl = object.image || "";
    const contextUrl = object.url || "";

    return {
      imageUrl,
      contextUrl,
      title: object.title || query,
      source: "museum",
      date: object.date_period || "",
      publisher: "The British Museum",
      license: "CC BY-NC-SA 4.0",
    };
  } catch {
    return null;
  }
}

/**
 * 신문 아카이브에서 검색.
 */
export async function searchNewspaperArchives(
  query: string
): Promise<ImageSearchResult | null> {
  try {
    // Chronicling America (미국 신문)
    const chronicling = await searchChroniclingAmerica(query);
    if (chronicling) return chronicling;

    return null;
  } catch {
    return null;
  }
}

/**
 * Chronicling America에서 신문 검색.
 */
async function searchChroniclingAmerica(
  query: string
): Promise<ImageSearchResult | null> {
  try {
    const searchUrl = new URL("https://chroniclingamerica.loc.gov/search/pages/results/");
    searchUrl.searchParams.set("andtext", query);
    searchUrl.searchParams.set("format", "json");
    searchUrl.searchParams.set("rows", "1");

    const res = await fetch(searchUrl.toString());
    if (!res.ok) return null;
    const data = await res.json();

    const item = data?.items?.[0];
    if (!item) return null;

    return {
      imageUrl: item.jp2 || "",
      contextUrl: item.id || "",
      title: item.title || query,
      source: "archive",
      date: item.date,
      publisher: `${item.newspaper_title} (${item.state})`,
      license: "Public Domain",
    };
  } catch {
    return null;
  }
}

/**
 * 다중 소스에서 검색하고 결과를 통합.
 *
 * 신뢰도 순서:
 * 1. 정부 아카이브
 * 2. 박물관
 * 3. 신문 아카이브
 * 4. Archive.org
 * 5. Wikimedia
 */
export async function searchRealAssets(
  query: string
): Promise<ImageSearchResult[]> {
  const results: ImageSearchResult[] = [];

  // 병렬로 모든 소스에서 검색
  const [government, museum, newspaper, archive, wikimedia] =
    await Promise.allSettled([
      searchGovernmentArchives(query),
      searchMuseumArchives(query),
      searchNewspaperArchives(query),
      searchArchiveOrgImage(query),
      searchWikimediaImage(query),
    ]);

  // 결과 수집 (실패해도 계속 진행)
  if (government.status === "fulfilled" && government.value) {
    results.push(government.value);
  }
  if (museum.status === "fulfilled" && museum.value) {
    results.push(museum.value);
  }
  if (newspaper.status === "fulfilled" && newspaper.value) {
    results.push(newspaper.value);
  }
  if (archive.status === "fulfilled" && archive.value) {
    results.push(archive.value);
  }
  if (wikimedia.status === "fulfilled" && wikimedia.value) {
    results.push(wikimedia.value);
  }

  return results;
}
