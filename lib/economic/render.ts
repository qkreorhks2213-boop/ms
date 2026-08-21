import fs from "fs";
import path from "path";
import os from "os";
import { ffmpeg, getVideoDuration } from "../common/ffmpegBase";
import { resolveCaptionFont, escapeFfmpegPath } from "../common/fonts";
import { runWithConcurrency } from "../common/concurrency";
import { resolveEconomicBgmFile } from "./audio";
import { splitIntoSentences } from "./scenes";
import { appendErrorLog, publicGeneratedDir, readProject, updateProject } from "./store";
import { TARGET_FPS, TARGET_HEIGHT, TARGET_SAMPLE_RATE, TARGET_WIDTH } from "./constants";
import type { NarrationChunk, Scene, SceneVisualType, EconomicProject } from "./types";

/**
 * 경제 뉴스 롱폼을 조립하는 최종 렌더링 파이프라인. 야담 버전과 구조는 같지만(장면 =
 * 정지 이미지 + 줌 + 자막을 무음 클립으로 먼저 렌더링 → 이어붙이기 → 내레이션 트랙 별도
 * 조립 → 마지막에 합성) 아래가 다르다:
 * - 훅에 허구 AI 동영상(Veo)을 쓰지 않는다 — 실제 자료 재활용 몽타주만 사용.
 * - 장면마다 출처 라벨(scene.visualSourceLabel)이 있으면 화면 하단에 작은 출처 표기를 낸다
 *   (요청 STEP4 "사실관계 추적"이 화면에도 드러나야 한다는 요구를 반영).
 * - 데이터 카드(stock_chart/stat_graph/data_viz)는 사진과 다른 줌 스타일(중앙 수치를
 *   천천히 확대)을 쓴다 — 사진/로고/지도는 기존처럼 완만한 켄번즈 팬.
 */

const BODY_ZOOM_AMOUNT = 0.12;
const DATA_CARD_ZOOM_AMOUNT = 0.08; // 데이터 카드는 과하게 확대하면 숫자가 잘릴 수 있어 더 약하게
const HOOK_ZOOM_AMOUNT = 0.35;
const HOOK_AVG_CUT_SECONDS = 4;
const HOOK_MIN_CUTS = 6;
const HOOK_MAX_CUTS = 30;

const MAX_CONCURRENT_RENDERS = Math.max(2, Math.min(4, os.cpus().length));

