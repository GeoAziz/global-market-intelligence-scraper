const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

function toCsv(records) {
  if (!Array.isArray(records)) return '';
  const keys = Array.from(records.reduce((s, r) => { Object.keys(r).forEach(k => s.add(k)); return s; }, new Set()));
  const lines = [keys.join(',')];
  for (const r of records) {
    const row = keys.map(k => {
      const v = r[k] === undefined || r[k] === null ? '' : String(r[k]);
      // escape quotes
      return `"${v.replace(/"/g, '""')}"`;
    }).join(',');
    lines.push(row);
  }
  return lines.join('\n');
}

async function exportJsonToCsv(jsonPath, outPath) {
  const abs = path.resolve(jsonPath);
  const data = JSON.parse(fs.readFileSync(abs, 'utf8'));
  const csv = toCsv(data);
  fs.writeFileSync(outPath, csv);
  return outPath;
}

async function uploadToS3(filePath, bucket, key, region) {
  const client = new S3Client({ region: region || process.env.AWS_REGION || 'us-east-1' });
  const body = fs.readFileSync(filePath);
  const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, Body: body });
  return client.send(cmd);
}

module.exports = { toCsv, exportJsonToCsv, uploadToS3 };
