/** Simple text cleaner to remove excessive whitespace and control chars */
function cleanText(text) {
    if (!text) return '';
    return text
        .replace(/\r\n|\r/g, "\n")
        .replace(/[\t\u00A0]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .join('\n\n');
}

module.exports = { cleanText };
