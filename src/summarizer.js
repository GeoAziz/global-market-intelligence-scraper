// Re-export summarizer API from modular summarizers
const { summarizeBatch } = require('./summarizers/index');
const { localSummarize } = require('./summarizers/extractiveSummarizer');

module.exports = { summarizeBatch, localSummarize };
