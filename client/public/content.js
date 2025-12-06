(function(){
try {
// Create browser outline (full box border)
const borderTop = document.createElement('div');
borderTop.id = 'unfair-border-top';
borderTop.className = 'unfair-browser-border';

const borderRight = document.createElement('div');
borderRight.id = 'unfair-border-right';
borderRight.className = 'unfair-browser-border';

const borderBottom = document.createElement('div');
borderBottom.id = 'unfair-border-bottom';
borderBottom.className = 'unfair-browser-border';

const borderLeft = document.createElement('div');
borderLeft.id = 'unfair-border-left';
borderLeft.className = 'unfair-browser-border';

document.documentElement.appendChild(borderTop);
document.documentElement.appendChild(borderRight);
document.documentElement.appendChild(borderBottom);
document.documentElement.appendChild(borderLeft);

// Create extension UI container
const extensionUI = document.createElement('div');
extensionUI.id = 'unfair-extension-ui';

// Header
const header = document.createElement('div');
header.id = 'unfair-header';

const headerLeft = document.createElement('div');
headerLeft.id = 'unfair-header-left';

const recordingIcon = document.createElement('div');
recordingIcon.id = 'unfair-recording-icon';

const recordingText = document.createElement('span');
recordingText.id = 'unfair-recording-text';
recordingText.textContent = 'UNFAIR RECORDING';

headerLeft.appendChild(recordingIcon);
headerLeft.appendChild(recordingText);

const closeBtn = document.createElement('button');
closeBtn.id = 'unfair-close-btn';
closeBtn.textContent = '×';
closeBtn.setAttribute('aria-label', 'Close');
closeBtn.onclick = () => {
  extensionUI.style.display = 'none';
  borderTop.style.display = 'none';
  borderRight.style.display = 'none';
  borderBottom.style.display = 'none';
  borderLeft.style.display = 'none';
};

header.appendChild(headerLeft);
header.appendChild(closeBtn);

// Content area
const content = document.createElement('div');
content.id = 'unfair-content';

const projectName = document.createElement('div');
projectName.id = 'unfair-project-name';
projectName.textContent = 'CS 225 MP3';

const timer = document.createElement('div');
timer.id = 'unfair-timer';

// Clock icon SVG
const clockIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
clockIcon.setAttribute('class', 'unfair-clock-svg');
clockIcon.setAttribute('viewBox', '0 0 24 24');
clockIcon.setAttribute('width', '16');
clockIcon.setAttribute('height', '16');
const clockPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
clockPath.setAttribute('d', 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z');
clockIcon.appendChild(clockPath);

const timerText = document.createElement('span');
timerText.textContent = '02:34';

timer.appendChild(clockIcon);
timer.appendChild(timerText);

const interactions = document.createElement('div');
interactions.id = 'unfair-interactions';
interactions.textContent = '12 interactions logged';

content.appendChild(projectName);
content.appendChild(timer);
content.appendChild(interactions);

// Action buttons
const actions = document.createElement('div');
actions.id = 'unfair-actions';

const pauseBtn = document.createElement('button');
pauseBtn.id = 'unfair-pause-btn';
pauseBtn.className = 'unfair-btn';
pauseBtn.textContent = 'Pause';

const stopBtn = document.createElement('button');
stopBtn.id = 'unfair-stop-btn';
stopBtn.className = 'unfair-btn';
stopBtn.textContent = 'Stop';

actions.appendChild(pauseBtn);
actions.appendChild(stopBtn);

// Assemble the UI
extensionUI.appendChild(header);
extensionUI.appendChild(content);
extensionUI.appendChild(actions);

// Append to document
document.documentElement.appendChild(extensionUI);

// Ensure it's visible even if page hasn't fully loaded
if (document.body) {
  // Already loaded
} else {
  // Wait for body to load
  document.addEventListener('DOMContentLoaded', () => {
    // UI is already appended to documentElement, so it should be visible
  });
}

// ===== Dynamic Shape Support =====
const SHAPE_CLASSES = ['rectangle','rounded','pill','diagonal','notch','ellipse','mixed'];

function applyShape(shape) {
  if (!shape) shape = 'rectangle';
  const normalized = String(shape).toLowerCase();
  const borderEls = document.querySelectorAll('.unfair-browser-border');
  borderEls.forEach((el) => {
    // remove previous shape- classes
    SHAPE_CLASSES.forEach((s) => el.classList.remove(`shape-${s}`));
    el.classList.add(`shape-${normalized}`);
  });

  if (extensionUI) {
    SHAPE_CLASSES.forEach((s) => extensionUI.classList.remove(`shape-${s}`));
    extensionUI.classList.add(`shape-${normalized}`);
  }
}

// Init from storage
try {
  chrome.storage.local.get(['unfairShape'], (res) => {
    const shape = (res && res.unfairShape) ? res.unfairShape : 'rectangle';
    applyShape(shape);
  });
} catch (e) {
  // In non-extension contexts this may fail silently
  applyShape('rectangle');
}

// React to storage changes so popup can change shape live
try {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.unfairShape) {
      applyShape(changes.unfairShape.newValue);
    }
  });
} catch (e) { /* ignore */ }

// Also listen for direct runtime messages to set shape
try {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === 'SET_SHAPE' && msg.shape) {
      applyShape(msg.shape);
      // persist preference
      try { chrome.storage.local.set({ unfairShape: msg.shape }); } catch (e) {}
      if (sendResponse) sendResponse({ ok: true });
    }
  });
} catch (e) { /* ignore in non-extension contexts */ }

} catch (e) {
  try { console.warn('[UNFAIR] content script init failed', e); } catch (ee) {}
}
})();

