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
});

// ===== EVENT LISTENERS =====
function setupEventListeners() {
  // Home screen buttons
  pauseBtn.addEventListener('click', togglePause);
  stopBtn.addEventListener('click', () => switchToLog());
  newAssignmentBtn.addEventListener('click', createNewAssignment);

  // Recording modal buttons
  closeRecordingBtn.addEventListener('click', closeRecordingModal);
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
  state.isRecording = true;
  state.recordingStartTime = Date.now();
  state.interactions = [];
  state.recordingTime = 0;

  saveState();
  renderAssignments();
  switchToScreen('home');
  openRecordingModal();
  // show header recording badge
  if (recordingBadge) recordingBadge.classList.remove('hidden');

  // Notify background worker to start session
  chrome.runtime.sendMessage(
    {
      type: 'START_SESSION',
      assignment: assignment,
    },
    (response) => {
      console.log('[UNFAIR] Session started:', response);
      startTimer();
    }
  );
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

  // Start recording for this assignment and open the in-page recording panel
  state.isRecording = true;
  state.isPaused = false;
  saveState();

  chrome.runtime.sendMessage({ type: 'START_SESSION', assignment: state.currentAssignment }, (response) => {
    console.log('[UNFAIR] START_SESSION response:', response);
    // Open recording modal in popup for immediate controls
    openRecordingModal();
    // show header recording badge
    if (recordingBadge) recordingBadge.classList.remove('hidden');
    startTimer();
  });
}

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

// ===== INTERACTION LOGGING (Mock) =====
function addMockInteractions() {
  // This will be replaced with real data from content.js
  state.interactions = [
    {
      id: 1,
      timestamp: '10:23:15 AM',
      type: 'prompt',
      content: 'How do I implement a binary search tree in C++? I need to understand the basic structure and the insertion algorithm.',
      category: 'Conceptual Explanation',
    },
    {
      id: 2,
      timestamp: '10:23:18 AM',
      type: 'response',
      content: 'A Binary Search Tree (BST) is a data structure where each node has at most two children, and for each node, all values in the left subtree are less than the node\'s value, and all values in the right subtree are greater. Here\'s a basic structure:',
      codeBlock: 'struct Node {\n  int data;\n  Node* left;\n  Node* right;\n};\n\nFor insertion, you compare the value to insert with the current node and recursively go left or right until you find an empty spot.',
    },
    {
      id: 3,
      timestamp: '10:23:45 AM',
      type: 'annotation',
      content: '✓ Student used concepts from this response in their implementation',
    },
    {
      id: 4,
      timestamp: '10:45:22 AM',
      type: 'prompt',
      content: 'How do I handle balancing in a binary search tree?',
      category: 'Debugging',
    },
    {
      id: 5,
      timestamp: '10:45:30 AM',
      type: 'response',
      content: 'Balancing is typically handled through AVL trees or Red-Black trees. AVL trees maintain a balance factor...',
      codeBlock: 'int getHeight(Node* node) {\n  if (node == NULL) return -1;\n  return 1 + max(getHeight(node->left), getHeight(node->right));\n}',
    },
    {
      id: 6,
      timestamp: '11:15:00 AM',
      type: 'annotation',
      content: '✓ Student used concepts from this response in their implementation',
    },
  ];

  if (state.currentAssignment) {
    state.currentAssignment.interactions = state.interactions;
  }
  saveState();
}

