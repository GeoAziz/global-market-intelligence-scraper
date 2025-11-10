const path = require('path');
const fs = require('fs');
const { exportJsonToCsv, uploadToS3 } = require('../src/exporter');

async function run() {
  const file = process.argv[2] || 'exports/ci_smoke_output.json';
  const csvOut = (process.argv[3]) || file.replace(/\.json$/, '.csv');
  if (!fs.existsSync(file)) {
    console.error('Input file not found:', file);
    process.exit(2);
  }
  await exportJsonToCsv(file, csvOut);
  console.log('Wrote CSV:', csvOut);
  const bucket = process.env.S3_BUCKET;
  if (bucket) {
    const key = process.env.S3_KEY || path.basename(csvOut);
    await uploadToS3(csvOut, bucket, key, process.env.AWS_REGION);
    console.log('Uploaded to s3://', bucket, '/', key);
  }
}

run().catch(e => { console.error(e); process.exit(3); });
