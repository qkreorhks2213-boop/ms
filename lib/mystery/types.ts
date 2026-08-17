/**
 * 실화 기반 미스터리 다큐멘터리 자동 제작 프로젝트의 데이터 모델.
 *
 * 이 프로그램은 미스터리 사건을 입력받아 자동으로:
 * 사건 조사 → 팩트체크 → 타임라인 → 대본 생성 → 장면 분할 → 시각자료 수집/생성
 * → 내레이션 → 편집 → 렌더링까지 처리합니다.
 *
 * 경제 롱폼 파이프라인을 기반으로 하되, 미스터리/사건 콘텐츠에 맞게 조정되었습니다:
 * 1. 출처: 실제 기록, 공식 자료, 증언 등을 구분 관리
 * 2. 팩트체크: 각 주장을 FACT/TESTIMONY/CLAIM/DISPUTED/UNVERIFIED로 분류
 * 3. 타임라인: 사건의 시간 순서 관리
 * 4. 시각자료: 실제 자료 > 그래픽 > AI 재현 순서로 우선 사용
 */

// 한국어 TTS 낭독 속도 (경제 버전에서 재사용)
export const CHARS_PER_MINUTE = 268;

/**
 * 목표 러닝타임(분). 사용자가 선택하거나 직접 입력할 수 있다.
 */
export const LENGTH_PRESETS_MINUTES = [5, 10, 15, 20, 30, 40, 60, 90, 110] as const;
export const MIN_TARGET_MINUTES = 5;
export const MAX_TARGET_MINUTES = 120;
export const DEFAULT_TARGET_MINUTES = 30;

/** 5분 미만을 고르면 경고를 보여준다. */
export const SHORT_LENGTH_WARNING_MINUTES = 5;

export const MIN_SCENE_VISUAL_TARGET = 12;
export const MAX_SCENE_VISUAL_TARGET = 160;
export const DEFAULT_SCENE_VISUAL_TARGET = 40;

/**
 * 미스터리 콘텐츠 유형.
 */
export type MysteryType =
  | "unsolved_case"     // 미제사건
  | "missing_person"    // 실종사건
  | "historical_mystery" // 역사적 미스터리
  | "legend_folklore"   // 괴담/전설
  | "military_mystery"  // 군사 미스터리
  | "scientific_mystery" // 과학적 미스터리
  | "supernatural"      // 초자연 현상
  | "crime"             // 범죄 미스터리
  | "other";

export const MYSTERY_TYPE_LABEL: Record<MysteryType, string> = {
  unsolved_case: "미제사건",
  missing_person: "실종사건",
  historical_mystery: "역사적 미스터리",
  legend_folklore: "괴담/전설",
  military_mystery: "군사 미스터리",
  scientific_mystery: "과학적 미스터리",
  supernatural: "초자연 현상",
  crime: "범죄 미스터리",
  other: "기타",
};

/**
 * 미스터리 서사 방식. 여러 개 선택 가능.
 */
export type MysteryAngle =
  | "case_focused"      // 사건 중심
  | "person_focused"    // 인물 중심
  | "evidence_focused"  // 증거 중심
  | "mystery_focused"   // 미스터리 중심
  | "historical_context" // 역사적 배경 중심
  | "scientific"        // 과학적 분석 중심
  | "twist";            // 반전 중심

export const MYSTERY_ANGLE_LABEL: Record<MysteryAngle, string> = {
  case_focused: "사건 중심",
  person_focused: "인물 중심",
  evidence_focused: "증거 중심",
  mystery_focused: "미스터리 중심",
  historical_context: "역사적 배경 중심",
  scientific: "과학적 분석 중심",
  twist: "반전 중심",
};

/**
 * 결말 방식.
 */
export type EndingStyle =
  | "confirmed_facts"    // 현재까지 확인된 사실 정리
  | "most_likely"        // 가장 가능성 높은 설명
  | "compare_hypotheses" // 여러 가설 비교
  | "unsolved"           // 미해결로 마무리
  | "open_ending";       // 열린 결말

