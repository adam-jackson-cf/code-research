---
model: claude-sonnet-4-5-20250929
description: Validate full-stack application (database, backend, frontend, integration) both internally and externally
argument-hint: [sandbox_id] [public_url] [backend: tmux]
---

# Purpose

Perform comprehensive testing and validation of a full-stack application running in a local sandbox (OrbStack or Tmux). Tests all three layers (database, backend, frontend) both internally (within sandbox) and externally (via public URL), ensuring the application is production-ready before user access.

## Variables

SANDBOX_ID: $1
PUBLIC_URL: $2
BACKEND: $3 default "tmux" if not provided

## Instructions

- CRITICAL: Both internal AND external validation must pass before reporting success
- If ANY test fails, debug and fix the issue before continuing
- All three layers (frontend, backend, database) must be validated
- DO NOT proceed to success report if tests fail
- Test real endpoints and user flows, not just health checks
- Verify data persists across the full stack

## Workflow

1. **Database Validation (Internal)**
   - Connect to SQLite database in sandbox using `sbx exec [SANDBOX_ID] --backend [BACKEND]`
   - Run `sqlite3 [db_path] ".tables"` to verify all tables exist
   - Run `sqlite3 [db_path] "SELECT COUNT(*) FROM [table];"` for main tables
   - Validate schema matches expected structure
   - Store initial row counts for later comparison

2. **Backend Validation (Internal)**
   - Test key API endpoints from inside sandbox:
     - Use `sbx exec [SANDBOX_ID] "curl http://localhost:8000/api/..." --backend [BACKEND]` for each endpoint
   - Verify response codes (200, 201, etc.)
   - Verify response data structure is correct
   - Run backend tests if they exist: `sbx exec [SANDBOX_ID] "cd backend && uv run pytest" --backend [BACKEND]`
   - Check for errors in backend logs

3. **Backend Validation (External)**
   - Test key API endpoints from OUTSIDE sandbox using PUBLIC_URL:
     - Use `curl [PUBLIC_URL]/api/...` from your local machine
   - Verify responses match internal test results
   - Verify CORS is configured correctly
   - **CRITICAL**: This is the most important test - validates external access works
   - If external tests fail but internal pass:
     - Check CORS configuration in FastAPI
     - Verify backend binds to 0.0.0.0, not 127.0.0.1
     - Check proxy settings in vite.config.js
     - Verify port forwarding and host settings

4. **Frontend Validation (Internal)**
   - Run frontend build: `sbx exec [SANDBOX_ID] "cd frontend && npm run build" --backend [BACKEND]`
   - Verify build succeeds with no errors
   - Run frontend tests if they exist: `sbx exec [SANDBOX_ID] "cd frontend && npm test" --backend [BACKEND]`
   - Verify dist/ folder is generated

5. **Frontend Validation (External)**
   - Test page loads: `curl [PUBLIC_URL]`
   - Verify HTML is served with correct WORKFLOW_ID in title
   - Verify no 404 errors for static assets
   - Check that frontend can reach backend API

6. **Integration Validation (End-to-End)**
   - Test complete user flow through all layers:
     1. Frontend loads successfully
     2. User performs key action (e.g., create item, submit form)
     3. Frontend makes API call to backend
     4. Backend processes request and updates database
     5. Database stores data correctly
     6. Backend returns data to frontend
     7. Frontend displays updated data
   - Verify data persists after refresh
   - Check browser console for errors (if accessible)
   - Validate the complete flow works from external access

7. **Browser UI Validation (Visual Testing)** (Optional - requires Playwright)
   - Start browser in headless mode: `sbx browser start`
   - Navigate to application: `sbx browser nav [PUBLIC_URL]`
   - Take screenshot for validation: `sbx browser screenshot --path /tmp/validation-[SANDBOX_ID].png`
   - Verify critical UI elements are present:
     - Page title: `sbx browser eval "document.title"`
     - Main heading: `sbx browser eval "document.querySelector('h1')?.textContent"`
     - Button count: `sbx browser eval "document.querySelectorAll('button').length"`
     - Input fields: `sbx browser eval "document.querySelectorAll('input').length"`
   - Check for JavaScript errors: `sbx browser eval "window.onerror ? 'Has errors' : 'No errors'"`
   - Close browser: `sbx browser close`

