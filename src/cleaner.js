// Re-export modular cleaners for compatibility and easier testing
const { cleanText } = require('./cleaners/cleanText');
const { deduplicateArticles } = require('./cleaners/deduplicate');

exports.cleanText = cleanText;
exports.cleanArticles = deduplicateArticles;
