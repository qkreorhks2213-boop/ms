# Mystery Documentary Pipeline - STEP MAPPING

**작성일**: 2026-08-17  
**상태**: 초기 분석 (현재 시스템 감사 중)  
**버전**: 1.0-DRAFT

---

## 📋 공식 STEP 정의 (STEP_01 ~ STEP_14)

이 문서는 Mystery Documentary Pipeline의 공식 14개 Step을 정의합니다.

모든 코드, UI, API, 상태 관리에서 이 Step ID만 사용해야 합니다.

---

### STEP_01: Research Investigation

**기능**: 주어진 주제에 대해 실제 뉴스, 자료, 정보를 수집합니다.

**입력**:
- projectId
- topic (문제 제목)
- caseType, angles, endingStyle

**처리**:
- Web search 또는 offline data 사용
- 최소 3~5개의 source 수집
- 각 source에 URL, publisher, date, title 기록

**출력**:
- `project.research: ResearchFinding[]`
- 각 finding: { source, title, publisher, url, date, retrievedAt }

**저장 위치**: `project.research`

**완료 조건**:
- research.length > 0
- 모든 source에 publisher 있음
- 모든 source에 URL 있음

**실패 조건**:
- research 수집 불가
- source 데이터 부족

**검증**: `lib/mystery/research.ts` - `researchTopic()`

**다음 단계**: STEP_02

---

### STEP_02: Fact-Checking & Analysis

**기능**: Research 결과의 주요 주장을 분석하고 팩트 체크합니다.

**입력**:
- projectId
- project.research

**처리**:
- 각 claim 추출
- verified / disputed / testimony / unknown 분류
- 신뢰도 점수 계산

**출력**:
- `project.factcheckResults: FactCheckResult`
- Record<claim, FactStatus>

**저장 위치**: `project.factcheckResults`

**완료 조건**:
- factcheckResults 존재
- verified + disputed + testimony > 0

**실패 조건**:
- factcheckResults 생성 실패

**검증**: `lib/mystery/factcheck.ts` - `analyzeResearchClaims()`

**다음 단계**: STEP_03

---

### STEP_03: Timeline Generation

**기능**: Research와 Fact-Check 결과를 기반으로 시간 흐름을 구성합니다.

**입력**:
- projectId
- project.research
- project.factcheckResults

**처리**:
- 주요 사건을 시간순 정렬
- 각 이벤트에 date, title, description 기록
- source 연결

**출력**:
- `project.timeline: TimelineEvent[]`
- 각 event: { date, title, description, source }

**저장 위치**: `project.timeline`

**완료 조건**:
- timeline.length > 0
- 모든 event에 date 있음
- timeline이 시간순 정렬됨

**실패 조건**:
- timeline 생성 불가
- event 개수 0

**검증**: `lib/mystery/timeline.ts` - `generateTimeline()`

**다음 단계**: STEP_04

---

### STEP_04: Script Generation

**기능**: Research, Fact-Check, Timeline을 기반으로 내레이션 스크립트를 생성합니다.

**입력**:
- projectId
- project.research
- project.factcheckResults
- project.timeline
- project.input.targetMinutes

**처리**:
- Hook (introduction) 생성
- Chapters (body) 생성 - 주요 사건별 내용
- Summary (conclusion) 생성
- 총 길이 검증 (targetMinutes ±10%)

**출력**:
- `project.script: MysteryScript`
- MysteryScript: { sections: ScriptSection[], estimatedMinutes, totalChars }
- Section: { id, kind (hook/chapter/summary), text, duration }

**저장 위치**: `project.script`

**완료 조건**:
- script.sections.length >= 3 (hook + at least 1 chapter + summary)
- estimatedMinutes 내에 targetMinutes ±10%
- 모든 section text 존재하고 비어있지 않음
- totalChars 계산 정확

**실패 조건**:
- 일부 section 생성 실패 → 전체 FAIL (CRITICAL error)
- 길이 tolerance 벗어남
- hook/chapter/summary 중 하나라도 비어있음

