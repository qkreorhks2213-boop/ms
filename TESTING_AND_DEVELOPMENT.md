# Testing and Development Guide
## Mystery Documentary Auto-Pipeline

---

## 🚀 Quick Start for Testing

### Option 1: Using the Quick-Create UI

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Open the quick-create page:**
   ```
   http://localhost:3000/mystery/quick-create
   ```

3. **Enter a mystery description or click a template:**
   - Type your own description, or
   - Click one of the example templates (Tamam Shud, Mary Celeste, Jack the Ripper)

4. **Click "✨ 자동 제작 시작"**
   - System will redirect to progress dashboard
   - Watch as stages progress: 🔍 → 📝 → 🎬 → 🖼️ → 🎤 → 🎥 → ✅

### Option 2: Using Development Test Endpoints

The system includes **development-only** test endpoints that don't require authentication.

#### Create a Test Project
```bash
curl -X POST http://localhost:3000/api/mystery/test/quick-create \
  -H "Content-Type: application/json" \
  -d '{"topic": "Your mystery description here"}'
```

**Response:**
```json
{
  "success": true,
  "project": {
    "id": "8828d7ea-e0b8-44d2-9d0b-01016724b0d3",
    "stage": "research",
    ...
  },
  "testUserId": "test-user-1786451633081",
  "nextStep": "POST to /api/mystery/test/start-pipeline with projectId..."
}
```

#### Start the Pipeline
```bash
curl -X POST http://localhost:3000/api/mystery/test/start-pipeline \
  -H "Content-Type: application/json" \
  -d '{"projectId": "8828d7ea-e0b8-44d2-9d0b-01016724b0d3"}'
```

#### Monitor Progress
```bash
curl http://localhost:3000/api/mystery/projects/8828d7ea-e0b8-44d2-9d0b-01016724b0d3
```

### Option 3: Using the Test Script

```bash
npm run dev  # Terminal 1

# Terminal 2
bash scripts/test-pipeline.sh "1948년 호주의 미스터리 시체 사건"
```

**Output:**
```
🎬 Mystery Documentary Auto-Pipeline Test
==========================================

📝 Topic: 1948년 호주의 미스터리 시체 사건

1️⃣ Creating test project...
✅ Project created: b34b55df-1b3b-4d61-b8e3-84c551750c2f
   Test User ID: test-user-1786451633081

2️⃣ Triggering auto-pipeline...
3️⃣ Monitoring pipeline progress...

  [1/6] 🔍 research              [15%]
  [2/6] 📝 script                [28%]
  [3/6] 🎬 scenes                [42%]
  [4/6] 🖼️ visuals               [56%]
  [5/6] 🎤 narration             [70%]
  [6/6] 🎥 render                [84%]
```

---

## 🧪 Development Endpoints

### Test Quick-Create
**Endpoint:** `POST /api/mystery/test/quick-create`

**Only available in development mode** (`NODE_ENV !== "production"`)

**Request:**
```json
{
  "topic": "Event description"
}
```

**Response:**
```json
{
  "success": true,
  "project": { ... },
  "testUserId": "test-user-...",
  "nextStep": "Start pipeline with test/start-pipeline"
}
```

### Test Start Pipeline
**Endpoint:** `POST /api/mystery/test/start-pipeline`

**Only available in development mode** (`NODE_ENV !== "production"`)

**Request:**
```json
{
  "projectId": "project-id-from-quick-create"
}
```

**Response:**
```json
{
  "status": "pipeline-started",
  "projectId": "...",
  "message": "Test pipeline initiated - will process in background"
}
```

**What It Does:**
1. Validates project exists
2. Starts pipeline in background (async)
3. Executes 11 pipeline steps:
   - Step 1: Research (web searches)
   - Step 2: Fact-checking
   - Step 3: Timeline
   - Step 4: Script generation
   - Step 5: Scene composition
   - Step 6: Visual research
   - Step 7: Scene optimization
   - Step 8: Narration
   - Step 9: QA checks
   - Step 10: Video rendering
   - Step 11: Mark complete

**Error Handling:**
- Returns 403 if not in development mode
- Returns 400 if projectId missing
- Returns 404 if project not found
- Logs errors to project's errorLog

---

## 🧬 Test Structure

### Unit Tests
```bash
npm test
```

**Coverage:**
- 102 tests across 8 test suites
- Project creation and data structures
- Boredom detection algorithm
- Scene optimization
- Pipeline state management
- Error handling
- System integration

### E2E Test Suite
**File:** `/lib/mystery/__tests__/auto-pipeline.test.ts`

**Tests:**
1. Project creation with defaults
2. Data structure validation
3. Boredom detection on mock scenes
4. Scene optimization results
5. Pipeline stage transitions
6. Error handling gracefully
7. System function integration
8. User journey simulation

---

## 🛠️ Development Workflow

### 1. Make Code Changes
```bash
# Edit files as needed
vim app/mystery/quick-create/page.tsx
```

### 2. Run Tests
```bash
npm test

# Or specific test:
npm test -- --testPathPatterns="auto-pipeline"
```

### 3. Build
```bash
npm run build
```

