# 실제 자료 + AI 혼합 미스터리 다큐 제작 가이드

## 핵심 원칙

이 프로젝트는:
- ❌ 실제 자료만 사용하는 프로그램이 아니고
- ❌ AI 이미지로 모든 장면을 만드는 프로그램도 아니다

목표:
- ✅ 실제 자료를 최대한 활용
- ✅ 부족한 부분만 AI와 자체 제작 그래픽으로 보완
- ✅ **실화 기반 미스터리 다큐멘터리**

---

## 1. 자료 사용 우선순위

장면 제작 시 다음 순서로 자료를 선택한다:

### 1단계: 실제 자료 검색
1. 실제 사건 사진 (Archive Photo)
2. 실제 뉴스 화면 (News Video/Screenshot)
3. 실제 인터뷰 (Interview)
4. 실제 사건 영상 (Event Video)
5. 공식 문서 (Official Document)
6. 법원/경찰/군/정부 자료 (Government Sources)
7. 당시 신문 및 아카이브 (Newspaper Archive)
8. 지도/위성자료 (Map/Satellite)

### 2단계: 자체 제작 그래픽
- 지도 (Map)
- 타임라인 (Timeline)
- 다이어그램 (Diagram)
- 데이터 카드 (Data Card)
- 증거 설명 그래픽 (Evidence Graphic)

### 3단계: AI 재현
- 역사적 상황 재현 (Historical Reconstruction)
- 실제 사진이 없는 장소 재현 (Location Reconstruction)
- 사건 당시 분위기 재현 (Atmosphere Reconstruction)
- 인물의 실루엣/뒷모습 재현 (Silhouette/Back View)
- 이동 경로 시각화 (Movement Path)
- 사건 구조 설명 (Structure Visualization)

---

## 2. 영상 구성 비율

### 권장 비율
```
실제 자료:        50~70%
자체 제작 그래픽: 15~25%
AI 재현:          10~25%
```

### 유연한 조정
- **자료 풍부한 사건**: 실제 자료 80~90%, AI 0~10%
- **자료 부족한 사건**: 실제 자료 40~60%, 그래픽+AI 40~60%

**핵심**: 비율이 아니라 **사실과 재현을 명확하게 구분**하는 것이 중요하다.

---

## 3. AI는 사실 생성에 사용하지 않는다

### ✅ AI 사용 용도
- 역사적 상황 재현 (팩트체크된 정보 기반)
- 실제 사진이 없는 장소 재현
- 사건 당시의 분위기 재현
- 인물의 실루엣/뒷모습 재현
- 이동 경로 시각화
- 지도 애니메이션
- 사건 구조 설명
- 문서/증거의 시각적 설명

### ❌ AI 절대 금지 용도
- 새로운 사건 만들어내기
- 존재하지 않는 증거 사진 생성
- 존재하지 않는 문서 생성
- 존재하지 않는 인물 만들기
- 실제 사건 영상처럼 위장
- 실제 뉴스처럼 위장
- 실제 인터뷰처럼 위장

---

## 4. AI 재현 장면에는 명확한 표시

AI로 생성된 장면은:
```
AI 재현
또는
AI Reconstruction
```

특히 실제 사진과 매우 유사한 장면은 반드시 재현임을 알 수 있도록 표시한다.

---

## 5. 자동 선택 로직 (Scene별)

### 질문 1: 실제 자료가 있는가?
```
YES → 실제 자료 우선 사용 (출처 표시 필수)
NO → 질문 2로
```

### 질문 2: 지도/문서/그래픽으로 설명할 수 있는가?
```
YES → 자체 제작 그래픽 사용 (지도, 타임라인, 다이어그램)
NO → 질문 3으로
```

### 질문 3: AI 재현이 설명에 도움이 되는가?
```
YES → AI 재현 (AI 재현 표시 필수)
NO → 질문 4로
```

### 질문 4: 타이포그래피만으로 충분한가?
```
YES → 텍스트 카드 + 내레이션
```

---

## 6. Scene 데이터 구조

### 실제 자료 사용 시
```typescript
{
  scene_id: "scene_001",
  visualType: "archive_photo",
  visualOrigin: "REAL_ARCHIVE_PHOTO",
  realMaterialSearched: true,
  realMaterialFound: true,
  visuals: {
    type: "archive_photo",
    origin: "REAL_ARCHIVE_PHOTO",
    sourceId: "source_001",
    sourceTitle: "JFK Assassination Photo",
    sourcePublisher: "National Archives",
    sourceDate: "1963-11-22",
    sourceLabel: "자료: National Archives / 1963",
    license: "Public Domain"
  },
  sources: [/* SourceRef[] */],
  factStatus: "FACT"
}
```

