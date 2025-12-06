// ===== CONTENT SCRIPT: AI INTERACTION CAPTURER =====
// This script runs on ChatGPT and Claude pages to capture all interactions

let isRecording = false;
let currentAssignmentId = null;
let interactions = [];
let lastMessageCount = 0;
let overlayElement = null;
let panelElement = null;
let panelTimerInterval = null;

function escapeHtml(text) {
  if (!text) return '';
  return String(text).replace(/[&<>"]+/g, function (s) {
    return ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;'
    })[s];
  });
}

// Safe wrapper for chrome.runtime.sendMessage to avoid "Extension context invalidated" errors
function safeSendMessage(message, callback) {
  try {
    if (window.chrome && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
      chrome.runtime.sendMessage(message, function (response) {
        if (chrome.runtime.lastError) {
          console.warn('[UNFAIR] sendMessage lastError:', chrome.runtime.lastError.message);
        }
        if (typeof callback === 'function') callback(response);
      });
    } else {
      if (typeof callback === 'function') callback(null);
    }
  } catch (err) {
    console.warn('[UNFAIR] safeSendMessage error:', err && err.message);
    if (typeof callback === 'function') callback(null);
  }
}

// Safe wrappers for chrome.storage.local.get/set
function safeStorageGet(key, callback) {
  try {
    if (window.chrome && chrome.storage && chrome.storage.local && typeof chrome.storage.local.get === 'function') {
      chrome.storage.local.get(key, (result) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.warn('[UNFAIR] storage.get lastError:', chrome.runtime.lastError.message);
        }
        if (typeof callback === 'function') callback(result);
      });
    } else {
      if (typeof callback === 'function') callback({});
    }
  } catch (err) {
    console.warn('[UNFAIR] safeStorageGet error:', err && err.message);
    if (typeof callback === 'function') callback({});
  }
}

function safeStorageSet(obj, callback) {
  try {
    if (window.chrome && chrome.storage && chrome.storage.local && typeof chrome.storage.local.set === 'function') {
      chrome.storage.local.set(obj, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.warn('[UNFAIR] storage.set lastError:', chrome.runtime.lastError.message);
        }
        if (typeof callback === 'function') callback();
      });
    } else {
      if (typeof callback === 'function') callback();
    }
  } catch (err) {
    console.warn('[UNFAIR] safeStorageSet error:', err && err.message);
    if (typeof callback === 'function') callback();
  }
}

