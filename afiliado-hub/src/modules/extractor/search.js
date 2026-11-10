function makeSearchUrl(query) {
  const slug = String(query || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('-');
  return `https://lista.mercadolivre.com.br/${slug}`;
}

module.exports = { makeSearchUrl };
