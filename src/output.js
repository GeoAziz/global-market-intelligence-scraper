const Apify = require('apify');
const fs = require('fs');
const path = require('path');
const log = require('../utils/logger');

async function saveToDataset(record) {
    try {
        // Normalize dataset record with provenance fields
        const rec = Object.assign({
            model: record.summaryModel || record.model || process.env.SUMMARY_MODEL || 'extractive-fallback',
            modelVersion: record.summaryModelVersion || record.modelVersion || process.env.SUMMARY_MODEL_VERSION || null,
            cached: record.cached || false,
            cachedAt: record.cachedAt || null,
        }, record);

        if (typeof Apify.Actor !== 'undefined' && typeof Apify.Actor.pushData === 'function') {
            await Apify.Actor.pushData(rec);
        } else if (typeof Apify.pushData === 'function') {
            await Apify.pushData(rec);
        } else {
            // Fallback: append to local file for demo
            const outDir = process.env.LOCAL_DATASET_DIR || 'exports';
            if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
            const fname = path.join(outDir, 'local_dataset.ndjson');
            fs.appendFileSync(fname, JSON.stringify(rec) + '\n');
        }
        log.info('Saved record to dataset', { url: record.link });
    } catch (err) {
        log.error('Failed to save to dataset', { err: err && err.message });
        throw err;
    }
}

async function exportToFile(records, { dir = 'exports', format = 'json' } = {}) {
    try {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = path.join(dir, `gmis_${ts}.${format}`);
        if (format === 'json') {
                fs.writeFileSync(filename, JSON.stringify(records, null, 2));
            } else if (format === 'ndjson') {
                const stream = records.map(r => JSON.stringify(r)).join('\n') + '\n';
                fs.writeFileSync(filename, stream);
            } else if (format === 'csv') {
            // Simple CSV export
            const keys = Object.keys(records[0] || {});
            const lines = [keys.join(',')].concat(records.map(r => keys.map(k => `"${String(r[k] || '')}"`).join(',')));
            fs.writeFileSync(filename, lines.join('\n'));
        }
        log.info('Exported file', { filename });
        return filename;
    } catch (err) {
        log.error('Export failed', { err: err && err.message });
        return null;
    }
}

module.exports = { saveToDataset, exportToFile };
