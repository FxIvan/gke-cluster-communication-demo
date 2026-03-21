const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// ─────────────────────────────────────────────
//  CONFIGURACIÓN
//  En GKE real, CLUSTER_B_URL sería la External IP
//  del LoadBalancer del Cluster B, o su DNS interno:
//    http://products-service.default.svc.cluster.local:3001
// ─────────────────────────────────────────────
const CLUSTER_B_URL = process.env.CLUSTER_B_URL || 'http://localhost:3001';
const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────
//  HELPER: llamada HTTP hacia el Cluster B
// ─────────────────────────────────────────────
async function callClusterB(path) {
  const url = `${CLUSTER_B_URL}${path}`;
  console.log(`[Cluster A] → Forwarding to Cluster B: GET ${url}`);

  const response = await fetch(url);
  const body = await response.json();

  return { status: response.status, body };
}

// ─────────────────────────────────────────────
//  MIDDLEWARE: logging de cada request entrante
// ─────────────────────────────────────────────
app.use((req, _res, next) => {
  const time = new Date().toISOString();
  console.log(`[Cluster A] [${time}] ${req.method} ${req.originalUrl}`);
  next();
});

// ─────────────────────────────────────────────
//  HELPER: armar la respuesta enriquecida del gateway
// ─────────────────────────────────────────────
function gatewayResponse(upstreamBody) {
  return {
    gateway: {
      cluster: 'cluster-a',
      region: 'us-east1',
      requestId: crypto.randomUUID(),
      handledAt: new Date().toISOString(),
    },
    upstream: upstreamBody,
  };
}

// ─────────────────────────────────────────────
//  RUTAS
// ─────────────────────────────────────────────

// GET /api/products
// Opcionalmente filtra por ?category=electronics
app.get('/api/products', async (req, res) => {
  try {
    const query = req.query.category ? `?category=${req.query.category}` : '';
    const { status, body } = await callClusterB(`/products${query}`);
    return res.status(status).json(gatewayResponse(body));
  } catch (err) {
    console.error('[Cluster A] ✗ Cluster B unreachable:', err.message);
    return res.status(502).json({
      error: 'Bad Gateway',
      message: 'Could not reach Cluster B (products-service)',
      clusterBUrl: CLUSTER_B_URL,
      detail: err.message,
    });
  }
});

// GET /api/products/:id
app.get('/api/products/:id', async (req, res) => {
  try {
    const { status, body } = await callClusterB(`/products/${req.params.id}`);
    if (status === 404) {
      return res.status(404).json({ error: 'Product not found', id: req.params.id });
    }
    return res.status(status).json(gatewayResponse(body));
  } catch (err) {
    console.error('[Cluster A] ✗ Cluster B unreachable:', err.message);
    return res.status(502).json({
      error: 'Bad Gateway',
      message: 'Could not reach Cluster B (products-service)',
    });
  }
});

// GET /health — usado por el readinessProbe de Kubernetes
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    cluster: 'cluster-a',
    upstreamTarget: CLUSTER_B_URL,
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────
//  START
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   CLUSTER A — API Gateway (Express)      ║');
  console.log(`║   Running on http://localhost:${PORT}        ║`);
  console.log('║   Simulates an external GKE entry point  ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log(`Forwarding requests → Cluster B at: ${CLUSTER_B_URL}`);
  console.log('');
  console.log('Available endpoints:');
  console.log(`  GET http://localhost:${PORT}/api/products`);
  console.log(`  GET http://localhost:${PORT}/api/products/:id`);
  console.log(`  GET http://localhost:${PORT}/api/products?category=electronics`);
  console.log(`  GET http://localhost:${PORT}/health`);
  console.log('');
});