# 실제 자료 + AI 혼합 시스템 - 구현 계획서

## 📋 개요

현재 테스트 프레임워크 위에 실제 자료 우선 선택 시스템을 구축하는 계획입니다.

**상태**: 🟢 타입 및 유틸리티 완성, 구현 대기 중

---

## ✅ 완료된 작업

### 1. 데이터 타입 확장 (`lib/mystery/types.ts`)
- [x] `VisualOrigin` 타입 세분화 (13가지 구체적 타입)
- [x] `AiGenerationInfo` 인터페이스 추가
- [x] `SceneVisual` 인터페이스 추가 (실제/AI/생성 혼합 지원)
- [x] `Scene` 인터페이스 확장
- [x] `ScriptSection` 확장

### 2. 자동 선택 로직 (`lib/mystery/visualAssetSelector.ts`)
- [x] 4단계 선택 알고리즘 구현
- [x] 실제 자료 점수 매기기
- [x] 그래픽 자동 생성 판단
- [x] AI 재현 필요 여부 판단
- [x] AI 프롬프트 자동 생성
- [x] 혼합 자료 처리
- [x] 출처 표시 자동 생성
- [x] 디스클레이머 생성

### 3. 문서 작성
- [x] `REAL_ASSET_GUIDE.md` - 상세 가이드
- [x] `IMPLEMENTATION_PLAN.md` - 이 문서

---

## 🔄 구현 대기 중인 작업

### Phase 1: Core Integration (1-2주)

#### 1.1 실제 자료 검색 강화

**파일**: `lib/mystery/imageSearch.ts`

현재 상태: Wikimedia 검색만 지원

수정 사항:
```typescript
// 현재 코드
async function searchImages(query: string) {
  // Wikimedia만 사용
  return searchWikimedia(query);
}

// 수정 후
async function searchImages(query: string) {
  // 여러 출처에서 검색
  const results = await Promise.all([
    searchArchiveOrg(query),        // 역사 자료
    searchWikimedia(query),         // 백과사전 이미지
    searchGovernmentArchives(query), // 정부 자료
    searchMuseumArchives(query),    // 박물관
    searchNewspaperArchives(query), // 신문 아카이브
  ]);
  
  return mergeAndRankResults(results);
}
```

추가 구현 항목:
- [ ] Archive.org 검색
- [ ] 정부 오픈 데이터 검색
- [ ] 박물관 API 통합 (British Museum, Smithsonian 등)
- [ ] 신문 아카이브 검색 (Chronicling America, 한국신문아카이브 등)
- [ ] 라이선스 필터링
- [ ] 날짜 필터링

#### 1.2 자체 제작 그래픽 생성 강화

**파일**: `lib/mystery/graphics.ts` (새로 생성)

구현할 그래픽 타입:
- [ ] Timeline: 사건 타임라인
- [ ] Map: 장소 표시 지도
- [ ] Diagram: 구조 다이어그램
- [ ] DataCard: 정보 카드
- [ ] Evidence: 증거 설명
- [ ] Comparison: 가설 비교

예시:
```typescript
async function generateTimeline(events: TimelineEvent[]) {
  // SVG로 타임라인 생성
  // 캔버스로 렌더링하여 PNG로 저장
}

async function generateMap(locations: Location[]) {
  // 지도 배경 + 마커 오버레이
  // 경로 시각화
}
```

#### 1.3 AI 재현 프롬프트 최적화

**파일**: `lib/mystery/aiPrompts.ts` (새로 생성)

현재: 일반적인 프롬프트

수정:
```typescript
// 장면 타입별 맞춤형 프롬프트
const prompts = {
  location: (scene) => generateLocationPrompt(scene),
  atmosphere: (scene) => generateAtmospherePrompt(scene),
  reconstruction: (scene) => generateReconstructionPrompt(scene),
  silhouette: (scene) => generateSilhouettePrompt(scene),
};

// 팩트체크된 정보만 포함
function generateReconstructionPrompt(scene) {
  const facts = scene.sources
    .map(s => s.factUsed)
    .filter(Boolean);
  
  return buildPromptFromFacts(facts);
}
```

---

### Phase 2: Pipeline Integration (2-3주)

#### 2.1 Visuals 모듈 수정

**파일**: `lib/mystery/visuals.ts`

현재 플로우:
```
Scene → AI 이미지 생성 → (완료)
```

수정된 플로우:
```
Scene
  ↓
실제 자료 검색 (visualAssetSelector)
  ↓
자료 발견?
  ├─ YES: 실제 자료 사용 (출처 표시)
  ├─ NO: 그래픽 가능?
  │   ├─ YES: 자체 제작 그래픽
  │   ├─ NO: AI 도움?
  │   │   ├─ YES: AI 재현 (표시)
  │   │   ├─ NO: 텍스트 카드
  ↓
(완료)
```

구현:
```typescript
async function generateSceneVisuals(scene: Scene, input: MysteryInput) {
  // 1단계: 실제 자료 검색
  const realAssets = await visualAssetSelector.searchRealAssets(scene);
  
  // 2단계: 자동 선택
  const selection = await visualAssetSelector.selectVisualAsset(
    scene,
    realAssets,
    input
  );
  
  // 3단계: 부족한 부분만 생성
  if (selection.requiresAiReconstruction) {
    const aiImage = await generateAiImage(selection.primary);
    selection.primary.url = aiImage.url;
  }
  
  // 4단계: 메타데이터 저장
  scene.visuals = selection.primary;
  scene.realMaterialSearched = true;
  scene.realMaterialFound = realAssets.length > 0;
  
  return scene;
}
```

#### 2.2 Script 모듈 수정

**파일**: `lib/mystery/script.ts`

