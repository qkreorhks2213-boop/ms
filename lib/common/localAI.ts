import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * 대본/장면판단(텍스트·JSON 생성)과 내레이션(TTS)을 전부 로컬/무료로 처리하는 백엔드.
 * 이전에는 lib/common/gemini.ts가 이 두 역할을 맡았지만, Gemini 무료 등급의 하루 요청 한도가
 * 롱폼 영상 하나를 완성하기엔 너무 낮아서(사용자 실측: 이대로면 한 달 걸림) 완전히 무료이고
 * 한도가 없는 로컬 실행 방식으로 교체했다:
 *
 * - 텍스트/JSON 생성 → Ollama(사용자 PC에서 로컬로 도는 LLM 서버, http://localhost:11434).
 *   이건 별도 설치가 필요하다(README 참고).
 * - 음성 합성(TTS) → 기본값은 Windows 내장 음성 합성(SAPI, PowerShell로 호출) — 별도 설치
 *   전혀 필요 없다(Windows 설정에서 한국어 음성만 추가하면 됨). Piper(오픈소스 로컬 TTS)를
 *   PIPER_VOICE_MODEL로 지정하면 그쪽을 대신 쓴다 — Windows가 아니거나 다른 목소리를 쓰고
 *   싶을 때의 대안. (Piper 공식 저장소는 한국어를 정식 지원하지 않고 커뮤니티 변환 모델만
 *   있어서, Windows 사용자에게는 SAPI 쪽이 훨씬 간단하고 안정적이다.)
 *
 * 설치 안 돼 있거나 한국어 음성이 없으면 아래 함수들이 설치 방법을 안내하는 오류를 던진다 —
 * Gemini 버전이 "API 키 없음"을 안내하던 자리를 그대로 대체한다.
 *
 * generateText/generateJson의 함수 시그니처를 gemini.ts와 동일하게 유지해서, 호출부
 * (script.ts/scenes.ts)는 import 경로만 바꾸면 되고 프롬프트/파싱 로직은 손댈 필요가 없다.
 */

// "localhost" 대신 "127.0.0.1"을 기본값으로 쓴다 — 일부 Windows 환경에서 Node의 fetch가
// localhost를 IPv6(::1)로 먼저 풀이하는데, Ollama는 기본적으로 IPv4(127.0.0.1)에만 붙어서
// "fetch failed"가 나는 경우가 실제로 있다(Ollama 자체가 안 켜진 것과 증상이 동일해 헷갈리기
// 쉽다). 127.0.0.1로 명시하면 이 문제 자체가 생기지 않는다.
export const OLLAMA_HOST = (process.env.OLLAMA_HOST || "http://127.0.0.1:11434").replace(/\/$/, "");
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:7b-instruct";

/** 로컬 TTS는 프리셋 여러 개를 보장할 수 없다(사용자가 내려받은 Piper 음성 모델 하나에 매인다). */
export const NARRATOR_VOICE_OPTIONS = ["기본"];
export const DEFAULT_VOICE_NAME = NARRATOR_VOICE_OPTIONS[0];

function ollamaSetupHint(detail: string): string {
  return (
    `로컬 LLM(Ollama) 호출에 실패했습니다: ${detail}\n\n` +
    `가장 먼저 확인할 것: 웹 브라우저 주소창에 http://127.0.0.1:11434 를 입력해보세요.\n` +
    `"Ollama is running"이라고 뜨면 Ollama는 정상 — 이 프로그램의 서버(npm run dev)를 껐다가\n` +
    `다시 켜보세요. 그 문구가 안 뜨면 Ollama 자체가 꺼져있는 것이니 아래를 확인하세요:\n` +
    `1) https://ollama.com 에서 Ollama 설치\n` +
    `2) 터미널에서 모델 받기: ollama pull ${OLLAMA_MODEL}\n` +
    `3) Ollama가 실행 중인지 확인(설치하면 보통 자동 실행됨, 아니면 터미널에서 "ollama serve")\n` +
    `4) 다른 포트/주소를 쓴다면 .env.local의 OLLAMA_HOST로 지정\n` +
    `현재 설정: OLLAMA_HOST=${OLLAMA_HOST}, OLLAMA_MODEL=${OLLAMA_MODEL}`
  );
}

async function callOllama(params: {
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  json: boolean;
}): Promise<string> {
  let res: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      res = await fetch(`${OLLAMA_HOST}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt: params.prompt,
          stream: false,
          ...(params.json ? { format: "json" } : {}),
          options: {
            temperature: params.temperature ?? 0.9,
            ...(params.maxOutputTokens ? { num_predict: params.maxOutputTokens } : {}),
          },
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err: any) {
    throw new Error(ollamaSetupHint(err?.message || String(err)));
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 404) {
      throw new Error(
        ollamaSetupHint(`모델 "${OLLAMA_MODEL}"을 찾을 수 없습니다(HTTP 404). "ollama pull ${OLLAMA_MODEL}"로 먼저 받으세요.`)
      );
    }
    throw new Error(ollamaSetupHint(`HTTP ${res.status}: ${body.slice(0, 500)}`));
  }
  const data = await res.json();
  const text: string | undefined = data?.response;
  if (typeof text !== "string") {
    throw new Error(ollamaSetupHint(`예상치 못한 응답 형식: ${JSON.stringify(data).slice(0, 500)}`));
  }
  return text;
}

/** 순수 텍스트 생성(대본 등) — Ollama 버전. */
export async function generateText(params: {
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<string> {
  return callOllama({ ...params, json: false });
}

/** JSON 응답 생성 + 파싱 — Ollama 버전. 로컬 모델은 Gemini보다 JSON 형식을 안 지킬 때가
 * 많아서, 코드펜스/설명 문구가 섞여 와도 본문 중 JSON처럼 보이는 부분을 추출하는 방어 로직을
 * gemini.ts보다 조금 더 관대하게 유지한다. */
export async function generateJson<T>(params: {
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<T> {
  const output = await callOllama({ ...params, json: true });
  try {
    return JSON.parse(output) as T;
  } catch {
    const match = output.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) {
      throw new Error(
        `로컬 LLM(${OLLAMA_MODEL})이 JSON 형식으로 응답하지 않았습니다. 이 모델이 지시를 잘 못 ` +
          `따르는 경우일 수 있습니다 — OLLAMA_MODEL을 더 큰/지시 이행에 강한 모델로 바꿔보세요.\n\n원본 응답:\n${output.slice(0, 1000)}`
      );
    }
    return JSON.parse(match[0]) as T;
  }
}

/**
 * JSON 배열을 요청했는데 로컬 모델이 바로 배열을 안 주고 { "chapters": [...] } 처럼 객체 하나로
 * 감싸서 줄 때가 흔하다(지시를 "배열 하나만 출력"이 아니라 "이름 붙은 필드에 담아 출력"으로
 * 오해하는 경우) — 지시를 다시 내려서 재시도하는 대신, 값 하나짜리 배열 속성이 있으면 그걸
 * 그대로 꺼내 쓴다. 감싸는 필드 이름이 뭐가 될지 모르므로 이름으로 찾지 않고 "배열 값을 가진
 * 유일한 속성"이라는 구조로 판단한다.
 */
export function coerceJsonArray<T>(value: unknown): T[] | null {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const arrayValues = Object.values(value).filter((v) => Array.isArray(v));
    if (arrayValues.length === 1) return arrayValues[0] as T[];
  }
  return null;
}

export interface SynthesizedSpeech {
  /** 16-bit signed little-endian, mono PCM. */
  buffer: Buffer;
  sampleRate: number;
}

export const PIPER_BIN = process.env.PIPER_BIN || "piper";
export const PIPER_VOICE_MODEL = process.env.PIPER_VOICE_MODEL || "";
export const PIPER_SAMPLE_RATE = Number(process.env.PIPER_SAMPLE_RATE || 22050);
const SAPI_SAMPLE_RATE = 22050;

function piperSetupHint(detail: string): string {
  return (
    `로컬 TTS(Piper) 호출에 실패했습니다: ${detail}\n\n` +
    `설치 확인:\n` +
    `1) https://github.com/rhasspy/piper 에서 OS에 맞는 실행 파일 내려받기\n` +
    `2) 한국어 음성 모델(.onnx + .onnx.json) 내려받기\n` +
    `3) .env.local에 PIPER_BIN(실행 파일 경로)과 PIPER_VOICE_MODEL(.onnx 파일 경로) 지정\n` +
    `현재 설정: PIPER_BIN=${PIPER_BIN || "(미지정)"}, PIPER_VOICE_MODEL=${PIPER_VOICE_MODEL || "(미지정)"}\n\n` +
    `PIPER_VOICE_MODEL을 아예 지정하지 않으면(Windows에서는) 별도 설치 없는 Windows 내장 음성으로 자동 전환됩니다.`
  );
}

