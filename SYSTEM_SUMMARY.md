# Mystery Documentary Production System - 최종 요약

## 🎯 프로젝트 상태

### Phase 1: 기초 구축 ✅ 완료
- [x] 5단계 테스트 프레임워크 (Doctor → Capability → Dry-run → Scene → Short)
- [x] 환경 진단 시스템
- [x] Mock 모드 지원
- [x] 안정적인 오류 분류 체계
- [x] 무한 루프 방지 메커니즘

### Phase 2: 실제 자료 + AI 혼합 시스템 ✅ 완료
- [x] 데이터 타입 확장 (13가지 VisualOrigin)
- [x] 자동 선택 알고리즘 (4단계 우선순위)
- [x] AI 생성 정보 추적
- [x] 혼합 자료 지원
- [x] 상세 구현 가이드
- [x] 4단계 구현 계획

---

## 📂 파일 구조

```
/home/user/-12/
├── 테스트 프레임워크
│   ├── TEST_FRAMEWORK.md (가이드)
│   ├── FINAL_TEST_RESULTS.md (실행 결과)
│   ├── scripts/
│   │   ├── doctor.js (환경 진단)
│   │   ├── capability-check.js (기능 확인)
│   │   ├── dry-run.js (파이프라인 검증)
│   │   ├── test-scene.js (1씬 렌더링)
│   │   └── test-short.js (3씬 영상 생성)
│   └── diagnostics/ (진단 데이터)
│
├── 실제 자료 + AI 시스템
│   ├── REAL_ASSET_GUIDE.md (상세 가이드)
│   ├── IMPLEMENTATION_PLAN.md (구현 계획)
│   ├── SYSTEM_SUMMARY.md (이 파일)
│   └── lib/mystery/
│       ├── types.ts (확장된 데이터 모델)
│       ├── visualAssetSelector.ts (자동 선택 로직)
│       ├── imageSearch.ts (실제 자료 검색)
│       ├── visuals.ts (시각자료 생성)
│       ├── render.ts (렌더링)
│       ├── script.ts (대본)
│       └── ... (기타 모듈)
│
└── 출력 파일
    └── test-output/ (테스트 비디오 등)
```

---

## 🔄 전체 파이프라인

```
사용자 입력 (미스터리 주제 + 설정)
    ↓
[STAGE 1: 리서치]
  • 웹 검색 (뉴스, 학술자료)
  • 실제 자료 수집 (아카이브, 박물관)
  • 인터뷰 자료 검색
  • 공식 문서 검색
    ↓
[STAGE 2: 팩트체크]
  • 정보 검증 (FACT/TESTIMONY/CLAIM/DISPUTED/UNVERIFIED)
  • 출처 신뢰도 평가
  • 타임라인 구축
    ↓
[STAGE 3: 스크립트 작성]
  • 대본 작성 (각 문장에 출처 연결)
  • VisualOrigin 지정 (REAL/AI/GENERATED)
  • FactStatus 지정
  • 재현 필요 여부 표시
    ↓
[STAGE 4: 씬 분할]
  • 대본 → 16~20개 씬
  • 각 씬에 시각 자료 타입 지정
    ↓
[STAGE 5: 자동 시각 자료 선택] ⭐ NEW
  Question 1: 실제 자료 있나?
    ├─ YES → 실제 자료 사용 (출처 표시)
    ├─ NO → Question 2
    ↓
  Question 2: 그래픽으로 설명 가능?
    ├─ YES → 자체 제작 그래픽 (지도/타임라인/다이어그램)
    ├─ NO → Question 3
    ↓
  Question 3: AI 도움 필요?
    ├─ YES → AI 재현 (명확한 표시)
    ├─ NO → Question 4
    ↓
  Question 4: 텍스트만으로 충분?
    ├─ YES → 텍스트 카드 + 내레이션
    ↓
[STAGE 6: 내레이션 생성]
  • TTS (한국어 음성)
  • 목소리 톤 설정
    ↓
[STAGE 7: 출처 및 표시 추가]
  • 화면에 출처 표시 (좌하단)
  • AI 재현 표시 (우상단)
  • 자막에 출처 정보 포함
    ↓
[STAGE 8: BGM 및 효과음]
  • 배경음악
  • 자막
    ↓
[STAGE 9: 렌더링]
  • FFmpeg로 MP4 생성
  • 1920x1080 @ 30fps
  • H.264 + AAC
    ↓
최종 영상 (실제 자료 + 그래픽 + AI 혼합)
```

