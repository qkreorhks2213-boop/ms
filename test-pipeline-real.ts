/**
 * End-to-end pipeline test with real service calls
 * Tests the actual pipeline flow without mocking external dependencies
 */

import { createProject, readProject, updateProject } from "./lib/mystery/store";
import type { MysteryProject } from "./lib/mystery/types";
import { researchTopic } from "./lib/mystery/research";
import { generateScript } from "./lib/mystery/script";
import { generateScenes } from "./lib/mystery/scenes";

async function testPipeline() {
  console.log("\n🧪 [TEST] Starting real end-to-end pipeline test...\n");

  // Step 1: Create project
  console.log("📌 Step 1: Creating project...");
  const input = {
    topic: "Jack the Ripper 1888 London serial killings",
    caseType: "unsolved_case" as const,
    targetMinutes: 5,  // Smaller for faster testing
    endingStyle: "compare_hypotheses" as const,
    sceneVisualTarget: 10,
    angleChoices: ["case_focused"],
  };

  const project = createProject(input, "test-user");
  console.log(`✅ Project created: ${project.id}`);

  // Step 2: Test research
  console.log("\n📌 Step 2: Running research phase...");
  try {
    await researchTopic(project.id, project);
    const after_research = readProject(project.id);
    console.log(`✅ Research completed`);
    console.log(`   - Findings: ${after_research?.research?.length || 0}`);
    console.log(`   - Timeline events: ${after_research?.timeline?.length || 0}`);
    console.log(`   - Factcheck claims: ${Object.keys(after_research?.factcheckResults || {}).length}`);
  } catch (err: any) {
    console.error(`❌ Research failed:`, err.message);
    return;
  }

  // Step 3: Test script generation
  console.log("\n📌 Step 3: Running script generation phase...");
  try {
    const project_for_script = readProject(project.id);
    if (!project_for_script) throw new Error("Project not found");
    await generateScript(project.id, project_for_script);
    const after_script = readProject(project.id);
    console.log(`✅ Script generated`);
    console.log(`   - Title: ${after_script?.script?.title || "N/A"}`);
    console.log(`   - Sections: ${after_script?.script?.sections.length || 0}`);
  } catch (err: any) {
    console.error(`❌ Script generation failed:`, err.message);
    return;
  }

  // Step 4: Test scene generation
  console.log("\n📌 Step 4: Running scene generation phase...");
  try {
    const project_for_scenes = readProject(project.id);
    if (!project_for_scenes) throw new Error("Project not found");
    await generateScenes(project.id, project_for_scenes);
    const after_scenes = readProject(project.id);
    console.log(`✅ Scenes generated`);
    console.log(`   - Scene count: ${after_scenes?.scenes?.length || 0}`);
  } catch (err: any) {
    console.error(`❌ Scene generation failed:`, err.message);
    return;
  }

  console.log("\n✅ Pipeline test completed successfully!");
  console.log(`\n📁 Project: ${project.id}`);
  const final = readProject(project.id);
  console.log(`📊 Final state:`);
  console.log(`   - Stage: ${final?.stage}`);
  console.log(`   - Research: ${final?.research?.length || 0}`);
  console.log(`   - Script sections: ${final?.script?.sections.length || 0}`);
  console.log(`   - Scenes: ${final?.scenes?.length || 0}`);
}

testPipeline().catch((err) => {
  console.error("❌ Test error:", err);
  process.exit(1);
});
