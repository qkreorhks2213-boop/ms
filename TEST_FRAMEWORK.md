# Mystery Video Pipeline - Stable Test Framework

## 개요

무한 오류 수정 루프를 제거하고 **안정적인 진단-테스트 시스템**으로 전환했습니다.

**목표**: 현재 환경에서 가능한 기능을 먼저 찾아내고, 가능한 기능으로 안정적으로 테스트하고, 불가능한 기능은 명확하게 차단하고, 다른 기능은 계속 개발할 수 있는 프로그램

---

## 5단계 테스트 프로세스

### LEVEL 0: Environment Check ✅

```bash
npm run doctor
```

**역할**: 시스템 도구, 환경변수, npm 패키지, 인터넷 연결 확인

**출력**: `/diagnostics/environment.json`

**상태 해석**:
- `PASS`: 모든 필수 요소 준비됨
- `WARN`: 일부 선택사항 누락 (계속 진행 가능)
- `FAIL`: 필수 요소 누락 (진행 불가능)

---

### LEVEL 1: Capability Check ✅

```bash
npm run capability
```

**역할**: 각 기능을 최소 테스트로 확인

**테스트 항목**:
1. **Web Research** - Google News RSS 피드
2. **Fact Check** - JSON 파싱 검증
3. **LLM Script** - OLLAMA 또는 Mock
4. **Image Search** - Wikimedia API
5. **TTS** - 음성 합성
6. **FFmpeg** - 비디오 렌더링
7. **Project Storage** - 파일 I/O
8. **Mock Mode** - 테스트 모드 활성화 여부

**출력**: `/diagnostics/capability-matrix.json`

**상태 해석**:
- `AVAILABLE` - 기능 사용 가능
- `AVAILABLE (MOCK)` - Mock 모드로 테스트 가능
- `UNAVAILABLE` - 기능 사용 불가능
- `DEFERRED` - 실제 사용 시점에 테스트

**Mock Mode 활성화**:
```bash
MYSTERY_MOCK_MODE=true npm run capability
```

외부 API 없이 테스트 데이터로 진행합니다.

---

### LEVEL 2: Dry Run ✅

```bash
MYSTERY_MOCK_MODE=true npm run dry-run
```

**역할**: 실제 데이터 없이 전체 파이프라인이 연결되어 있는지 확인

**테스트 단계**:
1. Research - 10개 자료 검색 (Mock)
2. Fact Check - 사실 검증 (Mock)
3. Script - 16장 대본 생성 (Mock)
4. Scenes - 장면 분할 (Mock)
5. Visuals - 시각자료 할당 (Mock)
6. Narration - 내레이션 (Mock)
7. Render - 렌더링 준비 (Mock)

**출력**: `/diagnostics/dry-run-result.json`

**특징**:
- API 호출 없음
- 이미지 생성 없음
- TTS 생성 없음
- 실제 렌더링 없음
- 데이터 구조만 검증

---

### LEVEL 3: One Scene Test ✅

```bash
npm run test:scene
```

**역할**: 1개 씬 완성 (실제 렌더링)

**구성**:
1. 텍스트 → 이미지 생성
2. 오디오 생성 (6초)
3. FFmpeg로 MP4 렌더링 (3~5초 영상)

**출력**: 
- `/test-output/test-scene.mp4` - 최종 영상
- `/diagnostics/test-scene-result.json` - 테스트 결과

**검증 내용**:
- 이미지 생성 성공
- 오디오 생성 성공
- FFmpeg 렌더링 성공
- 최종 MP4 파일 생성

---

### LEVEL 4: Short Video Test ✅

```bash
npm run test:short
```

**역할**: 2~3분 테스트 영상으로 전체 파이프라인 검증

**구성**:
- 주제: "칸다하르의 거인"
- 씬: 3개
- 각 씬: 45~50초
- 총 길이: 약 2~3분

**각 씬**:
1. 사건 개요 + 색상 배경
2. 증거와 기록 + 지도 배경
3. 결론 + 타임라인 배경

**출력**:
- `/test-output/test-short-video.mp4` - 최종 영상
- `/test-output/scene-0.mp4`, `scene-1.mp4`, `scene-2.mp4` - 각 씬
- `/diagnostics/test-short-result.json` - 테스트 결과

**검증 내용**:
- 여러 씬 처리
- 이미지 색상 구분
- 오디오 길이 정확성
- 씬 연결 (concat)
- 최종 영상 품질