export const ENDING_STYLE_LABEL: Record<EndingStyle, string> = {
  confirmed_facts: "현재까지 확인된 사실 정리",
  most_likely: "가장 가능성 높은 설명",
  compare_hypotheses: "여러 가설 비교",
  unsolved: "미해결로 마무리",
  open_ending: "열린 결말",
};

/**
 * 출처의 신뢰도 및 유형.
 */
export type SourceType =
  | "official"      // 공식 기록/정부
  | "military"      // 군사 기록
  | "court"         // 법원 기록
  | "academic"      // 학술 자료
  | "museum"        // 박물관/아카이브
  | "major_media"   // 주요 언론
  | "interview"     // 인터뷰/증언
  | "secondary"     // 2차 출처
  | "unknown";

export type SourceReliability = "high" | "medium" | "low" | "disputed";

/**
 * 주장의 검증 상태.
 */
export type FactStatus =
  | "FACT"        // 공식 기록으로 확인됨
  | "SUPPORTED"   // 여러 출처로 뒷받침됨
  | "TESTIMONY"   // 특정인의 증언으로만 확인됨
  | "CLAIM"       // 주장되지만 독립적 근거 없음
  | "DISPUTED"    // 출처마다 내용이 다름
  | "UNVERIFIED"  // 확인되지 않음
  | "FALSE";      // 거짓으로 입증됨

/**
 * 출처 참조 (뉴스/자료 출처 하나).
 */
export interface SourceRef {
  id?: string;
  title: string;
  publisher: string;
  publishedAt?: string; // ISO 날짜 문자열
  url: string;
  sourceType: SourceType;
  reliability: SourceReliability;
  factUsed: string; // 이 출처에서 실제로 사용한 사실
  accessedAt?: string;
  license?: string; // 라이선스 정보
  notes?: string;
}

/**
 * 사건 타임라인의 한 항목.
 */
export interface TimelineEvent {
  id: string;
  date: string; // ISO 날짜 또는 "YYYY-MM" 등 부분 날짜
  title: string;
  description: string;
  sources: SourceRef[];
  status: FactStatus; // 이 사건의 검증 상태
}

/**
 * 리서치 결과.
 */
export interface ResearchFinding {
  id: string;
  query: string;
  sources: SourceRef[];
  summary: string; // 종합한 사실관계 요약
}

/**
 * 사건/미스터리의 핵심 정보.
 */
export interface MysteryCase {
  name: string;
  date?: string;
  location?: string;
  mainPersons: string[]; // 주요 인물
  mainPlaces: string[]; // 주요 장소
  mainPoints: string[]; // 미스터리의 핵심 지점들
  timeline: TimelineEvent[];
  keyQuestions: string[]; // "왜?", "누가?", "어디서?" 같은 미스터리 질문들
}

/**
 * 사용자 입력.
 */
export interface MysteryInput {
  topic: string; // 사건/주제명 (필수)
  caseType: MysteryType;
  targetMinutes: number;
  angles: MysteryAngle[]; // 여러 개 선택 가능
  endingStyle: EndingStyle;
  useRealPhotos: boolean; // 실제 자료 사용 선호
  useAiReconstruction: boolean; // AI 재현 이미지 사용
  useBgm: boolean;
  voiceName: string;
  sceneVisualTarget: number;
}

export type ScriptSectionKind = "hook" | "chapter" | "summary";
export type SectionStatus = "pending" | "generating" | "done" | "error";

/**
 * 미스터리 대본의 챕터 유형.
 */
export type MysteryChapterType =
  | "opening"           // 1. 강력한 후킹 (첫 20~40초)
  | "background"        // 2. 배경 설명
  | "main_event"        // 3. 핵심 사건
  | "first_mystery"     // 4. 첫 번째 미스터리/의문
  | "evidence_1"        // 5. 첫 번째 증거/단서
  | "new_question"      // 6. 새로운 의문
  | "hidden_background" // 7. 숨겨진 배경
  | "evidence_2"        // 8. 추가 증거/단서
  | "unexpected"        // 9. 예상하지 못한 전개
  | "hypotheses"        // 10. 여러 가설 제시
  | "key_evidence"      // 11. 결정적 증거
  | "twist"             // 12. 반전/새로운 사실
  | "analysis"          // 13. 분석 및 해석
  | "remaining"         // 14. 아직 풀리지 않은 의문
  | "conclusion"        // 15. 결론/마무리
  | "closing";          // 16. 여운 있는 마무리

