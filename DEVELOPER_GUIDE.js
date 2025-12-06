// UNFAIR Developer's Quick Reference Guide

/*
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║                    QUICK REFERENCE FOR DEVELOPERS                  ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
// 🎯 KEY FILES & WHAT THEY DO
// ============================================================================

/*
FRONTEND (Chrome Extension)
───────────────────────────

popup.js
  • Main UI logic for all 3 screens
  • State management (state object)
  • Timer functionality
  • Assignment CRUD operations
  • Backend API calls
  • Copy-paste detection
  • Export/Share logic
  ⚡ Where to modify: UI behavior, state, API endpoints

popup.html
  • 3-screen layout (home, recording, log)
  • Assignment list rendering
  • Form inputs
  • Button listeners
  ⚡ Where to modify: UI structure, form fields, new screens

popup.css
  • Professional styling matching mockups
  • Blue/red color scheme
  • Responsive design
  • Animations (pulsing, transitions)
  ⚡ Where to modify: Colors, fonts, spacing, animations

content.js
  • Monitors ChatGPT/Claude pages
  • Detects prompts and responses
  • Auto-categorizes interactions
  • Extracts code blocks
  • Syncs to Chrome storage
  ⚡ Where to modify: Add new AI platforms, detection logic, categorization

background.js
  • Manages recording sessions
  • Routes messages between components
  • Syncs to backend API
  • Handles auth tokens
  ⚡ Where to modify: Backend communication, sync logic, authentication

config.js
  • Feature flags
  • API endpoints
  • AI platform configuration
  • Detection thresholds
  ⚡ Where to modify: Enable/disable features, change thresholds

manifest.json
  • Extension configuration
  • Permissions
  • Content script matches
  • Host permissions
  ⚡ Where to modify: Add new domains, permissions, icons
*/

/*
BACKEND (Flask API)
───────────────────

main.py
  • All 11 API endpoints
  • Database models (User, Course, Assignment, Interaction, Transcript)
  • Authentication logic
  • Error handling
  • CORS configuration
  ⚡ Where to modify: Add endpoints, change database schema, auth

Database Models:
  User        - Student/Professor accounts
  Course      - Course information
  Assignment  - Individual assignments
  Interaction - AI conversations
  Transcript  - Generated verification records
  ⚡ Where to modify: Add fields, relationships, constraints

API Endpoints (11 total):
  GET    /api/assignments                      - List all
  POST   /api/assignments                      - Create
  GET    /api/assignments/<id>                 - Get one
  PUT    /api/assignments/<id>                 - Update
  POST   /api/assignments/<id>/interactions    - Log interaction
  GET    /api/assignments/<id>/interactions    - Get all
  POST   /api/assignments/<id>/transcript      - Generate
  GET    /api/transcripts/<id>                 - Get public
  POST   /api/transcripts/<id>/share           - Update share
  GET    /api/health                           - Health check
  ⚡ Where to modify: Add endpoints, change request/response format

Utilities:
  create_token()   - Generate JWT
  verify_token()   - Validate JWT
  token_required   - Decorator for protected routes
  ⚡ Where to modify: Change token format, expiration, claims
*/

/*
UTILITIES
─────────

copyPasteDetector.js
  • Levenshtein distance algorithm
  • Code segment parsing
  • Similarity calculation
  • Report generation
  ⚡ Where to modify: Change thresholds, improve parsing, add features
*/

// ============================================================================
// 💬 COMPONENT COMMUNICATION
// ============================================================================

/*
Message Types Between Components:
──────────────────────────────────

// Content Script → Background Worker
{
  type: 'LOG_INTERACTION',
  data: { interaction object },
  assignmentId: 'uuid'
}

// Popup ↔ Background Worker
{
  type: 'GET_SESSION_STATUS'
}

{
  type: 'START_RECORDING',
  assignmentId: 'uuid'
}

{
  type: 'STOP_RECORDING'
}

// Popup → Backend API (via Background)
POST /api/assignments
PUT  /api/assignments/<id>
POST /api/assignments/<id>/interactions
POST /api/assignments/<id>/transcript

// Frontend → Chrome Storage
{
  unfairState: {
    isRecording: boolean,
    isPaused: boolean,
    assignments: [],
    currentAssignment: {},
    recordingTime: number
  }
}

{
  authToken: string
}

{
  unfairInteractions: {
    [assignmentId]: [interactions]
  }
}
*/

// ============================================================================
// 🔧 COMMON MODIFICATIONS
// ============================================================================