### AI 재현 사용 시
```typescript
{
  scene_id: "scene_015",
  visualType: "atmosphere",
  visualOrigin: "AI_RECONSTRUCTION",
  realMaterialSearched: true,
  realMaterialFound: false,
  requiresAiReconstruction: true,
  visuals: {
    type: "atmosphere",
    origin: "AI_RECONSTRUCTION",
    aiGeneration: {
      model: "claude-3.5-sonnet",
      prompt: "Based on historical records, recreate the atmosphere of...",
      generatedAt: "2024-08-09T10:30:00Z",
      displayDisclaimer: true,
      disclaimerText: "AI 재현"
    }
  },
  sources: [/* 프롬프트 기반 SourceRef[] */],
  factStatus: "RECONSTRUCTION",
  aiReconstructionExplained: true
}
```

### 혼합 자료
```typescript
{
  scene_id: "scene_025",
  visualOrigin: "MIXED",
  realMaterialSearched: true,
  visuals: [
    { // 실제 사진
      type: "archive_photo",
      origin: "REAL_ARCHIVE_PHOTO",
      sourceLabel: "자료: BBC / 2019"
    },
    { // 자체 제작 지도
      type: "map",
      origin: "GENERATED_GRAPHIC"
    },
    { // AI 재현
      type: "atmosphere",
      origin: "AI_RECONSTRUCTION",
      aiGeneration: { /* ... */ }
    }
  ]
}
```

---

## 7. 대본에서 출처 연결

각 문장이 어떤 자료에 기반하는지 명시:

```typescript
{
  text: "당시 현장을 조사했던 관계자는 이상한 흔적을 발견했다고 증언했습니다.",
  factStatus: "TESTIMONY",
  sources: ["source_007"], // 출처 ID
  visualOrigin: "REAL_INTERVIEW",
  aiReconstructionExplained: false
}

{
  text: "당시 상황을 재구성하면 이와 같은 모습이었을 가능성이 있습니다.",
  factStatus: "RECONSTRUCTION",
  sources: ["source_002", "source_005"], // 재구성 기반 출처
  visualOrigin: "AI_RECONSTRUCTION",
  aiReconstructionExplained: true
}
```

---

## 8. 명확한 표현 가이드

### 사용해야 할 표현
```
"당시 상황을 재구성하면..."
"정확한 모습은 확인되지 않았지만..."
"기록을 바탕으로 재현하면..."
"이 장면은 AI로 재현한 것입니다."
"실제 영상은 남아 있지 않습니다."
"이 부분은 목격자의 증언에 기반합니다."
```

### 피해야 할 표현
```
❌ "실제 CCTV 영상에 따르면..." (AI 영상일 때)
❌ "뉴스에서 보도한..." (AI 영상일 때)
❌ "○○가 말했습니다" (AI 음성일 때 원본 인터뷰인 척)
```

---

## 9. 파이프라인 플로우

```
사건 입력
  ↓
웹 리서치 (공식/뉴스/인터뷰/사진 검색)
  ↓
팩트체크 (FACT/TESTIMONY/CLAIM/DISPUTED/UNVERIFIED)
  ↓
타임라인 구축
  ↓
대본 작성 (각 문장에 출처 연결)
  ↓
씬 분할 (16~20개 씬)
  ↓
각 씬별 실제 자료 검색
  ↓
자료 발견 여부 판단
  ↓
├─ YES: 실제 자료 사용
├─ NO → 그래픽 가능? → YES: 자체 제작 그래픽
├─ NO → AI 도움? → YES: AI 재현 (AI 표시)
└─ NO → 텍스트 카드 + 내레이션
  ↓
TTS 생성
  ↓
자막 생성
  ↓
BGM 추가
  ↓
출처 표시 추가
  ↓
AI 재현 표시 추가
  ↓
팩트체크 검수
  ↓
렌더링
  ↓
최종 영상 (실제 + 그래픽 + AI 혼합)
```

---

## 10. 최종 품질 기준

### 시청자가 느껴야 할 점
```
"이거 AI로 다 만든 영상이네" ❌
"실제 사건 자료를 엄청 많이 조사했구나" ✅
```