export interface ScriptSection {
  id: string;
  kind: ScriptSectionKind;
  index?: number; // 순번 (kind === "chapter"일 때)
  chapterType?: MysteryChapterType;
  outlineSummary?: string;
  text: string;
  charCount: number;
  estimatedSeconds: number;
  status: SectionStatus;
  error?: string;
  sources: SourceRef[]; // 이 섹션이 근거로 삼은 출처
  visualOrigin?: VisualOrigin; // 이 섹션에서 사용할 시각자료의 출처
  factStatus?: FactStatus; // 이 섹션의 검증 상태
  needsDisclaimer?: boolean; // "재구성하면", "추정하면" 같은 설명 필요 여부
}

export interface MysteryScript {
  title: string;
  titleCandidates?: string[];
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
 * 장면의 시각자료 유형.
 */
export type SceneVisualType =
  | "archive_photo"        // 실제 아카이브 사진
  | "official_document"    // 공식 문서
  | "newspaper"            // 신문 기사
  | "map"                  // 지도
  | "satellite"            // 위성 사진
  | "timeline"             // 타임라인 그래픽
  | "interview"            // 인터뷰/증언 텍스트
  | "evidence"             // 증거 그래픽
  | "location"             // 장소 사진
  | "ai_reconstruction"    // AI 재현 이미지
  | "diagram"              // 다이어그램
  | "data_card"            // 데이터 카드
  | "text_card"            // 텍스트 카드
  | "atmosphere"           // 분위기 이미지
  | "video_archive";       // 영상 아카이브

/**
 * 시각자료의 출처 (실제 자료 vs AI 생성).
 */
export type VisualOrigin =
  | "REAL_ARCHIVE_PHOTO"        // 실제 아카이브 사진
  | "REAL_DOCUMENT"             // 실제 공식 문서
  | "REAL_NEWS"                 // 실제 뉴스 영상/화면
  | "REAL_INTERVIEW"            // 실제 인터뷰
  | "REAL_VIDEO"                // 실제 사건 영상
  | "REAL_MAP"                  // 실제 지도/위성자료
  | "GENERATED_GRAPHIC"         // 자체 제작 그래픽
  | "GENERATED_DIAGRAM"         // 자체 제작 다이어그램
  | "GENERATED_TIMELINE"        // 자체 제작 타임라인
  | "AI_RECONSTRUCTION"         // AI 재현 이미지
  | "AI_RECONSTRUCTION_VIDEO"   // AI 재현 영상
  | "AI_ATMOSPHERE"             // AI 분위기 이미지
  | "MIXED";                    // 실제 + AI 혼합

export const VISUAL_TYPE_LABEL: Record<SceneVisualType, string> = {
  archive_photo: "아카이브 사진",
  official_document: "공식 문서",
  newspaper: "신문 기사",
  map: "지도",
  satellite: "위성 사진",
  timeline: "타임라인",
  interview: "증언",
  evidence: "증거",
  location: "장소 사진",
  ai_reconstruction: "AI 재현",
  diagram: "다이어그램",
  data_card: "데이터 카드",
  text_card: "텍스트 카드",
  atmosphere: "분위기 이미지",
  video_archive: "영상 아카이브",
};

/**
 * AI 생성 정보.
 */
export interface AiGenerationInfo {
  model: string; // 사용한 AI 모델
  prompt: string; // 생성 프롬프트 (팩트체크된 정보 기반)
  generatedAt: string; // ISO 날짜
  displayDisclaimer: boolean; // 화면에 "AI 재현" 표시 여부
  disclaimerText?: string; // 커스텀 표시 텍스트
}

/**
 * 장면의 시각자료 (실제/AI/생성 혼합 가능).
 */
export interface SceneVisual {
  id: string;
  type: SceneVisualType;
  origin: VisualOrigin; // 출처 타입
  url?: string;
  thumbnailUrl?: string;

