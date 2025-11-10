const fetch = require('node-fetch');
const log = require('../../utils/logger');

const HF_API_URL = 'https://api-inference.huggingface.co/models/facebook/bart-large-cnn';

async function callHFSummary(text, hfToken, maxLength = 150) {
    if (!hfToken) throw new Error('No HF_TOKEN provided');
    const res = await fetch(HF_API_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${hfToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: text, parameters: { max_length: maxLength } }),
    });
    if (!res.ok) {
        const textBody = await res.text();
        throw new Error(`HF API error: ${res.status} ${textBody}`);
    }
    const json = await res.json();
    if (Array.isArray(json) && json[0] && json[0].summary_text) return json[0].summary_text;
    if (json.summary_text) return json.summary_text;
    if (typeof json === 'string') return json;
    throw new Error('Unknown HF response format');
}

module.exports = { callHFSummary };