### 4. Start Dev Server
```bash
npm run dev
```

### 5. Test Manually
```bash
# Option A: Web UI
open http://localhost:3000/mystery/quick-create

# Option B: API
curl -X POST http://localhost:3000/api/mystery/test/quick-create ...

# Option C: Script
bash scripts/test-pipeline.sh "Test topic"
```

### 6. Commit Changes
```bash
git add .
git commit -m "Description of changes"
git push -u origin claude/untitled-session-gtg0bt
```

---

## 📊 Monitoring Pipeline Progress

### Via File System
```bash
cat /home/user/-12/data/mystery-projects/{projectId}/project.json | jq .
```

### Via Dev Server Logs
The dev server logs all pipeline steps:
```
[test] Step 1: Research
[test] Step 2: Fact-checking
[test] Step 3: Timeline
...
```

### Via Project Status API
```bash
curl http://localhost:3000/api/mystery/projects/{projectId}
```

---

## 🚨 Common Issues

### Issue: "로그인이 필요합니다" (Login Required)
**Cause:** Using authenticated API endpoints without valid session

**Solution:** Use test endpoints instead:
```bash
# ❌ This requires auth
curl -X POST http://localhost:3000/api/mystery/projects/...

# ✅ Use test endpoint instead
curl -X POST http://localhost:3000/api/mystery/test/quick-create
```

### Issue: Build Fails with TypeScript Errors
**Solution:**
```bash
npm install          # Ensure deps up to date
npm run build        # Check specific errors
npm test             # Verify tests still pass
```

### Issue: Dev Server Shows 401 Errors
**Cause:** Missing authentication for regular API routes

**Solution:** This is expected. Regular API routes require NextAuth setup. Use:
- Quick-create page (handles auth redirects)
- Test endpoints (auth not required)

### Issue: External API Calls Fail (HTTP 403)
**Cause:** Network policy or proxy blocking external requests

**Example:**
```
뉴스 RSS 검색 실패(HTTP 403): https://news.google.com/rss/...
```

**Note:** This is expected in some environments. The system gracefully handles these failures.

---

## 📝 Example Workflows

### Workflow 1: Quick Demo
```bash
# 1. Start server
npm run dev

# 2. Open browser
open http://localhost:3000/mystery/quick-create

# 3. Click "Tamam Shud" template
# 4. Redirect to dashboard, watch progress
```

### Workflow 2: Automated Testing
```bash
# 1. Run test suite
npm test

# 2. All 102 tests should pass
# ✅ Test Suites: 8 passed
# ✅ Tests: 102 passed
```

### Workflow 3: Manual API Testing
```bash
# Terminal 1: Start server
npm run dev

# Terminal 2: Test project creation
PROJECT_ID=$(curl -s -X POST http://localhost:3000/api/mystery/test/quick-create \
  -H "Content-Type: application/json" \
  -d '{"topic": "Test"}' | jq -r '.project.id')

echo "Created: $PROJECT_ID"

# Terminal 2: Start pipeline
curl -X POST http://localhost:3000/api/mystery/test/start-pipeline \
  -H "Content-Type: application/json" \
  -d "{\"projectId\": \"$PROJECT_ID\"}"

# Terminal 2: Monitor
watch -n 2 "curl -s http://localhost:3000/api/mystery/projects/$PROJECT_ID | jq '.stage'"
```

### Workflow 4: CI/CD Integration
```bash
# In your CI/CD pipeline:
npm install          # Install deps
npm test             # Run tests (102 tests)
npm run build        # Build (no errors)

# Optional: Start server and hit endpoints
npm run dev &
sleep 5

# Test endpoints
curl -X POST http://localhost:3000/api/mystery/test/quick-create \
  -H "Content-Type: application/json" \
  -d '{"topic": "CI Test"}' -f

# Kill server
pkill -f "next dev"
```

---

## 🎯 What to Test

### UI/UX Testing
- [ ] Quick-create page loads
- [ ] Templates populate textarea
- [ ] Auto-create button works
- [ ] Progress dashboard shows stages
- [ ] Progress bar updates
- [ ] Can view project details
- [ ] Can navigate between tabs

### API Testing
- [ ] Test endpoints work in dev mode
- [ ] Returns 403 in production mode
- [ ] Project creation succeeds
- [ ] Pipeline starts in background
- [ ] Status updates as pipeline progresses
- [ ] Error logging works

### Pipeline Testing
- [ ] Each stage completes
- [ ] Progress updates appropriately
- [ ] Errors are caught and logged
- [ ] Boredom detection works
- [ ] Scene optimization applies
- [ ] Final stage marks as "done"

### Integration Testing
- [ ] Full end-to-end flow works
- [ ] UI → API → Processing → Results
- [ ] Multiple projects don't interfere
- [ ] State persistence works

---

## 📚 Additional Resources

- **Architecture**: See `MYSTERY_AUTO_PIPELINE.md`
- **Implementation**: See `IMPLEMENTATION_SUMMARY.md`
- **Session Report**: See `SESSION_COMPLETION_REPORT.md`
- **Code**: See `app/api/mystery/` and `lib/mystery/`

---

**Happy Testing! 🎬✨**