/*
Add a New AI Platform (e.g., Gemini)
────────────────────────────────────

1. content.js:
   - Add new observer function: observeGemini()
   - Add extraction function: extractGeminiConversation()
   - Add to initContentScript() setup

2. manifest.json:
   - Add to content_scripts matches
   - Add to host_permissions

3. config.js:
   - Add to PLATFORMS configuration

4. popup.js:
   - Update categorization logic if needed
*/

/*
Change Detection Thresholds
──────────────────────────

In config.js:
  THRESHOLDS: {
    COPY_PASTE_SIMILARITY: 0.75,  // Change this
    EXACT_MATCH: 0.95              // Or this
  }

In copyPasteDetector.js:
  constructor() {
    this.threshold = 0.75;  // Change here
  }
*/

/*
Add New Metric to Transcript
─────────────────────────────

1. popup.js - Calculation:
   Add logic to calculateTranscriptStats()

2. popup.html - Display:
   Add new stat-card div

3. server/main.py - Storage:
   Add field to Transcript.summary_stats

4. Backend sync in background.js:
   Include new metric in POST request
*/

/*
Modify UI Color Scheme
──────────────────────

In popup.css, change:
  Primary Blue: #2563eb
  Secondary Blue: #1e40af
  Red/Recording: #ef4444
  Yellow/Pause: #fbbf24
  Green/Active: #10b981

Search and replace or use CSS variables
*/

// ============================================================================
// 🐛 DEBUGGING TIPS
// ============================================================================

/*
Extension Debugging
───────────────────

Chrome DevTools:
  1. Open extension popup
  2. Right-click → Inspect
  3. Check Console tab for [UNFAIR] logs
  4. Check Network tab for API calls

Service Worker:
  1. chrome://extensions
  2. UNFAIR → Inspect views → service worker
  3. Check console for background.js logs

Content Script:
  1. Open ChatGPT/Claude in tab
  2. Right-click → Inspect
  3. Console tab → Look for [UNFAIR] logs
  4. Check DOM mutation detection
*/

/*
Backend Debugging
─────────────────

Check Server Health:
  curl http://localhost:5000/api/health

View Logs:
  python main.py  // Logs to console

Database Inspection:
  sqlite3 unfair.db
  > .tables
  > SELECT * FROM user;
  > SELECT * FROM assignment;
  > etc.

API Testing:
  curl -X POST http://localhost:5000/api/assignments \
    -H "Authorization: Bearer <token>" \
    -H "Content-Type: application/json" \
    -d '{"name": "Test"}'
*/

/*
Common Issues & Fixes
─────────────────────

Issue: Extension not capturing interactions
Solution:
  • Check [UNFAIR] logs in page console
  • Verify ChatGPT/Claude page is fully loaded
  • Reload extension in chrome://extensions
  • Refresh the page

Issue: Backend not receiving data
Solution:
  • Verify backend is running: curl http://localhost:5000/api/health
  • Check config.js API_BASE_URL
  • Look at Network tab in DevTools
  • Check backend console for errors

Issue: Timer not updating
Solution:
  • Check DevTools console for JavaScript errors
  • Verify startTimer() was called
  • Reload extension
  • Clear Chrome storage: chrome://settings/clearBrowserData

Issue: Data not persisting
Solution:
  • Check chrome://extensions → UNFAIR → Details
  • Verify extension has storage permission
  • Try manual save: Ctrl+Shift+Delete clear cache
  • Restart Chrome
*/

// ============================================================================
// 📊 KEY DATA STRUCTURES
// ============================================================================

/*
State Object (popup.js)
───────────────────────
{
  currentScreen: 'home|recording|log',
  isRecording: boolean,
  isPaused: boolean,
  recordingStartTime: timestamp,
  timerInterval: intervalId,
  assignments: [Assignment],
  currentAssignment: Assignment,
  interactions: [Interaction],
  recordingTime: seconds,
  authToken: string,
  backendUrl: 'http://...'
}
*/

/*
Assignment Object
─────────────────
{
  id: 'uuid',
  name: 'Assignment Name',
  course: 'CS 225',
  dueDate: '2025-01-15',
  createdAt: ISO timestamp,
  status: 'active|paused|submitted',
  interactions: [Interaction],
  recordingTime: seconds
}
*/

/*
Interaction Object
──────────────────
{
  id: 'uuid',
  timestamp: '10:23:15 AM',
  type: 'prompt|response',
  category: 'Debugging|Brainstorming|...',
  content: string,
  fullContent: string,
  platform: 'ChatGPT|Claude|...',
  codeBlocks: [string],
  capturedAt: ISO timestamp
}
*/

