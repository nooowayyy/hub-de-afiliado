const { randomUUID } = require('crypto');
const db = require('../../storage/database');
const { ML_AFFILIATE_GENERATOR_URL } = require('../../config');

const { validateProductUrl, validateAffiliateUrl, validateLabel } = require('./validation');

class AffiliateConverter {
  constructor(extractor) {
    this.extractor = extractor;
  }

  async prepare({ originalUrl, title, label }) {
    const productUrl = validateProductUrl(originalUrl);
    const affiliateLabel = validateLabel(label);
    const record = {
      id: randomUUID(),
      originalUrl: productUrl,
      title: String(title || '').trim().slice(0, 240),
      affiliateLabel,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };
    await db.affiliateLinks.insert(record);

    let opened = false;
    let browserMessage = '';
    try {
      await this.extractor.openAffiliateGenerator(ML_AFFILIATE_GENERATOR_URL);
      opened = true;
    } catch (error) {
      browserMessage = `Não consegui abrir o gerador dentro da janela automatizada: ${error.message}. Abra o endereço oficial manualmente.`;
    }

    return {
      success: true,
      pendingId: record.id,
      originalUrl: productUrl,
      title: record.title,
      affiliateLabel,
      generatorUrl: ML_AFFILIATE_GENERATOR_URL,
      openedInPersistentBrowser: opened,
      message: opened
        ? 'O Gerador de Links foi aberto na mesma sessão persistente. Cole o link original, selecione a etiqueta informada e gere o link.'
        : browserMessage
    };
  }

  async confirm({ pendingId, originalUrl, affiliateUrl, label }) {
    const cleanOriginal = validateProductUrl(originalUrl);
    const cleanAffiliate = validateAffiliateUrl(affiliateUrl, cleanOriginal);
    const cleanLabel = validateLabel(label);
    let pending = null;
    if (pendingId) pending = await db.affiliateLinks.findOne({ id: pendingId, status: 'PENDING' });
    if (!pending) pending = await db.affiliateLinks.findOne({ originalUrl: cleanOriginal, status: 'PENDING' });
    if (!pending) throw new Error('Não encontrei uma conversão pendente para esse produto. Clique em “Preparar link oficial” novamente.');
    if (pending.affiliateLabel !== cleanLabel) {
      throw new Error('A etiqueta confirmada não corresponde à etiqueta usada ao preparar o link.');
    }

    const updated = {
      ...pending,
      affiliateUrl: cleanAffiliate,
      status: 'CONFIRMED_BY_USER',
      confirmedAt: new Date().toISOString()
    };
    await db.affiliateLinks.update(
      { id: pending.id },
      { $set: { affiliateUrl: cleanAffiliate, status: 'CONFIRMED_BY_USER', confirmedAt: updated.confirmedAt } }
    );
    return { success: true, conversion: await db.affiliateLinks.findOne({ id: pending.id }) };
  }

  async findConfirmed(originalUrl) {
    const clean = validateProductUrl(originalUrl);
    const matches = await db.affiliateLinks
      .find({ originalUrl: clean, status: 'CONFIRMED_BY_USER' })
      .sort({ confirmedAt: -1 })
      .limit(1)
      .exec();
    return matches[0] || null;
  }

  async history(limit = 50) {
    return db.affiliateLinks.find({}).sort({ createdAt: -1 }).limit(limit).exec();
  }
}

module.exports = {
  AffiliateConverter,
};
