const fs = require('fs');
const path = require('path');
const { LAB_DIR } = require('./labFiles');

const WEEK = 7 * 24 * 60 * 60 * 1000;

function cleanupLabs() {
  const now = Date.now();

  const files = fs.readdirSync(LAB_DIR);

  for (const file of files) {
    const filePath = path.join(LAB_DIR, file);
    const stat = fs.statSync(filePath);

    if (now - stat.mtimeMs > WEEK) {
      fs.unlinkSync(filePath);
      console.log('🗑 Удалён старый файл анализа:', file);
    }
  }
}

module.exports = { cleanupLabs };
