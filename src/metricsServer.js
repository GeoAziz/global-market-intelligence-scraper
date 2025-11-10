const http = require('http');
const client = require('prom-client');

const port = process.env.METRICS_PORT ? parseInt(process.env.METRICS_PORT, 10) : 9400;

// Default metrics
client.collectDefaultMetrics({ timeout: 5000 });

const server = http.createServer(async (req, res) => {
    if (req.url === '/metrics') {
        res.setHeader('Content-Type', client.register.contentType);
        res.end(await client.register.metrics());
    } else {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('GMIS metrics server. Visit /metrics');
    }
});

server.listen(port, () => {
    console.log(`GMIS metrics server listening on http://localhost:${port}/metrics`);
});

process.on('SIGINT', () => process.exit(0));
