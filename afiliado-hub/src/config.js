const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const dataSetting = process.env.DATA_DIR || './data';
const DATA_DIR = path.isAbsolute(dataSetting)
  ? dataSetting
  : path.resolve(ROOT_DIR, dataSetting);

module.exports = {
  ROOT_DIR,
  DATA_DIR,
  PORT: Number.parseInt(process.env.PORT || '3000', 10),
  ML_AFFILIATE_GENERATOR_URL:
    process.env.ML_AFFILIATE_GENERATOR_URL ||
    'https://www.mercadolivre.com.br/l/afiliados-gerar-link'
};