// ===== OVERLAY MANAGEMENT =====
function injectRecordingOverlay() {
  // Remove existing overlay if any
  if (overlayElement) {
    overlayElement.remove();
  }

  // Create and inject new overlay
  overlayElement = document.createElement('div');
  overlayElement.id = 'unfair-recording-overlay';
  overlayElement.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border: 6px solid #ef4444;
    pointer-events: none;
    z-index: 2147483647;
    box-sizing: border-box;
  `;
  document.body.appendChild(overlayElement);
  console.log('[UNFAIR] Recording overlay injected');
}

function removeRecordingOverlay() {
  if (overlayElement) {
    overlayElement.remove();
    overlayElement = null;
  }
  console.log('[UNFAIR] Recording overlay removed');
}

// ===== RECORDING PANEL (persistent in-page UI) =====
function injectRecordingPanel(assignmentId, assignmentName) {
  removeRecordingPanel();

  panelElement = document.createElement('div');
  panelElement.id = 'unfair-recording-panel';
  panelElement.style.cssText = `
    position: fixed;
    top: 18px;
    right: 18px;
    width: 240px;
    background: linear-gradient(180deg,#ef4444,#dc2626);
    color: white;
    border-radius: 12px;
    box-shadow: 0 8px 28px rgba(0,0,0,0.25);
    z-index: 2147483647;
    font-family: Arial, sans-serif;
    overflow: visible;
    border: 2px solid rgba(255,255,255,0.06);
  `;

  panelElement.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(0,0,0,0.1);border-bottom:1px solid rgba(255,255,255,0.1)">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:8px;height:8px;background:#fff;border-radius:50%;animation:pulse 2s infinite"></div>
        <div style="font-size:14px;font-weight:600;letter-spacing:0.5px">RECORDING</div>
      </div>
      <button id="unfair-close" title="Close" style="background:transparent;border:none;color:white;cursor:pointer;font-size:18px;width:20px;height:20px;display:flex;align-items:center;justify-content:center;line-height:1">✕</button>
    </div>
    <div id="unfair-panel-body" style="padding:16px;background:transparent;color:white">
      <div style="font-size:18px;font-weight:600;margin-bottom:12px;color:#ffffff">${escapeHtml(assignmentName || 'Assignment')}</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:16px">🕐</span>
        <div style="font-size:20px;font-weight:700;font-family:'Courier New',monospace" id="unfair-panel-timer">0:00</div>
      </div>
      <div style="font-size:13px;opacity:0.9;margin-bottom:16px" id="unfair-panel-count">0 interactions logged</div>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button id="unfair-pause" style="flex:1;background:#ffffff;border:none;color:#dc2626;padding:10px;border-radius:6px;cursor:pointer;font-size:14px;font-weight:500;display:flex;align-items:center;justify-content:center;gap:6px">⏸ Pause</button>
        <button id="unfair-stop" style="flex:1;background:transparent;border:1.5px solid #ffffff;color:#ffffff;padding:10px;border-radius:6px;cursor:pointer;font-size:14px;font-weight:500;display:flex;align-items:center;justify-content:center;gap:6px">⊠ Stop</button>
      </div>
      <button id="unfair-back-home" style="width:100%;background:#ffffff;border:none;color:#dc2626;padding:10px;border-radius:6px;cursor:pointer;font-size:14px;font-weight:500">Back to Home</button>
    </div>
    <style>
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    </style>
  `;

  document.body.appendChild(panelElement);

  // Wire up controls
  document.getElementById('unfair-stop').addEventListener('click', () => {
    safeSendMessage({ type: 'STOP_SESSION' }, (resp) => {
      console.log('[UNFAIR] STOP_SESSION from panel', resp);
    });
  });

  document.getElementById('unfair-pause').addEventListener('click', (e) => {
    safeSendMessage({ type: 'TOGGLE_PAUSE' }, (resp) => {
      if (resp && resp.isPaused) {
        e.target.innerHTML = '▶ Resume';
      } else {
        e.target.innerHTML = '⏸ Pause';
      }
    });
  });

  // Wire close button
  document.getElementById('unfair-close').addEventListener('click', () => {
    // hide but keep a small visible header so it can be re-opened by re-clicking the extension icon
    const body = document.getElementById('unfair-panel-body');
    if (body) body.style.display = 'none';
  });

  // Wire back to home button
  document.getElementById('unfair-back-home').addEventListener('click', () => {
    // Open extension popup
    chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
  });

  console.log('[UNFAIR] Recording panel injected');
}

function removeRecordingPanel() {
  if (panelElement) {
    panelElement.remove();
    panelElement = null;
  }
  if (panelTimerInterval) {
    clearInterval(panelTimerInterval);
    panelTimerInterval = null;
  }
  console.log('[UNFAIR] Recording panel removed');
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'START_RECORDING') {
    isRecording = true;
    currentAssignmentId = msg.assignmentId;
    injectRecordingOverlay();
    injectRecordingPanel(msg.assignmentId, msg.assignmentName || msg.assignmentId);
    console.log('[UNFAIR] Recording started on content script');
  }
  if (msg.type === 'STOP_RECORDING') {
    isRecording = false;
    removeRecordingOverlay();
    removeRecordingPanel();
    console.log('[UNFAIR] Recording stopped on content script');
  }
  if (msg.type === 'TIMER_UPDATED') {
    // Update panel timer if present
    if (panelElement) {
      const t = msg.recordingTime || 0;
      const hours = Math.floor(t / 3600);
      const minutes = Math.floor((t % 3600) / 60);
      const seconds = t % 60;
      // Format as MM:SS (or HH:MM if over an hour)
      let formatted;
      if (hours > 0) {
        formatted = `${hours}:${String(minutes).padStart(2, '0')}`;
      } else {
        formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      }
      const timerEl = document.getElementById('unfair-panel-timer');
      if (timerEl) timerEl.textContent = formatted;
    }
    // Update interaction count if available
    if (panelElement) {
      const countEl = document.getElementById('unfair-panel-count');
      if (countEl) countEl.textContent = `${interactions.length} interactions logged`;
    }
  }
});

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', initContentScript);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initContentScript);
} else {
  initContentScript();
}

