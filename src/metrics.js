const client = require('prom-client');
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ timeout: 5000 });

const hfCalls = new client.Counter({ name: 'gmis_hf_calls_total', help: 'Total HF calls' });
const hfFailures = new client.Counter({ name: 'gmis_hf_failures_total', help: 'HF call failures' });
const cacheHits = new client.Counter({ name: 'gmis_cache_hits_total', help: 'Cache hits' });
const articlesProcessed = new client.Counter({ name: 'gmis_articles_processed_total', help: 'Articles processed' });
const summariesGenerated = new client.Counter({ name: 'gmis_summaries_generated_total', help: 'Summaries generated' });
const perSiteSuccess = new client.Counter({ name: 'gmis_site_success_total', help: 'Successful extractions per site', labelNames: ['site'] });
const requestLatency = new client.Histogram({ name: 'gmis_request_latency_seconds', help: 'Request latency seconds', buckets: [0.1, 0.5, 1, 2, 5, 10] });

module.exports = {
    client,
    hfCalls,
    hfFailures,
    cacheHits,
    articlesProcessed,
    summariesGenerated,
    metricsEndpoint: async (req, res) => {
        res.setHeader('Content-Type', client.register.contentType);
        res.end(await client.register.metrics());
    }
};
