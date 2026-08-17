/**
 * 경제·시사 뉴스 기반 롱폼 영상 제작 파이프라인의 데이터 모델.
 *
 * 이 프로젝트는 원래 "야담(전래 이야기)" 롱폼 자동 제작 프로그램이었다. 이번 전환은 콘텐츠
 * 장르를 바꾸는 것이 아니라 파이프라인 자체의 성격을 바꾸는 작업이다 — 야담은 "허구를
 * 그럴듯하게 지어내는" 도구였지만, 경제 뉴스는 "실제 사실을 정확하게 전달"해야 하므로
 * 아래 세 가지가 근본적으로 다르다:
 *
 * 1. 장면(Scene)의 화면 = AI 삽화가 아니라 실제 뉴스사진/차트/그래프/로고/지도 등 실제
 *    자료다(불가능한 경우에만 AI 보조 그래픽으로 대체). → SceneVisualType, visualUrl 등.
 * 2. 대본 문장은 출처 없이 지어내면 안 된다 — 각 섹션이 어떤 뉴스(언론사/날짜/URL)에
 *    근거했는지 추적 가능해야 한다. → SourceRef, ScriptSection.sources.
 * 3. 목표 길이가 100~120분으로 고정되지 않는다 — 사용자가 5~110분 사이에서 고르며, 그
 *    값이 대본 분량/장면 수/렌더링 길이 전체에 그대로 전달된다.
 *
 * 제목 공식·서사 앵글 비중은 "떡상채널 미니북 ② — 경제 채널 시장 실측"(65개 채널·6,975편
 * 전수 통계, 2026-08-03 실측)에서 그대로 가져왔다. 코드를 고칠 때도 이 근거를 먼저 확인할 것.
 */

// 한국어 TTS 낭독 속도. 경제 PDF는 발화 속도를 실측하지 않았으므로(§1~§8 전수 확인 결과
// 언급 없음), 언어 자체의 특성인 이전 야담 실측치(분당 268자, 234~338자 범위로 매우 균질)를
// 그대로 재사용한다 — 장르가 아니라 "한국어 내레이션 속도"에 대한 값이라 재사용이 타당하다.
export const CHARS_PER_MINUTE = 268;

/**
 * 목표 러닝타임(분). PDF §1 실측: 60분+ 영상이 10~20분 대비 중앙 조회수 9.3배, 40~60분(단일
 * 심층편)도 20~40분보다 유리 — "짧게 여러 개보다 길게 하나"가 이 시장의 핵심 공식이다. 다만
 * PDF §7은 60분+의 71%가 "이미 터진 개별 편을 묶은 통합본"이지 처음부터 60분+로 새로 만드는
 * 형태가 아니라고도 밝힌다(§8 실전 함의 ①). 즉 이 프로그램처럼 주제 하나로 새 영상 한 편을
 * 만드는 경우의 실전 권장값은 "개별 편 20~40분 이상"(§8-1)이다.
 *
 * 사용자가 실제로 요청한 길이 옵션(5·10·20·30·60·90·110분)은 그대로 지원하되, 20분 미만을
 * 고르면 PDF 실측 근거(0~10분 중앙 1,471회 vs 40~60분 44,712회)를 UI에서 알려주기만 하고
 * 막지는 않는다 — 사용자의 명시적 요구를 임의로 좁히지 않기 위함이다.
 */
export const LENGTH_PRESETS_MINUTES = [5, 10, 20, 30, 60, 90, 110] as const;
export const MIN_TARGET_MINUTES = 5;
export const MAX_TARGET_MINUTES = 120;
export const DEFAULT_TARGET_MINUTES = 30; // PDF §8-1 "개별 편은 20~40분 이상" 하한 근처

/** 20분 미만을 고르면 UI가 이 문구로 PDF 실측 경고를 보여준다. */
export const SHORT_LENGTH_WARNING_MINUTES = 20;

export const MIN_SCENE_VISUAL_TARGET = 12;
export const MAX_SCENE_VISUAL_TARGET = 160;
export const DEFAULT_SCENE_VISUAL_TARGET = 40;

/**
 * 서사 앵글(전체 영상의 프레이밍). PDF §2 실측: 상위 100편 중 붕괴·몰락 서사가 37%로 압도적
 * 1위(그 외 대비 ×1.22), 그다음 국가/세계경제(19%) · 인물/기업 스토리(18%) · 개념/원리
 * 설명(9%) · 부자/하우투(7%) 순. "쉬운 경제 설명" 같은 담백한 설명형은 오히려 감점(§3).
 */
export type NarrativeAngle = "collapse" | "macro" | "company_story" | "concept_explainer" | "wealth_howto";