---

## 오류 분류 및 처리

### 오류 5가지 분류

#### A. 환경 오류
**예**: FFmpeg 미설치, Python 없음, 권한 문제

**처리**:
```
ERROR_CLASS: ENVIRONMENT
TESTABLE: NO
AUTO_FIXABLE: NO
→ 사용자가 환경을 설정해야 함
```

#### B. 설정 오류
**예**: API KEY 없음, 환경변수 누락

**처리**:
```
ERROR_CLASS: CONFIG
TESTABLE: YES (Mock mode로)
AUTO_FIXABLE: NO
→ Mock 모드 활성화 또는 환경변수 설정
```

#### C. 의존성 오류
**예**: npm package 없음, 버전 충돌

**처리**:
```
ERROR_CLASS: DEPENDENCY
TESTABLE: YES (새로 설치 후)
AUTO_FIXABLE: YES
→ npm install 실행
```

#### D. 코드 오류
**예**: TypeScript 오류, API 오류

**처리**:
```
ERROR_CLASS: CODE
TESTABLE: YES
AUTO_FIXABLE: YES (일반적으로)
→ 코드 수정 후 재테스트
```

#### E. 외부 서비스 오류
**예**: API 서버 다운, rate limit, 네트워크

**처리**:
```
ERROR_CLASS: EXTERNAL
TESTABLE: NO
AUTO_FIXABLE: NO
→ 서비스 복구 대기 또는 Mock 사용
```

---

## 핵심 규칙

### ✅ 해야 할 것

1. **환경 먼저 확인** - `npm run doctor` 실행 후 시작
2. **기능별 테스트** - `npm run capability`로 가능한 것 확인
3. **연결성 검증** - `npm run dry-run`으로 파이프라인 연결성 확인
4. **최소 테스트** - 1개 씬 또는 2~3분으로 테스트
5. **점진적 확장** - 1씬 → 3씬 → 전체 영상

### ❌ 절대 하지 말 것

1. **같은 오류 반복** - 최대 2회만 같은 방법으로 시도
2. **외부 API 없이 계속 시도** - Mock 모드 사용 또는 BLOCKED 처리
3. **불가능한 기능 강제** - Fallback 또는 생략
4. **무한 수정 루프** - 5회 수정 후에도 실패하면 BLOCKED
5. **테스트 불가능한 환경에서 계속** - 환경 준비 후 진행

---

## Mock Mode 사용

### 활성화

```bash
MYSTERY_MOCK_MODE=true npm run capability
MYSTERY_MOCK_MODE=true npm run dry-run
```

또는 `.env.development`에 설정:
```
MYSTERY_MOCK_MODE=true
```

### Mock 모드에서 사용 불가능한 것

- 실제 웹 검색
- 실제 이미지 다운로드
- 실제 TTS 생성
- 실제 비디오 렌더링

### Mock 모드에서 사용 가능한 것

- 데이터 구조 검증
- 파이프라인 연결성 확인
- 오류 처리 로직 검증
- 저장 및 로드 기능

---

## 진단 파일

### `/diagnostics/environment.json`
- 시스템 도구 상태
- 환경변수 상태
- npm 패키지 설치 상태
- 인터넷 연결 상태

### `/diagnostics/capability-matrix.json`
- 각 기능의 가용성
- 오류 원인
- 자동 해결 가능 여부
- 사용자 조치 필요 여부

### `/diagnostics/dry-run-result.json`
- 각 파이프라인 단계의 통과 여부
- 데이터 구조 검증 결과
- 오류 로그

### `/diagnostics/test-scene-result.json`
- 이미지 생성 성공/실패
- 오디오 생성 성공/실패
- 비디오 렌더링 성공/실패

### `/diagnostics/test-short-result.json`
- 3개 씬 처리 결과
- 씬별 크기/길이
- 최종 영상 품질

---

## 사용 예시

### 시나리오 1: 완전히 새로운 환경

```bash
# Step 1: 환경 확인
npm run doctor

# → 결과: FFmpeg 없음, API KEY 없음
# → 원인: 환경 부족

# Step 2: 기능 확인 (Mock 사용)
MYSTERY_MOCK_MODE=true npm run capability

# → 결과: 모두 AVAILABLE (MOCK)

# Step 3: 파이프라인 테스트 (Mock)
MYSTERY_MOCK_MODE=true npm run dry-run

# → 결과: 모든 단계 PASS

# Step 4: FFmpeg 설치 후 실제 테스트
npm run test:scene

# → 비디오 생성 성공
```

