const fs = require('fs');
const playwright = require('playwright');
const log = require('../../utils/logger') || require('../utils/logger');

const systemChromiumPaths = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
];

function findSystemChromium() {
    return systemChromiumPaths.find(p => {
        try { return fs.existsSync(p) && fs.statSync(p).isFile(); } catch (e) { return false; }
    });
}

async function launchChromium(options = {}) {
    // options forwarded to playwright.launch
    try {
        return await playwright.chromium.launch(Object.assign({ headless: true }, options));
    } catch (err) {
        const sys = findSystemChromium();
        if (sys) {
            log && log.warn && log.warn('Playwright browser not found in cache; falling back to system Chromium', { path: sys, err: err && err.message });
            return await playwright.chromium.launch(Object.assign({ headless: true, executablePath: sys, args: ['--no-sandbox', '--disable-setuid-sandbox'] }, options));
        }
        throw err;
    }
}

module.exports = { launchChromium, findSystemChromium };