// ===== TRANSCRIPT GENERATION =====
function populateTranscript() {
  // Populate header info
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

  // Populate stats
  totalInteractions.textContent = state.interactions.length;
  const hours = Math.floor(state.recordingTime / 3600);
  const minutes = Math.floor((state.recordingTime % 3600) / 60);
  activeTime.textContent = `${hours}h ${String(minutes).padStart(2, '0')}m`;
  contentUsed.textContent = Math.floor(state.interactions.length * 0.35); // Mock calculation
  aiAssistance.textContent = '35%'; // Mock data

  // Populate interaction log
  logContainer.innerHTML = '';

  // Show no interactions message if empty
  if (state.interactions.length === 0) {
    const noInteractionsDiv = document.createElement('div');
    noInteractionsDiv.className = 'no-interactions-message';
    noInteractionsDiv.innerHTML = `
      <div style="padding: 40px 20px; text-align: center; background: #fef3c7; border-radius: 8px; border: 1px solid #fcd34d;">
        <h3 style="color: #92400e; margin: 0 0 10px 0;">No Interactions Recorded</h3>
        <p style="color: #b45309; margin: 5px 0;">No AI interactions were logged during the recording session.</p>
        <p style="color: #b45309; margin: 5px 0;">This may indicate:</p>
        <ul style="text-align: left; display: inline-block; margin: 10px 0; color: #b45309;">
          <li>No AI tools (ChatGPT, Claude) were used</li>
          <li>Recording was paused during AI usage</li>
          <li>AI tools were opened but content was not captured</li>
        </ul>
      </div>
    `;
    logContainer.appendChild(noInteractionsDiv);
    return;
  }

  // Render actual interactions
  state.interactions.forEach((interaction, index) => {
    const item = document.createElement('div');
    item.className = 'interaction-item';

    let typeClass = '';
    let typeLabel = '';
    if (interaction.type === 'prompt') {
      typeClass = 'type-prompt';
      typeLabel = 'STUDENT PROMPT';
    } else if (interaction.type === 'response') {
      typeClass = 'type-response';
      typeLabel = 'AI RESPONSE';
    }

    let contentHTML = `
      <div class="interaction-number">${index + 1}</div>
      <div class="interaction-content">
        <div class="interaction-time">${interaction.timestamp}</div>
        <span class="interaction-type ${typeClass}">${typeLabel}</span>
    `;

    if (interaction.category) {
      contentHTML += `<span class="interaction-type" style="background: #e0e7ff; color: #3730a3;">${interaction.category}</span>`;
    }

    contentHTML += `<div class="interaction-text">${escapeHtml(interaction.content)}</div>`;

    if (interaction.codeBlock) {
      contentHTML += `<div class="interaction-code">${escapeHtml(interaction.codeBlock)}</div>`;
    }

    if (interaction.type === 'annotation') {
      contentHTML = contentHTML.replace('class="interaction-text"', 'class="interaction-annotation"');
    }

    contentHTML += `</div>`;

    item.innerHTML = contentHTML;
    logContainer.appendChild(item);
  });
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// ===== EXPORT & SHARE =====
function exportTranscript() {
  // Export as HTML (which can be converted to PDF in browser)
  const html = generateTranscriptHTML();
  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/html;charset=utf-8,' + encodeURIComponent(html));
  element.setAttribute('download', `${state.currentAssignment?.name || 'transcript'}-${Date.now()}.html`);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);

  // Also provide text version
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

  // Also sync to backend
  generateTranscriptOnBackend();

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
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 20px;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .verified-badge {
      display: inline-block;
      background: #10b981;
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: bold;
      margin-bottom: 20px;
    }
    h1 {
      color: #1f2937;
      margin: 0 0 30px 0;
      font-size: 32px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-bottom: 40px;
      padding: 20px;
      background: #f9fafb;
      border-radius: 8px;
    }
    .info-item label {
      display: block;
      font-size: 12px;
      font-weight: bold;
      color: #6b7280;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .info-item p {
      margin: 0;
      font-size: 16px;
      color: #1f2937;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      margin-bottom: 40px;
    }
    .stat-card {
      background: #f0f4ff;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      border-left: 4px solid #2563eb;
    }
    .stat-card .value {
      font-size: 24px;
      font-weight: bold;
      color: #2563eb;
    }
    .stat-card .label {
      font-size: 12px;
      color: #6b7280;
      margin-top: 5px;
      text-transform: uppercase;
    }
    .section-title {
      font-size: 18px;
      font-weight: bold;
      color: #1f2937;
      margin: 30px 0 20px 0;
      padding-bottom: 10px;
      border-bottom: 2px solid #e5e7eb;
    }
    .interaction-item {
      margin-bottom: 30px;
      padding: 20px;
      background: #f9fafb;
      border-radius: 8px;
      border-left: 4px solid #3b82f6;
    }
    .interaction-item.prompt {
      border-left-color: #8b5cf6;
    }
    .interaction-item.response {
      border-left-color: #3b82f6;
    }
    .interaction-item.annotation {
      border-left-color: #10b981;
    }
    .interaction-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      gap: 10px;
    }
    .interaction-type {
      display: inline-block;
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      padding: 4px 8px;
      border-radius: 4px;
      background: #e0e7ff;
      color: #3730a3;
    }
    .interaction-type.prompt {
      background: #ede9fe;
      color: #6d28d9;
    }
    .interaction-type.response {
      background: #dbeafe;
      color: #1e40af;
    }
    .interaction-type.annotation {
      background: #d1fae5;
      color: #065f46;
    }
    .interaction-time {
      font-size: 12px;
      color: #6b7280;
    }
    .interaction-content {
      margin-top: 12px;
      color: #374151;
      line-height: 1.6;
    }
    .interaction-code {
      background: #1f2937;
      color: #e5e7eb;
      padding: 12px;
      border-radius: 6px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      margin-top: 10px;
      overflow-x: auto;
    }
    .no-interactions {
      padding: 40px 20px;
      text-align: center;
      background: #fef3c7;
      border-radius: 8px;
      border: 1px solid #fcd34d;
    }
    .no-interactions h3 {
      color: #92400e;
      margin: 0 0 10px 0;
    }
    .no-interactions p {
      color: #b45309;
      margin: 5px 0;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
      text-align: center;
    }
    @media print {
      body { background: white; }
      .container { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="verified-badge">✓ VERIFIED TRANSCRIPT</div>
    <h1>AI Collaboration Transcript</h1>
    
    <div class="info-grid">
      <div class="info-item">
        <label>Student</label>
        <p>John Doe (johndoe@illinois.edu)</p>
      </div>
      <div class="info-item">
        <label>Course</label>
        <p>${state.currentAssignment?.course || 'Unknown'}</p>
      </div>
      <div class="info-item">
        <label>Assignment</label>
        <p>${state.currentAssignment?.name || 'Unknown'}</p>
      </div>
      <div class="info-item">
        <label>Due Date</label>
        <p>${state.currentAssignment?.dueDate || 'Unknown'}</p>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="value">${state.interactions.length}</div>
        <div class="label">Interactions</div>
      </div>
      <div class="stat-card">
        <div class="value">${timeFormatted}</div>
        <div class="label">Recording Time</div>
      </div>
      <div class="stat-card">
        <div class="value">${Math.floor(state.interactions.length * 0.35)}</div>
        <div class="label">Content Used</div>
      </div>
      <div class="stat-card">
        <div class="value">35%</div>
        <div class="label">AI Assistance</div>
      </div>
    </div>

    <div class="section-title">Interaction Log</div>
`;

  if (state.interactions.length === 0) {
    html += `
    <div class="no-interactions">
      <h3>No Interactions Recorded</h3>
      <p>No AI interactions were logged during the recording session.</p>
      <p>This may indicate:</p>
      <ul style="text-align: left; display: inline-block; margin: 10px 0;">
        <li>No AI tools (ChatGPT, Claude) were used</li>
        <li>Recording was paused during AI usage</li>
        <li>AI tools were opened but content was not captured</li>
      </ul>
    </div>
`;
  } else {
    state.interactions.forEach((interaction, index) => {
      const typeClass = interaction.type === 'prompt' ? 'prompt' : interaction.type === 'response' ? 'response' : 'annotation';
      html += `
    <div class="interaction-item ${typeClass}">
      <div class="interaction-header">
        <div class="interaction-time"><strong>Interaction #${index + 1}</strong> • ${interaction.timestamp}</div>
      </div>
      <div>
        <span class="interaction-type ${typeClass}">${interaction.type.toUpperCase()}</span>
        ${interaction.category ? `<span class="interaction-type" style="background: #e0e7ff; color: #3730a3;">${escapeHtml(interaction.category)}</span>` : ''}
      </div>
      <div class="interaction-content">${escapeHtml(interaction.content)}</div>
      ${interaction.codeBlock ? `<div class="interaction-code">${escapeHtml(interaction.codeBlock)}</div>` : ''}
    </div>
`;
    });
  }

  html += `
    <div class="footer">
      <p>Generated on ${now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} at ${now.toLocaleTimeString()}</p>
      <p>This is an official transcript generated by UNFAIR</p>
    </div>
  </div>
</body>
</html>`;

  return html;
}

// ===== STATE PERSISTENCE =====
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

  // Also update backend if authenticated
  if (state.authToken && state.currentAssignment) {
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
        // Open popup modal and sync current session data from background
        openRecordingModal();
        // show header recording badge when restoring state
        if (recordingBadge) recordingBadge.classList.remove('hidden');
        // Fetch current session details from background
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

// ===== MESSAGE LISTENER (for content.js) =====
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'LOG_INTERACTION') {
    state.interactions.push(request.data);
    if (state.currentAssignment) {
      state.currentAssignment.interactions = state.interactions;
    }
    saveState();
    interactionCount.textContent = `${state.interactions.length} interactions logged`;
    recordingInteractions.textContent = `${state.interactions.length} interactions logged`;

    // Sync to backend if authenticated
    if (state.authToken && state.currentAssignment) {
      syncInteractionToBackend(request.data);
    }
  }
});

// ===== BACKEND INTEGRATION =====

async function syncInteractionToBackend(interaction) {
  if (!state.authToken || !state.currentAssignment) return;

  try {
    const response = await fetch(
      `${state.backendUrl}/api/assignments/${state.currentAssignment.id}/interactions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.authToken}`,
        },
        body: JSON.stringify({
          type: interaction.type,
          category: interaction.category,
          content: interaction.content,
          fullContent: interaction.fullContent,
          platform: interaction.platform,
          codeBlocks: interaction.codeBlocks,
          timestamp: interaction.timestamp,
        }),
      }
    );

    if (response.ok) {
      console.log('[UNFAIR] Interaction synced to backend');
    }
  } catch (error) {
    console.error('[UNFAIR] Backend sync error:', error);
  }
}

async function updateAssignmentOnBackend() {
  if (!state.authToken || !state.currentAssignment) return;

  try {
    const response = await fetch(`${state.backendUrl}/api/assignments/${state.currentAssignment.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.authToken}`,
      },
      body: JSON.stringify({
        status: state.currentAssignment.status,
        recording_time: state.recordingTime,
      }),
    });

    if (response.ok) {
      console.log('[UNFAIR] Assignment updated on backend');
    }
  } catch (error) {
    console.error('[UNFAIR] Backend update error:', error);
  }
}

async function generateTranscriptOnBackend() {
  if (!state.authToken || !state.currentAssignment) {
    // Generate locally if no backend
    return;
  }

  try {
    const response = await fetch(`${state.backendUrl}/api/assignments/${state.currentAssignment.id}/transcript`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.authToken}`,
      },
    });

    const data = await response.json();
    if (response.ok) {
      console.log('[UNFAIR] Transcript generated on backend:', data);
      return data;
    }
  } catch (error) {
    console.error('[UNFAIR] Backend transcript error:', error);
  }

  return null;
}