function fsPathFromPublicUrl(url: string): string {
  return path.join(process.cwd(), "public", url.replace(/^\//, ""));
}

interface CaptionCue {
  text: string;
  start: number;
  end: number;
}

/** 내레이션 청크들이 이어지는 구간 전체를 문장 단위로 나눠 시간을 문자수 비율로 배분한다. */
function buildCaptionCues(chunks: NarrationChunk[]): CaptionCue[] {
  const cues: CaptionCue[] = [];
  let cursor = 0;
  for (const chunk of chunks) {
    const duration = chunk.durationSeconds || 0;
    if (duration <= 0) continue;
    const sentences = splitIntoSentences(chunk.text);
    if (sentences.length === 0) {
      cursor += duration;
      continue;
    }
    const totalChars = sentences.reduce((n, s) => n + s.length, 0) || 1;
    let local = 0;
    for (const sentence of sentences) {
      const dur = duration * (sentence.length / totalChars);
      cues.push({ text: sentence, start: cursor + local, end: cursor + local + dur });
      local += dur;
    }
    cursor += duration;
  }
  return cues;
}

function sliceCaptionsForWindow(cues: CaptionCue[], windowStart: number, windowEnd: number): CaptionCue[] {
  return cues
    .filter((c) => c.end > windowStart && c.start < windowEnd)
    .map((c) => ({
      text: c.text,
      start: Math.max(0, c.start - windowStart),
      end: Math.min(windowEnd, c.end) - windowStart,
    }));
}

interface ClipPlan {
  id: string;
  /** null이면 이미지를 못 구한 극단적 실패 상황 — 검은 화면으로라도 시간을 채운다. */
  imagePath: string | null;
  durationSeconds: number;
  zoomAmount: number;
  captions: CaptionCue[];
  sourceLabel?: string;
}

function buildHookClipPlans(project: EconomicProject): ClipPlan[] {
  const hookNarration = project.hookNarration || [];
  const hookTotal = hookNarration.reduce((s, c) => s + (c.durationSeconds || 0), 0);
  if (hookTotal <= 0.3) return [];

  const hookCues = buildCaptionCues(hookNarration);
  const plans: ClipPlan[] = [];
  let remaining = hookTotal;
  let cursor = 0;

  const sceneById = new Map((project.scenes || []).map((s) => [s.id, s]));
  const montageIds = (project.hookMontageSceneIds || []).filter(
    (id) => sceneById.get(id)?.visualStatus === "done" && sceneById.get(id)?.visualUrl
  );

  if (remaining > 0.3 && montageIds.length > 0) {
    let cutCount = Math.round(remaining / HOOK_AVG_CUT_SECONDS);
    cutCount = Math.max(HOOK_MIN_CUTS, Math.min(HOOK_MAX_CUTS, cutCount));
    const perCut = remaining / cutCount;
    for (let i = 0; i < cutCount; i++) {
      const scene = sceneById.get(montageIds[i % montageIds.length])!;
      plans.push({
        id: `hook-montage-${i}`,
        imagePath: fsPathFromPublicUrl(scene.visualUrl!),
        durationSeconds: perCut,
        zoomAmount: HOOK_ZOOM_AMOUNT,
        captions: sliceCaptionsForWindow(hookCues, cursor, cursor + perCut),
      });
      cursor += perCut;
    }
  } else if (remaining > 0.3) {
    plans.push({
      id: "hook-fallback",
      imagePath: null,
      durationSeconds: remaining,
      zoomAmount: 0,
      captions: sliceCaptionsForWindow(hookCues, cursor, cursor + remaining),
    });
  }

  return plans;
}

const DATA_VISUAL_TYPES: SceneVisualType[] = ["stock_chart", "stat_graph", "data_viz"];

function buildSceneClipPlans(scenes: Scene[]): ClipPlan[] {
  return scenes
    .filter((s) => (s.durationSeconds || 0) > 0.3 && s.visualStatus === "done" && s.visualUrl)
    .map((s) => ({
      id: s.id,
      imagePath: fsPathFromPublicUrl(s.visualUrl!),
      durationSeconds: s.durationSeconds || 0,
      zoomAmount: DATA_VISUAL_TYPES.includes(s.visualType) ? DATA_CARD_ZOOM_AMOUNT : BODY_ZOOM_AMOUNT,
      captions: buildCaptionCues(s.narration),
      sourceLabel: s.visualSourceLabel,
    }));
}

/**
 * 자막 한 줄을 drawtext용 임시 파일로 쓰고 필터 문자열 조각을 만든다.
 * expansion=none 필수 — 경제 대본은 "3.5%", "성장률 +2.1%"처럼 %가 매우 흔한데, ffmpeg
 * drawtext는 기본값(expansion=normal)에서 textfile 내용도 %{...} 확장 문법으로 해석해서
 * %가 섞인 줄이 화면에서 통째로 사라진다. expansion=none으로 끄면 파일 내용을 있는 그대로
 * 그린다.
 */
function captionFilters(captions: CaptionCue[], fontPath: string, workDir: string, clipId: string): string[] {
  const safeFont = escapeFfmpegPath(fontPath);
  const fontsize = Math.round(TARGET_HEIGHT * 0.09);
  return captions
    .filter((c) => c.text.trim() && c.end > c.start)
    .map((c, i) => {
      const file = path.join(workDir, `cap_${clipId}_${i}.txt`);
      fs.writeFileSync(file, c.text.replace(/\r?\n/g, " ").trim(), "utf-8");
      const safeFile = escapeFfmpegPath(file);
      return `drawtext=fontfile='${safeFont}':textfile='${safeFile}':expansion=none:fontsize=${fontsize}:fontcolor=white:bordercolor=black:borderw=7:x=(w-text_w)/2:y=h*0.82:enable='between(t,${c.start.toFixed(2)},${c.end.toFixed(2)})'`;
    });
}

/** 화면 우측 하단에 작은 출처 표기를 낸다(실제 뉴스 방송의 "자료: ○○" 하단 표기 스타일). */
function sourceLabelFilter(label: string, fontPath: string, workDir: string, clipId: string): string {
  const safeFont = escapeFfmpegPath(fontPath);
  const file = path.join(workDir, `src_${clipId}.txt`);
  fs.writeFileSync(file, label.replace(/\r?\n/g, " ").trim(), "utf-8");
  const safeFile = escapeFfmpegPath(file);
  return `drawtext=fontfile='${safeFont}':textfile='${safeFile}':expansion=none:fontsize=24:fontcolor=0xc8cad0:bordercolor=black:borderw=3:x=w-text_w-30:y=h-48`;
}

async function renderClipPlan(params: {
  plan: ClipPlan;
  fontPath: string | null;
  workDir: string;
  outPath: string;
}): Promise<void> {
  const { plan, fontPath, workDir, outPath } = params;
  const duration = plan.durationSeconds;

  const videoFilters: string[] = [];
  videoFilters.push(
    `scale=${TARGET_WIDTH}:${TARGET_HEIGHT}:force_original_aspect_ratio=increase`,
    `crop=${TARGET_WIDTH}:${TARGET_HEIGHT}`
  );

  if (plan.zoomAmount > 0) {
    const frameCount = Math.max(1, Math.round(duration * TARGET_FPS));
    const maxZoom = 1 + plan.zoomAmount;
    const step = plan.zoomAmount / frameCount;
    videoFilters.push(
      `zoompan=z='min(zoom+${step.toFixed(8)}\\,${maxZoom.toFixed(4)})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${TARGET_WIDTH}x${TARGET_HEIGHT}:fps=${TARGET_FPS}`
    );
  }
  videoFilters.push("setsar=1");

  if (fontPath && plan.sourceLabel) {
    videoFilters.push(sourceLabelFilter(plan.sourceLabel, fontPath, workDir, plan.id));
  }
  if (fontPath && plan.captions.length > 0) {
    videoFilters.push(...captionFilters(plan.captions, fontPath, workDir, plan.id));
  }

  const cmd = ffmpeg();
  if (!plan.imagePath) {
    cmd.input(`color=c=black:s=${TARGET_WIDTH}x${TARGET_HEIGHT}:r=${TARGET_FPS}`).inputOptions(["-f lavfi"]);
  } else {
    cmd.input(plan.imagePath).inputOptions(["-loop 1"]);
  }

  const timeoutMs = Math.max(60_000, duration * 12_000);

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cmd.kill("SIGKILL");
      reject(new Error(`클립 ${plan.id} 렌더링이 ${Math.round(timeoutMs / 1000)}초를 넘겨 중단했습니다.`));
    }, timeoutMs);

    cmd
      .duration(duration)
      .videoFilters(videoFilters)
      .outputOptions([
        "-c:v libx264",
        "-preset veryfast",
        "-crf 20",
        "-an",
        `-r ${TARGET_FPS}`,
        "-y",
      ])
      .on("error", (err, _stdout, stderr) => {
        clearTimeout(timer);
        reject(new Error(`${err.message}\n--- ffmpeg stderr ---\n${(stderr || "").trim()}`));
      })
      .on("end", () => {
        clearTimeout(timer);
        resolve();
      })
      .save(outPath);
  });
}

