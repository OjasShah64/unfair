// ===== COPY-PASTE DETECTION UTILITY =====
// Detects which portions of student code came from AI responses

class CopyPasteDetector {
  constructor() {
    this.aiResponses = [];
    this.studentCode = '';
    this.threshold = 0.75; // 75% similarity threshold for detection
  }

  /**
   * Initialize detector with AI responses and student code
   */
  initializeWithData(interactions, studentCode) {
    this.aiResponses = interactions
      .filter((i) => i.type === 'response')
      .map((i) => ({
        content: i.fullContent,
        codeBlocks: i.codeBlocks || [],
        timestamp: i.timestamp,
      }));

    this.studentCode = studentCode;
  }

  /**
   * Analyze which code segments were likely copied from AI
   */
  analyzeCodeSegments() {
    const segments = this.parseCodeSegments(this.studentCode);
    const analysis = [];

    segments.forEach((segment, index) => {
      const matches = this.findMatches(segment.code);
      analysis.push({
        segmentIndex: index,
        code: segment.code,
        startLine: segment.startLine,
        endLine: segment.endLine,
        matches: matches,
        likelihood: this.calculateLikelihood(matches),
        status: this.determineStatus(matches),
      });
    });

    return analysis;
  }

  /**
   * Parse code into logical segments (functions, classes, blocks)
   */
  parseCodeSegments(code) {
    const segments = [];
    const lines = code.split('\n');
    let currentSegment = '';
    let startLine = 0;
    let braceCount = 0;

    lines.forEach((line, index) => {
      currentSegment += line + '\n';
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;

      // Segment complete when braces are balanced and line is not empty
      if (braceCount === 0 && line.trim() !== '' && line.trim() !== '{') {
        if (currentSegment.trim().length > 10) {
          segments.push({
            code: currentSegment.trim(),
            startLine: startLine,
            endLine: index,
          });
        }
        currentSegment = '';
        startLine = index + 1;
      }
    });

    // Add remaining segment
    if (currentSegment.trim().length > 10) {
      segments.push({
        code: currentSegment.trim(),
        startLine: startLine,
        endLine: lines.length - 1,
      });
    }

    return segments;
  }

  /**
   * Find matching content in AI responses
   */
  findMatches(studentSegment) {
    const matches = [];
    const studentLines = studentSegment.split('\n').filter((l) => l.trim());

    this.aiResponses.forEach((response) => {
      // Check full response content
      const similarity = this.calculateSimilarity(studentSegment, response.content);
      if (similarity > this.threshold) {
        matches.push({
          type: 'full_response',
          similarity: similarity,
          timestamp: response.timestamp,
          source: response.content.substring(0, 100),
        });
      }

      // Check code blocks specifically
      response.codeBlocks.forEach((codeBlock) => {
        const blockSimilarity = this.calculateSimilarity(studentSegment, codeBlock);
        if (blockSimilarity > this.threshold) {
          matches.push({
            type: 'code_block',
            similarity: blockSimilarity,
            timestamp: response.timestamp,
            source: codeBlock.substring(0, 100),
          });
        }
      });
    });

    return matches;
  }

  /**
   * Levenshtein distance for string similarity
   */
  calculateSimilarity(str1, str2) {
    // Normalize strings
    const normalize = (s) =>
      s
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^\w]/g, '');

    const s1 = normalize(str1);
    const s2 = normalize(str2);

    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) {
      return 1.0;
    }

    const editDistance = this.getEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   */
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

  /**
   * Calculate overall likelihood based on matches
   */
  calculateLikelihood(matches) {
    if (matches.length === 0) return 0;

    const avgSimilarity = matches.reduce((sum, m) => sum + m.similarity, 0) / matches.length;
    const exactMatches = matches.filter((m) => m.similarity > 0.95).length;
    const weight = Math.min(exactMatches * 0.2 + avgSimilarity * 0.8, 1.0);

    return Math.round(weight * 100);
  }

  /**
   * Determine status: manual, likely_copied, or copied
   */
  determineStatus(matches) {
    if (matches.length === 0) return 'manually_written';
    const maxSimilarity = Math.max(...matches.map((m) => m.similarity));
    if (maxSimilarity > 0.95) return 'likely_copied';
    if (maxSimilarity > 0.8) return 'partially_derived';
    return 'manually_written';
  }

  /**
   * Generate detailed report
   */
  generateReport() {
    const analysis = this.analyzeCodeSegments();
    const totalSegments = analysis.length;
    const copiedSegments = analysis.filter((a) => a.status === 'likely_copied').length;
    const partialSegments = analysis.filter((a) => a.status === 'partially_derived').length;

    const percentageCopied = (copiedSegments / totalSegments) * 100;
    const percentagePartial = (partialSegments / totalSegments) * 100;

    return {
      summary: {
        totalSegments,
        copiedSegments,
        partialSegments,
        manualSegments: totalSegments - copiedSegments - partialSegments,
        percentageCopied: Math.round(percentageCopied),
        percentagePartial: Math.round(percentagePartial),
        overallScore: Math.round((100 - percentageCopied) * 0.8 + (100 - percentagePartial) * 0.2),
      },
      details: analysis,
    };
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CopyPasteDetector;
}
