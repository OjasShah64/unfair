// ===== BACKGROUND SERVICE WORKER =====
// Manages recording sessions and backend communication

let recording = false;
let currentSession = [];
let currentAssignment = null;
let backendUrl = 'http://localhost:5000'; // Change in production
// Feature flag: disable backend calls during UI-first development
const ENABLE_BACKEND = false;

// ===== TIMER MANAGEMENT =====
let recordingTime = 0; // in seconds
let timerInterval = null;
let isPaused = false;

// ===== SESSION MANAGEMENT =====

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'START_SESSION') {
    handleStartSession(msg.assignment, sendResponse);
    return true;
  }

  if (msg.type === 'STOP_SESSION') {
    handleStopSession(sendResponse);
    return true;
  }

  if (msg.type === 'LOG_INTERACTION') {
    handleLogInteraction(msg.data, msg.assignmentId, sendResponse);
    return true;
  }

  if (msg.type === 'GET_SESSION_STATUS') {
    sendResponse({
      recording: recording,
      currentAssignment: currentAssignment,
      interactionCount: currentSession.length,
      recordingTime: recordingTime,
      isPaused: isPaused,
    });
  }

  if (msg.type === 'GENERATE_TRANSCRIPT') {
    handleGenerateTranscript(msg.assignmentId, sendResponse);
    return true;
  }

  if (msg.type === 'TOGGLE_PAUSE') {
    handleTogglePause(sendResponse);
    return true;
  }

  if (msg.type === 'GET_RECORDING_TIME') {
    sendResponse({ recordingTime: recordingTime });
  }
  
  if (msg.type === 'GET_CURRENT_SESSION') {
    sendResponse({
      assignment: currentAssignment,
      interactions: currentSession,
      recordingTime: recordingTime,
      isPaused: isPaused,
      recording: recording,
    });
    return true;
  }
});

// ===== SESSION HANDLERS =====

function handleStartSession(assignment, callback) {
  recording = true;
  isPaused = false;
  currentAssignment = assignment;
  currentSession = [];
  recordingTime = 0;

  // Start persistent timer
  startTimer();

  // Notify all tabs that recording started
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, {
        type: 'START_RECORDING',
        assignmentId: assignment.id,
        assignmentName: assignment.name,
      }).catch(() => {
        // Tab might not have content script loaded, ignore
      });
    });
  });

  console.log('[UNFAIR] Session started:', assignment);
  callback({ status: 'started', assignment: assignment });
}

function handleStopSession(callback) {
  recording = false;
  isPaused = false;
  stopTimer();

  // Notify all tabs that recording stopped
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, { type: 'STOP_RECORDING' }).catch(() => {
        // Tab might not have content script loaded, ignore
      });
    });
  });

  chrome.storage.local.set(
    {
      [`session_${currentAssignment?.id}`]: {
        assignment: currentAssignment,
        interactions: currentSession,
        recordingTime: recordingTime,
        stoppedAt: new Date().toISOString(),
      },
    },
    () => {
      console.log('[UNFAIR] Session stopped. Total interactions:', currentSession.length);
      callback({ status: 'stopped', interactions: currentSession, recordingTime: recordingTime });
    }
  );
}

function handleLogInteraction(interaction, assignmentId, callback) {
  currentSession.push(interaction);

  // Broadcast the new interaction to any open popups so UI can update live
  try {
    chrome.runtime.sendMessage({ type: 'NEW_INTERACTION', interaction: interaction, assignmentId: assignmentId });
  } catch (e) {
    // ignore
  }

  // Sync to backend if token is available and backend enabled
  if (ENABLE_BACKEND) {
    chrome.storage.local.get('authToken', (result) => {
      if (result.authToken) {
        syncInteractionToBackend(interaction, assignmentId, result.authToken);
      }
    });
  }

  callback({ status: 'logged', interactionId: interaction.id });
}

function handleGenerateTranscript(assignmentId, callback) {
  if (!ENABLE_BACKEND) {
    callback({ error: 'Backend disabled' });
    return;
  }
  chrome.storage.local.get('authToken', (result) => {
    if (!result.authToken) {
      callback({ error: 'Not authenticated' });
      return;
    }

    generateTranscriptOnBackend(assignmentId, result.authToken, callback);
  });
}

// ===== BACKEND COMMUNICATION =====

function syncInteractionToBackend(interaction, assignmentId, token) {
  if (!ENABLE_BACKEND) {
    console.log('[UNFAIR] Background backend disabled — skipping interaction sync');
    return;
  }
  fetch(`${backendUrl}/api/assignments/${assignmentId}/interactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
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
  })
    .then((response) => response.json())
    .then((data) => {
      console.log('[UNFAIR] Interaction synced to backend:', data);
    })
    .catch((error) => {
      console.error('[UNFAIR] Error syncing interaction:', error);
      // Still save locally even if backend fails
    });
}

function generateTranscriptOnBackend(assignmentId, token, callback) {
  if (!ENABLE_BACKEND) {
    console.log('[UNFAIR] Background backend disabled — skipping transcript generation');
    callback({ error: 'Backend disabled' });
    return;
  }
  fetch(`${backendUrl}/api/assignments/${assignmentId}/transcript`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.error) {
        callback({ error: data.error });
      } else {
        callback({ success: true, transcript: data });
      }
    })
    .catch((error) => {
      console.error('[UNFAIR] Error generating transcript:', error);
      callback({ error: 'Failed to generate transcript' });
    });
}

// ===== TIMER MANAGEMENT =====

function startTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
  }

  timerInterval = setInterval(() => {
    if (!isPaused && recording) {
      recordingTime++;
      // Broadcast updated time to all connected popups
      chrome.runtime.sendMessage({
        type: 'TIMER_UPDATED',
        recordingTime: recordingTime,
      }).catch(() => {
        // Popup might be closed, that's fine
      });
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  recordingTime = 0;
}

function handleTogglePause(callback) {
  isPaused = !isPaused;
  callback({ isPaused: isPaused });
}

// ===== STORAGE SYNCHRONIZATION =====

// Auto-sync periodically when recording
setInterval(() => {
  if (recording && currentAssignment) {
    chrome.storage.local.set({
      unfairState: {
        isRecording: recording,
        currentAssignment: currentAssignment,
        interactionCount: currentSession.length,
        recordingTime: recordingTime,
        isPaused: isPaused,
        lastSync: new Date().toISOString(),
      },
    });
  }
}, 5000);

console.log('[UNFAIR] Background service worker initialized');