export const NARRATIVE_ANGLE_INFO: Record<NarrativeAngle, { label: string; share: string; desc: string }> = {
  collapse: {
    label: "붕괴·몰락",
    share: "37% · 상위 100편 1위",
    desc: '나라·기업·부동산·화폐가 "무너진다·파산·위기·폭락"하는 프레임. 제목에 "몰락"류 단어 포함 시 ×1.22.',
  },
  macro: { label: "국가·세계경제", share: "19%", desc: "국가 단위 거시경제 흐름(환율/금리/무역 등)을 다룬다." },
  company_story: { label: "인물·기업 스토리", share: "18%", desc: "특정 기업/인물의 실제 사건을 중심으로 서사를 구성한다." },
  concept_explainer: { label: "개념·원리 설명", share: "9%", desc: "경제 개념/원리를 설명한다. PDF 실측상 감점 요소가 섞여 있어 상대적으로 불리." },
  wealth_howto: { label: "부자·하우투", share: "7%", desc: "재테크/자산 형성 실전 팁 중심." },
};

/** 결말 스타일 — 사용자가 요청한 대본 구조 9번 항목(핵심 정리) / 8번 항목(향후 전망)에 대응. */
export type EndingStyle = "outlook" | "summary";

export interface EconomicInput {
  /** 사용자가 입력하는 경제 주제/이슈. 필수. */
  topic: string;
  /** 목표 러닝타임(분). LENGTH_PRESETS_MINUTES 중 선택하거나 MIN~MAX 범위 내 자유 입력. */
  targetMinutes: number;
  narrativeAngle: NarrativeAngle;
  endingStyle: EndingStyle;
  /** 참여 유도형 CTA(예: "이 이슈 어떻게 보세요? 댓글로 남겨주세요")를 훅에 넣을지. */
  useEngagementCta: boolean;
  /** 내레이션에 쓸 TTS 목소리 프리셋 이름. */
  voiceName: string;
  /** 목표 장면(시각자료) 개수 — MIN/MAX/DEFAULT_SCENE_VISUAL_TARGET 참고. */
  sceneVisualTarget: number;
  /** 잔잔한 배경음을 깔지 여부(선택 기능, public/audio/bgm/economic/ 폴더 필요). */
  useBgm: boolean;
}

export interface TitleCandidate {
  text: string;
  /** PDF §3 제목 공식 가점/감점 배율 기준 참고 점수. 절대 지표 아님. */
  score: number;
  notes: string[];
}

/**
 * 뉴스/자료 출처 하나. 대본 섹션 또는 장면이 어떤 사실을 어디서 가져왔는지 추적하기 위한
 * 최소 단위 — "Scene 07 / 내용: ... / Source: 언론사·날짜·원문 URL" 형태로 화면에 표시된다.
 */
export interface SourceRef {
  title: string;
  publisher: string;
  /** ISO 날짜 문자열. 리서치 단계에서 확인 못 하면 비워둔다(추측으로 채우지 않음). */
  publishedAt?: string;
  url: string;
  /** 이 출처에서 실제로 대본에 반영한 구체적 사실 한 줄. */
  factUsed: string;
}

/**
 * 리서치(뉴스 조사) 단계 산출물. 대본 생성 전에 한 번 실행되어, 이후 모든 섹션 생성 프롬프트가
 * 이 결과를 근거 자료로 참조한다 — "기사를 찾았다고 그대로 베끼지 않고, 여러 출처의 사실을
 * 종합해 독자적인 설명형 대본을 쓴다"는 요구사항을 지키기 위해 여기서는 헤드라인/발행처/날짜/
 * URL 같은 메타데이터와, 모델이 근거로 삼을 수 있는 짧은 사실 요약만 보관하고 기사 본문 전체를
 * 저장하지 않는다(저작권·표절 방지 + 기사 원문 그대로 베끼는 것을 구조적으로 차단).
 */
export interface ResearchFinding {
  id: string;
  query: string;
  sources: SourceRef[];
  /** 이 조사 결과에서 정리한 사실관계 요약(모델이 종합, 기사 원문 인용 아님). */
  summary: string;
}

export type ScriptSectionKind = "hook" | "chapter" | "summary";
export type SectionStatus = "pending" | "generating" | "done" | "error";

/**
 * 사용자가 요청한 9단계 대본 구조 중, 훅(1번)과 핵심 정리(9번)를 제외한 나머지 7개 관점.
 * 챕터 하나가 여러 관점을 동시에 다룰 수 있다 — 목표 길이가 짧으면(예: 5~10분) 적은 수의
 * 챕터가 여러 관점을 압축해서 다루고, 길면(60~110분) 관점별로 챕터가 늘어난다.
 */
export type EconomicAngle = "situation" | "cause" | "history" | "impact" | "numbers" | "expert" | "outlook";

export const ANGLE_LABEL: Record<EconomicAngle, string> = {
  situation: "지금 무슨 일이 벌어졌는지",
  cause: "왜 이런 일이 발생했는지",
  history: "과거에는 어떤 일이 있었는지",
  impact: "관련 기업·국가·시장에 어떤 영향이 있는지",
  numbers: "실제 숫자와 자료",
  expert: "전문가·시장 관점",
  outlook: "앞으로 어떤 일이 벌어질 수 있는지",
};

