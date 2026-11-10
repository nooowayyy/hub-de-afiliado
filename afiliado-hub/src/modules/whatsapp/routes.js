const express = require('express');

function createWhatsAppRouter(service) {
  const router = express.Router();

  router.get('/status', (_req, res) => res.json(service.getStatus()));

  router.post('/connect', async (_req, res) => {
    try {
      const result = await service.connect();
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message, ...service.getStatus() });
    }
  });

  router.post('/disconnect', async (_req, res) => {
    try {
      res.json({ success: true, ...await service.disconnect() });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/groups', async (_req, res) => {
    try {
      res.json({ success: true, groups: await service.getGroups() });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  return router;
}

module.exports = { createWhatsAppRouter };
