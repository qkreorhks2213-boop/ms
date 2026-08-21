#!/bin/bash
# Test script for mystery documentary auto-pipeline
# Usage: bash scripts/test-pipeline.sh [topic]

set -e

TOPIC="${1:-1948년 호주 애들레이드의 미스터리 시체 사건 - Tamam Shud Case}"
BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "🎬 Mystery Documentary Auto-Pipeline Test"
echo "=========================================="
echo ""
echo "📝 Topic: $TOPIC"
echo ""

# Step 1: Create test project
echo "1️⃣ Creating test project..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/mystery/test/quick-create" \
  -H "Content-Type: application/json" \
  -d "{\"topic\": \"$TOPIC\"}")

echo "$CREATE_RESPONSE" | jq .

PROJECT_ID=$(echo "$CREATE_RESPONSE" | jq -r '.project.id')
TEST_USER_ID=$(echo "$CREATE_RESPONSE" | jq -r '.testUserId')

if [ "$PROJECT_ID" = "null" ] || [ -z "$PROJECT_ID" ]; then
  echo "❌ Failed to create project"
  exit 1
fi

echo ""
echo "✅ Project created: $PROJECT_ID"
echo "   Test User ID: $TEST_USER_ID"
echo ""

# Step 2: Trigger auto-pipeline-v2
echo "2️⃣ Triggering auto-pipeline-v2 (this runs in background)..."
PIPELINE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/mystery/projects/$PROJECT_ID/auto-pipeline-v2" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token")

echo "$PIPELINE_RESPONSE" | jq .
echo ""

# Step 3: Poll project status
echo "3️⃣ Monitoring pipeline progress (10 second intervals, max 60 seconds)..."
echo ""

COUNTER=0
MAX_ATTEMPTS=6

while [ $COUNTER -lt $MAX_ATTEMPTS ]; do
  sleep 10
  COUNTER=$((COUNTER + 1))

  STATUS_RESPONSE=$(curl -s "$BASE_URL/api/mystery/projects/$PROJECT_ID" \
    -H "Authorization: Bearer test-token")

  STAGE=$(echo "$STATUS_RESPONSE" | jq -r '.stage')
  PROGRESS=$(echo "$STATUS_RESPONSE" | jq -r '.progress // 0')

  if [ "$STAGE" = "null" ]; then
    echo "❌ Failed to get project status"
    echo "$STATUS_RESPONSE" | jq .
    break
  fi

  # Stage emoji indicators
  case "$STAGE" in
    "research") EMOJI="🔍" ;;
    "script") EMOJI="📝" ;;
    "scenes") EMOJI="🎬" ;;
    "visuals") EMOJI="🖼️" ;;
    "narration") EMOJI="🎤" ;;
    "render") EMOJI="🎥" ;;
    "done") EMOJI="✅" ;;
    *) EMOJI="❓" ;;
  esac

  printf "  [$COUNTER/6] $EMOJI %-20s [%3d%%]\n" "$STAGE" "$PROGRESS"

  if [ "$STAGE" = "done" ]; then
    echo ""
    echo "🎉 Pipeline completed!"
    break
  fi
done

echo ""
echo "=========================================="
echo "📊 Final Project Status:"
echo ""

curl -s "$BASE_URL/api/mystery/projects/$PROJECT_ID" \
  -H "Authorization: Bearer test-token" | jq .

echo ""
echo "✅ Test complete! View dashboard at:"
echo "   $BASE_URL/mystery?projectId=$PROJECT_ID"
