const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function run() {
  console.log('Running deterministic fixture smoke-run to produce sample_demo.json');
  execSync('node ./scripts/fixture_smoke_run.js', { stdio: 'inherit' });
  // pick the latest exports file
  const dir = path.join(process.cwd(), 'exports');
  const files = fs.readdirSync(dir).filter(f => f.startsWith('ci_smoke_output_') && f.endsWith('.json'));
  if (!files.length) {
    console.error('No smoke-run outputs found in exports/');
    process.exit(2);
  }
  files.sort();
  const latest = files[files.length - 1];
  const src = path.join(dir, latest);
  const dest = path.join(dir, 'sample_demo.json');
  fs.copyFileSync(src, dest);
  console.log('Sample demo output ready at', dest);
}

run().catch(e => { console.error(e && e.stack); process.exit(3); });
