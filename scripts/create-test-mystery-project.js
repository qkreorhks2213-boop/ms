const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const projectId = uuidv4();
const projectDir = path.join(process.cwd(), 'data', 'mystery-projects', projectId);
fs.mkdirSync(projectDir, { recursive: true });

const project = {
  id: projectId,
  name: "칸다하르의 거인 - 테스트",
  userId: "test-user-001",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  errorLog: [],
  input: {
    topic: "칸다하르의 거인",
    caseType: "military_mystery",
    targetMinutes: 15,
    angles: ["evidence_focused", "mystery_focused"],
    endingStyle: "unsolved",
    useRealPhotos: true,
    useAiReconstruction: true,
    voiceName: "default",
    useBgm: false,
    sceneVisualTarget: 30
  },
  stage: "research",
  render: { status: "idle" }
};

fs.writeFileSync(
  path.join(projectDir, 'project.json'),
  JSON.stringify(project, null, 2)
);

console.log(`✓ 테스트 프로젝트 생성됨: ${projectId}`);
console.log(`프로젝트 파일: ${projectDir}/project.json`);