/** Piper CLI로 합성 — 텍스트를 stdin으로 주면 --output-raw로 stdout에 raw 16-bit mono PCM을 뱉는다. */
async function synthesizeSpeechPiper(text: string): Promise<SynthesizedSpeech> {
  return new Promise<SynthesizedSpeech>((resolve, reject) => {
    const child = spawn(PIPER_BIN, ["--model", PIPER_VOICE_MODEL, "--output-raw"]);
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.on("error", (err: any) => {
      if (err?.code === "ENOENT") {
        reject(new Error(piperSetupHint(`실행 파일을 찾을 수 없습니다(${PIPER_BIN}).`)));
      } else {
        reject(new Error(piperSetupHint(err?.message || String(err))));
      }
    });
    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
    child.on("close", (code) => {
      const buffer = Buffer.concat(stdoutChunks);
      if (code !== 0 || buffer.length === 0) {
        const stderr = Buffer.concat(stderrChunks).toString("utf-8");
        reject(new Error(piperSetupHint(`종료 코드 ${code}. ${stderr.slice(0, 500)}`)));
        return;
      }
      resolve({ buffer, sampleRate: PIPER_SAMPLE_RATE });
    });
    child.stdin.write(text);
    child.stdin.end();
  });
}

// PowerShell(System.Speech, SAPI)을 이용한 Windows 내장 TTS. Piper와 달리 별도 설치가
// 전혀 필요 없다(윈도우 자체에 있는 기능) — Windows 설정 > 시간 및 언어 > 음성 > 음성 추가
// 에서 "한국어"를 추가하기만 하면 된다. 이게 Piper보다 나은 이유: Piper 공식 저장소는
// 한국어를 정식 지원하지 않아(커뮤니티 변환 모델만 존재, 안정성 미검증) 비개발자에게
// 권하기엔 리스크가 크다.
const SAPI_SCRIPT = `
param([string]$TextPath, [string]$WavPath)
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voices = $synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -eq "ko-KR" }
if ($voices.Count -eq 0) {
  Write-Error "NO_KOREAN_VOICE_INSTALLED"
  exit 1
}
$synth.SelectVoice($voices[0].VoiceInfo.Name)
$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(${SAPI_SAMPLE_RATE}, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$synth.SetOutputToWaveFile($WavPath, $format)
$text = Get-Content -Path $TextPath -Raw -Encoding UTF8
$synth.Speak($text)
$synth.Dispose()
exit 0
`.trim();

