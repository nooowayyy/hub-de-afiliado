const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { DATA_DIR } = require('../../config');

const AUTH_DIR = path.join(DATA_DIR, 'whatsapp-auth');

class WhatsAppService {
  constructor() {
    this.client = null;
    this.qrCodeDataUrl = '';
    this.status = 'DESCONECTADO';
    this.message = 'WhatsApp ainda não foi iniciado.';
    this.lastError = '';
  }

  getStatus() {
    return {
      status: this.status,
      qrCode: this.qrCodeDataUrl,
      message: this.message,
      lastError: this.lastError
    };
  }

  async connect() {
    if (this.client) {
      return { success: true, message: 'O cliente do WhatsApp já está inicializando ou conectado.', ...this.getStatus() };
    }

    fs.mkdirSync(AUTH_DIR, { recursive: true });
    this.status = 'INICIALIZANDO';
    this.message = 'Iniciando o WhatsApp Web. O QR aparecerá nesta tela se for necessário.';
    this.lastError = '';

    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: 'afiliado-hub',
        dataPath: AUTH_DIR
      }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      },
    });
    this.client = client;

    client.on('qr', async (qr) => {
      try {
        this.qrCodeDataUrl = await QRCode.toDataURL(qr, {
          errorCorrectionLevel: 'M',
          margin: 2,
          width: 300,
          color: { dark: '#101827', light: '#ffffff' }
        });
        this.status = 'AGUARDANDO_QR';
        this.message = 'Leia o QR Code com o WhatsApp do celular. O código está nesta tela, não no terminal.';
      } catch (error) {
        this.status = 'ERRO';
        this.lastError = error.message;
        this.message = 'Não foi possível renderizar o QR Code.';
      }
    });

    client.on('authenticated', () => {
      this.status = 'AUTENTICADO';
      this.qrCodeDataUrl = '';
      this.message = 'Autenticação concluída. Finalizando a conexão do WhatsApp Web.';
    });

    client.on('ready', () => {
      this.status = 'CONECTADO';
      this.qrCodeDataUrl = '';
      this.message = 'WhatsApp conectado. Sua sessão local foi salva.';
      this.lastError = '';
    });

    client.on('auth_failure', (reason) => {
      this.status = 'ERRO';
      this.lastError = String(reason || 'Falha de autenticação');
      this.message = 'A autenticação falhou. Tente conectar novamente e, se necessário, refaça o pareamento.';
      this.client = null;
      client.destroy().catch(() => {});
    });

    client.on('disconnected', (reason) => {
      this.status = 'DESCONECTADO';
      this.qrCodeDataUrl = '';
      this.message = `WhatsApp desconectado${reason ? `: ${reason}` : '.'}`;
      this.client = null;
    });

    try {
      await client.initialize();
      return { success: true, ...this.getStatus() };
    } catch (error) {
      this.status = 'ERRO';
      this.lastError = error.message;
      this.message = 'Não foi possível iniciar o WhatsApp Web.';
      this.client = null;
      throw error;
    }
  }

  async getGroups() {
    if (!this.client || this.status !== 'CONECTADO') {
      throw new Error('Conecte o WhatsApp antes de carregar os grupos.');
    }
    const chats = await this.client.getChats();
    return chats
      .filter((chat) => chat.isGroup)
      .map((chat) => ({ id: chat.id._serialized, name: chat.name || 'Grupo sem nome' }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  async sendOffer({ chatId, title, affiliateUrl, price, installments, coupon, imageUrl }) {
    if (!this.client || this.status !== 'CONECTADO') {
      throw new Error('WhatsApp não está conectado.');
    }
    const target = String(chatId || '').trim();
    if (!/@g\.us$/.test(target)) {
      throw new Error('Selecione um grupo válido, cujo identificador termina em @g.us.');
    }
    const productTitle = String(title || '').trim();
    const link = String(affiliateUrl || '').trim();
    if (!productTitle || !link) throw new Error('Título e link oficial de afiliado são obrigatórios.');
    let parsed;
    try { parsed = new URL(link); } catch { throw new Error('O link de afiliado não é uma URL válida.'); }
    if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('O link de afiliado deve usar HTTP ou HTTPS.');

    let messageText = `💵 *${String(price || '').trim() || 'Confira o preço no anúncio'}*\n`;
    if (installments) messageText += `⭐ Em até ${String(installments).trim()}\n`;
    if (coupon) messageText += `🎟️ Use o cupom: *${String(coupon).trim()}*\n`;
    messageText += `🔗 *Acesse aqui:* ${link}\n\n`;
    messageText += '▶️ Confira as condições diretamente no Mercado Livre.';

    if (imageUrl) {
      let image;
      try {
        const imageParsed = new URL(imageUrl);
        const hostname = imageParsed.hostname.toLowerCase();
        const isLocalHost = hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') ||
          /^127\./.test(hostname) || /^10\./.test(hostname) || /^192\.168\./.test(hostname) ||
          /^169\.254\./.test(hostname) || /^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname) || hostname === '::1' || hostname === '[::1]';
        if (imageParsed.protocol !== 'https:' || isLocalHost) throw new Error('Use uma URL HTTPS pública para a imagem');
        image = await MessageMedia.fromUrl(imageParsed.toString(), { unsafeMime: false });
      } catch (error) {
        throw new Error(`Não consegui carregar a imagem informada: ${error.message}`);
      }
      await this.client.sendMessage(target, image, { caption: `*${productTitle}*\n\n${messageText}` });
    } else {
      await this.client.sendMessage(target, `*${productTitle}*\n\n${messageText}`);
    }
    return { success: true, message: 'Oferta enviada.', chatId: target };
  }

  async disconnect() {
    const client = this.client;
    this.client = null;
    this.qrCodeDataUrl = '';
    if (client) await client.destroy().catch(() => {});
    this.status = 'DESCONECTADO';
    this.message = 'WhatsApp desconectado. A sessão salva foi mantida.';
    return this.getStatus();
  }
}

module.exports = { WhatsAppService };
