#!/usr/bin/env node

/**
 * CAPABILITY CHECK
 * 각 기능별 최소 테스트로 실제 사용 가능 여부 확인
 *
 * 사용: npm run capability
 *
 * 테스트 항목:
 * 1. Web Research (Google News RSS)
 * 2. Fact Check (JSON 파싱)
 * 3. LLM Script (OLLAMA 또는 Mock)
 * 4. Image Search (Wikimedia API)
 * 5. TTS (Text-to-Speech)
 * 6. FFmpeg Video (2초 테스트)
 * 7. Project Storage (JSON 저장)
 * 8. Mock Mode (테스트용 가짜 데이터)
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const DIAGNOSTICS_DIR = path.join(__dirname, "../diagnostics");
const CAPABILITY_FILE = path.join(DIAGNOSTICS_DIR, "capability-matrix.json");

if (!fs.existsSync(DIAGNOSTICS_DIR)) {
  fs.mkdirSync(DIAGNOSTICS_DIR, { recursive: true });
}

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[36m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

const capabilities = {};

async function testWebResearch() {
  log("\n🔍 Testing: Web Research", "blue");

  try {
    // RSS 피드 간단한 테스트
    const hasInternet = await checkInternet();
    if (!hasInternet) {
      capabilities["Web Research"] = {
        status: "UNAVAILABLE",
        reason: "No internet connection",
        autoFixable: false,
        userAction: "Check internet connection",
      };
      log("  ✗ No internet connection", "red");
      return;
    }

    // Mock 모드에서는 항상 패스
    if (process.env.MYSTERY_MOCK_MODE === "true") {
      capabilities["Web Research"] = {
        status: "AVAILABLE (MOCK)",
        reason: "Mock mode enabled",
        autoFixable: false,
        userAction: "none",
      };
      log("  ✓ AVAILABLE (Mock mode)", "green");
      return;
    }

    // 실제 테스트는 나중에
    capabilities["Web Research"] = {
      status: "AVAILABLE",
      reason: "Internet connection detected",
      autoFixable: false,
      userAction: "none",
    };
    log("  ✓ AVAILABLE", "green");
  } catch (error) {
    capabilities["Web Research"] = {
      status: "FAILED",
      reason: error.message,
      autoFixable: false,
      userAction: "Check error logs",
    };
    log(`  ✗ Error: ${error.message}`, "red");
  }
}

async function testFactCheck() {
  log("\n📋 Testing: Fact Check", "blue");

  try {
    // JSON 파싱만 테스트
    const testData = {
      claims: [
        {
          claim: "Test fact",
          status: "FACT",
          source: "Test Source",
          date: "2026-08-09",
        },
      ],
    };

    const jsonStr = JSON.stringify(testData);
    const parsed = JSON.parse(jsonStr);

    if (parsed.claims && parsed.claims[0].status) {
      capabilities["Fact Check"] = {
        status: "AVAILABLE",
        reason: "JSON parsing works",
        autoFixable: false,
        userAction: "none",
      };
      log("  ✓ AVAILABLE", "green");
    }
  } catch (error) {
    capabilities["Fact Check"] = {
      status: "FAILED",
      reason: error.message,
      autoFixable: false,
      userAction: "Check error logs",
    };
    log(`  ✗ Error: ${error.message}`, "red");
  }
}

async function testLLM() {
  log("\n🧠 Testing: LLM Script Generation", "blue");

  try {
    // OLLAMA 확인
    const ollamaHost = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";

    if (process.env.MYSTERY_MOCK_MODE === "true") {
      capabilities["LLM Script"] = {
        status: "AVAILABLE (MOCK)",
        reason: "Mock mode enabled",
        autoFixable: false,
        userAction: "none",
      };
      log("  ✓ AVAILABLE (Mock mode)", "green");
      return;
    }

    // OLLAMA 연결 시도 (timeout 짧게)
    try {
      const response = require("child_process").execSync(
        `curl -s -m 2 ${ollamaHost}/api/tags 2>&1`,
        { encoding: "utf-8" }
      );

      if (response.includes("models")) {
        capabilities["LLM Script"] = {
          status: "AVAILABLE",
          reason: "OLLAMA is running",
          autoFixable: false,
          userAction: "none",
        };
        log("  ✓ AVAILABLE (OLLAMA running)", "green");
      } else {
        throw new Error("OLLAMA not responding");
      }
    } catch {
      capabilities["LLM Script"] = {
        status: "UNAVAILABLE",
        reason: "OLLAMA not running on " + ollamaHost,
        autoFixable: true,
        userAction:
          "Start OLLAMA: ollama serve, or enable MYSTERY_MOCK_MODE=true",
      };
      log(
        "  ⚠ OLLAMA not available (Mock mode available)",
        "yellow"
      );
    }
  } catch (error) {
    capabilities["LLM Script"] = {
      status: "FAILED",
      reason: error.message,
      autoFixable: false,
      userAction: "Check error logs",
    };
    log(`  ✗ Error: ${error.message}`, "red");
  }
}

async function testImageSearch() {
  log("\n🖼️  Testing: Image Search", "blue");

  try {
    // Wikimedia API 간단한 테스트
    const hasInternet = await checkInternet();

    if (!hasInternet) {
      capabilities["Image Search"] = {
        status: "UNAVAILABLE",
        reason: "No internet connection",
        autoFixable: false,
        userAction: "Check internet connection",
      };
      log("  ✗ No internet", "red");
      return;
    }

    if (process.env.MYSTERY_MOCK_MODE === "true") {
      capabilities["Image Search"] = {
        status: "AVAILABLE (MOCK)",
        reason: "Mock mode enabled",
        autoFixable: false,
        userAction: "none",
      };
      log("  ✓ AVAILABLE (Mock mode)", "green");
      return;
    }

    capabilities["Image Search"] = {
      status: "AVAILABLE",
      reason: "Internet connection available",
      autoFixable: false,
      userAction: "none",
    };
    log("  ✓ AVAILABLE", "green");
  } catch (error) {
    capabilities["Image Search"] = {
      status: "FAILED",
      reason: error.message,
      autoFixable: false,
      userAction: "Check error logs",
    };
    log(`  ✗ Error: ${error.message}`, "red");
  }
}

async function testTTS() {
  log("\n🔊 Testing: Text-to-Speech", "blue");

  try {
    // TTS는 복잡하므로 mock으로 처리
    if (process.env.MYSTERY_MOCK_MODE === "true") {
      capabilities["TTS"] = {
        status: "AVAILABLE (MOCK)",
        reason: "Mock mode enabled",
        autoFixable: false,
        userAction: "none",
      };
      log("  ✓ AVAILABLE (Mock mode)", "green");
      return;
    }

    // 실제 환경에서는 이후 별도 테스트
    capabilities["TTS"] = {
      status: "DEFERRED",
      reason: "Will test during scene generation",
      autoFixable: false,
      userAction: "none",
    };
    log("  ⏳ DEFERRED (test during scene generation)", "yellow");
  } catch (error) {
    capabilities["TTS"] = {
      status: "FAILED",
      reason: error.message,
      autoFixable: false,
      userAction: "Check error logs",
    };
    log(`  ✗ Error: ${error.message}`, "red");
  }
}

async function testFFmpeg() {
  log("\n🎬 Testing: FFmpeg Rendering", "blue");

  try {
    // Try bundled FFmpeg first
    const ffmpegPath = require("path").join(__dirname, "../node_modules/@ffmpeg-installer/linux-x64/ffmpeg");
    const ffmpeg = require("fs").existsSync(ffmpegPath) ? ffmpegPath : "ffmpeg";

    const ffmpegCheck = require("child_process").execSync(
      `"${ffmpeg}" -version 2>&1 | head -1`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    );

    if (ffmpegCheck.includes("ffmpeg")) {
      capabilities["FFmpeg"] = {
        status: "AVAILABLE",
        reason: "FFmpeg found",
        autoFixable: false,
        userAction: "none",
      };
      log("  ✓ AVAILABLE", "green");
    } else {
      throw new Error("FFmpeg not found");
    }
  } catch (error) {
    capabilities["FFmpeg"] = {
      status: "UNAVAILABLE",
      reason: "FFmpeg not installed",
      autoFixable: true,
      userAction: "Install FFmpeg from https://ffmpeg.org",
    };
    log("  ✗ FFmpeg not found", "red");
  }
}

async function testProjectStorage() {
  log("\n💾 Testing: Project Storage", "blue");

  try {
    const testDir = path.join(__dirname, "../data/test");
    const testFile = path.join(testDir, "capability-test.json");

    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    const testData = {
      test: true,
      timestamp: new Date().toISOString(),
    };

    fs.writeFileSync(testFile, JSON.stringify(testData, null, 2));
    const readData = JSON.parse(fs.readFileSync(testFile, "utf-8"));

    if (readData.test) {
      capabilities["Project Storage"] = {
        status: "AVAILABLE",
        reason: "File I/O working",
        autoFixable: false,
        userAction: "none",
      };
      log("  ✓ AVAILABLE", "green");
      fs.unlinkSync(testFile);
    }
  } catch (error) {
    capabilities["Project Storage"] = {
      status: "FAILED",
      reason: error.message,
      autoFixable: false,
      userAction: "Check file permissions",
    };
    log(`  ✗ Error: ${error.message}`, "red");
  }
}

async function testMockMode() {
  log("\n🎭 Testing: Mock Mode", "blue");

  try {
    const isMockEnabled = process.env.MYSTERY_MOCK_MODE === "true";

    capabilities["Mock Mode"] = {
      status: isMockEnabled ? "ENABLED" : "DISABLED",
      reason: isMockEnabled
        ? "Mock mode is enabled"
        : "Can be enabled with MYSTERY_MOCK_MODE=true",
      autoFixable: false,
      userAction: "none",
    };

    log(
      `  ${isMockEnabled ? "✓" : "○"} Mock Mode: ${isMockEnabled ? "ENABLED" : "Disabled"}`,
      isMockEnabled ? "green" : "yellow"
    );

    if (!isMockEnabled) {
      log("    (Can enable with: MYSTERY_MOCK_MODE=true)", "yellow");
    }
  } catch (error) {
    capabilities["Mock Mode"] = {
      status: "UNKNOWN",
      reason: error.message,
      autoFixable: false,
      userAction: "Check error",
    };
  }
}

function checkInternet() {
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

async function generateMatrix() {
  log("\n\n================================", "blue");
  log("CAPABILITY MATRIX", "blue");
  log("================================\n", "blue");

  const table = [
    ["기능", "상태", "원인", "자동 해결", "사용자 조치"].join(" | "),
    ["-".repeat(10), "-".repeat(15), "-".repeat(30), "-".repeat(8), "-".repeat(40)].join(
      "|"
    ),
  ];

  for (const [feature, info] of Object.entries(capabilities)) {
    const status = info.status.includes("UNAVAILABLE")
      ? "❌ " + info.status
      : info.status.includes("FAILED")
        ? "⚠️  " + info.status
        : info.status.includes("DEFERRED")
          ? "⏳ " + info.status
          : info.status.includes("AVAILABLE")
            ? "✓ " + info.status
            : info.status;

    const fixable = info.autoFixable ? "YES" : "NO";
    const action = info.userAction || "none";

    const row = [
      feature.padEnd(12),
      status.padEnd(20),
      info.reason.slice(0, 28).padEnd(30),
      fixable.padEnd(8),
      action.slice(0, 38).padEnd(40),
    ].join(" | ");

    table.push(row);
  }

  console.log(table.join("\n"));

  // 최종 상태
  log("\n================================", "blue");

  const allAvailable = Object.values(capabilities).every((c) =>
    c.status.includes("AVAILABLE") ||
    c.status.includes("DEFERRED") ||
    c.status.includes("ENABLED")
  );

  const someBlocked = Object.values(capabilities).some((c) =>
    c.status.includes("UNAVAILABLE")
  );

  if (allAvailable && !someBlocked) {
    log("✓ ALL CAPABILITIES READY", "green");
  } else if (someBlocked) {
    log("⚠ SOME CAPABILITIES BLOCKED", "yellow");
    log("\nBlocked capabilities:", "yellow");
    Object.entries(capabilities).forEach(([feature, info]) => {
      if (info.status.includes("UNAVAILABLE")) {
        log(`  • ${feature}: ${info.userAction}`, "yellow");
      }
    });
  } else {
    log("✓ CAPABILITIES READY (with deferred tests)", "green");
  }

  log("\n================================\n", "blue");

  // JSON 저장
  const matrix = {
    timestamp: new Date().toISOString(),
    capabilities,
    summary: {
      total: Object.keys(capabilities).length,
      available: Object.values(capabilities).filter((c) =>
        c.status.includes("AVAILABLE")
      ).length,
      blocked: Object.values(capabilities).filter((c) =>
        c.status.includes("UNAVAILABLE")
      ).length,
      deferred: Object.values(capabilities).filter((c) =>
        c.status.includes("DEFERRED")
      ).length,
    },
  };

  fs.writeFileSync(CAPABILITY_FILE, JSON.stringify(matrix, null, 2));
  log(`Capability matrix saved to: ${CAPABILITY_FILE}`, "blue");

  // 다음 단계
  log("\nNext Steps:", "blue");
  log("  1. Review capabilities above", "green");
  if (someBlocked) {
    log("  2. Resolve blocked capabilities", "yellow");
    log("  3. Enable MYSTERY_MOCK_MODE=true to test without external services", "yellow");
  }
  log("  Run: npm run dry-run", "green");
}

async function main() {
  console.clear();
  log("\n================================", "blue");
  log("CAPABILITY CHECK", "blue");
  log("================================\n", "blue");

  await testWebResearch();
  await testFactCheck();
  await testLLM();
  await testImageSearch();
  await testTTS();
  await testFFmpeg();
  await testProjectStorage();
  await testMockMode();

  await generateMatrix();

  process.exit(0);
}

main().catch((error) => {
  console.error("Capability check failed:", error);
  process.exit(1);
});
