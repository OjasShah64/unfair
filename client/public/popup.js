// Popup script copied from src/popup/popup.js with start-recording behavior
// ===== STATE MANAGEMENT =====
let state = {
  currentScreen: 'home', // home, recording, log
  isRecording: false,
  isPaused: false,
  recordingStartTime: null,
  timerInterval: null,
  assignments: [],
  currentAssignment: null,
  interactions: [],
  recordingTime: 0, // in seconds
  authToken: null,
  backendUrl: 'http://localhost:5000', // Change in production
};

// Feature flag: disable all backend interactions when false (keeps export local-only)
const ENABLE_BACKEND = false;

// ===== DOM ELEMENTS =====
const homeScreen = document.getElementById('homeScreen');
const interactionLogScreen = document.getElementById('interactionLogScreen');
const recordingModal = document.getElementById('recordingModal');

// Home screen elements
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const newAssignmentBtn = document.getElementById('newAssignmentBtn');
const assignmentsList = document.getElementById('assignmentsList');
const timerText = document.getElementById('timerText');
const interactionCount = document.getElementById('interactionCount');
const currentCourse = document.getElementById('currentCourse');
const currentDetails = document.getElementById('currentDetails');
const recordingBadge = document.getElementById('recordingBadge');

// Recording modal elements
const closeRecordingBtn = document.getElementById('closeRecordingBtn');
const startRecordingBtn = document.getElementById('startRecordingBtn');
const pauseRecordingBtn = document.getElementById('pauseRecordingBtn');
const stopRecordingBtn = document.getElementById('stopRecordingBtn');
const recordingTimer = document.getElementById('recordingTimer');
const recordingInteractions = document.getElementById('recordingInteractions');
const recordingAssignment = document.getElementById('recordingAssignment');

// Interaction log elements
const studentName = document.getElementById('studentName');
const courseName = document.getElementById('courseName');
const dateGenerated = document.getElementById('dateGenerated');
const assignmentDue = document.getElementById('assignmentDue');
const totalInteractions = document.getElementById('totalInteractions');
const activeTime = document.getElementById('activeTime');
const contentUsed = document.getElementById('contentUsed');
const aiAssistance = document.getElementById('aiAssistance');
const logContainer = document.getElementById('logContainer');
const exportBtn = document.getElementById('exportBtn');
const shareBtn = document.getElementById('shareBtn');
const backHomeBtn = document.getElementById('backHomeBtn');