---

## 🎬 시각 자료 우선순위

### Tier 1: 실제 자료 (50-70%)
```
아카이브 사진 > 뉴스 영상 > 인터뷰 > 사건 영상 > 공식 문서 > 정부 자료 > 신문 아카이브 > 지도
```
**특징**: 원본 자료, 출처 명확, 신뢰도 높음

### Tier 2: 자체 제작 그래픽 (15-25%)
```
타임라인 > 지도 > 다이어그램 > 데이터 카드 > 증거 설명
```
**특징**: 정보 전달, 구조 설명, 실제 자료 보완

### Tier 3: AI 재현 (10-25%)
```
분위기 이미지 > 역사적 상황 > 장소 재현 > 실루엣/뒷모습 > 경로 시각화
```
**특징**: 명확한 표시, 팩트 기반, 설명 보조

---

## 📊 핵심 메타데이터 구조

### 각 Scene에 저장되는 정보

```typescript
Scene {
  id: string;
  
  // 내용
  text: string;
  
  // 시각 자료
  visuals: SceneVisual | SceneVisual[];
  
  // 우선순위 추적
  realMaterialSearched: boolean;      // 실제 자료 검색 여부
  realMaterialFound: boolean;         // 실제 자료 발견 여부
  requiresAiReconstruction: boolean;  // AI 재현 필요 여부
  
  // 팩트 정보
  factStatus: FactStatus;             // FACT/TESTIMONY/CLAIM/DISPUTED/UNVERIFIED
  sources: SourceRef[];               // 근거 출처들
  
  // AI 생성 정보
  aiReconstructionExplained: boolean;  // "재구성하면" 등 설명 여부
}

SceneVisual {
  type: SceneVisualType;              // archive_photo, map, ai_reconstruction 등
  origin: VisualOrigin;               // REAL/AI/GENERATED 구분
  
  // 실제 자료의 경우
  sourceId: string;
  sourceTitle: string;
  sourcePublisher: string;
  sourceDate: string;
  sourceLabel: string;                // "자료: BBC / 2019"
  license: string;
  
  // AI 생성의 경우
  aiGeneration: {
    model: string;
    prompt: string;
    generatedAt: string;
    displayDisclaimer: boolean;
    disclaimerText: string;
  };
}
```

---

## ✅ 구현 완료 목록

### 데이터 모델 ✅
- [x] VisualOrigin (13가지 타입)
- [x] AiGenerationInfo
- [x] SceneVisual
- [x] Scene 확장
- [x] ScriptSection 확장

### 비즈니스 로직 ✅
- [x] selectVisualAsset() - 4단계 선택
- [x] scoreRealAsset() - 실제 자료 평점
- [x] canUseGraphic() - 그래픽 가능 여부
- [x] shouldUseAiReconstruction() - AI 필요 여부
- [x] generateAiPrompt() - 팩트 기반 프롬프트
- [x] formatSourceLabel() - 출처 표시 생성
- [x] generateDisclaimer() - 디스클레이머 생성

### 문서 ✅
- [x] REAL_ASSET_GUIDE.md (15 섹션)
- [x] IMPLEMENTATION_PLAN.md (4 Phase)
- [x] SYSTEM_SUMMARY.md (이 파일)

### 테스트 프레임워크 ✅
- [x] npm run doctor (환경 진단)
- [x] npm run capability (기능 확인)
- [x] npm run dry-run (파이프라인 검증)
- [x] npm run test:scene (1씬 렌더링)
- [x] npm run test:short (3씬 영상)

---

## 🚀 다음 단계

### 즉시 (1-2주)
1. ✅ 코드 리뷰 및 타입 검증
2. ⏳ 실제 자료 검색 강화
   - Archive.org API 통합
   - 정부 오픈 데이터 통합
   - 박물관 API 통합
3. ⏳ 그래픽 생성 모듈 (Timeline, Map, Diagram)