### 체크리스트
- [ ] 실제 자료가 우선된가?
- [ ] AI 재현이 명확하게 표시되었는가?
- [ ] 모든 출처가 표기되었는가?
- [ ] "재구성하면" 같은 표현이 있는가?
- [ ] 팩트와 추측이 구분되었는가?
- [ ] 실제 영상처럼 보이는 AI 장면은 없는가?

---

## 11. 구현 예시

### 대본 문장 → 시각자료 연결

```
내레이션: "2002년 6월, 아프가니스탄 칸다하르 지역에서 대형 유골이 
           발견되었다고 알려졌습니다."

실제 자료 검색:
  - 당시 신문 기사 사진? → 찾음
  - 뉴스 화면? → 찾음
  - 공식 기록? → 못 찾음

선택 결과:
  - 신문 기사 사진 (실제 자료) 사용
  - 출처: 당시 신문 명
  - 화면 표시: "자료: ○○신문 / 2002"
```

```
내레이션: "당시 현장 상황을 재구성하면 이와 같았을 것으로 추정됩니다."

실제 자료 검색:
  - 현장 사진? → 못 찾음
  - 뉴스 영상? → 못 찾음

그래픽 가능?
  - 지도? → 가능 (그래픽 사용)
  - 그 외? → 불가능

AI 도움?
  - 분위기 표현? → 가능

선택 결과:
  - 지도 그래픽 (자체 제작) + AI 분위기 이미지 (혼합)
  - AI 이미지 표시: "AI 재현"
  - 내레이션에 "재구성하면" 포함
```

---

## 12. 파이프라인 수정 사항

현재 코드 수정이 필요한 부분:

### `/lib/mystery/visuals.ts`
```typescript
// 기존: 자동으로 AI 이미지 생성
// 수정: 실제 자료 검색 먼저

async function generateSceneVisuals(scene: Scene, input: MysteryInput) {
  // 1단계: 실제 자료 검색
  const realAssets = await searchRealAssets(scene);
  
  // 2단계: 자동 선택
  const selected = await selectVisualAsset(scene, realAssets, input);
  
  // 3단계: 부족한 부분만 생성
  if (selected.requiresAiReconstruction) {
    // AI 생성 (명확한 표시와 함께)
    const aiImage = await generateAiReconstruction(selected.primary);
  }
}
```

### `/lib/mystery/imageSearch.ts`
```typescript
// 실제 자료 검색 강화
// - Wikimedia Commons (퍼블릭 도메인 이미지)
// - Archive.org (뉴스/문서 스캔본)
// - 정부/박물관 오픈 자료
// - 저작권 자유로운 뉴스 아카이브
```

### `/lib/mystery/script.ts`
```typescript
// 각 문장에 출처와 시각자료 타입 추가
interface ScriptLine {
  text: string;
  sources: SourceRef[];
  visualOrigin: VisualOrigin;
  factStatus: FactStatus;
  needsDisclaimer: boolean; // "재구성하면" 필요?
}
```

---

## 13. 금지되는 표현 금지 목록

이 목록을 체크하며 개발한다:

```javascript
// ❌ 금지: 실제 CCTV처럼 AI 영상을 제작
createFakeCctvFootage(); // 금지됨

// ❌ 금지: 실제 뉴스 영상처럼 AI 영상을 제작
createFakeNewsFootage(); // 금지됨

// ❌ 금지: 실제 인터뷰처럼 AI 인물을 말하게 함
generateAiInterviewedPerson(); // 금지됨

// ❌ 금지: 존재하지 않는 증거 사진 생성
generateFakeEvidencePhoto(); // 금지됨

// ❌ 금지: 존재하지 않는 문서 생성
generateFakeDocument(); // 금지됨

// ✅ 허용: 팩트체크된 정보 기반 재현
generateHistoricalReconstruction(verifiedFacts); // 허용됨
```

---

## 최종 체크리스트

영상 제작 완료 전 확인:

- [ ] 모든 실제 자료 검색 완료
- [ ] AI 재현에 명확한 표시 추가
- [ ] 모든 출처 표기 (날짜/출처명/라이선스)
- [ ] 팩트와 추측 구분
- [ ] "재구성하면", "추정하면" 표현 확인
- [ ] 실제처럼 보이는 AI 장면 없음
- [ ] 대본 문장별 출처 연결
- [ ] 자료 비율 확인 (실제 > 그래픽 > AI)
- [ ] 팩트체크 검수 완료
