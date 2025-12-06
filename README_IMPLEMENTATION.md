# UNFAIR - AI Dashcam for Coding Assignments

A Chrome extension that tracks and verifies AI-assisted learning, creating transparent records of how students use AI during coding assignments.

## 📋 Project Structure

```
unfair/
├── client/
│   └── public/
│       ├── manifest.json          # Chrome extension manifest
│       └── src/
│           ├── background.js      # Service worker for recording management
│           ├── content.js         # Content script for AI platform monitoring
│           ├── config.js          # Extension configuration
│           ├── popup/
│           │   ├── popup.html     # UI for all 3 screens
│           │   ├── popup.css      # Styling
│           │   └── popup.js       # UI logic & state management
│           └── utils/
│               └── copyPasteDetector.js  # Copy-paste detection algorithm
├── server/
│   ├── main.py                    # Flask backend API
│   ├── requirements.txt           # Python dependencies
│   └── .env.example              # Environment template
└── docs/
    └── architecture.md            # System architecture
```

## 🎯 Features

### 1. **Recording Interface** (Home Screen)
- Real-time timer showing recording duration
- Assignment management with multiple projects
- Current session status and interaction count
- Pause/Resume functionality for breaks

### 2. **Recording Modal** (Red notification)
- Appears when recording is active
- Shows live timer and interaction counter
- Quick access to pause/stop buttons
- High-visibility pulsing indicator

### 3. **Interaction Log & Transcript** (Verification Screen)
- Complete record of all AI interactions
- Student info, course details, due dates
- Collaboration summary with key metrics:
  - Total interactions count
  - Active AI time (recording time minus pauses)
  - Content used (AI responses referenced/copied)
  - AI assistance percentage
- Export as text file
- Shareable links with expiration

## 🚀 Getting Started

### Backend Setup

1. **Install dependencies**
   ```bash
   cd server
   pip install -r requirements.txt
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Initialize database**
   ```bash
   python main.py
   ```

4. **Run server**
   ```bash
   python main.py
   # Server runs on http://localhost:5000
   ```

### Extension Setup

1. **Open Chrome Extensions**
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (top right)

2. **Load extension**
   - Click "Load unpacked"
   - Select `client/public` directory

3. **Configure API endpoint**
   - Edit `client/public/src/config.js`
   - Set `API.BASE_URL` to your backend URL

## 🔄 How It Works

### Recording Session Flow

1. **User starts recording**
   - Opens extension popup
   - Clicks "New Assignment" button
   - Enters assignment details (name, due date, course)
   - Recording modal appears

2. **Monitoring interactions**
   - Content script monitors ChatGPT/Claude tabs
   - Detects student prompts and AI responses
   - Auto-categorizes interactions (Debugging, Brainstorming, etc.)
   - Logs to local storage and backend (if authenticated)

3. **Pausing/Resuming**
   - User can pause recording during breaks
   - Timer pauses but session remains open
   - Can resume at any time

4. **Stopping & Generating Transcript**
   - User clicks "Stop & Export"
   - System generates verified transcript
   - Shows summary stats and complete interaction log
   - User can download or share with professor

### Component Communication

```
Content Script (content.js)
    ↓ (detected interactions)
Background Worker (background.js)
    ↓ (logs & syncs)
Popup UI (popup.js) ← Chrome Storage
    ↓ (if authenticated)
Backend API (Flask)
    ↓
Database (SQLite/PostgreSQL)
```

## 📊 API Endpoints

All endpoints require `Authorization: Bearer <token>` header

### Assignments
- `GET /api/assignments` - Get all assignments for user
- `POST /api/assignments` - Create new assignment
- `GET /api/assignments/<id>` - Get assignment with interactions
- `PUT /api/assignments/<id>` - Update assignment status/time

### Interactions
- `POST /api/assignments/<id>/interactions` - Log new interaction
- `GET /api/assignments/<id>/interactions` - Get all interactions for assignment

### Transcripts
- `POST /api/assignments/<id>/transcript` - Generate verified transcript
- `GET /api/transcripts/<id>` - Get public transcript (by share link)
- `POST /api/transcripts/<id>/share` - Update share settings

## 🔍 Copy-Paste Detection

The extension includes advanced copy-paste detection that:

1. **Analyzes student code** against AI responses
2. **Uses Levenshtein distance** for similarity calculation
3. **Identifies code segments** that likely came from AI
4. **Generates confidence score** (0-100%)

### How to Use

```javascript
// In popup.js or analysis script
const detector = new CopyPasteDetector();
detector.initializeWithData(interactions); // AI responses
const matchScore = detector.analyzeCode(studentCode);
console.log(`Code matches AI responses: ${matchScore}%`);
```

**Thresholds:**
- 75%+ similarity: Likely copied
- 80%-95%: Partially derived
- <80%: Likely manual with minor references

## 🔐 Authentication (Coming Soon)

Currently the extension works without authentication. User auth will be implemented with:

- Email/password signup
- OAuth2 integration
- JWT token-based sessions
- Role-based access (student/professor)

## 📝 Data Stored

### Locally (Chrome Storage)
- Current recording state
- Assignments and interaction cache
- Auth token (if authenticated)

### On Backend (if authenticated)
- User profile
- Assignment metadata
- Complete interaction log
- Generated transcripts

## ⚙️ Configuration

Edit `client/public/src/config.js` to:

- Change backend API URL
- Enable/disable features
- Add monitoring for new AI platforms
- Adjust detection thresholds

## 🛠️ Development

### Testing Content Script
1. Open DevTools on ChatGPT/Claude tab
2. Check console for `[UNFAIR]` messages
3. Verify mutations are being detected

### Testing Backend
```bash
# Check API health
curl http://localhost:5000/api/health

# List extensions (debug service worker)
chrome://extensions/ → UNFAIR → Inspect views → service worker
```

### Common Issues

**Content script not capturing interactions:**
- Ensure ChatGPT/Claude tab is active
- Check console for `[UNFAIR] Content script loaded` message
- Verify mutation observer is running

**Backend sync failing:**
- Check `Network` tab in DevTools
- Verify backend is running on correct port
- Check CORS configuration in `main.py`

**Timer not updating:**
- Ensure `startTimer()` is called
- Check browser console for errors

## 📦 Deployment

### Extension
- Package as `.crx` file for distribution
- Submit to Chrome Web Store

### Backend
- Deploy to production server
- Update `config.js` with production API URL
- Set up HTTPS and proper CORS
- Use strong `SECRET_KEY` in production
- Configure PostgreSQL for production database

## 📚 Architecture Details

See `docs/architecture.md` for:
- System design overview
- Data flow diagrams
- Database schema
- API specifications

## 🤝 Contributing

For backend contributions:
1. Create virtual environment
2. Install requirements
3. Make changes
4. Test with `python -m pytest`

For extension contributions:
1. Load unpacked in developer mode
2. Make changes
3. Reload extension
4. Test in extension popup

## 📄 License

MIT License - See LICENSE file

## 🆘 Support

For issues or questions:
- Check console logs (`[UNFAIR]` prefix)
- Review network requests in DevTools
- Check backend logs for API errors
- Inspect database with `sqlite3 unfair.db`
