/** Lightweight extractive summarizer used as fallback */
function localSummarize(text, maxSentences = 3) {
    if (!text) return '';
    const sentences = text.replace(/\n/g, ' ').match(/[^.!?]+[.!?]?/g) || [text];
    const scored = sentences.map(s => ({ s: s.trim(), score: s.trim().length }));
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, maxSentences).map(x => x.s);
    return top.join(' ');
}

module.exports = { localSummarize };