function initContentScript() {
  console.log('[UNFAIR] Content script initialized on', window.location.hostname);
  try {
    checkRecordingStatus();
  } catch (e) {
    console.warn('[UNFAIR] checkRecordingStatus threw:', e && e.message);
  }
  setupMutationObservers();
  setupPeriodicCheck();
}

// ===== RECORDING STATUS =====
function checkRecordingStatus() {
  safeStorageGet('unfairState', (result) => {
    if (result && result.unfairState) {
      try {
        isRecording = result.unfairState.isRecording;
        currentAssignmentId = result.unfairState.currentAssignment?.id;
        console.log('[UNFAIR] Recording status:', isRecording);
      } catch (err) {
        console.warn('[UNFAIR] error applying saved state:', err && err.message);
      }
    }
  });
}

// Listen for changes in recording state
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (changes.unfairState) {
    const newState = changes.unfairState.newValue;
    isRecording = newState.isRecording;
    currentAssignmentId = newState.currentAssignment?.id;
    console.log('[UNFAIR] Recording state changed:', isRecording);
  }
});

// ===== CHATGPT INTERACTION CAPTURE =====
function setupMutationObservers() {
  // Observer for ChatGPT/OpenAI
  if (window.location.hostname.includes('openai.com') || window.location.hostname.includes('chatgpt.com')) {
    observeChatGPT();
  }

  // Observer for Claude/Anthropic
  if (window.location.hostname.includes('claude.ai')) {
    observeClaude();
  }
}

function observeChatGPT() {
  console.log('[UNFAIR] Setting up ChatGPT observer');

  const observer = new MutationObserver((mutations) => {
    if (!isRecording) return;

    // Look for conversation messages
    const messages = document.querySelectorAll('[data-message-id], [data-testid*="message"]');
    if (messages.length !== lastMessageCount) {
      lastMessageCount = messages.length;

      // Extract the latest conversation
      const conversation = extractChatGPTConversation();
      if (conversation.length > 0) {
        const latestInteraction = conversation[conversation.length - 1];
        captureInteraction(latestInteraction);
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: false,
  });
}

function extractChatGPTConversation() {
  const messages = [];
  const messageElements = document.querySelectorAll('[data-message-id], [data-testid*="message"]');

  messageElements.forEach((el, index) => {
    const textContent = el.innerText || el.textContent;
    if (textContent && textContent.length > 0) {
      // Determine if it's a user prompt or AI response
      const isUserMessage = el.closest('[data-testid*="user"]') || el.querySelector('[data-testid*="user"]');
      const timestamp = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });

      messages.push({
        type: isUserMessage ? 'prompt' : 'response',
        content: textContent.slice(0, 500), // Cap at 500 chars for initial capture
        timestamp,
        platform: 'ChatGPT',
        fullContent: textContent,
      });
    }
  });

  return messages;
}

