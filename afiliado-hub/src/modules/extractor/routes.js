const express = require('express');
const { MercadoLivreExtractor } = require('./service');

const router = express.Router();
const extractor = new MercadoLivreExtractor();

router.get('/status', (_req, res) => res.json(extractor.getState()));

router.post('/start', async (req, res) => {
  try {
    const result = await extractor.startSearch(req.body || {});
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message, state: extractor.getState() });
  }
});

router.post('/capture', async (_req, res) => {
  try {
    const result = await extractor.captureProducts();
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message, state: extractor.getState() });
  }
});

router.post('/stop', async (_req, res) => {
  try {
    res.json({ success: true, ...(await extractor.stop()) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = { router, extractor };