async function concatClips(clipPaths: string[], outPath: string): Promise<void> {
  const listFile = `${outPath}.list.txt`;
  fs.writeFileSync(listFile, clipPaths.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"), "utf-8");
  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(listFile)
      .inputOptions(["-f concat", "-safe 0"])
      .outputOptions(["-c copy", "-y"])
      .on("error", (err, _stdout, stderr) => reject(new Error(`${err.message}\n${(stderr || "").trim()}`)))
      .on("end", () => resolve())
      .save(outPath);
  });
}

/** 내레이션 청크들(서로 다른 샘플레이트일 수 있음)을 순서대로 이어 붙여 하나의 오디오 트랙으로 만든다. */
async function buildNarrationTrack(chunks: NarrationChunk[], outPath: string): Promise<void> {
  const valid = chunks.filter((c) => c.filePath && fs.existsSync(c.filePath) && (c.durationSeconds || 0) > 0);
  if (valid.length === 0) {
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(`anullsrc=r=${TARGET_SAMPLE_RATE}:cl=mono`)
        .inputOptions(["-f lavfi"])
        .duration(1)
        .outputOptions(["-y"])
        .on("error", (err) => reject(err))
        .on("end", () => resolve())
        .save(outPath);
    });
    return;
  }

  const cmd = ffmpeg();
  valid.forEach((c) => {
    cmd.input(c.filePath!).inputOptions(["-f s16le", `-ar ${c.sampleRate || 24000}`, "-ac 1"]);
  });
  const aformatChain = valid.map((_, i) => `[${i}:a]aformat=sample_rates=${TARGET_SAMPLE_RATE}:channel_layouts=mono[a${i}]`);
  const concatChain = `${valid.map((_, i) => `[a${i}]`).join("")}concat=n=${valid.length}:v=0:a=1[aout]`;

  await new Promise<void>((resolve, reject) => {
    cmd
      .complexFilter([...aformatChain, concatChain])
      .outputOptions(["-map [aout]", "-c:a pcm_s16le", "-y"])
      .on("error", (err, _stdout, stderr) => reject(new Error(`${err.message}\n${(stderr || "").trim()}`)))
      .on("end", () => resolve())
      .save(outPath);
  });
}