// ===== CLAUDE INTERACTION CAPTURE =====
function observeClaude() {
  console.log('[UNFAIR] Setting up Claude observer');

  const observer = new MutationObserver((mutations) => {
    if (!isRecording) return;

    const messages = document.querySelectorAll('[data-test-id*="message"], .message, [role="article"]');
    if (messages.length !== lastMessageCount) {
      lastMessageCount = messages.length;

      const conversation = extractClaudeConversation();
      if (conversation.length > 0) {
        const latestInteraction = conversation[conversation.length - 1];
        captureInteraction(latestInteraction);
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: false,
  });
}

function extractClaudeConversation() {
  const messages = [];
  const messageElements = document.querySelectorAll('[data-test-id*="message"], [role="article"], .message');

  messageElements.forEach((el) => {
    const textContent = el.innerText || el.textContent;
    if (textContent && textContent.length > 0) {
      const timestamp = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });

      // Claude typically alternates between user and assistant
      const isUserMessage = el.className.includes('user') || el.textContent.includes('You:');

      messages.push({
        type: isUserMessage ? 'prompt' : 'response',
        content: textContent.slice(0, 500),
        timestamp,
        platform: 'Claude',
        fullContent: textContent,
      });
    }
  });

  return messages;
}

// ===== INTERACTION LOGGING =====
function captureInteraction(interaction) {
  if (!isRecording || !currentAssignmentId) return;

  // Analyze the interaction
  const analyzedInteraction = analyzeInteraction(interaction);

  // Send to background script
  safeSendMessage(
    {
      type: 'LOG_INTERACTION',
      data: analyzedInteraction,
      assignmentId: currentAssignmentId,
    },
    (response) => {
      console.log('[UNFAIR] Interaction logged:', response);
    }
  );

  interactions.push(analyzedInteraction);
  
  // Update panel interaction count
  const countEl = document.getElementById('unfair-panel-count');
  if (countEl) {
    countEl.textContent = `${interactions.length} interactions logged`;
  }
}

function analyzeInteraction(interaction) {
  // Determine category based on content
  let category = 'Coding Help';

  const content = interaction.content.toLowerCase();

  if (content.includes('debug') || content.includes('error') || content.includes('fix')) {
    category = 'Debugging';
  } else if (content.includes('explain') || content.includes('understand') || content.includes('concept')) {
    category = 'Conceptual Explanation';
  } else if (content.includes('syntax') || content.includes('format') || content.includes('structure')) {
    category = 'Syntax Help';
  } else if (content.includes('refactor') || content.includes('improve') || content.includes('optimize')) {
    category = 'Code Refactoring';
  } else if (content.includes('brainstorm') || content.includes('idea') || content.includes('approach')) {
    category = 'Brainstorming';
  }

  // Extract code blocks if present
  const codeBlockRegex = /```[\s\S]*?```/g;
  const codeBlocks = interaction.fullContent.match(codeBlockRegex) || [];

  return {
    id: Date.now() + Math.random(),
    timestamp: interaction.timestamp,
    type: interaction.type,
    content: interaction.content,
    fullContent: interaction.fullContent,
    category: interaction.type === 'response' ? category : null,
    platform: interaction.platform,
    codeBlocks: codeBlocks,
    capturedAt: new Date().toISOString(),
  };
}

// ===== PERIODIC SYNC =====
function setupPeriodicCheck() {
  // Check recording status every 5 seconds
  setInterval(() => {
    checkRecordingStatus();
  }, 5000);

  // Sync interactions to storage every 30 seconds
  setInterval(() => {
    if (isRecording && interactions.length > 0) {
      safeStorageGet('unfairInteractions', (result) => {
        const allInteractions = (result && result.unfairInteractions) ? result.unfairInteractions : {};
        allInteractions[currentAssignmentId] = interactions;
        safeStorageSet({ unfairInteractions: allInteractions });
      });
    }
  }, 30000);
}

// ===== MESSAGE LISTENER =====
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_INTERACTIONS') {
    sendResponse({
      interactions: interactions,
      assignmentId: currentAssignmentId,
    });
  }

  if (request.type === 'CLEAR_INTERACTIONS') {
    interactions = [];
    sendResponse({ success: true });
  }
  
});

console.log('[UNFAIR] Content script fully loaded and ready to capture interactions');



