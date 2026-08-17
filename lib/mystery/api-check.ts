/**
 * API/Service Availability Detection
 * Checks which external services and tools are available
 */

import { spawn } from "child_process";

export type ServiceStatus = "🟢 READY" | "🟡 OPTIONAL" | "🔴 REQUIRED";

export interface ServiceCheckResult {
  name: string;
  status: ServiceStatus;
  available: boolean;
  version?: string;
  message: string;
  setupInstructions?: string;
}

async function checkCommand(command: string, args: string[] = [], timeoutMs: number = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    const process = spawn(command, args, { stdio: "pipe" });
    const timeout = setTimeout(() => {
      process.kill();
      resolve(false);
    }, timeoutMs);

    process.on("close", (code) => {
      clearTimeout(timeout);
      resolve(code === 0);
    });

    process.on("error", () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

export async function checkFFmpeg(): Promise<ServiceCheckResult> {
  const available = await checkCommand("ffmpeg", ["-version"]);
  return {
    name: "FFmpeg",
    status: available ? "🟢 READY" : "🔴 REQUIRED",
    available,
    message: available
      ? "FFmpeg is installed and working"
      : "FFmpeg is not installed. This is required for video rendering.",
    setupInstructions: available
      ? undefined
      : `Install FFmpeg:
  - macOS: brew install ffmpeg
  - Ubuntu/Debian: sudo apt-get install ffmpeg
  - Windows: https://ffmpeg.org/download.html`,
  };
}

export async function checkPiper(): Promise<ServiceCheckResult> {
  const available = await checkCommand("piper", ["--help"]);
  return {
    name: "Piper TTS",
    status: available ? "🟢 READY" : "🔴 REQUIRED",
    available,
    message: available
      ? "Piper TTS is installed and working"
      : "Piper TTS is required for narration generation. Without it, the pipeline cannot generate voice narration.",
    setupInstructions: available
      ? undefined
      : `Install Piper TTS:
  pip install piper-tts

  Download Korean voice model:
  piper --voice ko_KR-narae-medium --download-dir ~/.piper/models`,
  };
}

export async function checkOllama(): Promise<ServiceCheckResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch("http://localhost:11434/api/tags", { method: "GET", signal: controller.signal });
    clearTimeout(timeoutId);
    const available = response.ok;
    return {
      name: "Ollama (Local LLM)",
      status: available ? "🟢 READY" : "🟡 OPTIONAL",
      available,
      message: available
        ? "Ollama is running and accessible (improves script quality)"
        : "Ollama is not running. Script generation will use Google search results and local LLM fallback only.",
      setupInstructions: available
        ? undefined
        : `Start Ollama (optional for enhanced script generation):
  ollama serve

  Or install from: https://ollama.ai`,
    };
  } catch (err) {
    return {
      name: "Ollama (Local LLM)",
      status: "🟡 OPTIONAL",
      available: false,
      message: "Ollama is not running. Script generation will use Google search results and local LLM fallback only.",
      setupInstructions: `Start Ollama (optional for enhanced script generation):
  ollama serve

Or install from: https://ollama.ai`,
    };
  }
}

export async function checkAllServices(): Promise<ServiceCheckResult[]> {
  console.log("[api-check] Checking service availability...");

  const results = await Promise.all([checkFFmpeg(), checkPiper(), checkOllama()]);

  // Print results
  results.forEach((result) => {
    console.log(`[api-check] ${result.status} ${result.name}: ${result.message}`);
  });

  // Check if any required services are missing
  const requiredMissing = results.filter((r) => r.status === "🔴 REQUIRED" && !r.available);
  if (requiredMissing.length > 0) {
    console.error("[api-check] ❌ Missing required services:");
    requiredMissing.forEach((r) => {
      console.error(`  - ${r.name}: ${r.setupInstructions}`);
    });
  }

  return results;
}

export function generateServiceReport(results: ServiceCheckResult[]): string {
  const lines: string[] = ["## API/Service Status\n"];

  results.forEach((result) => {
    lines.push(`${result.status} **${result.name}**`);
    lines.push(`   ${result.message}`);
    if (result.setupInstructions) {
      lines.push(`   \`\`\`\n${result.setupInstructions}\n\`\`\``);
    }
    lines.push("");
  });

  const allRequired = results.filter((r) => r.status === "🔴 REQUIRED");
  const allReady = results.filter((r) => r.status === "🟢 READY");

  lines.push("### Summary");
  lines.push(`- Required services ready: ${allReady.filter((r) => r.status === "🔴 REQUIRED").length}/${allRequired.length}`);
  lines.push(`- Optional services ready: ${allReady.filter((r) => r.status === "🟡 OPTIONAL").length}`);

  return lines.join("\n");
}
