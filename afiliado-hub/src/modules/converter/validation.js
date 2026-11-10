const ALLOWED_HOSTS = new Set([
  'mercadolivre.com.br',
  'www.mercadolivre.com.br',
  'produto.mercadolivre.com.br',
  'mercadolivre.com',
  'www.mercadolivre.com',
  'meli.la'
]);

function parseHttpsUrl(value, fieldName) {
  let parsed;
  try {
    parsed = new URL(String(value || '').trim());
  } catch {
    throw new Error(`${fieldName} precisa ser uma URL válida.`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`${fieldName} precisa usar HTTPS.`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${fieldName} não pode conter usuário ou senha embutidos na URL.`);
  }
  return parsed;
}

function validateProductUrl(value) {
  const url = parseHttpsUrl(value, 'Link do produto');
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase()) || url.hostname.toLowerCase() === 'meli.la') {
    throw new Error('Por enquanto, somente links do Mercado Livre Brasil são aceitos.');
  }
  if (!/(\/p\/|MLB-)/i.test(url.pathname)) {
    throw new Error('Informe o link de uma página específica de produto, não uma busca ou página geral.');
  }
  return url.toString();
}

function validateAffiliateUrl(value, originalUrl) {
  const url = parseHttpsUrl(value, 'Link de afiliado');
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error('O link informado não pertence a um domínio aceito do Mercado Livre.');
  }
  if (url.toString() === originalUrl) {
    throw new Error('O link confirmado é igual ao link original. Cole o link novo que o Gerador de Links criou.');
  }
  return url.toString();
}

function validateLabel(label) {
  const clean = String(label || '').trim();
  if (!clean) throw new Error('Informe a etiqueta que você selecionou no Gerador de Links.');
  if (clean.length > 30 || !/^[a-z0-9]+$/.test(clean)) {
    throw new Error('A etiqueta deve ter até 30 caracteres, apenas com letras minúsculas e números, sem espaços ou caracteres especiais.');
  }
  return clean;
}

module.exports = {
  ALLOWED_HOSTS,
  parseHttpsUrl,
  validateProductUrl,
  validateAffiliateUrl,
  validateLabel
};