// ===== MESSAGE LISTENER FOR BACKGROUND UPDATES =====
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'TIMER_UPDATED') {
    state.recordingTime = msg.recordingTime;
    updateTimerDisplay();
  }
});

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  checkAuthToken();
  loadState();
  setupEventListeners();
  renderAssignments();
  // Set devVersion badge so user can confirm popup loaded the latest file
  try {
    const devEl = document.getElementById('devVersion');
    if (devEl) {
      const now = new Date();
      devEl.textContent = `v ${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    }
  } catch (e) { /* ignore */ }
});

// ===== EVENT LISTENERS =====
function setupEventListeners() {
  // Home screen buttons
  pauseBtn.addEventListener('click', togglePause);
  stopBtn.addEventListener('click', () => switchToLog());
  newAssignmentBtn.addEventListener('click', createNewAssignment);

  // Recording modal buttons
  closeRecordingBtn.addEventListener('click', closeRecordingModal);
  startRecordingBtn.addEventListener('click', startRecording);
  pauseRecordingBtn.addEventListener('click', togglePause);
  stopRecordingBtn.addEventListener('click', () => switchToLog());

  // Interaction log buttons
  exportBtn.addEventListener('click', exportTranscript);
  shareBtn.addEventListener('click', shareTranscript);
  backHomeBtn.addEventListener('click', () => switchToScreen('home'));
}

// ===== SCREEN NAVIGATION =====
function switchToScreen(screenName) {
  state.currentScreen = screenName;

  // Hide all screens
  homeScreen.classList.remove('active');
  interactionLogScreen.classList.remove('active');

  // Show selected screen
  if (screenName === 'home') {
    homeScreen.classList.add('active');
    startTimer();
  } else if (screenName === 'log') {
    interactionLogScreen.classList.add('active');
    stopTimer();
    populateTranscript();
  }
}

function switchToLog() {
  state.isRecording = false;
  state.isPaused = false;
  recordingModal.classList.add('hidden');
  // hide header recording badge
  if (recordingBadge) recordingBadge.classList.add('hidden');
  
  // Notify background worker to stop session
  chrome.runtime.sendMessage(
    { type: 'STOP_SESSION' },
    (response) => {
      console.log('[UNFAIR] Session stopped:', response);
      if (response && response.interactions) {
        state.interactions = response.interactions;
        if (state.currentAssignment) state.currentAssignment.interactions = state.interactions;
      }
      if (response && typeof response.recordingTime !== 'undefined') {
        state.recordingTime = response.recordingTime;
      }
    }
  );
  
  // After stop request, show transcript (populateTranscript will use updated state)
  setTimeout(() => switchToScreen('log'), 300);
}

function closeRecordingModal() {
  recordingModal.classList.add('hidden');
}

function openRecordingModal() {
  recordingModal.classList.remove('hidden');
}

// When opening the modal, apply Figma-style classes and initialize shape selector
function onOpenRecordingModalSetup() {
  try {
    // style timer and modal buttons to match Figma look
    const tl = document.querySelector('.timer-large');
    if (tl) tl.classList.add('figma-style');

    if (startRecordingBtn) startRecordingBtn.classList.add('figma-style');
    if (pauseRecordingBtn) pauseRecordingBtn.classList.add('figma-style');
    if (stopRecordingBtn) stopRecordingBtn.classList.add('figma-style');

    // initialize shape selector state
    initShapeSelector();

    // show per-assignment selected shape if exists
    if (state.currentAssignment && state.currentAssignment.shape) {
      setExtensionShape(state.currentAssignment.shape);
      setShapeSelectorActive(state.currentAssignment.shape);
    }
  } catch (e) { console.warn('[UNFAIR] modal setup error', e); }
}

// ===== ASSIGNMENT MANAGEMENT =====
function createNewAssignment() {
  const name = prompt('Enter assignment name:');
  if (!name) return;

  const dueDate = prompt('Enter due date (YYYY-MM-DD):');
  if (!dueDate) return;

  const course = prompt('Enter course name:');
  if (!course) return;

  const assignment = {
    id: Date.now(),
    name,
    dueDate,
    course,
    createdAt: new Date().toISOString(),
    status: 'active',
    interactions: [],
    recordingTime: 0,
  };

  state.assignments.push(assignment);
  state.currentAssignment = assignment;
  // Do NOT start recording automatically — open modal and let user Start
  state.interactions = [];
  state.recordingTime = 0;

  saveState();
  renderAssignments();
  switchToScreen('home');
  openRecordingModal();
}

function renderAssignments() {
  assignmentsList.innerHTML = '';

  state.assignments.forEach((assignment) => {
    const card = document.createElement('div');
    card.className = 'assignment-card';
    if (assignment.id === state.currentAssignment?.id) {
      card.classList.add('active');
    }

    let statusClass = 'status-active';
    let statusText = '● Active';
    if (assignment.status === 'paused') {
      statusClass = 'status-paused';
      statusText = '⏸ Paused';
    } else if (assignment.status === 'done') {
      statusClass = 'status-done';
      statusText = '✓ Done';
    }

    card.innerHTML = `
      <h4>${assignment.name}</h4>
      <p>${assignment.course} • Due ${assignment.dueDate}</p>
      <p>${assignment.interactions.length} interactions</p>
      <div class="assignment-status ${statusClass}">
        <span class="status-dot"></span>
        <span>${statusText}</span>
      </div>
    `;

    card.addEventListener('click', () => selectAssignment(assignment.id));
    assignmentsList.appendChild(card);
  });

  if (state.currentAssignment) {
    currentCourse.textContent = state.currentAssignment.course;
    currentDetails.textContent = `Due ${state.currentAssignment.dueDate} • ${state.currentAssignment.interactions.length} interactions`;
    recordingAssignment.textContent = state.currentAssignment.name;
  }
}

function selectAssignment(id) {
  state.currentAssignment = state.assignments.find((a) => a.id === id);
  state.interactions = state.currentAssignment?.interactions || [];
  renderAssignments();

  // Do NOT start recording automatically — instead open the recording modal so user can Start
  saveState();
  openRecordingModal();

  // Show recording UI visually (match Figma): open the red recording modal and
  // display the header badge and assignment details, but do NOT start the session.
  try {
    if (recordingBadge) recordingBadge.classList.remove('hidden');
    if (recordingAssignment) recordingAssignment.textContent = state.currentAssignment?.name || '';
    if (recordingInteractions) recordingInteractions.textContent = `${state.interactions.length} interactions logged`;
    // Reset timer display in modal to 0:00:00 until the user starts recording
    if (recordingTimer) recordingTimer.textContent = '0:00:00';
    // Apply modal setup styles and init shape selector
    onOpenRecordingModalSetup();
  } catch (e) { /* ignore */ }
}

// Start recording when user clicks Start in the modal
function startRecording() {
  if (!state.currentAssignment) {
    alert('Select an assignment first');
    return;
  }

  state.isRecording = true;
  state.isPaused = false;
  state.interactions = state.currentAssignment.interactions || [];
  state.recordingTime = 0;
  saveState();

  chrome.runtime.sendMessage({ type: 'START_SESSION', assignment: state.currentAssignment }, (response) => {
    console.log('[UNFAIR] START_SESSION response:', response);
    // show header recording badge
    if (recordingBadge) recordingBadge.classList.remove('hidden');
    startTimer();
  });
}

// ===== Shape selector helpers =====
function initShapeSelector() {
  const selector = document.getElementById('shapeSelector');
  if (!selector) return;
  const buttons = selector.querySelectorAll('.shape-btn');
  buttons.forEach((b) => {
    b.removeEventListener('click', onShapeButtonClick);
    b.addEventListener('click', onShapeButtonClick);
  });
}

function onShapeButtonClick(e) {
  const btn = e.currentTarget;
  const shape = btn.getAttribute('data-shape');
  if (!shape) return;
  // apply shape live
  setExtensionShape(shape);
  // update UI
  setShapeSelectorActive(shape);
  // persist for this assignment
  if (state.currentAssignment) {
    state.currentAssignment.shape = shape;
    saveState();
  }
}

function setShapeSelectorActive(shape) {
  const selector = document.getElementById('shapeSelector');
  if (!selector) return;
  const buttons = selector.querySelectorAll('.shape-btn');
  buttons.forEach((b) => {
    if (b.getAttribute('data-shape') === shape) b.classList.add('active'); else b.classList.remove('active');
  });
}

// ===== Diagnostics: surface errors in the popup UI for easier debugging =====
window.addEventListener('error', function (event) {
  try {
    const diag = document.getElementById('diagnostics');
    if (!diag) return;
    diag.classList.remove('hidden');
    const msg = `${new Date().toLocaleTimeString()} — ${event.message} at ${event.filename}:${event.lineno}`;
    const p = document.createElement('div'); p.textContent = msg; diag.appendChild(p);
    console.error('[UNFAIR popup error]', event.message, event.filename, event.lineno, event.error);
  } catch (e) { /* ignore */ }
});


// Listen for background broadcasts: new interactions and timer updates
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'NEW_INTERACTION') {
    // Only append if it matches current assignment
    if (state.currentAssignment && msg.assignmentId === state.currentAssignment.id) {
      state.interactions.push(msg.interaction);
      state.currentAssignment.interactions = state.interactions;
      saveState();
      interactionCount.textContent = `${state.interactions.length} interactions logged`;
      recordingInteractions.textContent = `${state.interactions.length} interactions logged`;
    }
  }

  if (msg.type === 'TIMER_UPDATED') {
    // Update local display
    state.recordingTime = msg.recordingTime || state.recordingTime;
    updateTimerDisplay();
  }
});

// ===== TIMER MANAGEMENT =====
function startTimer() {
  // Get initial time from background
  chrome.runtime.sendMessage({ type: 'GET_RECORDING_TIME' }, (response) => {
    if (response) {
      state.recordingTime = response.recordingTime;
    }
  });

  // Listen for timer updates from background
  if (!state.timerInterval) {
    state.timerInterval = setInterval(() => {
      if (state.isRecording) {
        chrome.runtime.sendMessage({ type: 'GET_RECORDING_TIME' }, (response) => {
          if (response) {
            state.recordingTime = response.recordingTime;
            updateTimerDisplay();
          }
        });
      }
    }, 1000);
  }
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function updateTimerDisplay() {
  const hours = Math.floor(state.recordingTime / 3600);
  const minutes = Math.floor((state.recordingTime % 3600) / 60);
  const seconds = state.recordingTime % 60;

  const formatted = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  timerText.textContent = formatted;
  recordingTimer.textContent = formatted;

  // Also update modal
  if (state.currentAssignment) {
    state.currentAssignment.recordingTime = state.recordingTime;
  }
}

function togglePause() {
  // Notify background worker to toggle pause
  chrome.runtime.sendMessage({ type: 'TOGGLE_PAUSE' }, (response) => {
    if (response) {
      state.isPaused = response.isPaused;

      if (state.isPaused) {
        pauseBtn.textContent = '▶ Resume';
        pauseRecordingBtn.textContent = '▶ Resume';
      } else {
        pauseBtn.textContent = '⏸ Pause';
        pauseRecordingBtn.textContent = '⏸ Pause';
      }

      if (state.currentAssignment) {
        state.currentAssignment.status = state.isPaused ? 'paused' : 'active';
      }

      renderAssignments();
      saveState();
    }
  });
}

// ===== TRANSCRIPT / EXPORT / PERSISTENCE continued (reuse existing implementations) =====
// For brevity, re-use the implementations present in src/popup/popup.js by delegating to storage and backend functions already loaded in the background/other scripts.

function populateTranscript() {
  // Re-use the logic from src version by using the stored state
  // (Implementation is present in src file; this popup version keeps the same behavior.)
  const now = new Date();
  studentName.textContent = 'John Doe (johndoe@illinois.edu)';
  courseName.textContent = state.currentAssignment?.course || 'CS 225 - Data Structures';
  dateGenerated.textContent = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  assignmentDue.textContent = state.currentAssignment?.dueDate || 'October 25, 2025';

  totalInteractions.textContent = state.interactions.length;
  const hours = Math.floor(state.recordingTime / 3600);
  const minutes = Math.floor((state.recordingTime % 3600) / 60);
  activeTime.textContent = `${hours}h ${String(minutes).padStart(2, '0')}m`;

  logContainer.innerHTML = '';
  if (state.interactions.length === 0) {
    const noInteractionsDiv = document.createElement('div');
    noInteractionsDiv.className = 'no-interactions-message';
    noInteractionsDiv.innerHTML = `
      <div style="padding: 40px 20px; text-align: center; background: #fef3c7; border-radius: 8px; border: 1px solid #fcd34d;">
        <h3 style="color: #92400e; margin: 0 0 10px 0;">No Interactions Recorded</h3>
        <p style="color: #b45309; margin: 5px 0;">No AI interactions were logged during the recording session.</p>
      </div>
    `;
    logContainer.appendChild(noInteractionsDiv);
  } else {
    state.interactions.forEach((interaction, index) => {
      const item = document.createElement('div');
      item.className = 'interaction-item';
      item.innerText = `${index + 1}. ${interaction.timestamp} - ${interaction.type}\n${interaction.content}`;
      logContainer.appendChild(item);
    });
  }
}

function saveState() {
  chrome.storage.local.set({
    unfairState: {
      isRecording: state.isRecording,
      isPaused: state.isPaused,
      assignments: state.assignments,
      currentAssignment: state.currentAssignment,
      recordingTime: state.recordingTime,
    },
  });

  if (ENABLE_BACKEND && state.authToken && state.currentAssignment) {
    updateAssignmentOnBackend();
  }
}

function loadState() {
  chrome.storage.local.get('unfairState', (result) => {
    if (result.unfairState) {
      const saved = result.unfairState;
      state.isRecording = saved.isRecording || false;
      state.isPaused = saved.isPaused || false;
      state.assignments = saved.assignments || [];
      state.currentAssignment = saved.currentAssignment || null;
      state.recordingTime = saved.recordingTime || 0;

      renderAssignments();
      updateTimerDisplay();

      if (state.isRecording) {
        openRecordingModal();
        if (recordingBadge) recordingBadge.classList.remove('hidden');
        chrome.runtime.sendMessage({ type: 'GET_CURRENT_SESSION' }, (resp) => {
          if (resp && resp.assignment && resp.assignment.id === state.currentAssignment?.id) {
            state.recordingTime = resp.recordingTime || state.recordingTime;
            state.interactions = resp.interactions || state.interactions;
            if (state.currentAssignment) state.currentAssignment.interactions = state.interactions;
          }
          startTimer();
        });
      }
    }
  });
}

function checkAuthToken() {
  chrome.storage.local.get('authToken', (result) => {
    if (result.authToken) {
      state.authToken = result.authToken;
    }
  });
}

// ===== EXPORT & SHARE (copied from src implementation) =====
function exportTranscript() {
  const html = generateTranscriptHTML();
  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/html;charset=utf-8,' + encodeURIComponent(html));
  element.setAttribute('download', `${state.currentAssignment?.name || 'transcript'}-${Date.now()}.html`);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);

  setTimeout(() => {
    const transcript = generateTranscriptText();
    const textElement = document.createElement('a');
    textElement.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(transcript));
    textElement.setAttribute('download', `${state.currentAssignment?.name || 'transcript'}-${Date.now()}.txt`);
    textElement.style.display = 'none';
    document.body.appendChild(textElement);
    textElement.click();
    document.body.removeChild(textElement);
  }, 500);

  if (ENABLE_BACKEND) generateTranscriptOnBackend();
  alert('Transcript(s) downloaded successfully! (HTML + TXT)');
}

function shareTranscript() {
  const transcript = generateTranscriptText();
  const encodedTranscript = encodeURIComponent(transcript);
  const shareUrl = `${window.location.origin}/share?transcript=${encodedTranscript}`;

  navigator.clipboard.writeText(shareUrl);
  alert('Share link copied to clipboard!');
}

function generateTranscriptText() {
  let text = `AI COLLABORATION TRANSCRIPT\n`;
  text += `================================\n\n`;
  text += `Student: John Doe (johndoe@illinois.edu)\n`;
  text += `Course: ${state.currentAssignment?.course}\n`;
  text += `Assignment: ${state.currentAssignment?.name}\n`;
  text += `Date Generated: ${new Date().toLocaleString()}\n`;
  text += `Due Date: ${state.currentAssignment?.dueDate}\n\n`;

  text += `COLLABORATION SUMMARY\n`;
  text += `---------------------\n`;
  text += `Total Interactions: ${state.interactions.length}\n`;
  const hours = Math.floor(state.recordingTime / 3600);
  const minutes = Math.floor((state.recordingTime % 3600) / 60);
  text += `Active AI Time: ${hours}h ${String(minutes).padStart(2, '0')}m\n`;
  text += `Content Used: ${Math.floor(state.interactions.length * 0.35)}\n`;
  text += `AI Assistance: 35%\n\n`;

  text += `INTERACTION LOG\n`;
  text += `---------------------\n\n`;

  if (state.interactions.length === 0) {
    text += `[NO INTERACTIONS RECORDED]\n\n`;
    text += `No AI interactions were logged during the recording session.\n`;
    text += `This may indicate:\n`;
    text += `- No AI tools (ChatGPT, Claude) were used\n`;
    text += `- Recording was paused during AI usage\n`;
    text += `- AI tools were opened but content was not captured\n`;
  } else {
    state.interactions.forEach((interaction, index) => {
      text += `[${index + 1}] ${interaction.timestamp}\n`;
      text += `Type: ${interaction.type.toUpperCase()}\n`;
      if (interaction.category) {
        text += `Category: ${interaction.category}\n`;
      }
      text += `\n${interaction.content}\n`;
      if (interaction.codeBlock) {
        text += `\n${interaction.codeBlock}\n`;
      }
      text += `\n---\n\n`;
    });
  }

  return text;
}

function generateTranscriptHTML() {
  const hours = Math.floor(state.recordingTime / 3600);
  const minutes = Math.floor((state.recordingTime % 3600) / 60);
  const seconds = state.recordingTime % 60;
  const timeFormatted = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const now = new Date();

  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>AI Collaboration Transcript - ${state.currentAssignment?.name}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; max-width: 900px; margin: 0 auto; padding: 40px 20px; background: #f5f5f5; }
    .container { background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .verified-badge { display: inline-block; background: #10b981; color: white; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-bottom: 20px; }
    h1 { color: #1f2937; margin: 0 0 30px 0; font-size: 32px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="verified-badge">✓ VERIFIED TRANSCRIPT</div>
    <h1>AI Collaboration Transcript</h1>
    <div style="padding:20px; background:#f9fafb; border-radius:8px; margin-bottom:20px;">
      <div><strong>Student:</strong> John Doe (johndoe@illinois.edu)</div>
      <div><strong>Course:</strong> ${state.currentAssignment?.course || 'Unknown'}</div>
      <div><strong>Assignment:</strong> ${state.currentAssignment?.name || 'Unknown'}</div>
      <div><strong>Due Date:</strong> ${state.currentAssignment?.dueDate || 'Unknown'}</div>
    </div>
    <div><strong>Recording Time:</strong> ${timeFormatted}</div>
    <hr />
`;

  if (state.interactions.length === 0) {
    html += `<div style="padding:40px; background:#fef3c7; border-radius:8px;">No interactions recorded</div>`;
  } else {
    state.interactions.forEach((interaction, index) => {
      html += `<div style="margin:20px 0; padding:16px; background:#f9fafb; border-left:4px solid #3b82f6;">`;
      html += `<div><strong>Interaction #${index + 1}</strong> • ${interaction.timestamp}</div>`;
      html += `<div style="margin-top:8px;">${escapeHtml(interaction.content)}</div>`;
      if (interaction.codeBlock) html += `<pre style="background:#1f2937;color:#e5e7eb;padding:12px;border-radius:6px;">${escapeHtml(interaction.codeBlock)}</pre>`;
      html += `</div>`;
    });
  }

  html += `<div style="margin-top:40px; font-size:12px; color:#6b7280; text-align:center;">Generated on ${now.toLocaleDateString()} at ${now.toLocaleTimeString()}</div>`;
  html += `</div></body></html>`;
  return html;
}

async function syncInteractionToBackend(interaction) {
  if (!ENABLE_BACKEND) {
    console.log('[UNFAIR] Backend disabled — skipping interaction sync');
    return;
  }
  if (!state.authToken || !state.currentAssignment) return;

  try {
    const response = await fetch(`${state.backendUrl}/api/assignments/${state.currentAssignment.id}/interactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.authToken}` },
      body: JSON.stringify(interaction),
    });
    if (response.ok) console.log('[UNFAIR] Interaction synced to backend');
  } catch (e) { console.error('[UNFAIR] Backend sync error:', e); }
}

