const fs = require('fs');
const path = require('path');
const express = require('express');
const { PORT, ROOT_DIR, DATA_DIR } = require('./config');
const { router: extractorRouter, extractor } = require('./modules/extractor/routes');
const { createRouter: createConverterRouter } = require('./modules/converter/routes');
const { WhatsAppService } = require('./modules/whatsapp/service');
const { createWhatsAppRouter } = require('./modules/whatsapp/routes');
const { AffiliateConverter } = require('./modules/converter/service');
const { createOffersRouter } = require('./modules/offers/routes');

fs.mkdirSync(DATA_DIR, { recursive: true });
const app = express();
const whatsapp = new WhatsAppService();
const converter = new AffiliateConverter(extractor);

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(ROOT_DIR, 'public')));

app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'Afiliado Hub', time: new Date().toISOString() }));
app.use('/api/extractor', extractorRouter);
app.use('/api/converter', createConverterRouter(extractor).router);
app.use('/api/whatsapp', createWhatsAppRouter(whatsapp));
app.use('/api/offers', createOffersRouter(converter, whatsapp));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Rota de API não encontrada.' }));
app.get('*', (_req, res) => res.sendFile(path.join(ROOT_DIR, 'public', 'index.html')));

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`Afiliado Hub disponível em http://localhost:${PORT}`);
  console.log('A interface é local. Não compartilhe a pasta data/ ou os perfis de sessão.');
});

async function shutdown(signal) {
  console.log(`\n${signal}: encerrando serviços...`);
  server.close();
  await Promise.allSettled([extractor.stop(), whatsapp.disconnect()]);
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