### 단기 (3-4주)
4. ⏳ Visuals 모듈 수정 (selectVisualAsset 통합)
5. ⏳ Script 모듈 수정 (VisualOrigin/FactStatus 추가)
6. ⏳ Render 모듈 수정 (출처/AI 표시 추가)

### 중기 (5-6주)
7. ⏳ 단위 및 통합 테스트
8. ⏳ E2E 테스트 (실제 미스터리 5건)
9. ⏳ 성능 최적화

### 장기 (7주+)
10. ⏳ Web UI 업데이트
11. ⏳ 자동 팩트체크 검증
12. ⏳ 다국어 지원

---

## 📋 최종 검증 기준

영상이 완성되었을 때 확인할 사항:

```
품질 체크리스트:
  [ ] 실제 자료가 우선되었는가? (50-70%)
  [ ] AI 재현이 명확하게 표시되었는가?
  [ ] 모든 출처가 표기되었는가? (자료명/출처/날짜)
  [ ] "재구성하면", "추정하면" 표현이 있는가?
  [ ] 팩트와 추측이 구분되었는가?
  [ ] 실제 영상처럼 보이는 AI 장면은 없는가?
  [ ] 라이선스가 준수되었는가?
  [ ] 시청자가 "자료를 많이 조사했네"라고 느껴지는가?
```

---

## 🎯 핵심 원칙 (개발 중 항상 확인)

### DO ✅
- 실제 자료 먼저 검색
- 모든 출처 명시
- AI 재현 명확하게 표시
- 팩트 기반 프롬프트만 사용
- "재구성하면", "추정하면" 표현 사용
- 혼합 자료 지원

### DON'T ❌
- AI 영상을 CCTV처럼 표시
- AI 영상을 뉴스처럼 표시
- AI 인물을 실제처럼 말하게 함
- 존재하지 않는 증거 생성
- 존재하지 않는 문서 생성
- AI 이미지를 실제로 표시

---

## 📞 참고 자료

| 문서 | 용도 |
|------|------|
| REAL_ASSET_GUIDE.md | 자료 선택 상세 가이드 |
| IMPLEMENTATION_PLAN.md | 구현 로드맵 및 단계별 계획 |
| TEST_FRAMEWORK.md | 테스트 프레임워크 사용법 |
| lib/mystery/types.ts | 데이터 타입 정의 |
| lib/mystery/visualAssetSelector.ts | 자동 선택 로직 구현 |

---

## 🎬 완성된 영상의 모습

### 최종 영상의 특징
```
"이것은 AI가 만든 다큐멘터리다"가 아니라
"실제 자료를 철저하게 조사하고, 부족한 부분만 AI로 재구성한 다큐멘터리다"

라는 느낌을 줌
```

### 예시 구성
```
[씬 1] 실제 신문 사진 (1970년대)
  → "당시 신문 보도에 따르면..."
  → 출처 표시: "자료: ○○신문 / 1970"

[씬 2] 자체 제작 타임라인 그래픽
  → "사건의 진행 순서를 보면..."
  → 그래픽 표시: 자동 생성

[씬 3] AI 재현 이미지 (분위기)
  → "당시 상황을 재구성하면..."
  → AI 표시: "AI 재현"

[씬 4] 실제 인터뷰 클립 (5초)
  → "증인은 이렇게 증언했습니다..."
  → 출처 표시: "인터뷰: ○○ / ○○방송 / 2017"

[씬 5] 공식 문서 스크린샷
  → "공식 기록에 따르면..."
  → 출처 표시: "자료: 정부 공식 문서"
```

---

## 🏁 결론

### 현재 상태
✅ **아키텍처 완성** - 데이터 모델, 로직, 문서 모두 준비됨
⏳ **구현 대기** - 각 모듈과의 통합 작업 필요

### 다음 작업
1. 실제 자료 검색 강화
2. 각 모듈 순차적 수정
3. 테스트 및 최적화
4. UI 업데이트

### 예상 완료 시간
- Phase 1 (Core Integration): 1-2주
- Phase 2 (Pipeline Integration): 2-3주
- Phase 3 (Testing & QA): 1-2주
- Phase 4 (UI Update): 1주
- **총 예상: 5-8주**

---

**상태**: 🟢 기초 완성, 통합 대기  
**최종 목표**: 2026년 9월 중순 출시 준비 완료