/*
Transcript Object
─────────────────
{
  id: 'uuid',
  assignmentId: 'uuid',
  generatedAt: ISO timestamp,
  shareToken: 'uuid',
  shareExpiresAt: ISO timestamp,
  summaryStats: {
    totalInteractions: number,
    userPrompts: number,
    aiResponses: number,
    activeTimeSeconds: number,
    aiAssistancePercentage: number
  }
}
*/

// ============================================================================
// 🎨 CUSTOMIZATION CHECKLIST
// ============================================================================

/*
Before Going to Production
───────────────────────────

□ Update config.js with production API URL
□ Change SECRET_KEY in .env
□ Set FLASK_ENV=production
□ Configure PostgreSQL for backend
□ Set up HTTPS for API
□ Enable proper CORS origins
□ Set up email notifications
□ Configure database backups
□ Add rate limiting
□ Implement proper logging
□ Test all features in production-like environment
□ Set up monitoring/alerting
□ Create admin dashboard
□ Write API documentation
□ Create user documentation
□ Set up customer support system
*/

// ============================================================================
// 📚 USEFUL COMMANDS
// ============================================================================

/*
Backend Commands
────────────────

# Start backend
cd server
python main.py

# Install new package
pip install package-name
pip freeze > requirements.txt

# Reset database
rm unfair.db
python main.py  // Recreates DB

# Check dependencies
pip list

# Test API
curl http://localhost:5000/api/health
*/

/*
Git Commands
────────────

# Check status
git status

# Stage changes
git add .

# Commit
git commit -m "description"

# Push
git push origin main

# View recent commits
git log --oneline -10

# Create feature branch
git checkout -b feature/name
*/

// ============================================================================
// 📖 LEARNING RESOURCES
// ============================================================================

/*
Documentation:
  • README_IMPLEMENTATION.md - Full setup guide
  • IMPLEMENTATION_COMPLETE.md - Feature summary
  • docs/architecture.md - System design
  • READY_TO_LAUNCH.txt - Quick overview

Code Comments:
  • Every major function has explanatory comments
  • Search for [UNFAIR] tags in code for key sections
  • Check config.js for feature explanations

External Resources:
  • Flask Documentation: https://flask.palletsprojects.com
  • Chrome Extension Docs: https://developer.chrome.com/docs/extensions
  • SQLAlchemy: https://docs.sqlalchemy.org
  • JWT: https://jwt.io
*/

// ============================================================================
// ✨ TIPS & TRICKS
// ============================================================================

/*
Productivity Tips
─────────────────

1. Use Chrome DevTools Breakpoints
   Set breakpoints in popup.js to debug state changes

2. Use console.log with [UNFAIR] prefix
   Makes it easy to find your logs: grep "[UNFAIR]"

3. Use Chrome Storage Viewer
   Extension: "Storage" by jpadilla
   View all Chrome storage in one place

4. Use Python Flask Shell
   $ python -c "from main import *; db.create_all()"

5. Monitor Network Requests
   DevTools → Network tab filters API calls in real-time

6. Use VS Code Extensions:
   - Python
   - Prettier (for formatting)
   - Error Lens
   - Thunder Client (for API testing)

7. Keep browser console clean
   Only show [UNFAIR] logs: console.log('[UNFAIR]', ...)
*/

// ============================================================================
// 🎯 NEXT FEATURES TO IMPLEMENT
// ============================================================================

/*
Phase 2: Authentication
  □ Signup form
  □ Login form
  □ Email verification
  □ Password reset
  □ Role selection (student/professor)
  □ Google OAuth integration

Phase 3: Professor Dashboard
  □ Class management
  □ Student roster
  □ Assignment submissions
  □ Analytics/reports
  □ Transcript review interface

Phase 4: Advanced Features
  □ Code quality analysis
  □ Learning outcome tracking
  □ Peer comparison (anonymized)
  □ AI literacy assessments
  □ Integration with LMS (Canvas, Blackboard)
  □ Mobile app
*/

// ============================================================================
// 📞 GET HELP
// ============================================================================

/*
Where to Look:
  1. Check browser console for [UNFAIR] messages
  2. Review Network tab for API errors
  3. Read code comments throughout project
  4. Check IMPLEMENTATION_COMPLETE.md for troubleshooting
  5. Test in developer mode: chrome://extensions

Common Debugging Workflow:
  1. Reproduce issue
  2. Check console logs
  3. Inspect network requests
  4. Review relevant code
  5. Add console.log for debugging
  6. Test fix
  7. Remove debug logs
  8. Commit change
*/

/*
═══════════════════════════════════════════════════════════════════════════════
                    Happy Coding! Questions? Check the docs! 🚀
═══════════════════════════════════════════════════════════════════════════════
*/
