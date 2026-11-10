const express = require('express');
const { AffiliateConverter } = require('./service');

function createRouter(extractor) {
  const router = express.Router();
  const converter = new AffiliateConverter(extractor);

  router.post('/prepare', async (req, res) => {
    try {
      const result = await converter.prepare(req.body || {});
      res.json(result);
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.post('/confirm', async (req, res) => {
    try {
      const result = await converter.confirm(req.body || {});
      res.json(result);
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.get('/history', async (req, res) => {
    try {
      const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 30, 1), 100);
      res.json({ success: true, items: await converter.history(limit) });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return { router, converter };
}

module.exports = { createRouter };
