const log = require('../../utils/logger');
const { reserveUsage, incrementUsage } = require('../openaiTracker');

// Simple token estimator (rough): 1 token ~= 4 chars
function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
}

async function callOpenAISummary(text, apiKey, opts = {}) {
    if (!apiKey) throw new Error('No OPENAI_KEY provided');

    const maxTokensPerRequest = parseInt(process.env.OPENAI_MAX_TOKENS_PER_REQUEST || '1024', 10);
    const maxRequestsPerRun = parseInt(process.env.OPENAI_MAX_REQUESTS_PER_RUN || '50', 10);
    const maxTokensPerRun = parseInt(process.env.OPENAI_MAX_TOKENS_PER_RUN || '100000', 10);

    let content = text;
    const est = estimateTokens(content);
    if (est > maxTokensPerRequest) {
        log.warn('Text exceeds max tokens per request, truncating');
        content = content.slice(0, maxTokensPerRequest * 4);
    }

    // Try to reserve persistent usage before calling OpenAI
    try {
        const reserved = await reserveUsage({ tokens: est + (opts.max_tokens || 256), requests: 1, usd: 0 }, {
            maxTokensPerRun,
            maxRequestsPerRun,
        });
        if (!reserved) throw new Error('OpenAI caps would be exceeded; aborting request');
    } catch (e) {
        // If the tracker fails, don't proceed unsafely
        log.warn('openaiTracker.reserveUsage failed or caps exceeded', { err: e && e.message });
        throw e;
    }

    const payload = {
        model: opts.model || process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: [
            { role: 'system', content: 'You are a concise summarizer. Produce a short summary (100-200 words) with a 2-3 sentence TL;DR.' },
            { role: 'user', content },
        ],
        max_tokens: opts.max_tokens || 200,
        temperature: typeof opts.temperature === 'number' ? opts.temperature : 0.2,
    };

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`OpenAI API error: ${res.status} ${body}`);
    }

    const j = await res.json();
    const summary = j?.choices?.[0]?.message?.content || j?.choices?.[0]?.text || '';

    // Persist usage
    try {
        await incrementUsage({ tokens: est + (payload.max_tokens || 0), requests: 1, usd: 0 });
    } catch (e) {
        log && log.warn && log.warn('Failed to persist OpenAI usage', { err: e && e.message });
    }

    return (summary || '').trim();
}

module.exports = { callOpenAISummary, estimateTokens };
