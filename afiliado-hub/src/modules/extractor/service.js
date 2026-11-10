const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { DATA_DIR } = require('../../config');
const { makeSearchUrl } = require('./search');

const PROFILE_DIR = path.join(DATA_DIR, 'mercado-livre-profile');


class MercadoLivreExtractor {
  constructor() {
    this.context = null;
    this.searchPage = null;
    this.portalPage = null;
    this.busy = false;
    this.state = {
      status: 'IDLE',
      message: 'Aguardando uma pesquisa.',
      query: '',
      quantity: 10,
      products: [],
      lastUpdated: null
    };
  }

  getState() {
    return { ...this.state, products: [...this.state.products] };
  }

  async ensureContext() {
    if (this.context) return this.context;
    fs.mkdirSync(PROFILE_DIR, { recursive: true });
    this.context = await chromium.launchPersistentContext(PROFILE_DIR, {
      headless: false,
      viewport: null,
      args: ['--start-maximized']
    });
    this.context.on('close', () => {
      this.context = null;
      this.searchPage = null;
      this.portalPage = null;
      if (!['IDLE', 'STOPPED'].includes(this.state.status)) {
        this.state.status = 'IDLE';
        this.state.message = 'A janela do navegador foi fechada.';
      }
    });
    const pages = this.context.pages();
    this.searchPage = pages[0] || await this.context.newPage();
    return this.context;
  }

  async startSearch({ query, quantity }) {
    const cleanQuery = String(query || '').trim();
    const parsedQuantity = Number.parseInt(quantity, 10);
    if (cleanQuery.length < 2) {
      throw new Error('Digite um termo de pesquisa com pelo menos 2 caracteres.');
    }
    if (!Number.isFinite(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 50) {
      throw new Error('A quantidade deve ser um número entre 1 e 50.');
    }
    if (this.busy) throw new Error('O navegador está ocupado com outra operação.');

    this.busy = true;
    this.state = {
      status: 'OPENING_BROWSER',
      message: 'Abrindo o Mercado Livre no navegador persistente.',
      query: cleanQuery,
      quantity: parsedQuantity,
      products: [],
      lastUpdated: new Date().toISOString()
    };

    try {
      await this.ensureContext();
      if (!this.searchPage || this.searchPage.isClosed()) {
        this.searchPage = await this.context.newPage();
      }
      await this.searchPage.goto(makeSearchUrl(cleanQuery), {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
      this.state.status = 'WAITING_FOR_USER';
      this.state.message = 'Confira a página aberta. Faça login manualmente ou conclua qualquer verificação solicitada. Quando os resultados estiverem visíveis, clique em “Capturar produtos” no painel.';
      this.state.lastUpdated = new Date().toISOString();
      return this.getState();
    } catch (error) {
      this.state.status = 'ERROR';
      this.state.message = `Não foi possível abrir a pesquisa: ${error.message}`;
      throw error;
    } finally {
      this.busy = false;
    }
  }

  async captureProducts() {
    if (!this.context || !this.searchPage || this.searchPage.isClosed()) {
      throw new Error('Inicie uma pesquisa para abrir o navegador antes de capturar produtos.');
    }
    if (this.busy) throw new Error('O navegador está ocupado com outra operação.');

    this.busy = true;
    this.state.status = 'CAPTURING';
    this.state.message = 'Lendo os produtos que estão visíveis na página aberta.';
    try {
      const products = await this.searchPage.evaluate((limit) => {
        const selectors = ['.poly-card', 'li.ui-search-layout__item', '.ui-search-result'];
        const nodes = new Set();
        for (const selector of selectors) {
          document.querySelectorAll(selector).forEach((node) => nodes.add(node));
        }

        const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();
        const output = [];
        const seen = new Set();

        for (const card of nodes) {
          if (output.length >= limit) break;
          const titleNode = card.querySelector(
            '.poly-component__title, .ui-search-item__title, h2, h3, [class*="title"]'
          );
          const titleLink = card.querySelector(
            'a.poly-component__title, a.ui-search-link, a[href*="/p/"], a[href*="MLB-"]'
          );
          const allAnchors = Array.from(card.querySelectorAll('a[href]'));
          const anchor = titleLink || allAnchors.find((item) => {
            const href = item.getAttribute('href') || '';
            const text = clean(item.innerText || item.getAttribute('aria-label'));
            return /^https?:/.test(href) && text.length > 8;
          });
          const href = anchor?.href || '';
          const title = clean(titleNode?.innerText || anchor?.innerText || anchor?.getAttribute('aria-label'));
          if (!title || !href || !/^https?:\/\//i.test(href) || seen.has(href)) continue;

          const fraction = clean(card.querySelector('.andes-money-amount__fraction')?.innerText);
          const decimal = clean(card.querySelector('.andes-money-amount__decimal')?.innerText);
          const symbol = clean(card.querySelector('.andes-money-amount__currency-symbol')?.innerText) || 'R$';
          let price = '';
          if (fraction) price = `${symbol} ${fraction}${decimal ? `,${decimal}` : ''}`;
          else {
            const priceNode = card.querySelector('[class*="price"]');
            price = clean(priceNode?.innerText).slice(0, 80);
          }

          seen.add(href);
          output.push({
            title: title.slice(0, 240),
            price: price || 'Preço não identificado',
            url: href
          });
        }
        return output;
      }, this.state.quantity);

      this.state.products = products;
      this.state.status = products.length ? 'RESULTS_READY' : 'NO_RESULTS';
      this.state.message = products.length
        ? `${products.length} produto(s) capturado(s). A extração considerou apenas os cards visíveis na página.`
        : 'Nenhum card de produto foi identificado. Confira se a página de resultados terminou de carregar e se não há uma verificação de segurança pendente.';
      this.state.lastUpdated = new Date().toISOString();
      return this.getState();
    } catch (error) {
      this.state.status = 'ERROR';
      this.state.message = `Falha ao capturar os produtos: ${error.message}`;
      throw error;
    } finally {
      this.busy = false;
    }
  }

  async openAffiliateGenerator(url) {
    if (!this.context) await this.ensureContext();
    if (this.portalPage && !this.portalPage.isClosed()) {
      await this.portalPage.close().catch(() => {});
    }
    this.portalPage = await this.context.newPage();
    await this.portalPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    return { opened: true };
  }

  async stop() {
    if (this.context) {
      const context = this.context;
      this.context = null;
      this.searchPage = null;
      this.portalPage = null;
      await context.close().catch(() => {});
    }
    this.state.status = 'STOPPED';
    this.state.message = 'Navegador fechado. O perfil local de sessão foi preservado.';
    this.state.lastUpdated = new Date().toISOString();
    return this.getState();
  }
}

module.exports = { MercadoLivreExtractor, PROFILE_DIR };
