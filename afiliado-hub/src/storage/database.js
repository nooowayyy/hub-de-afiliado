const fs = require('fs');
const path = require('path');
const Datastore = require('nedb-promises');
const { DATA_DIR } = require('../config');

fs.mkdirSync(DATA_DIR, { recursive: true });

function collection(name) {
  return Datastore.create({
    filename: path.join(DATA_DIR, `${name}.db`),
    autoload: true,
    timestampData: true
  });
}

module.exports = {
  settings: collection('settings'),
  history: collection('history'),
  affiliateLinks: collection('affiliate-links')
};
