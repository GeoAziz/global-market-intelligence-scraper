const hosts = new Map();
const minDelayMs = Number(process.env.HOST_MIN_DELAY_MS || 1000);

async function waitForHost(host) {
    if (!host) return;
    const now = Date.now();
    const entry = hosts.get(host) || { last: 0 };
    const elapsed = now - (entry.last || 0);
    const wait = Math.max(0, minDelayMs - elapsed);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    hosts.set(host, { last: Date.now() });
}

module.exports = { waitForHost };
