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

  if (lowerName.includes("mary") && lowerName.includes("celeste")) {
    return getMaryCelesteScript(targetMinutes);
  }

  if (lowerName.includes("jack") && lowerName.includes("ripper")) {
    return getJackTheRipperScript(targetMinutes);
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

function getMaryCelesteScript(targetMinutes: number): OfflineScriptSection[] {
  const charsPerMinute = 268;
  const totalChars = targetMinutes * charsPerMinute;
  const chapterCount = Math.max(3, Math.min(8, Math.ceil(targetMinutes / 2)));
  const charsPerChapter = Math.floor(totalChars / chapterCount);

  return [
    {
      id: "section-0",
      type: "hook",
      order: 0,
      title: "바다의 유령 선박",
      text: `1872년 12월 4일, 대서양 상에서 기이한 발견이 있었습니다. 완벽하게 항해 가능한 상태의 배 메리셀레스트호가 표류하고 있었던 것입니다. 하지만 배에는 아무도 없었습니다. 13명의 승무원과 선장의 가족 모두가 사라져 있었습니다. 이것은 해양 역사에서 가장 미스터리한 실종 사건이 되었습니다.`,
      durationSeconds: Math.floor(charsPerChapter / charsPerMinute * 60),
      sources: [],
    },
    {
      id: "section-1",
      type: "background",
      order: 1,
      title: "배의 배경과 항해",
      text: `메리셀레스트호는 미국 뉴욕에서 이탈리아 제노바로 향하는 알코올을 실은 상선이었습니다. 선장 벤자민 브릭은 경험 많은 선원이었고, 그의 아내와 2살 딸도 함께 탔습니다. 배는 11월 7일에 출발했으며, 모두 정상적인 항해를 예상했습니다. 하지만 약 3주 후, 배는 완전히 인적이 없는 상태로 발견되었습니다.`,
      durationSeconds: Math.floor(charsPerChapter / charsPerMinute * 60),
      sources: [],
    },
    {
      id: "section-2",
      type: "main_event",
      order: 2,
      title: "발견과 수수께끼",
      text: `포르투갈의 포 타오 노바 일호에서 배를 발견했을 때, 모든 것이 정상인 것처럼 보였습니다. 돛은 펼쳐져 있었고, 항해 도구들도 제자리에 있었습니다. 배의 식량도 충분했고, 물도 있었습니다. 하지만 선원들은 없었습니다. 보트도 하나 사라져 있었습니다. 이것은 누군가 배에서 떠나갔다는 것을 의미했지만, 왜 그래야 했는지는 아무도 알 수 없었습니다.`,
      durationSeconds: Math.floor(charsPerChapter / charsPerMinute * 60),
      sources: [],
    },
    {
      id: "section-3",
      type: "evidence",
      order: 3,
      title: "조사와 발견된 증거",
      text: `당국의 조사는 많은 의문점을 남겼습니다. 선박의 저장소에는 물이 고여 있었고, 많은 물건들이 흩어져 있었습니다. 이것은 폭풍우가 있었을 가능성을 시사했습니다. 하지만 선원들이 왜 배를 포기했는지는 설명할 수 없었습니다. 화재의 흔적도 없었고, 공격의 징후도 없었습니다. 배는 침몰 위기에 처해 있지도 않았습니다.`,
      durationSeconds: Math.floor(charsPerChapter / charsPerMinute * 60),
      sources: [],
    },
    {
      id: "section-4",
      type: "analysis",
      order: 4,
      title: "제시된 이론들",
      text: `150년이 지난 지금도 여러 이론이 존재합니다. 폭풍우로 인한 공포, 음독에 의한 선원 반란, 해적의 공격, 심지어 초자연적 현상까지 제시되었습니다. 일부는 선원들이 구명보트로 떠났지만 구조되지 않았을 것이라 주장합니다. 다른 이들은 배의 이상한 구조 때문에 선원들이 배가 침몰하고 있다고 생각했을 것이라 설명합니다.`,
      durationSeconds: Math.floor(charsPerChapter / charsPerMinute * 60),
      sources: [],
    },
    {
      id: "section-5",
      type: "mystery_deepens",
      order: 5,
      title: "현대의 재검토",
      text: `최근의 해양 전문가들은 메리셀레스트호의 사건을 재검토했습니다. 어떤 전문가는 배의 선체가 손상되어 선원들이 침몰할 위험이 있다고 잘못 생각했을 수 있다고 제안했습니다. 다른 이들은 배에서의 폭발이나 화학 반응을 제안합니다. 그러나 확실한 답은 여전히 없습니다.`,
      durationSeconds: Math.floor(charsPerChapter / charsPerMinute * 60),
      sources: [],
    },
    {
      id: "section-6",
      type: "conclusion",
      order: 6,
      title: "바다의 미스터리",
      text: `메리셀레스트호 사건은 대양의 신비로움을 상징합니다. 배와 선원들이 어디로 갔는지, 무슨 일이 일어났는지는 영원히 미스터리로 남을 수도 있습니다. 이 사건은 우리에게 바다의 위력과 인간이 직면할 수 있는 예측 불가능한 상황에 대해 생각하게 합니다. 150년 후에도 우리는 여전히 그 진실을 찾고 있습니다.`,
      durationSeconds: Math.floor(charsPerChapter / charsPerMinute * 60),
      sources: [],
    },
  ];
}

function getJackTheRipperScript(targetMinutes: number): OfflineScriptSection[] {
  const charsPerMinute = 268;
  const totalChars = targetMinutes * charsPerMinute;
  const chapterCount = Math.max(3, Math.min(8, Math.ceil(targetMinutes / 2)));
  const charsPerChapter = Math.floor(totalChars / chapterCount);

  return [
    {
      id: "section-0",
      type: "hook",
      order: 0,
      title: "런던의 악몽",
      text: `1888년 8월, 런던의 이스트엔드는 공포에 휩싸였습니다. 한 명의 연쇄살인범이 거리를 배회하고 있었던 것입니다. 이 범인은 역사상 가장 악명 높은 연쇄살인범 중 한 명이 되었습니다. 잭더리퍼는 10주 동안 적어도 5명의 여성을 살해했으며, 그 이후 흔적을 감추고 사라졌습니다. 범인의 정체는 지금까지도 규명되지 않았습니다.`,
      durationSeconds: Math.floor(charsPerChapter / charsPerMinute * 60),
      sources: [],
    },
    {
      id: "section-1",
      type: "background",
      order: 1,
      title: "빅토리아 시대 런던",
      text: `1880년대의 런던은 산업 혁명의 중심이었지만, 심각한 빈곤 문제를 안고 있었습니다. 이스트엔드는 노동자 계급과 가난한 사람들의 거주지였습니다. 많은 여성들이 생존을 위해 성매매에 종사했습니다. 경찰 시스템도 미약했고, 범죄 해결 기술도 부족했습니다. 이런 환경이 리퍼의 활동을 가능하게 만들었습니다.`,
      durationSeconds: Math.floor(charsPerChapter / charsPerMinute * 60),
      sources: [],
    },
    {
      id: "section-2",
      type: "main_event",
      order: 2,
      title: "공포의 시작",
      text: `살인이 시작된 것은 1888년 8월 31일입니다. 메리 앤 니콜스가 발견되었을 때, 경찰은 처음에 이것이 특별한 사건이라고 인식하지 못했습니다. 하지만 9월 8일, 또 다른 희생자 애니 채프먼이 발견되었을 때, 런던은 연쇄살인범의 존재를 깨달았습니다. 두 피해자는 모두 성매매 여성이었고, 비슷한 방식으로 살해당했습니다.`,
      durationSeconds: Math.floor(charsPerChapter / charsPerMinute * 60),
      sources: [],
    },
    {
      id: "section-3",
      type: "evidence",
      order: 3,
      title: "단서와 편지들",
      text: `경찰은 범인에 대한 단서를 거의 찾을 수 없었습니다. 범인은 매우 신중하게 행동했습니다. 하지만 "잭더리퍼"라는 서명이 있는 편지들이 신문사와 경찰에 도착하기 시작했습니다. 이 편지들이 진짜인지 가짜인지는 여전히 논쟁의 대상입니다. 현장에서 발견된 것은 거의 없었지만, 피해자들의 신체 훼손 방식은 일관되었습니다.`,
      durationSeconds: Math.floor(charsPerChapter / charsPerMinute * 60),
      sources: [],
    },
    {
      id: "section-4",
      type: "analysis",
      order: 4,
      title: "범인 추적과 용의자들",
      text: `범인의 정체를 파악하기 위해 많은 노력이 기울어졌습니다. 수백 명의 용의자가 심문되었습니다. 의사, 도축업자, 러시아 이민자, 왕실 인물까지도 의심받았습니다. 하지만 확실한 증거가 없었습니다. 범인은 의료 지식이 있는 것 같았지만, 이것이 직업을 좁히기에는 충분하지 않았습니다. 범인의 심리 프로필을 작성한 전문가들도 범인을 정확히 파악하지 못했습니다.`,
      durationSeconds: Math.floor(charsPerChapter / charsPerMinute * 60),
      sources: [],
    },
    {
      id: "section-5",
      type: "mystery_deepens",
      order: 5,
      title: "살인의 종료와 미스터리",
      text: `마지막 살인은 1888년 11월 9일이었습니다. 메리 제인 켈리가 끔찍하게 살해된 후, 리퍼의 살인은 갑자기 멈췄습니다. 이것은 범인이 체포되었을 수도, 죽었을 수도, 아니면 다른 이유로 멈춘 것일 수도 있습니다. 이후 130년 이상 동안, 많은 연구자들이 범인의 정체를 밝히려고 시도했습니다. DNA 기술도 도움이 되지 않았습니다.`,
      durationSeconds: Math.floor(charsPerChapter / charsPerMinute * 60),
      sources: [],
    },
    {
      id: "section-6",
      type: "conclusion",
      order: 6,
      title: "역사의 그림자",
      text: `잭더리퍼는 범죄의 역사에 깊은 영향을 미쳤습니다. 이 사건은 현대적 경찰 수사 기법의 발전을 가져왔고, 범죄 심리학의 기초가 되었습니다. 하지만 범인의 정체는 여전히 미스터리입니다. 혹시 당신이 알고 있는 정보가 이 수수께끼를 풀 수 있을까요? 136년이 지난 지금도, 런던의 어둠 속에는 여전히 리퍼의 비밀이 숨어있을지도 모릅니다.`,
      durationSeconds: Math.floor(charsPerChapter / charsPerMinute * 60),
      sources: [],
    },
  ];
}