async function updateAssignmentOnBackend() {
  if (!ENABLE_BACKEND) {
    console.log('[UNFAIR] Backend disabled — skipping assignment update');
    return;
  }
  if (!state.authToken || !state.currentAssignment) return;
  try {
    await fetch(`${state.backendUrl}/api/assignments/${state.currentAssignment.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.authToken}` },
      body: JSON.stringify({ status: state.currentAssignment.status, recording_time: state.recordingTime }),
    });
    console.log('[UNFAIR] Assignment updated on backend');
  } catch (e) { console.error('[UNFAIR] Backend update error:', e); }
}

async function generateTranscriptOnBackend() {
  if (!ENABLE_BACKEND) {
    console.log('[UNFAIR] Backend disabled — skipping transcript generation');
    return null;
  }
  if (!state.authToken || !state.currentAssignment) return null;
  try {
    const response = await fetch(`${state.backendUrl}/api/assignments/${state.currentAssignment.id}/transcript`, { method: 'POST', headers: { 'Authorization': `Bearer ${state.authToken}` } });
    return await response.json();
  } catch (e) { console.error('[UNFAIR] Backend transcript error:', e); return null; }
}

// ===== COPY-PASTE DETECTION (copied) =====
class CopyPasteDetector {
  constructor() { this.aiResponses = []; this.threshold = 0.75; }
  initializeWithData(interactions) { this.aiResponses = interactions.filter(i=>i.type==='response').map(i=>({ content: i.fullContent||i.content, codeBlocks: i.codeBlocks||[], timestamp: i.timestamp })); }
  analyzeCode(studentCode) {
    let matchScore=0, totalCompared=0;
    this.aiResponses.forEach(response=>{
      const similarity = this.calculateSimilarity(studentCode, response.content);
      totalCompared++; if (similarity>this.threshold) matchScore++;
      response.codeBlocks.forEach(cb=>{ totalCompared++; if (this.calculateSimilarity(studentCode, cb)>this.threshold) matchScore++; });
    });
    return totalCompared>0?Math.round((matchScore/totalCompared)*100):0;
  }
  calculateSimilarity(str1,str2){ const normalize=s=>s.toLowerCase().replace(/\s+/g,'').replace(/[^\w]/g,''); const s1=normalize(str1), s2=normalize(str2); const longer=s1.length>s2.length?s1:s2, shorter=s1.length>s2.length?s2:s1; if(longer.length===0) return 1.0; const editDistance=this.getEditDistance(longer,shorter); return (longer.length-editDistance)/longer.length; }
  getEditDistance(s1,s2){ const costs=[]; for(let i=0;i<=s1.length;i++){ let lastValue=i; for(let j=0;j<=s2.length;j++){ if(i===0) costs[j]=j; else if(j>0){ let newValue=costs[j-1]; if(s1.charAt(i-1)!==s2.charAt(j-1)) newValue=Math.min(Math.min(newValue,lastValue),costs[j])+1; costs[j-1]=lastValue; lastValue=newValue; } } if(i>0) costs[s2.length]=lastValue; } return costs[s2.length]; }
}
const detector = new CopyPasteDetector();
function analyzeSubmissionCode(code){ detector.initializeWithData(state.interactions); return detector.analyzeCode(code); }

// ===== Shape Setter for Content Script =====
function setExtensionShape(shape) {
  if (!shape) shape = 'rectangle';
  try {
    // Persist choice so new tabs also pick it up
    chrome.storage.local.set({ unfairShape: shape }, () => {
      // Broadcast to all tabs so active pages update immediately
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          try {
            chrome.tabs.sendMessage(tab.id, { type: 'SET_SHAPE', shape });
          } catch (e) {
            // ignore tabs that don't accept messages
          }
        });
      });
    });
  } catch (e) {
    console.warn('[UNFAIR] setExtensionShape failed:', e);
  }
}

// Expose for quick testing via console
window.setExtensionShape = setExtensionShape;

// When popup opens, if current assignment has a preferred shape apply it
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (state.currentAssignment && state.currentAssignment.shape) {
      setExtensionShape(state.currentAssignment.shape);
    }
  }, 200);
});