/** WAV 파일에서 "data" 청크를 찾아 그 안의 raw PCM 바이트만 잘라낸다(헤더 크기를 44바이트로 가정하지 않음). */
function extractWavPcm(wavBuffer: Buffer): Buffer {
  const dataTagIndex = wavBuffer.indexOf("data", 12, "ascii");
  if (dataTagIndex === -1) throw new Error("WAV 파일에서 data 청크를 찾지 못했습니다.");
  const dataSize = wavBuffer.readUInt32LE(dataTagIndex + 4);
  const dataStart = dataTagIndex + 8;
  return wavBuffer.subarray(dataStart, dataStart + dataSize);
}

function sapiSetupHint(detail: string): string {
  return (
    `Windows 내장 음성(TTS) 호출에 실패했습니다: ${detail}\n\n` +
    `한국어 음성이 설치되어 있는지 확인하세요:\n` +
    `Windows 설정 > 시간 및 언어 > 음성 > "음성 추가" > 한국어 선택 후 설치\n` +
    `설치 후 앱(서버)을 재시작해야 반영됩니다.`
  );
}

async function synthesizeSpeechWindowsSapi(text: string): Promise<SynthesizedSpeech> {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "economic-sapi-"));
  const scriptPath = path.join(workDir, "speak.ps1");
  const textPath = path.join(workDir, "text.txt");
  const wavPath = path.join(workDir, "out.wav");
  fs.writeFileSync(scriptPath, SAPI_SCRIPT, "utf-8");
  // BOM을 붙여야 Windows PowerShell 5.1의 Get-Content -Encoding UTF8이 한글을 안전하게 인식한다.
  fs.writeFileSync(textPath, "\uFEFF" + text, "utf-8");

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
        "-TextPath",
        textPath,
        "-WavPath",
        wavPath,
      ]);
      const stderrChunks: Buffer[] = [];
      child.on("error", (err: any) => reject(new Error(sapiSetupHint(err?.message || String(err)))));
      child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
      child.on("close", (code) => {
        if (code !== 0) {
          const stderr = Buffer.concat(stderrChunks).toString("utf-8");
          if (stderr.includes("NO_KOREAN_VOICE_INSTALLED")) {
            reject(new Error(sapiSetupHint("설치된 한국어 음성이 없습니다.")));
          } else {
            reject(new Error(sapiSetupHint(`종료 코드 ${code}. ${stderr.slice(0, 500)}`)));
          }
          return;
        }
        resolve();
      });
    });
    const wavBuffer = fs.readFileSync(wavPath);
    const pcm = extractWavPcm(wavBuffer);
    if (pcm.length === 0) throw new Error(sapiSetupHint("빈 오디오가 생성되었습니다."));
    return { buffer: pcm, sampleRate: SAPI_SAMPLE_RATE };
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

/**
 * 대본 한 조각을 로컬 TTS로 낭독한 음성을 합성한다. voiceName은 로컬 모드에서는 무시된다
 * (설치된 음성이 하나로 고정되어 있으므로) — 시그니처는 예전 gemini.ts와 호환 유지.
 * PIPER_VOICE_MODEL이 설정되어 있으면 Piper를, 아니면 Windows 내장 음성(SAPI)을 쓴다.
 */
export async function synthesizeSpeech(text: string, _voiceName: string): Promise<SynthesizedSpeech> {
  if (PIPER_VOICE_MODEL) {
    return synthesizeSpeechPiper(text);
  }
  if (process.platform === "win32") {
    return synthesizeSpeechWindowsSapi(text);
  }
  throw new Error(
    `로컬 TTS가 설정되지 않았습니다. Windows가 아니라서 내장 음성을 쓸 수 없으니, Piper를 설치하고 ` +
      `.env.local에 PIPER_BIN/PIPER_VOICE_MODEL을 지정하세요(macOS는 추후 'say' 명령 지원 예정).`
  );
}