  // 실제 자료의 경우
  sourceId?: string; // 연결된 SourceRef의 id
  sourceTitle?: string;
  sourcePublisher?: string;
  sourceDate?: string;
  sourceUrl?: string;
  sourceLabel?: string; // 화면에 표시할 텍스트 (예: "출처: BBC / 2019")
  license?: string;

  // AI 생성의 경우
  aiGeneration?: AiGenerationInfo;

  // 생성 그래픽의 경우
  graphicType?: string; // "timeline", "diagram", "data_card" 등

  // 혼합 자료의 경우
  components?: SceneVisual[]; // 혼합 구성요소
}

/**
 * 장면 (Scene).
 */
export interface Scene {
  id: string;
  sectionId: string;
  order: number;
  text: string;

  // 메인 시각자료
  visualType: SceneVisualType;
  visualQuery: string; // 검색 쿼리 (실제 자료 검색용)
  visualHeadline?: string;
  visualLabel?: string;

  // 시각자료 우선순위 확인
  realMaterialSearched?: boolean; // 실제 자료 검색 여부
  realMaterialFound?: boolean; // 실제 자료 발견 여부
  requiresAiReconstruction?: boolean; // AI 재현 필요 여부

  // 시각자료 상태 및 출처 (호환성: 기존 + 신규)
  visuals?: SceneVisual | SceneVisual[]; // 신규: 단일 또는 혼합
  visualStatus: AssetStatus;
  visualError?: string;
  visualUrl?: string; // 기존: 생성된 이미지 URL
  visualSourceLabel?: string; // 기존: 화면 표시 출처
  visualSourceUrl?: string; // 기존: 원본 출처 URL
  visualOrigin?: VisualOrigin; // 기존: 실제/AI/생성 구분

  // 팩트 연결
  factStatus?: FactStatus; // 이 장면이 표현하는 내용의 검증 상태
  sources?: SourceRef[]; // 이 장면이 근거로 삼은 출처들

  // 내레이션
  narration: NarrationChunk[];
  durationSeconds?: number;

  // 메타데이터
  aiReconstructionExplained?: boolean; // "재구성하면" 같은 설명이 내레이션에 포함되었는지
}

export type PipelineStage =
  | "research"
  | "factcheck"
  | "timeline"
  | "script"
  | "scenes"
  | "visuals"
  | "narration"
  | "review"
  | "render"
  | "done";

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

/**
 * 미스터리 프로젝트 메인 데이터 구조.
 */
export interface MysteryProject {
  id: string;
  name: string; // 사용자가 붙인 프로젝트 이름
  userId: string;
  createdAt: string;
  updatedAt: string;
  input: MysteryInput;
  stage: PipelineStage;

  // 각 단계의 산출물
  case?: MysteryCase;
  research?: ResearchFinding[];
  factcheckResults?: any; // FactCheckReport with detailed fact-checking results
  timeline?: TimelineEvent[];
  script?: MysteryScript;
  scenes?: Scene[];
  hookNarration?: NarrationChunk[];

  // 새로 추가: 음성, 자막, 자료
  narrationSegments?: any[]; // NarrationSegment[]
  narrationError?: string;
  subtitleTracks?: any[]; // SubtitleTrack[]
  sceneAssets?: any[]; // SceneAsset[]

  // 렌더링 및 에러
  render: RenderState;
  hookMontageSceneIds?: string[];
  output?: {
    mp4?: string;
    status?: string;
  };
  pipelineError?: string;
  pipelineRunning?: boolean; // 파이프라인이 현재 실행 중인지 여부 (중복 실행 방지)
  pipelineStartedAt?: string; // 파이프라인 시작 시간 (타임아웃 감지용)
  errorLog: ErrorLogEntry[];
}