### 시나리오 2: API 없음

```bash
# Doctor
npm run doctor

# → 결과: OPENAI_API_KEY 없음

# Capability
npm run capability

# → 결과: LLM Script = UNAVAILABLE

# 해결책
# Option A: Mock 모드 사용
MYSTERY_MOCK_MODE=true npm run test:short

# Option B: API KEY 설정 후 재시도
export OPENAI_API_KEY=sk-xxx
npm run capability
```

### 시나리오 3: FFmpeg 렌더링 실패

```bash
# Test:scene 실패
npm run test:scene

# → 오류: FFmpeg rendering failed

# 오류 분류
ERROR_CLASS: ENVIRONMENT
TESTABLE: YES (Mock으로 검증)
AUTO_FIXABLE: NO (FFmpeg 설치 필요)

# Mock으로 파이프라인 검증
MYSTERY_MOCK_MODE=true npm run dry-run

# → PASS

# FFmpeg 설치 후 다시
# (또는 CI/CD 환경에서는 Docker 사용)
```

---

## 현재 상태

### ✅ 준비된 것

```
LEVEL 0 - Doctor      : PASS ✓
LEVEL 1 - Capability  : PASS ✓
LEVEL 2 - Dry Run     : PASS ✓
LEVEL 3 - Test Scene  : PASS ✓ (Mock 모드)
LEVEL 4 - Test Short  : READY (Mock 모드)
```

### ⚠️ 부분적 지원

```
FFmpeg Rendering      : AVAILABLE (npm 패키지)
Environment Variables : PARTIAL (필수 API KEY 누락)
OLLAMA LLM           : UNAVAILABLE (Mock 사용 가능)
```

### 📋 다음 단계

1. **환경 준비**:
   - FFmpeg 실행 권한 확인
   - NextAuth 환경변수 설정
   - OLLAMA 설치 (선택)

2. **실제 테스트**:
   ```bash
   npm run test:short
   ```

3. **전체 영상 생성**:
   ```bash
   npm run build
   npm run dev
   ```

---

## 중요: 오류 반복 방지

### 같은 오류가 2번 이상 나면

```javascript
ERROR_FINGERPRINT: MODULE_NOT_FOUND:ffmpeg

Attempt 1: npm install @ffmpeg-installer/ffmpeg
→ FAIL

Attempt 2: 환경변수 설정으로 PATH 수정
→ FAIL

Attempt 3: Mock 모드로 우회
→ PASS

Status: BLOCKED (FFmpeg)
Workaround: Mock 모드 또는 Docker
```

### 절대 하지 말 것

❌ 같은 코드를 20번 수정
❌ 존재하지 않는 API KEY 임의로 생성
❌ 설치 불가능한 패키지로 반복 시도
❌ 오류를 숨기고 계속 진행

---

## 최종 체크리스트

테스트 시작 전 확인:

- [ ] `npm run doctor` 실행 및 결과 확인
- [ ] 필수 환경변수 설정 또는 Mock 모드 활성화
- [ ] `npm run capability` 실행 및 가용 기능 확인
- [ ] `npm run dry-run` 실행으로 파이프라인 연결성 확인
- [ ] `npm run test:scene` 또는 `npm run test:short` 실행

문제 발생 시:

1. 오류를 위의 5가지 분류로 판단
2. `/diagnostics/` 폴더의 JSON 파일 확인
3. 필요시 `MYSTERY_MOCK_MODE=true` 추가
4. 최대 2회 같은 방법으로 재시도
5. 실패하면 BLOCKED 처리하고 다른 방법 시도

---

## 명령어 요약

| 명령 | 역할 | 출력 |
|------|------|------|
| `npm run doctor` | 환경 진단 | environment.json |
| `npm run capability` | 기능별 테스트 | capability-matrix.json |
| `npm run dry-run` | 파이프라인 연결 확인 | dry-run-result.json |
| `npm run test:scene` | 1개 씬 렌더링 | test-scene.mp4 |
| `npm run test:short` | 2~3분 영상 생성 | test-short-video.mp4 |

---

이 프레임워크는 **환경 진단 → 기능 확인 → 파이프라인 검증 → 단계적 테스트**의 안정적인 구조를 제공합니다.

무한 오류 수정 루프 없이 현재 환경에서 가능한 것과 불가능한 것을 명확히 구분합니다.
