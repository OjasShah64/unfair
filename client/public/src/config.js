// Extension Configuration
// Adjust these settings for different environments

const CONFIG = {
  // Backend API
  API: {
    // Development
    // BASE_URL: 'http://localhost:5000',

    // Production (change this)
    BASE_URL: 'https://api.unfair.app',

    ENDPOINTS: {
      ASSIGNMENTS: '/api/assignments',
      INTERACTIONS: '/api/assignments/:id/interactions',
      TRANSCRIPT: '/api/assignments/:id/transcript',
      HEALTH: '/api/health',
    },
  },

  // Feature Flags
  FEATURES: {
    COPY_PASTE_DETECTION: true,
    BACKEND_SYNC: true,
    REAL_TIME_LOGGING: true,
    AUTO_SAVE: true,
  },

  // AI Platforms to Monitor
  PLATFORMS: {
    CHATGPT: {
      domains: ['chat.openai.com', 'chatgpt.com'],
      enabled: true,
    },
    CLAUDE: {
      domains: ['claude.ai'],
      enabled: true,
    },
    COPILOT: {
      domains: ['copilot.microsoft.com'],
      enabled: false, // Will enable after testing
    },
  },

  // Interaction Categories
  CATEGORIES: ['Brainstorming', 'Debugging', 'Syntax Help', 'Conceptual Explanation', 'Code Refactoring'],

  // Timeouts
  TIMEOUTS: {
    BACKEND_SYNC: 30000, // 30 seconds
    AUTO_SAVE: 5000, // 5 seconds
    INTERACTION_CHECK: 5000, // 5 seconds
  },

  // Thresholds
  THRESHOLDS: {
    COPY_PASTE_SIMILARITY: 0.75, // 75% similarity threshold
    EXACT_MATCH: 0.95, // 95% for exact match
  },
};

// Export for use in different modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
