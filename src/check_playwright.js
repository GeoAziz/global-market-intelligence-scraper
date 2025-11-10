const fs = require('fs');
const path = require('path');
const log = require('../utils/logger');
const playwright = require('playwright');

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

async function probe() {
    const diag = {
        time: new Date().toISOString(),
        playwrightInstalled: false,
        playwrightCanLaunch: false,
        usedExecutablePath: null,
        systemChromium: null,
        error: null,
    };

    try {
        diag.playwrightInstalled = true;
        // Try normal launch first
        try {
            const browser = await playwright.chromium.launch({ headless: true });
            diag.playwrightCanLaunch = true;
            await browser.close();
            console.log(JSON.stringify(diag, null, 2));
            process.exit(0);
        } catch (err) {
            // try system chromium
            const sys = findSystemChromium();
            if (sys) {
                diag.systemChromium = sys;
                try {
                    const browser = await playwright.chromium.launch({ headless: true, executablePath: sys, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
                    diag.playwrightCanLaunch = true;
                    diag.usedExecutablePath = sys;
                    await browser.close();
                    console.log(JSON.stringify(diag, null, 2));
                    process.exit(0);
                } catch (err2) {
                    diag.error = `system-chromium-launch-failed: ${err2 && err2.message}`;
                    console.error(JSON.stringify(diag, null, 2));
                    process.exit(2);
                }
            } else {
                diag.error = `playwright-launch-failed: ${err && err.message}`;
                console.error(JSON.stringify(diag, null, 2));
                process.exit(3);
            }
        }
    } catch (e) {
        diag.error = `unexpected: ${e && e.message}`;
        console.error(JSON.stringify(diag, null, 2));
        process.exit(4);
    }
}

probe();
