#!/bin/bash
#
# Comprehensive E2E Test for Mystery Documentary Auto-Pipeline
# Tests all 3 mystery cases with full pipeline execution
#

set -e

BASEURL="${BASEURL:-http://localhost:3000}"
RESULTS_DIR="./test-results"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
REPORT_DIR="${RESULTS_DIR}/e2e-${TIMESTAMP}"

# Create results directory
mkdir -p "${REPORT_DIR}"

echo "=========================================="
echo "Mystery Documentary E2E Test Suite"
echo "=========================================="
echo "Base URL: ${BASEURL}"
echo "Results Directory: ${REPORT_DIR}"
echo "Timestamp: ${TIMESTAMP}"
echo ""

# Step 1: Check services
echo "[1/4] Checking API services..."
SERVICE_CHECK=$(curl -s "${BASEURL}/api/mystery/test/check-services")
echo "$SERVICE_CHECK" > "${REPORT_DIR}/services.json"

FFMPEG=$(echo "$SERVICE_CHECK" | grep -o '"available":true' | head -1 | grep -q 'true' && echo "YES" || echo "NO")
PIPER=$(echo "$SERVICE_CHECK" | grep -o '"available":true' | tail -2 | head -1 | grep -q 'true' && echo "YES" || echo "NO")

echo "  ✓ FFmpeg available: $FFMPEG"
echo "  ✓ Piper TTS available: $PIPER"
echo ""

# Function to test a single case
test_case() {
  local CASE_NAME=$1
  local TOPIC=$2
  local CASE_DIR="${REPORT_DIR}/${CASE_NAME}"

  mkdir -p "$CASE_DIR"

  echo "[2/4] Testing: $CASE_NAME ($TOPIC)"
  echo "  Creating project..."

  # Create project
  PROJECT_JSON=$(curl -s -X POST "${BASEURL}/api/mystery/create" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"Test: $CASE_NAME\",
      \"topic\": \"$TOPIC\",
      \"caseType\": \"unsolved_case\",
      \"targetMinutes\": 10,
      \"endingStyle\": \"unsolved\"
    }")

  PROJECT_ID=$(echo "$PROJECT_JSON" | grep -o '"projectId":"[^"]*' | sed 's/"projectId":"//')

  if [ -z "$PROJECT_ID" ]; then
    echo "  ✗ Failed to create project"
    echo "$PROJECT_JSON" > "$CASE_DIR/error-create.json"
    return 1
  fi

  echo "  ✓ Project created: $PROJECT_ID"

  # Start pipeline
  echo "  Starting pipeline..."
  PIPELINE_START=$(curl -s -X POST "${BASEURL}/api/mystery/test/start-pipeline" \
    -H "Content-Type: application/json" \
    -d "{\"projectId\": \"$PROJECT_ID\"}")

  echo "  ✓ Pipeline started (background execution)"

  # Wait for pipeline to complete (check every 2 seconds, max 60 seconds)
  echo "  Waiting for pipeline completion..."
  WAIT_TIME=0
  MAX_WAIT=60
  COMPLETED=false

  while [ $WAIT_TIME -lt $MAX_WAIT ]; do
    PROJECT_STATUS=$(curl -s "${BASEURL}/api/mystery/project?id=${PROJECT_ID}")
    STAGE=$(echo "$PROJECT_STATUS" | grep -o '"stage":"[^"]*' | sed 's/"stage":"//')

    if [ "$STAGE" = "done" ]; then
      COMPLETED=true
      break
    fi

    echo "  • Stage: $STAGE (${WAIT_TIME}s)"
    sleep 2
    WAIT_TIME=$((WAIT_TIME + 2))
  done

  if [ "$COMPLETED" = false ]; then
    echo "  ✗ Pipeline timeout (>60s)"
    return 1
  fi

  echo "  ✓ Pipeline completed"

  # Fetch project data
  FINAL_PROJECT=$(curl -s "${BASEURL}/api/mystery/project?id=${PROJECT_ID}")
  echo "$FINAL_PROJECT" > "$CASE_DIR/project.json"

  # Generate report
  echo "  Generating report..."
  REPORT=$(curl -s "${BASEURL}/api/mystery/test/get-report?projectId=${PROJECT_ID}")
  echo "$REPORT" > "$CASE_DIR/report.json"

  MARKDOWN=$(echo "$REPORT" | grep -o '"markdown":"[^"]*' | sed 's/"markdown":"//;s/"$//' | head -c 2000)
  echo "$MARKDOWN" > "$CASE_DIR/report.md"

  # Extract metrics
  RESEARCH_COUNT=$(echo "$FINAL_PROJECT" | grep -o '"research":\[' -A 1000 | grep -o '"id":"' | wc -l)
  SCRIPT_SECTIONS=$(echo "$FINAL_PROJECT" | grep -o '"sections":\[' -A 1000 | grep -o '"text":"' | wc -l)
  SCENE_COUNT=$(echo "$FINAL_PROJECT" | grep -o '"scenes":\[' -A 1000 | grep -o '"id":"' | wc -l)
  NARRATION_COUNT=$(echo "$FINAL_PROJECT" | grep -o '"narrationSegments":\[' -A 1000 | grep -o '"id":"' | wc -l)
  SUBTITLE_COUNT=$(echo "$FINAL_PROJECT" | grep -o '"subtitleTracks":\[' -A 1000 | grep -o '"text":"' | wc -l)

  echo ""
  echo "  📊 Metrics:"
  echo "     • Research findings: $RESEARCH_COUNT"
  echo "     • Script sections: $SCRIPT_SECTIONS"
  echo "     • Scenes: $SCENE_COUNT"
  echo "     • Narration segments: $NARRATION_COUNT"
  echo "     • Subtitles: $SUBTITLE_COUNT"
  echo ""

  # Save metrics
  cat > "$CASE_DIR/metrics.txt" <<EOF
Case: $CASE_NAME
Topic: $TOPIC
Project ID: $PROJECT_ID

Content Metrics:
  Research Findings: $RESEARCH_COUNT
  Script Sections: $SCRIPT_SECTIONS
  Scenes: $SCENE_COUNT
  Narration Segments: $NARRATION_COUNT
  Subtitles: $SUBTITLE_COUNT

Status: SUCCESS
EOF

  echo "  ✓ Report saved to $CASE_DIR/"
  echo ""

  return 0
}