/** 무음 영상 + 내레이션 트랙(+선택적 BGM)을 합쳐 최종 파일을 만든다. */
async function muxFinal(params: {
  silentVideoPath: string;
  narrationPath: string;
  bgmPath: string | null;
  outPath: string;
  totalDurationSeconds: number;
}): Promise<void> {
  const { silentVideoPath, narrationPath, bgmPath, outPath, totalDurationSeconds } = params;
  const cmd = ffmpeg().input(silentVideoPath).input(narrationPath);

  if (!bgmPath) {
    await new Promise<void>((resolve, reject) => {
      cmd
        .outputOptions(["-map 0:v", "-map 1:a", "-c:v copy", "-c:a aac", "-shortest", "-y"])
        .on("error", (err, _stdout, stderr) => reject(new Error(`${err.message}\n${(stderr || "").trim()}`)))
        .on("end", () => resolve())
        .save(outPath);
    });
    return;
  }

  cmd.input(bgmPath).inputOptions(["-stream_loop -1"]);
  const fadeOutStart = Math.max(0, totalDurationSeconds - 2);
  const filters = [
    `[1:a]aformat=sample_rates=${TARGET_SAMPLE_RATE}:channel_layouts=mono,volume=2.0[narr]`,
    `[2:a]aformat=sample_rates=${TARGET_SAMPLE_RATE}:channel_layouts=mono,volume=0.18,afade=t=in:st=0:d=2,afade=t=out:st=${fadeOutStart.toFixed(2)}:d=2[bgm]`,
    `[narr][bgm]amix=inputs=2:duration=first:dropout_transition=0[aout]`,
  ];
  await new Promise<void>((resolve, reject) => {
    cmd
      .complexFilter(filters)
      .outputOptions(["-map 0:v", "-map [aout]", "-c:v copy", "-c:a aac", "-shortest", "-y"])
      .on("error", (err, _stdout, stderr) => reject(new Error(`${err.message}\n${(stderr || "").trim()}`)))
      .on("end", () => resolve())
      .save(outPath);
  });
}

function assertReadyForRender(project: EconomicProject): void {
  if (!project.script || !project.scenes || project.scenes.length === 0) {
    throw new Error("대본/장면이 아직 준비되지 않았습니다.");
  }
  const visualsLeft = project.scenes.filter((s) => s.visualStatus !== "done").length;
  if (visualsLeft > 0) {
    throw new Error(`아직 시각자료가 준비되지 않은 장면이 ${visualsLeft}개 있습니다.`);
  }
  const narrationLeft = project.scenes.filter((s) => s.narration.length === 0 || s.narration.some((n) => n.status !== "done")).length;
  if (narrationLeft > 0) {
    throw new Error(`아직 내레이션이 준비되지 않은 장면이 ${narrationLeft}개 있습니다.`);
  }
}

