const express = require('express');
const db = require('../../storage/database');

function createOffersRouter(converter, whatsapp) {
  const router = express.Router();

  router.post('/send', async (req, res) => {
    try {
      const payload = req.body || {};
      const conversion = await converter.findConfirmed(payload.originalUrl);
      if (!conversion || conversion.affiliateUrl !== String(payload.affiliateUrl || '').trim()) {
        return res.status(400).json({
          success: false,
          error: 'Confirme primeiro o link gerado pelo Gerador oficial do Mercado Livre. O link usado no envio precisa corresponder à conversão salva.'
        });
      }
      const result = await whatsapp.sendOffer(payload);
      await db.history.insert({
        type: 'WHATSAPP_OFFER',
        title: String(payload.title || '').trim(),
        originalUrl: conversion.originalUrl,
        affiliateUrl: conversion.affiliateUrl,
        affiliateLabel: conversion.affiliateLabel,
        chatId: String(payload.chatId || '').trim(),
        sentAt: new Date().toISOString(),
        result: 'SENT'
      });
      res.json(result);
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.get('/history', async (req, res) => {
    try {
      const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 30, 1), 100);
      const items = await db.history.find({}).sort({ sentAt: -1 }).limit(limit).exec();
      res.json({ success: true, items });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

module.exports = { createOffersRouter };