# Step 2: Test Tamam Shud case
echo "[2/4] Testing Cases..."
echo ""
test_case "tamam-shud" "타만 슈드 사건" || true

# Step 3: Test Mary Celeste case
test_case "mary-celeste" "Mary Celeste" || true

# Step 4: Test Jack the Ripper case
test_case "jack-ripper" "Jack the Ripper" || true

# Generate final summary
echo "[4/4] Generating final summary..."
cat > "${REPORT_DIR}/SUMMARY.md" <<EOF
# E2E Test Results - ${TIMESTAMP}

## Test Environment
- Base URL: ${BASEURL}
- FFmpeg Available: $FFMPEG
- Piper TTS Available: $PIPER
- Test Start: $(date)

## Test Cases

### Tamam Shud Case (타만 슈드 사건)
- Status: $([ -f "${REPORT_DIR}/tamam-shud/metrics.txt" ] && echo "✅ COMPLETE" || echo "❌ FAILED")
- Results: See \`tamam-shud/\` directory

### Mary Celeste Case
- Status: $([ -f "${REPORT_DIR}/mary-celeste/metrics.txt" ] && echo "✅ COMPLETE" || echo "❌ FAILED")
- Results: See \`mary-celeste/\` directory

### Jack the Ripper Case
- Status: $([ -f "${REPORT_DIR}/jack-ripper/metrics.txt" ] && echo "✅ COMPLETE" || echo "❌ FAILED")
- Results: See \`jack-ripper/\` directory

## Artifacts Generated
- Service status reports
- Project JSON data
- Final status reports
- Content metrics
- Markdown-formatted reports

## Final Status
Test Suite Complete - See individual case directories for detailed results.
EOF

echo "✅ All tests completed!"
echo ""
echo "📁 Results saved to: ${REPORT_DIR}/"
echo "📋 Summary: ${REPORT_DIR}/SUMMARY.md"
echo ""
echo "=========================================="