8. **Error Resolution (If Tests Fail)**
   - DO NOT proceed if any test fails
   - Debug the specific failure:
     - Check application logs: `sbx exec [SANDBOX_ID] "cat backend/logs/*" --backend [BACKEND]`
     - Verify configuration files
     - Test individual components
     - Fix the root cause
   - Re-run ALL validations after fixes
   - Only proceed when all validations pass

9. Now follow the `Report` section to report the validation results

## Report

Present validation results in this format:

## 🧪 Full-Stack Validation Results

**Sandbox ID**: [SANDBOX_ID]
**Public URL**: [PUBLIC_URL]
**Backend**: [BACKEND]

---

### ✅ Database Validation (Internal)
- **Tables**: ✅ All tables exist ([list table names])
- **Queries**: ✅ Database accessible and queryable
- **Schema**: ✅ Matches expected structure
- **Status**: PASSED

---

### ✅ Backend Validation (Internal)
- **Endpoints Tested**: [list endpoints tested]
- **Response Codes**: ✅ All returned expected codes
- **Data Structure**: ✅ Responses match expected format
- **Tests**: ✅ Backend tests passed (or N/A if no tests)
- **Status**: PASSED

---

### ✅ Backend Validation (External)
- **Endpoints Tested**: [list endpoints tested via PUBLIC_URL]
- **External Access**: ✅ APIs accessible from public URL
- **CORS**: ✅ Configured correctly
- **Data Consistency**: ✅ External responses match internal tests
- **Status**: PASSED

---

### ✅ Frontend Validation (Internal)
- **Build**: ✅ Build succeeded with no errors
- **Tests**: ✅ Frontend tests passed (or N/A if no tests)
- **Assets**: ✅ dist/ folder generated correctly
- **Status**: PASSED

---

### ✅ Frontend Validation (External)
- **Page Load**: ✅ HTML served correctly from [PUBLIC_URL]
- **WORKFLOW_ID**: ✅ Found in page title
- **Static Assets**: ✅ No 404 errors
- **Status**: PASSED

---

### ✅ Integration Validation (End-to-End)
- **User Flow Tested**: [describe the flow, e.g., "Created item → Saved to DB → Displayed in list → Persisted after refresh"]
- **Frontend → Backend**: ✅ API calls successful
- **Backend → Database**: ✅ Data persisted correctly
- **Database → Backend**: ✅ Data retrieved successfully
- **Backend → Frontend**: ✅ Data displayed correctly
- **Data Persistence**: ✅ Data survives page refresh
- **Status**: PASSED

---

### ✅ Browser UI Validation (Visual Testing)
- **Screenshot**: ✅ Saved to /tmp/validation-[SANDBOX_ID].png
- **Page Title**: ✅ [actual title from browser eval]
- **Main Heading (H1)**: ✅ [actual h1 text]
- **Interactive Elements**: ✅ [N buttons, M inputs found]
- **JavaScript Errors**: ✅ No errors detected
- **Page State**: ✅ complete (fully loaded)
- **Visual Appearance**: ✅ UI renders correctly (see screenshot)
- **Status**: PASSED

---

### 🎉 Final Validation Status: ALL TESTS PASSED

Your application is production-ready and accessible at: **[PUBLIC_URL]**

**Validation Summary:**
- ✅ Database layer working correctly
- ✅ Backend APIs responding (internal + external)
- ✅ Frontend built and served properly
- ✅ Complete end-to-end flow validated
- ✅ External access confirmed working
- ✅ Browser UI validation passed (screenshot captured)

---

**OR** (If any test failed):

### ❌ Final Validation Status: TESTS FAILED

**Failed Tests:**
- [List which validation section(s) failed]

**Error Details:**
[Detailed error information for each failure]

**Required Actions:**
1. [Specific fix needed for failure 1]
2. [Specific fix needed for failure 2]

**Next Steps:**
- Fix the issues listed above
- Re-run validation: `\test [SANDBOX_ID] [PUBLIC_URL] [BACKEND]`
- Do not proceed until all tests pass
