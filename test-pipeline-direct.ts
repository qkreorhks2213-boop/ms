#!/usr/bin/env ts-node
/**
 * Direct E2E Pipeline Test
 * Runs the pipeline programmatically without requiring a running web server
 */

import { createProject, readProject, updateProject } from "@/lib/mystery/store";
import { researchTopic } from "@/lib/mystery/research";
import { generateScript } from "@/lib/mystery/script";
import { generateScenes } from "@/lib/mystery/scenes";
import { generateNarrationForScenes } from "@/lib/mystery/narration";
import { generateSubtitles } from "@/lib/mystery/subtitles";
import { integrateAssetsWithScenes, validateAssetSources } from "@/lib/mystery/assets";
import { renderMysteryVideo } from "@/lib/mystery/render-simple";
import { checkAllServices } from "@/lib/mystery/api-check";
import { generateStatusReport, formatStatusReportMarkdown } from "@/lib/mystery/status-report";
import { detectBoringScenes, optimizeBoringScenes } from "@/lib/mystery/boredumDetector";
import fs from "fs";
import path from "path";

const TEST_CASES = [
  {
    name: "Tamam Shud Case",
    topic: "타만 슈드 사건",
    type: "unsolved_case" as const,
  },
  {
    name: "Mary Celeste",
    topic: "Mary Celeste",
    type: "unsolved_case" as const,
  },
  {
    name: "Jack the Ripper",
    topic: "Jack the Ripper",
    type: "crime" as const,
  },
];

