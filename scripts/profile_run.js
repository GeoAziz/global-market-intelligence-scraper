const { spawn } = require('child_process');
const pidusage = require('pidusage');
const fs = require('fs');
const path = require('path');

async function runProfile() {
  const outDir = path.join(process.cwd(), 'exports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  console.log('Starting profiling run (demo)...');
  const child = spawn('node', ['./scripts/demo_run.js'], { stdio: ['ignore', 'pipe', 'pipe'] });

  const pid = child.pid;
  console.log('Spawned demo as PID', pid);

  let peakMemory = 0;
  let peakCpu = 0;
  const samples = [];
  const start = Date.now();

  const poll = setInterval(async () => {
    try {
      const stat = await pidusage(pid);
      peakMemory = Math.max(peakMemory, stat.memory);
      peakCpu = Math.max(peakCpu, stat.cpu);
      samples.push({ t: Date.now() - start, memory: stat.memory, cpu: stat.cpu });
    } catch (e) {
      // process may have exited
    }
  }, 500);

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', d => { stdout += d.toString(); process.stdout.write(d); });
  child.stderr.on('data', d => { stderr += d.toString(); process.stderr.write(d); });

  child.on('close', (code) => {
    clearInterval(poll);
    const duration = Date.now() - start;
    const report = {
      pid,
      exitCode: code,
      durationMs: duration,
      peakMemoryBytes: peakMemory,
      peakCpuPercent: peakCpu,
      samplesCount: samples.length,
      samples,
      stdout: stdout.slice(0, 8192),
      stderr: stderr.slice(0, 8192),
      timestamp: new Date().toISOString(),
    };
  const ts = Date.now();
  const outFile = path.join(outDir, `profile_report_${ts}.json`);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  // Also write a small human-readable markdown summary for quick inspection
  const md = [];
  md.push('# Profile report');
  md.push(`Generated: ${report.timestamp}`);
  md.push(`- PID: ${report.pid}`);
  md.push(`- Exit code: ${report.exitCode}`);
  md.push(`- Duration: ${(report.durationMs / 1000).toFixed(2)}s`);
  md.push(`- Peak memory: ${(report.peakMemoryBytes / (1024*1024)).toFixed(2)} MB`);
  md.push(`- Peak CPU: ${report.peakCpuPercent.toFixed(2)}%`);
  md.push(`- Samples: ${report.samplesCount}`);
  md.push('Files:');
  md.push(`- JSON: ${path.basename(outFile)}`);
  const mdFile = path.join(outDir, `profile_report_${ts}.md`);
  fs.writeFileSync(mdFile, md.join('\n'));
  console.log('Profile run complete. Reports:', outFile, mdFile);
    process.exit(code || 0);
  });
}

runProfile().catch(e => { console.error(e && e.stack); process.exit(2); });