function checkAuthToken() {
  chrome.storage.local.get('authToken', (result) => {
    if (result.authToken) {
      state.authToken = result.authToken;
      console.log('[UNFAIR] Authentication token loaded');
    }
  });
}

// ===== COPY-PASTE DETECTION =====

class CopyPasteDetector {
  constructor() {
    this.aiResponses = [];
    this.threshold = 0.75;
  }

  initializeWithData(interactions) {
    this.aiResponses = interactions
      .filter((i) => i.type === 'response')
      .map((i) => ({
        content: i.fullContent || i.content,
        codeBlocks: i.codeBlocks || [],
        timestamp: i.timestamp,
      }));
  }

  analyzeCode(studentCode) {
    let matchScore = 0;
    let totalCompared = 0;

    this.aiResponses.forEach((response) => {
      const similarity = this.calculateSimilarity(studentCode, response.content);
      totalCompared++;
      if (similarity > this.threshold) {
        matchScore++;
      }

      response.codeBlocks.forEach((codeBlock) => {
        const blockSimilarity = this.calculateSimilarity(studentCode, codeBlock);
        totalCompared++;
        if (blockSimilarity > this.threshold) {
          matchScore++;
        }
      });
    });

    return totalCompared > 0 ? Math.round((matchScore / totalCompared) * 100) : 0;
  }

  calculateSimilarity(str1, str2) {
    const normalize = (s) =>
      s.toLowerCase().replace(/\s+/g, '').replace(/[^\w]/g, '');

    const s1 = normalize(str1);
    const s2 = normalize(str2);

    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.getEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  getEditDistance(s1, s2) {
    const costs = [];

    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }

    return costs[s2.length];
  }
}

// Initialize detector
const detector = new CopyPasteDetector();

function analyzeSubmissionCode(code) {
  detector.initializeWithData(state.interactions);
  return detector.analyzeCode(code);
}