export interface ScriptSection {
  id: string;
  kind: ScriptSectionKind;
  /** kind === "chapter"일 때만: 1부터 시작하는 순번. */
  index?: number;
  /** kind === "chapter"일 때만: 이 챕터가 다루는 관점(1개 이상). */
  angles?: EconomicAngle[];
  outlineSummary?: string;
  text: string;
  charCount: number;
  estimatedSeconds: number;
  status: SectionStatus;
  error?: string;
  /** 이 섹션이 근거로 삼은 출처. 리서치 단계 결과 중 이 섹션에 실제로 인용된 것만 담는다. */
  sources: SourceRef[];
}

export interface EconomicScript {
  title: string;
  titleCandidates: TitleCandidate[];
  outline: string;
  sections: ScriptSection[];
  totalCharCount: number;
  estimatedMinutes: number;
}

export type AssetStatus = "pending" | "generating" | "done" | "error";

export interface NarrationChunk {
  id: string;
  text: string;
  status: AssetStatus;
  error?: string;
  filePath?: string;
  sampleRate?: number;
  durationSeconds?: number;
}

/**
 * 장면(Scene)의 화면을 어떤 종류의 실제 자료로 채울지. AI가 대본 문장을 보고 "이 장면에서
 * 무엇을 보여줘야 하는가"를 먼저 판단해 이 값을 정하고, 그 값에 맞는 소싱 파이프라인이
 * 실행된다(fallback_graphic만 AI 이미지 생성 — 나머지는 전부 실제 자료 검색/조회).
 */
export type SceneVisualType =
  | "news_photo" // 실제 인물/장소/사건 사진(Wikimedia Commons 등 공개 라이선스 자료)
  | "company_logo" // 기업 로고
  | "stock_chart" // 실제 주가·환율·금리 등 시계열 차트(실제 수치 기반)
  | "stat_graph" // 통계/경제지표 막대·꺾은선 그래프(실제 수치 기반)
  | "map" // 지도
  | "data_viz" // 표/요약 카드 형태의 데이터 시각화
  | "fallback_graphic"; // 실사진·차트로 표현 불가능한 추상 개념 — AI 보조 인포그래픽(최후 수단)

export const VISUAL_TYPE_LABEL: Record<SceneVisualType, string> = {
  news_photo: "실제 사진",
  company_logo: "기업 로고",
  stock_chart: "실시간 시세 차트",
  stat_graph: "통계 그래프",
  map: "지도",
  data_viz: "데이터 시각화",
  fallback_graphic: "AI 보조 그래픽",
};

export interface Scene {
  id: string;
  sectionId: string;
  /** 같은 섹션 내에서의 순번(0부터). */
  order: number;
  text: string;
  visualType: SceneVisualType;
  /** 검색/조회에 쓸 질의(기업명, 티커, 통계 지표명, 지역명 등) — news_photo/company_logo/map에 사용. */
  visualQuery: string;
  /**
   * stock_chart/stat_graph/data_viz 전용: 리서치에서 확인한 실제 수치/문구(예: "1,480원")와
   * 그 라벨(예: "원/달러 환율"). 지어내지 않고 리서치 단계 근거를 그대로 옮긴 값이어야 한다.
   */
  visualHeadline?: string;
  visualLabel?: string;
  visualStatus: AssetStatus;
  visualError?: string;
  /** public/generated/<projectId>/scenes/<id>.png 상대 URL. */
  visualUrl?: string;
  /** 화면 하단에 표시할 출처 라벨(예: "출처: Stooq · 2026-08-08"). */
  visualSourceLabel?: string;
  visualSourceUrl?: string;
  /** 이 장면이 훅 몽타주로 재활용할 만큼 시각적으로 강한지(대본/장면 생성 단계에서 AI가 표시). */
  isHookWorthy?: boolean;
  narration: NarrationChunk[];
  durationSeconds?: number;
}

export type PipelineStage = "research" | "script" | "scenes" | "visuals" | "narration" | "render" | "done";

export interface StageProgress {
  completed: number;
  total: number;
  failed: number;
}

export type RenderStatus = "idle" | "working" | "ready" | "error";

export interface RenderState {
  status: RenderStatus;
  currentStep?: string;
  progress?: StageProgress;
  videoUrl?: string;
  error?: string;
  warning?: string;
}

export interface ErrorLogEntry {
  at: string;
  stage: PipelineStage;
  unitId?: string;
  message: string;
  retryable: boolean;
}

export interface EconomicProject {
  id: string;
  /** 사용자가 붙인/고칠 수 있는 프로젝트 이름(목록 화면 표시용). 기본값은 topic 앞부분. */
  name: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  input: EconomicInput;
  stage: PipelineStage;
  research?: ResearchFinding[];
  script?: EconomicScript;
  scenes?: Scene[];
  hookNarration?: NarrationChunk[];
  render: RenderState;
  /** 훅 몽타주에 재활용할 본문 장면 id 목록. */
  hookMontageSceneIds?: string[];
  pipelineError?: string;
  errorLog: ErrorLogEntry[];
}
