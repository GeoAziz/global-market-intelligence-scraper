#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const EXPORTS_DIR = path.resolve(__dirname, '..', 'exports');
const MAX_MEM_MB = Number(process.env.PROFILE_MAX_MEMORY_MB || 200); // MB
const MAX_DURATION_MS = Number(process.env.PROFILE_MAX_DURATION_MS || 120000); // ms

function findLatestProfile() {
  if (!fs.existsSync(EXPORTS_DIR)) return null;
  const files = fs.readdirSync(EXPORTS_DIR)
    .filter(f => f.startsWith('profile_report_') && f.endsWith('.json'))
    .map(f => ({ f, t: fs.statSync(path.join(EXPORTS_DIR, f)).mtimeMs }))
    .sort((a,b) => b.t - a.t);
  return files.length ? path.join(EXPORTS_DIR, files[0].f) : null;
}

const f = findLatestProfile();
if (!f) {
  console.warn('No profile report found in exports/. Skipping guard.');
  process.exit(0);
}

let raw;
try { raw = fs.readFileSync(f, 'utf8'); } catch (e) { console.error('Failed to read profile file:', e.message); process.exit(2); }
let json;
try { json = JSON.parse(raw); } catch (e) { console.error('Profile file is not valid JSON:', e.message); process.exit(2); }

const durationMs = Number(json.durationMs || 0);
const peakMemoryBytes = Number(json.peakMemoryBytes || 0);
const peakMemoryMb = Math.round(peakMemoryBytes / (1024*1024));

console.log('Profile guard checking', f);
console.log(`Duration: ${durationMs} ms  Peak memory: ${peakMemoryMb} MB`);
console.log(`Thresholds -> maxDurationMs: ${MAX_DURATION_MS} ms, maxMemoryMB: ${MAX_MEM_MB} MB`);

if (durationMs > MAX_DURATION_MS) {
  console.error(`Profile duration ${durationMs}ms exceeds threshold ${MAX_DURATION_MS}ms`);
  process.exit(3);
}

if (peakMemoryMb > MAX_MEM_MB) {
  console.error(`Peak memory ${peakMemoryMb}MB exceeds threshold ${MAX_MEM_MB}MB`);
  process.exit(4);
}

console.log('Profile guard: OK');
process.exit(0);
