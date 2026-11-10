const assert = require('assert');
const {
  validateProductUrl,
  validateAffiliateUrl,
  validateLabel
} = require('../src/modules/converter/validation');
const { makeSearchUrl } = require('../src/modules/extractor/search');

assert.equal(
  makeSearchUrl('monitor 27 polegadas'),
  'https://lista.mercadolivre.com.br/monitor-27-polegadas'
);
assert.match(
  validateProductUrl('https://www.mercadolivre.com.br/monitor/p/MLB123456'),
  /^https:\/\/www\.mercadolivre\.com\.br\//
);
assert.throws(() => validateProductUrl('https://lista.mercadolivre.com.br/monitor'));
assert.throws(() => validateProductUrl('https://example.com/produto/MLB123'));
assert.equal(validateLabel('campanha2026'), 'campanha2026');
assert.throws(() => validateLabel('Campanha 2026'));
assert.throws(() => validateLabel('campanha_2026'));
assert.throws(() => validateAffiliateUrl(
  'https://example.com/link',
  'https://www.mercadolivre.com.br/monitor/p/MLB123456'
));
assert.equal(
  validateAffiliateUrl('https://meli.la/abc123', 'https://www.mercadolivre.com.br/monitor/p/MLB123456'),
  'https://meli.la/abc123'
);
console.log('Validações básicas concluídas.');