**검증**: `lib/mystery/script.ts` - `generateScript()`

**다음 단계**: STEP_05

---

### STEP_05: Scene Composition

**기능**: Script를 개별 Scene으로 분해합니다. 각 Scene은 시각 자료와 연결됩니다.

**입력**:
- projectId
- project.script
- project.input.sceneVisualTarget

**처리**:
- Script section별로 장면(Scene) 생성
- 각 Scene에 narration text, visual requirement 할당
- Scene 개수가 targetCount ±20% 범위 내 조정
- Scene timing 계산 (startTime, endTime, duration)

**출력**:
- `project.scenes: Scene[]`
- Scene: { 
    id, 
    sectionId, 
    text, 
    visualType, 
    visualQuery,
    startTime (초),
    endTime (초),
    duration (초),
    narrationSegmentId (나중에 채워짐)
  }

**저장 위치**: `project.scenes`

**완료 조건**:
- scenes.length >= targetCount * 0.8 AND <= targetCount * 1.2
- 모든 scene에 id, text, sectionId 있음
- 모든 scene에 startTime, endTime, duration 있음
- timing이 누적되어 있음 (scene[0].startTime = 0, scene[n].endTime = totalDuration)

**실패 조건**:
- scenes.length 목표 범위 밖
- Scene 생성 실패
- timing 계산 오류

**검증**: `lib/mystery/scenes.ts` - `generateScenes()`

**다음 단계**: STEP_06

---

### STEP_06: Visual Discovery & Asset Integration

**기능**: 각 Scene에 필요한 시각 자료를 검색하고 연결합니다.

**입력**:
- projectId
- project.scenes
- project.name (topic)

**처리**:
- 각 scene의 visualQuery로 실제 이미지/비디오 검색
- Real photos, videos, documents 우선 수집
- Asset 메타데이터 (width, height, source URL) 기록
- Scene-Asset 매핑

**출력**:
- `project.sceneAssets: SceneAsset[]`
- Asset in Scene: { sceneId, assetUrl, assetType, width, height, source, attribution }

**저장 위치**: `project.sceneAssets`

**완료 조건**:
- sceneAssets.length > 0
- 모든 scene에 최소 1개의 asset 연결
- Asset metadata 완전

**실패 조건**:
- Asset 수집 불가능
- Scene-asset 매핑 실패

**검증**: `lib/mystery/assets.ts` - `integrateAssetsWithScenes()`

**다음 단계**: STEP_07

---

### STEP_07: Visual Generation (Real + AI)

**기능**: 부족한 시각 자료를 실제 이미지로 생성/보강합니다. 실제 이미지 위주, 필요시 AI 생성.

**입력**:
- projectId
- project.scenes
- project.sceneAssets
- project.input.useRealPhotos, useAiReconstruction

**처리**:
- 각 scene별 최종 시각 자료 생성/다운로드
- Real photo 우선 사용
- 부족하면 graphics/AI generated image 생성
- 모든 생성 이미지를 disk에 저장: `projects/{projectId}/scenes/`

**출력**:
- 각 scene에 실제 파일 생성: `scene_1.png`, `scene_2.png`, ...
- `project.scenes[].visualStatus = "done"`
- `project.scenes[].visualUrl` = path to image

**저장 위치**: Disk + project.scenes[].visualUrl

**완료 조건**:
- projectDir(projectId)/scenes/ 디렉토리 존재
- 모든 scene에 해당하는 PNG 파일 존재
- 각 파일 크기 > 100KB
- project.scenes[].visualStatus = "done" (모든 scene)

**실패 조건**:
- Visual 생성 불가 (80% 이상 실패)
- 파일 시스템 오류

**검증**: `lib/mystery/visuals.ts` - `generateAllSceneVisuals()`

**다음 단계**: STEP_08

---

### STEP_08: Scene Optimization

**기능**: 지루하거나 중복된 scene을 탐지하고 제거/통합합니다.

