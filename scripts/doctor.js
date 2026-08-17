#!/usr/bin/env node

/**
 * MYSTERY VIDEO PIPELINE DOCTOR
 * 환경 진단 및 상태 확인 도구
 *
 * 사용: npm run doctor
 *
 * 역할:
 * 1. 필수 도구 확인 (Node, npm, Python, FFmpeg, FFprobe, Git)
 * 2. 환경변수 확인 (API KEY 등)
 * 3. npm 패키지 확인
 * 4. 인터넷 연결 확인
 * 5. 전체 상태를 JSON으로 저장
 */

const fs = require("fs");
const path = require("path");
const { execSync, spawn } = require("child_process");

const DIAGNOSTICS_DIR = path.join(__dirname, "../diagnostics");
const DIAGNOSTIC_FILE = path.join(DIAGNOSTICS_DIR, "environment.json");

// 디렉토리 생성
if (!fs.existsSync(DIAGNOSTICS_DIR)) {
  fs.mkdirSync(DIAGNOSTICS_DIR, { recursive: true });
}

const diagnosis = {
  timestamp: new Date().toISOString(),
  status: "OK",
  tools: {},
  environment: {},
  packages: {},
  internet: null,
  readiness: "UNKNOWN",
  issues: [],
};

// 색상 코드
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkCommand(cmd, args = [], versionFlag = "--version") {
  try {
    const output = execSync(`${cmd} ${versionFlag}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const version = output.split("\n")[0].trim();
    return { available: true, version };
  } catch (error) {
    return { available: false, error: error.message };
  }
}

function checkFile(filePath, description) {
  const exists = fs.existsSync(filePath);
  return {
    exists,
    path: filePath,
    description,
  };
}

async function checkInternet() {
  return new Promise((resolve) => {
    try {
      require("dns").lookup("google.com", (err) => {
        resolve(!err);
      });
    } catch {
      resolve(false);
    }
  });
}

async function main() {
  console.clear();
  log("\n================================", "blue");
  log("MYSTERY VIDEO PIPELINE DOCTOR", "blue");
  log("================================\n", "blue");

  // 1. Node 및 npm 확인
  log("📦 System Tools...", "blue");

  const node = checkCommand("node");
  diagnosis.tools.node = node;
  log(
    `  Node: ${node.available ? "✓ " + node.version : "✗ NOT FOUND"}`,
    node.available ? "green" : "red"
  );

  const npm = checkCommand("npm");
  diagnosis.tools.npm = npm;
  log(
    `  npm: ${npm.available ? "✓ " + npm.version : "✗ NOT FOUND"}`,
    npm.available ? "green" : "red"
  );

  const git = checkCommand("git");
  diagnosis.tools.git = git;
  log(
    `  git: ${git.available ? "✓ " + git.version : "✗ NOT FOUND"}`,
    git.available ? "green" : "red"
  );

  // 2. 개발 도구 확인
  log("\n🎬 Media Tools...", "blue");

  const ffmpeg = checkCommand("ffmpeg", ["-version"]);
  diagnosis.tools.ffmpeg = ffmpeg;
  log(
    `  FFmpeg: ${ffmpeg.available ? "✓ AVAILABLE" : "✗ NOT FOUND"}`,
    ffmpeg.available ? "green" : "red"
  );

  const ffprobe = checkCommand("ffprobe", ["-version"]);
  diagnosis.tools.ffprobe = ffprobe;
  log(
    `  FFprobe: ${ffprobe.available ? "✓ AVAILABLE" : "✗ NOT FOUND"}`,
    ffprobe.available ? "green" : "red"
  );

  // 3. Python 확인
  log("\n🐍 Python...", "blue");

  const python = checkCommand("python3", ["-V"]);
  diagnosis.tools.python = python;
  log(
    `  Python: ${python.available ? "✓ " + python.version : "✗ NOT FOUND"}`,
    python.available ? "green" : "red"
  );

  // 4. 환경변수 확인
  log("\n🔐 Environment Variables...", "blue");

  const requiredEnvVars = [
    "NEXTAUTH_SECRET",
    "NEXTAUTH_URL",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
  ];

  const optionalEnvVars = [
    "OLLAMA_HOST",
    "OLLAMA_MODEL",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GOOGLE_CSE_ID",
    "GOOGLE_CSE_KEY",
    "MYSTERY_MOCK_MODE",
  ];

  const envStatus = {};

  for (const envVar of requiredEnvVars) {
    const present = !!process.env[envVar];
    envStatus[envVar] = present ? "PRESENT (Required)" : "MISSING (Required)";
    log(
      `  ${envVar}: ${present ? "✓" : "✗"} ${envStatus[envVar]}`,
      present ? "green" : "red"
    );
    if (!present) {
      diagnosis.issues.push(`Missing required env var: ${envVar}`);
      diagnosis.status = "WARN";
    }
  }

  log("\n  Optional variables:", "yellow");
  for (const envVar of optionalEnvVars) {
    const present = !!process.env[envVar];
    envStatus[envVar] = present ? "PRESENT" : "MISSING";
    log(`    ${envVar}: ${present ? "✓" : "○"}`);
  }

  diagnosis.environment = envStatus;

  // 5. npm 패키지 확인
  log("\n📚 npm Packages...", "blue");

  try {
    const packageJsonPath = path.join(__dirname, "../package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

    const requiredPackages = [
      "next",
      "@ffmpeg-installer/ffmpeg",
      "@ffprobe-installer/ffprobe",
      "fluent-ffmpeg",
    ];

    let packagesMissing = 0;
    for (const pkg of requiredPackages) {
      const installed =
        packageJson.dependencies[pkg] ||
        packageJson.devDependencies[pkg] ||
        false;
      const nodeModulesPath = path.join(__dirname, `../node_modules/${pkg}`);
      const isInstalled = fs.existsSync(nodeModulesPath);

      diagnosis.packages[pkg] = {
        inPackageJson: !!installed,
        isInstalled,
      };

      const status = isInstalled ? "✓" : "○";
      const color = isInstalled ? "green" : "yellow";
      log(`  ${pkg}: ${status}`, color);

      if (!isInstalled) {
        packagesMissing++;
      }
    }

    if (packagesMissing > 0) {
      diagnosis.issues.push(
        `${packagesMissing} required npm packages not installed`
      );
      if (diagnosis.status !== "WARN") {
        diagnosis.status = "WARN";
      }
    }
  } catch (error) {
    log(`  Error checking packages: ${error.message}`, "red");
    diagnosis.status = "ERROR";
  }

  // 6. 인터넷 연결 확인
  log("\n🌐 Internet Connection...", "blue");
  const hasInternet = await checkInternet();
  diagnosis.internet = hasInternet;
  log(
    `  Internet: ${hasInternet ? "✓ CONNECTED" : "○ NO CONNECTION"}`,
    hasInternet ? "green" : "yellow"
  );

  // 7. 프로젝트 구조 확인
  log("\n📁 Project Structure...", "blue");

  const requiredDirs = [
    "lib/mystery",
    "lib/economic",
    "app/api/mystery",
    "app/api/economic",
    "public/audio/bgm",
    "data",
  ];

  const projectRoot = path.join(__dirname, "..");

  for (const dir of requiredDirs) {
    const fullPath = path.join(projectRoot, dir);
    const exists = fs.existsSync(fullPath);
    log(
      `  ${dir}: ${exists ? "✓" : "✗"}`,
      exists ? "green" : "red"
    );
    if (!exists) {
      diagnosis.issues.push(`Missing directory: ${dir}`);
    }
  }

  // 8. 최종 상태 결정
  log("\n================================", "blue");

  if (diagnosis.status === "OK") {
    diagnosis.readiness = "READY";
    log("✓ READY FOR TESTING", "green");
  } else if (diagnosis.status === "WARN") {
    diagnosis.readiness = "PARTIAL";
    log("⚠ PARTIAL SETUP", "yellow");
  } else {
    diagnosis.readiness = "NOT_READY";
    log("✗ NOT READY", "red");
  }

  if (diagnosis.issues.length > 0) {
    log("\nIssues found:", "yellow");
    diagnosis.issues.forEach((issue) => {
      log(`  • ${issue}`, "yellow");
    });
  }

  log("\n================================\n", "blue");

  // JSON 저장
  fs.writeFileSync(DIAGNOSTIC_FILE, JSON.stringify(diagnosis, null, 2));
  log(`Diagnostic saved to: ${DIAGNOSTIC_FILE}`, "blue");

  // 다음 단계 제안
  log("\nNext Steps:", "blue");
  if (!npm.available || !node.available) {
    log("  1. Install Node.js from https://nodejs.org", "yellow");
  } else {
    log("  1. npm install (if not done)", "green");
    log("  2. npm run build", "green");
    log("  3. npm run capability", "green");
  }

  process.exit(diagnosis.status === "OK" || diagnosis.status === "WARN" ? 0 : 1);
}

main().catch((error) => {
  console.error("Doctor failed:", error);
  process.exit(1);
});