async function runFullPipeline(topic: string, caseType: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Testing: ${topic}`);
  console.log(`${"=".repeat(60)}\n`);

  // Create project
  console.log(`[1/13] Creating project`);

  const project = createProject({
    topic,
    caseType: caseType as any,
    targetMinutes: 10,
    angles: [],
    endingStyle: "unsolved",
    useRealPhotos: true,
    useAiReconstruction: true,
    useBgm: true,
    voiceName: "default",
    sceneVisualTarget: 40,
  }, "test-user");

  const projectId = project.id;
  console.log(`      ✓ Project created: ${projectId}`);

  // 1. Research
  console.log(`[2/13] Researching: ${topic}`);
  try {
    updateProject(projectId, (p) => {
      p.stage = "research";
    });
    const projectForResearch = readProject(projectId)!;
    await researchTopic(projectId, projectForResearch);
    console.log(`      ✓ Research complete`);
  } catch (err: any) {
    console.warn(`      ⚠ Research failed: ${err.message}`);
  }

  // 2. Script
  console.log(`[3/13] Generating script`);
  try {
    updateProject(projectId, (p) => {
      p.stage = "script";
    });
    const projectForScript = readProject(projectId)!;
    await generateScript(projectId, projectForScript);
    console.log(`      ✓ Script complete`);
  } catch (err: any) {
    console.warn(`      ⚠ Script generation failed: ${err.message}`);
  }

  // 3. Scenes
  console.log(`[4/13] Generating scenes`);
  try {
    updateProject(projectId, (p) => {
      p.stage = "scenes";
    });
    const projectForScenes = readProject(projectId)!;
    await generateScenes(projectId, projectForScenes);
    console.log(`      ✓ Scenes complete`);
  } catch (err: any) {
    console.warn(`      ⚠ Scene generation failed: ${err.message}`);
  }

  // 4. Assets
  console.log(`[5/13] Integrating assets`);
  try {
    const projectForAssets = readProject(projectId)!;
    if (projectForAssets.scenes) {
      const { scenes, assets } = integrateAssetsWithScenes(topic, projectForAssets.scenes);
      const validation = validateAssetSources(assets);
      updateProject(projectId, (p) => {
        p.scenes = scenes;
        p.sceneAssets = assets as any;
      });
      console.log(`      ✓ Assets integrated (${validation.summary.realAssets} real, ${validation.summary.aiGenerated} AI)`);
    }
  } catch (err: any) {
    console.warn(`      ⚠ Asset integration failed: ${err.message}`);
  }

  // 5. Boredom detection
  console.log(`[6/13] Scene optimization`);
  try {
    const projectForBoredom = readProject(projectId)!;
    if (projectForBoredom.scenes) {
      const analyses = detectBoringScenes(projectForBoredom.scenes);
      if (analyses.length > 0) {
        const optimized = optimizeBoringScenes(projectForBoredom.scenes, analyses);
        updateProject(projectId, (p) => {
          p.scenes = optimized;
        });
      }
      console.log(`      ✓ Boredom detection complete`);
    }
  } catch (err: any) {
    console.warn(`      ⚠ Boredom detection failed: ${err.message}`);
  }

  // 6. Narration
  console.log(`[7/13] Generating narration`);
  try {
    updateProject(projectId, (p) => {
      p.stage = "narration";
    });
    const projectForNarration = readProject(projectId)!;
    const narrationResult = await generateNarrationForScenes(projectId, projectForNarration);
    if (narrationResult.success) {
      updateProject(projectId, (p) => {
        p.narrationSegments = narrationResult.segments as any;
      });
      console.log(`      ✓ Narration complete (${narrationResult.segments.length} segments)`);
    } else {
      console.warn(`      ⚠ Narration skipped: ${narrationResult.error}`);
    }
  } catch (err: any) {
    console.warn(`      ⚠ Narration failed: ${err.message}`);
  }

  // 7. Subtitles
  console.log(`[8/13] Generating subtitles`);
  try {
    const projectForSubtitles = readProject(projectId)!;
    if (projectForSubtitles.narrationSegments) {
      const sceneIds = projectForSubtitles.scenes?.map((s) => s.id) || [];
      const subtitleTrack = generateSubtitles(projectForSubtitles.narrationSegments, sceneIds, "ko-KR");
      updateProject(projectId, (p) => {
        p.subtitleTracks = [subtitleTrack] as any;
      });
      console.log(`      ✓ Subtitles complete (${subtitleTrack.subtitles.length} items)`);
    } else {
      console.log(`      ⏭  Subtitles skipped (no narration)`);
    }
  } catch (err: any) {
    console.warn(`      ⚠ Subtitle generation failed: ${err.message}`);
  }

  // 8. QA
  console.log(`[9/13] QA checks`);
  const projectForQA = readProject(projectId)!;
  const qaChecks = {
    hasResearch: !!projectForQA.research && projectForQA.research.length > 0,
    hasScript: !!projectForQA.script && projectForQA.script.sections.length > 0,
    hasScenes: !!projectForQA.scenes && projectForQA.scenes.length > 0,
    hasNarration: !!projectForQA.narrationSegments,
  };
  console.log(`      ✓ QA checks: ${JSON.stringify(qaChecks)}`);

  // 9. Render
  console.log(`[10/13] Rendering video`);
  try {
    updateProject(projectId, (p) => {
      p.stage = "render";
    });
    const projectForRender = readProject(projectId)!;
    await renderMysteryVideo(projectId, projectForRender);
    console.log(`      ✓ Video rendered`);
  } catch (err: any) {
    console.warn(`      ⚠ Rendering failed: ${err.message}`);
  }

  // 10. Complete
  console.log(`[11/13] Marking complete`);
  updateProject(projectId, (p) => {
    p.stage = "done";
  });
  console.log(`      ✓ Pipeline complete`);

  // Generate report
  console.log(`[12/13] Generating report`);
  const services = await checkAllServices();
  const apiStatus = {
    ffmpeg: services[0].available,
    piper: services[1].available,
    ollama: services[2].available,
  };
  const finalProject = readProject(projectId)!;
  const report = generateStatusReport(finalProject, apiStatus);
  const markdown = formatStatusReportMarkdown(report);
  console.log(`      ✓ Report generated`);

  // Save results
  console.log(`[13/13] Saving results`);
  const resultsDir = path.join(process.cwd(), "test-results", `${topic.replace(/\s+/g, "-")}-${Date.now()}`);
  fs.mkdirSync(resultsDir, { recursive: true });

  fs.writeFileSync(path.join(resultsDir, "project.json"), JSON.stringify(finalProject, null, 2));
  fs.writeFileSync(path.join(resultsDir, "report.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(resultsDir, "report.md"), markdown);

  console.log(`      ✓ Results saved to ${resultsDir}`);
  console.log(`\n📊 Final Status: ${report.overallStatus}`);

  return report;
}

async function main() {
  console.log("\n");
  console.log("╔" + "=".repeat(58) + "╗");
  console.log("║" + " Mystery Documentary E2E Test Suite ".padEnd(59, " ") + "║");
  console.log("╚" + "=".repeat(58) + "╝");

  // Check services
  console.log("\nChecking API services...");
  const services = await checkAllServices();

  const results: any[] = [];

  // Run tests for each case
  for (const testCase of TEST_CASES) {
    try {
      const report = await runFullPipeline(testCase.topic, testCase.type);
      results.push({
        case: testCase.name,
        status: report.overallStatus,
        findings: report.research.findingsCount,
        sections: report.script.sectionsCount,
        scenes: report.scenes.scenesCount,
      });
    } catch (err: any) {
      console.error(`\n❌ Test failed: ${err.message}`);
      results.push({
        case: testCase.name,
        status: "FAIL",
        error: err.message,
      });
    }
  }

  // Final summary
  console.log("\n");
  console.log("╔" + "=".repeat(58) + "╗");
  console.log("║" + " Test Summary ".padEnd(59, " ") + "║");
  console.log("╚" + "=".repeat(58) + "╝");

  console.log("\n");
  results.forEach((r) => {
    const icon = r.status === "PASS" ? "✅" : "❌";
    console.log(`${icon} ${r.case}`);
    if (r.error) {
      console.log(`   Error: ${r.error}`);
    } else {
      console.log(`   Status: ${r.status} | Research: ${r.findings} | Sections: ${r.sections} | Scenes: ${r.scenes}`);
    }
  });

  const passCount = results.filter((r) => r.status === "PASS").length;
  console.log(`\n📊 Summary: ${passCount}/${results.length} tests passed`);
  console.log("\n");
}

main().catch(console.error);