**입력**:
- projectId
- project.scenes (with visuals)

**처리**:
- 각 scene의 "지루함" 점수 계산 (짧은 지속시간, 반복된 visual 등)
- 지루한 scene 제거 또는 인접 scene과 병합
- Scene 목록 최적화

**출력**:
- `project.scenes` 업데이트 (일부 scene 제거 가능)

**저장 위치**: `project.scenes`

**완료 조건**:
- scenes.length > 0
- 최적화된 scene list 저장됨

**실패 조건**:
- Scene 최적화 중 데이터 손실

**검증**: `lib/mystery/boredumDetector.ts` - `detectBoringScenes()`, `optimizeBoringScenes()`

**다음 단계**: STEP_09

---

### STEP_09: Narration Generation

**기능**: 각 Scene의 script text를 음성(TTS)으로 변환합니다.

**입력**:
- projectId
- project.scenes
- project.script
- project.input.voiceName

**처리**:
- 각 scene의 text → Piper TTS로 음성 생성
- Audio file 저장: `projects/{projectId}/narration/segment_0.wav`, ...
- 실제 audio duration FFprobe로 측정
- NarrationSegment 생성

**출력**:
- Disk: narration/*.wav 파일들
- `project.narrationSegments: NarrationSegment[]`
- NarrationSegment: { id, sceneId, sectionId, text, audioPath, durationSeconds }

**저장 위치**: Disk + project.narrationSegments

**완료 조건**:
- narrationSegments.length = scenes.length
- 모든 segment에 audioPath 있음
- 모든 audio 파일 존재 (실제 파일)
- durationSeconds는 FFprobe로 측정한 실제 값

**실패 조건**:
- Piper TTS 실패
- Audio 파일 생성 실패
- duration 측정 실패

**검증**: `lib/mystery/narration.ts` - `generateNarrationForScenes()`

**다음 단계**: STEP_10

---

### STEP_10: Subtitle Generation

**기능**: Narration audio의 timing을 기반으로 자막을 생성합니다.

**입력**:
- projectId
- project.scenes
- project.narrationSegments
- language (default: ko-KR)

**처리**:
- 각 narrationSegment의 시작/끝 시간 기반 자막 생성
- Scene ID와 subtitle timing 연결
- SubtitleTrack 생성

**출력**:
- `project.subtitleTracks: SubtitleTrack[]`
- SubtitleTrack: { language, subtitles: Subtitle[] }
- Subtitle: { startTime, endTime, sceneId, text }

**저장 위치**: `project.subtitleTracks`

**완료 조건**:
- subtitleTracks.length > 0
- 모든 subtitle에 startTime, endTime, text 있음
- Subtitle timing이 정확함

**실패 조건**:
- Subtitle 생성 실패

**검증**: `lib/mystery/subtitles.ts` - `generateSubtitles()`

**다음 단계**: STEP_11

---

### STEP_11: Quality Verification

**기능**: 지금까지 생성된 모든 산출물이 완전한지 검증합니다.

**입력**:
- projectId
- project (전체)

**처리**:
- Research: 데이터 존재 확인
- Script: 모든 section 확인, 길이 검증
- Scenes: 개수, timing, visual 파일 확인
- Narration: Audio 파일 존재 확인
- Subtitles: Track 존재 확인
- 각 검증 단계 기록

**출력**:
- 검증 결과 저장
- 실패 항목 리스트 (있으면 throw CRITICAL error)

**저장 위치**: Error log (project.errorLog)

**완료 조건**:
- 모든 필수 항목 검증 완료
- 검증 실패 0개

**실패 조건**:
- 어떤 항목이라도 검증 실패

**검증**: `lib/mystery/final-quality-gate.ts` - `runFinalQualityGate()`

**다음 단계**: STEP_12

---

### STEP_12: Video Rendering

**기능**: Scene visuals + Narration audio + Subtitles를 하나의 MP4 파일로 렌더링합니다.

**입력**:
- projectId
- project.scenes (with visual files)
- project.narrationSegments (with audio files)
- project.subtitleTracks

**처리**:
- Production renderer (1920x1080, 30fps, H.264, AAC)
- 각 scene visual을 sequence로 배열
- Narration audio 동기화
- Subtitle burn-in 또는 separate track 추가
- FFmpeg로 최종 MP4 인코딩

**출력**:
- `projects/{projectId}/output.mp4` (실제 파일)
- `project.output.mp4` = path to file

**저장 위치**: Disk + project.output

**완료 조건**:
- output.mp4 파일 실제 존재
- 파일 크기 > 5MB
- 파일 duration 정확
- Resolution = 1920x1080
- Video codec = H.264
- Audio codec = AAC

**실패 조건**:
- MP4 생성 실패
- 파일 손상

**검증**: `lib/mystery/render-simple.ts` - `renderMysteryVideo()`

**다음 단계**: STEP_13

---

### STEP_13: Final MP4 Validation

**기능**: 생성된 MP4의 무결성과 품질을 최종 검증합니다.

**입력**:
- projectId
- output.mp4 파일

**처리**:
- FFprobe로 메타데이터 확인
- Resolution, FPS, duration, codec 검증
- Audio level 확인
- Black frame 감지
- Silent audio 감지
- Actual frame 추출 및 검증

**출력**:
- 검증 결과 (pass/fail)
- 상세 메타데이터

**저장 위치**: Error log (project.errorLog)

**완료 조건**:
- MP4 file exists
- Duration accurate
- Resolution = 1920x1080
- FPS = 30
- Video codec = H.264
- Audio codec = AAC
- Frame sampling PASS
- Audio level PASS
- Black frame 0%
- Silent audio 0%

**실패 조건**:
- 어떤 검증이라도 실패

**검증**: `lib/mystery/render-validate.ts` - `validateMP4WithFFprobe()`

**다음 단계**: STEP_14

---

### STEP_14: Completion & Archival

**기능**: 최종 완료 처리, 프로젝트 상태 업데이트, 산출물 아카이빙.

**입력**:
- projectId
- project (전체 상태)

**처리**:
- Project stage = "done"
- 최종 metadata 기록
- 성공 로그 저장
- 임시 파일 정리
- Public 폴더에 최종 산출물 복사

**출력**:
- project.stage = "done"
- project.completedAt = timestamp
- Public archive 생성

**저장 위치**: project.stage, project.completedAt

**완료 조건**:
- project.stage = "done"
- 모든 산출물 존재
- 검증 PASS

**실패 조건**:
- 이전 단계 실패 시 도달할 수 없음

---

## 📊 Step 간 데이터 흐름

```
STEP_01 Research
    ↓ project.research
STEP_02 Fact-Check
    ↓ project.factcheckResults
STEP_03 Timeline
    ↓ project.timeline
STEP_04 Script
    ↓ project.script
STEP_05 Scene Composition
    ↓ project.scenes
STEP_06 Visual Discovery
    ↓ project.sceneAssets
STEP_07 Visual Generation
    ↓ disk: scenes/*.png
STEP_08 Scene Optimization
    ↓ project.scenes (updated)
STEP_09 Narration
    ↓ disk: narration/*.wav + project.narrationSegments
STEP_10 Subtitles
    ↓ project.subtitleTracks
STEP_11 Quality Verification
    ↓ validation PASS/FAIL
STEP_12 Video Rendering
    ↓ disk: output.mp4
STEP_13 Final Validation
    ↓ validation PASS/FAIL
STEP_14 Completion
    ↓ project.stage = "done"
```

---

## 🔍 검증 체크리스트

### 기본 검증

- [ ] project.research 존재 여부
- [ ] project.factcheckResults 존재 여부
- [ ] project.timeline 존재 여부
- [ ] project.script 존재 여부
- [ ] project.scenes 존재 여부
- [ ] project.narrationSegments 존재 여부
- [ ] project.subtitleTracks 존재 여부

### 파일 검증

- [ ] scenes/*.png 파일 모두 존재
- [ ] narration/*.wav 파일 모두 존재
- [ ] output.mp4 파일 존재
- [ ] output.mp4 파일 크기 > 5MB
- [ ] output.mp4 파일 손상 없음

### 메타데이터 검증

- [ ] script.sections 모두 비어있지 않음
- [ ] scenes 개수 tolerance 범위 내
- [ ] scenes timing 누적 정확
- [ ] narrationSegments duration FFprobe 값
- [ ] subtitles timing 정확

### MP4 검증

- [ ] Resolution = 1920x1080
- [ ] FPS = 30
- [ ] Duration = expected
- [ ] Video codec = H.264
- [ ] Audio codec = AAC
- [ ] Audio level normal
- [ ] No black frames
- [ ] No silent sections
- [ ] Browser playback PASS

---

## 🚀 현재 상태 분석

### 현재 구현된 Step

| Step | 상태 | 설명 |
|------|------|------|
| STEP_01 | ✓ 부분 | research.ts 존재, 하지만 실제 data source 검증 필요 |
| STEP_02 | ✓ 부분 | factcheck.ts 존재, 하지만 실제 검증 로직 미흡 |
| STEP_03 | ✓ 부분 | timeline.ts 존재, 하지만 event 생성 검증 필요 |
| STEP_04 | ✓ 부분 | script.ts 존재, 단위 오류 수정됨, 하지만 validation 강화 필요 |
| STEP_05 | ✓ 부분 | scenes.ts 존재, 하지만 timing 검증 필요 |
| STEP_06 | ✓ 부분 | assets.ts 존재, 하지만 실제 asset 수집 검증 필요 |
| STEP_07 | ✓ 부분 | visuals.ts 존재, 하지만 실제 이미지 생성/다운로드 검증 필요 |
| STEP_08 | ✓ 부분 | boredumDetector.ts 존재, 하지만 실제 작동 검증 필요 |
| STEP_09 | ✓ 부분 | narration.ts 존재, duration 개선됨, 하지만 실제 audio file 검증 필요 |
| STEP_10 | ✓ 부분 | subtitles.ts 존재, 하지만 실제 timing 검증 필요 |
| STEP_11 | ✓ 부분 | final-quality-gate.ts 존재, 하지만 실제 파일 검증 필요 |
| STEP_12 | ✓ 부분 | render-simple.ts 존재, 1920x1080 설정됨, 하지만 실제 MP4 생성 검증 필요 |
| STEP_13 | ✓ 부분 | render-validate.ts 존재, 하지만 실제 MP4 검증 강화 필요 |
| STEP_14 | ✗ 미구현 | Completion logic 거의 없음 |

### 주요 문제점

1. **Auto-pipeline의 Step ID 일관성 부족**
   - 현재: 1, 2, 3, ..., 13, 7.5, 9.5 형태로 혼재
   - 필요: STEP_01 ~ STEP_14로 통일

2. **UI와 Backend Step 불일치**
   - 현재 app/mystery/page.tsx는 step 단계를 제대로 표시 안 함

3. **각 Step의 실제 검증 미흡**
   - 대부분의 step이 "완료 처리만 했지만 실제 산출물 검증 없음"

4. **API와 UI 연결 부족**
   - API는 있지만 UI에서 각 Step을 개별 실행할 수 없음

5. **프로젝트 상태 추적 부족**
   - Project JSON에 각 Step의 status (pending/running/completed/failed) 기록 안 함

---

## 📝 다음 작업

1. ✓ STEP 정의 완료 (이 문서)
2. [ ] Backend Step 상태 관리 구조 구현
3. [ ] Auto-pipeline Step ID 통일
4. [ ] 각 Step의 실제 검증 강화
5. [ ] UI 재구축 (Step progress, individual step run)
6. [ ] API 통합
7. [ ] E2E 테스트
8. [ ] 최종 MP4 검증

---

**이 문서는 작업이 진행되면서 지속적으로 업데이트됩니다.**