export async function renderProject(projectId: string): Promise<void> {
  const project = readProject(projectId);
  if (!project) throw new Error(`프로젝트를 찾을 수 없습니다: ${projectId}`);
  assertReadyForRender(project);

  updateProject(projectId, (p) => {
    p.render = { status: "working", currentStep: "렌더링 준비 중" };
  });

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "economic-render-"));

  try {
    const fontPath = resolveCaptionFont();
    const captionWarning = fontPath ? undefined : "한글 자막용 폰트를 찾지 못해 자막 없이 렌더링했습니다.";

    const hookPlans = buildHookClipPlans(project);
    const scenePlans = buildSceneClipPlans(project.scenes || []);
    const allPlans = [...hookPlans, ...scenePlans];

    if (allPlans.length === 0) {
      throw new Error("렌더링할 장면이 없습니다.");
    }

    updateProject(projectId, (p) => {
      p.render = {
        status: "working",
        currentStep: `장면 영상 렌더링 중 (0/${allPlans.length})`,
        progress: { completed: 0, total: allPlans.length, failed: 0 },
      };
    });

    let completed = 0;
    const clipPaths = await runWithConcurrency(
      allPlans.map((plan, i) => async () => {
        const outPath = path.join(workDir, `clip_${String(i).padStart(4, "0")}.mp4`);
        await renderClipPlan({ plan, fontPath, workDir, outPath });
        completed += 1;
        updateProject(projectId, (p) => {
          p.render.currentStep = `장면 영상 렌더링 중 (${completed}/${allPlans.length})`;
          p.render.progress = { completed, total: allPlans.length, failed: 0 };
        });
        return outPath;
      }),
      MAX_CONCURRENT_RENDERS
    );

    updateProject(projectId, (p) => {
      p.render.currentStep = "장면 영상 이어붙이는 중";
    });
    const silentVideoPath = path.join(workDir, "concat_silent.mp4");
    await concatClips(clipPaths, silentVideoPath);

    updateProject(projectId, (p) => {
      p.render.currentStep = "전체 내레이션 오디오 트랙 구성 중";
    });
    const orderedNarration: NarrationChunk[] = [
      ...(project.hookNarration || []),
      ...(project.scenes || []).flatMap((s) => s.narration),
    ];
    const narrationPath = path.join(workDir, "narration.wav");
    await buildNarrationTrack(orderedNarration, narrationPath);

    const totalDurationSeconds = allPlans.reduce((s, p) => s + p.durationSeconds, 0);
    const bgmPath = project.input.useBgm ? resolveEconomicBgmFile() : null;
    const bgmWarning =
      project.input.useBgm && !bgmPath
        ? "배경음 파일이 public/audio/bgm/economic/ 폴더에 없어 배경음 없이 렌더링했습니다."
        : undefined;

    updateProject(projectId, (p) => {
      p.render.currentStep = "최종 합성 중";
    });
    const outputsDir = path.join(process.cwd(), "public", "renders");
    fs.mkdirSync(outputsDir, { recursive: true });
    const finalPath = path.join(outputsDir, `${projectId}.mp4`);
    await muxFinal({ silentVideoPath, narrationPath, bgmPath, outPath: finalPath, totalDurationSeconds });

    updateProject(projectId, (p) => {
      p.stage = "done";
      p.render = {
        status: "ready",
        videoUrl: `/renders/${projectId}.mp4`,
        warning: [captionWarning, bgmWarning].filter(Boolean).join(" ") || undefined,
      };
    });
  } catch (err: any) {
    const message = err?.message || String(err);
    updateProject(projectId, (p) => {
      p.render = { status: "error", error: message };
    });
    appendErrorLog(projectId, { stage: "render", message, retryable: true });
  } finally {
    try {
      fs.rmSync(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
    } catch (cleanupErr) {
      console.warn(`[economic] 임시 작업 폴더 정리 실패(결과에는 영향 없음): ${workDir}`, cleanupErr);
    }
  }
}

/** 렌더링은 오래 걸리므로 API 라우트에서 await 하지 않고 백그라운드로 던진다. */
export function submitRenderJob(projectId: string): void {
  renderProject(projectId).catch((err) => {
    const message = err?.message || String(err);
    updateProject(projectId, (p) => {
      p.render = { status: "error", error: message };
    });
    appendErrorLog(projectId, { stage: "render", message, retryable: true });
  });
}
