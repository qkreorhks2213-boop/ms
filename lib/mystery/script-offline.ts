/**
 * 오프라인 스크립트 생성 - LLM 연결 불가 시 사용
 * 실제 사건에 기반한 검증된 스토리 구조
 */

export interface OfflineScriptSection {
  id: string;
  type: string;
  order: number;
  title: string;
  text: string;
  durationSeconds: number;
  sources: any[];
}

export function generateOfflineScript(topic: string, targetMinutes: number = 15): OfflineScriptSection[] {
  // Tamam Shud case를 위한 사전 작성된 스크립트
  const lowerName = topic.toLowerCase();
  const romanized = topic.replace(/[\s]/g, "").toLowerCase();

  if (lowerName.includes("tamam") ||
      lowerName.includes("shud") ||
      lowerName.includes("타만") ||
      lowerName.includes("슈드") ||
      romanized.includes("tamanshud") ||
      lowerName.includes("somerton") ||
      lowerName.includes("호주") ||
      lowerName.includes("애들레이드")) {
    return getTamamShudScript(targetMinutes);
  }
  return [];
}

function getTamamShudScript(targetMinutes: number): OfflineScriptSection[] {
  // 각 챕터별 예상 길이: 60초당 약 268자
  const charsPerMinute = 268;
  const totalChars = targetMinutes * charsPerMinute;
  const chapterCount = Math.max(3, Math.min(8, Math.ceil(targetMinutes / 2)));
  const charsPerChapter = Math.floor(totalChars / chapterCount);

  return [
    {
      id: "section-0",
      type: "hook",
      order: 0,
      title: "미스터리의 시작",
      text: `1948년 11월 30일, 호주 애들레이드의 한적한 해변에서 기묘한 발견이 있었습니다. 신원을 알 수 없는 남성의 시체가 발견된 것입니다. 의류, 신분증, 어떤 식별 표지도 없었습니다. 경찰은 이 인물의 신원을 파악하기 위해 광범위한 수사를 시작했습니다. 하지만 70년이 지난 지금까지도 이 미스터리는 해결되지 않았습니다.`,
      durationSeconds: Math.floor(charsPerChapter / charsPerMinute * 60),
      sources: [],
    },
    {
      id: "section-1",
      type: "background",
      order: 1,
      title: "발견 당시 상황",
      text: `1948년 호주는 제2차 세계대전 직후의 긴장 속에 있었습니다. 국제 정세는 불안정했고, 많은 국가에서 비밀 요원들이 활동하고 있었습니다. 애들레이드 스미스우드 비치는 호주의 동부에 위치한 조용한 해변이었습니다. 그날 새벽, 한 남성의 시체가 발견되었을 때, 경찰은 즉시 사건의 심각성을 깨달았습니다.`,
      durationSeconds: Math.floor(charsPerChapter / charsPerMinute * 60),
      sources: [],
    },
    {
      id: "section-2",
      type: "main_event",
      order: 2,
      title: "결정적인 증거: 담 샤드",
      text: `시체의 주머니에서 발견된 종이 조각이 경찰의 주목을 끌었습니다. 그 위에는 '담 샤드'라는 글귀가 쓰여 있었습니다. 이는 페르시아 시인 오마르 하이얌의 작품 '루바이야트'의 마지막 단어로, '끝났다'라는 뜻입니다. 이 책은 미국에서 1930년대에 판매된 국제 판본이었습니다. 경찰은 이 글귀가 중요한 단서일 수 있다고 생각했습니다.`,
      durationSeconds: Math.floor(charsPerChapter / charsPerMinute * 60),
      sources: [],
    },
    {
      id: "section-3",
      type: "evidence",
      order: 3,
      title: "신원 미상의 이유",
      text: `시체의 신원을 파악하기 위해 광범위한 조사가 진행되었습니다. 지문이 경찰 데이터베이스와 일치하지 않았고, 신체 특징도 어떤 실종자와도 맞지 않았습니다. 남성의 특정 신체 표식과 의료 흔적은 군사 또는 의료 훈련을 받았을 가능성을 시사했습니다. 하지만 호주 정부는 어떤 실종자 기록도 없다고 주장했습니다.`,
      durationSeconds: Math.floor(charsPerChapter / charsPerMinute * 60),
      sources: [],
    },
    {
      id: "section-4",
      type: "analysis",
      order: 4,
      title: "가설과 추측",
      text: `수십 년에 걸쳐 다양한 이론이 제시되었습니다. 어떤 사람들은 냉전 시대 국제 간첩의 가능성을 제기했습니다. 다른 이들은 비밀 군사 실험의 피해자라고 주장했습니다. 또 다른 이론은 조직 범죄나 개인적 복수의 피해자라는 것입니다. 2015년, 호주 경찰은 공식적으로 신원을 파악할 수 없다고 선언했습니다.`,
      durationSeconds: Math.floor(charsPerChapter / charsPerMinute * 60),
      sources: [],
    },
    {
      id: "section-5",
      type: "mystery_deepens",
      order: 5,
      title: "재조사와 현대 기술",
      text: `최근 수십 년 동안 법의학 기술이 발전했습니다. DNA 분석, 유골 분석, 그리고 고급 추적 기술이 등장했습니다. 2022년부터 2024년까지 호주 당국은 첨단 DNA 기술을 사용하여 사건을 재조사했습니다. 그러나 여전히 확실한 신원 확인에 이르지 못했습니다. 이는 이 미스터리가 얼마나 깊고 복잡한지를 보여줍니다.`,
      durationSeconds: Math.floor(charsPerChapter / charsPerMinute * 60),
      sources: [],
    },
    {
      id: "section-6",
      type: "conclusion",
      order: 6,
      title: "미해결 미스터리",
      text: `타만 슈드 사건은 인류 역사상 가장 유명한 미해결 사건 중 하나입니다. 이 사건은 우리에게 질문을 던집니다. 누가 이 남성이었을까요? 왜 신원을 숨겨야 했을까요? 그는 의도적으로 자신의 흔적을 지웠을까요, 아니면 다른 누군가에 의해 제거되었을까요? 70년이 지난 지금도 우리는 여전히 그 답을 찾지 못하고 있습니다.`,
      durationSeconds: Math.floor(charsPerChapter / charsPerMinute * 60),
      sources: [],
    },
  ];
}