추가:
- [ ] 각 문장에 `visualOrigin` 필드 추가
- [ ] 각 문장에 `factStatus` 필드 추가
- [ ] AI 재현 설명 자동 추가 ("재구성하면", "추정하면")

```typescript
// 수정 전
const section = {
  text: "...",
  sources: [],
};

// 수정 후
const section = {
  text: "...",
  sources: [],
  visualOrigin: "REAL_INTERVIEW",
  factStatus: "TESTIMONY",
  needsDisclaimer: false,
};
```

#### 2.3 Render 모듈 수정

**파일**: `lib/mystery/render.ts`

추가:
- [ ] AI 재현 표시 오버레이 추가
- [ ] 출처 표시 자동 추가
- [ ] 자막에 출처 정보 포함

```typescript
function addSourceLabel(frame, scene) {
  if (scene.visuals.sourceLabel) {
    overlayText(frame, scene.visuals.sourceLabel, {
      position: "bottom-left",
      size: "small",
      opacity: 0.8,
    });
  }
}

function addAiDisclaimer(frame, scene) {
  if (scene.visuals.aiGeneration?.displayDisclaimer) {
    overlayText(frame, "AI 재현", {
      position: "top-right",
      size: "small",
      opacity: 0.7,
    });
  }
}
```

---

### Phase 3: Testing & QA (1-2주)

#### 3.1 단위 테스트

추가할 테스트:
- [ ] `visualAssetSelector.test.ts` - 선택 로직 검증
- [ ] `graphicsGenerator.test.ts` - 그래픽 생성 검증
- [ ] `aiPrompts.test.ts` - 프롬프트 생성 검증

#### 3.2 통합 테스트

```bash
# 각 시나리오별 테스트
npm run test:real-asset       # 실제 자료 검색
npm run test:graphic-only     # 그래픽만 사용
npm run test:ai-reconstruction # AI 재현
npm run test:mixed-assets     # 혼합 자료
```

#### 3.3 E2E 테스트

실제 미스터리로 전체 파이프라인 검증:
- [ ] 자료 풍부한 사건 (예: JFK 암살)
- [ ] 자료 부족한 사건 (예: 미스테리)
- [ ] 역사적 사건 (예: 타이타닉)
- [ ] 최근 사건 (예: 실종 사건)

---

### Phase 4: UI 업데이트 (1주)

#### 4.1 Web UI

현재: 간단한 생성 버튼

추가:
- [ ] 실제 자료 검색 결과 표시
- [ ] 자료 선택 UI
- [ ] AI 재현 미리보기
- [ ] 혼합 자료 옵션

#### 4.2 설정 추가

```typescript
interface MysteryInput {
  // 기존
  topic: string;
  targetMinutes: number;
  
  // 신규
  preferRealAssets: boolean; // 실제 자료 우선
  aiReconstructionStyle: "realistic" | "artistic" | "minimal";
  showSourceLabels: boolean;
  showAiDisclaimers: boolean;
}
```

---

## 📊 타임라인

```
현재 (Week 0)
  ├─ 타입 확장: ✅ 완료
  ├─ 유틸리티: ✅ 완료
  └─ 가이드: ✅ 완료

Week 1-2 (Phase 1)
  ├─ 실제 자료 검색 강화
  ├─ 그래픽 생성 모듈
  └─ AI 프롬프트 최적화

Week 3-4 (Phase 2)
  ├─ Visuals 모듈 수정
  ├─ Script 모듈 수정
  └─ Render 모듈 수정

Week 5-6 (Phase 3)
  ├─ 단위 테스트
  ├─ 통합 테스트
  └─ E2E 테스트

Week 7 (Phase 4)
  ├─ Web UI 업데이트
  └─ 설정 추가
```

---

## 🔗 의존성

### 필수
- TypeScript 확장 타입 ✅ 완료
- visualAssetSelector 모듈 ✅ 완료

### 추가 필요
- GraphicsGenerator 모듈 (SVG 기반)
- Archive API 클라이언트
- Government 오픈 데이터 클라이언트

### 선택
- Museum API 통합
- 신문 아카이브 API 통합

---

## 🎯 성공 기준

프로젝트 완료로 간주하는 조건:

1. ✅ 타입 및 인터페이스 확장
2. ✅ 자동 선택 로직 구현
3. ⏳ 실제 자료 검색 통합
4. ⏳ 자체 제작 그래픽 생성
5. ⏳ AI 재현 표시 추가
6. ⏳ 출처 표시 자동화
7. ⏳ 전체 파이프라인 통합
8. ⏳ UI 업데이트
9. ⏳ 완전 테스트 (단위 + 통합 + E2E)

---

## 📝 주의사항

### 보안
- AI 프롬프트는 팩트체크된 정보만 사용
- 사용자 입력 검증 필수
- 라이선스 확인 필수

### 성능
- 실제 자료 검색 병렬화 (시간 최소화)
- 그래픽 생성 캐싱
- 이미지 최적화

### UX
- 명확한 출처 표시
- AI 재현 표시 일관성
- 검색 결과 정렬 (신뢰도 기준)

---

## 💡 향후 확장

추후 추가 가능한 기능:
- [ ] 자동 팩트체크 검증
- [ ] 여러 시각자료 조합 최적화
- [ ] 다국어 지원
- [ ] 동영상 자료 처리
- [ ] 자동 썸네일 생성
- [ ] 소셜 미디어 포스트 생성

---

## 📞 연락처 & 참고

- 가이드: `REAL_ASSET_GUIDE.md`
- 타입: `lib/mystery/types.ts`
- 유틸리티: `lib/mystery/visualAssetSelector.ts`
- 테스트 프레임워크: `TEST_FRAMEWORK.md`
