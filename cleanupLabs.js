const fs = require('fs');
const path = require('path');

const LAB_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(__dirname, 'db.json');

const WEEK = 7 * 24 * 60 * 60 * 1000;
const LAB_HISTORY_KEEP = 90 * 24 * 60 * 60 * 1000; // 90 дней

function cleanupLabs() {

  console.log('🧹 Запуск авто-очистки анализов и истории...');

  const now = Date.now();

  // ===== 1. ЧИСТКА ФАЙЛОВ PDF =====

  if (fs.existsSync(LAB_DIR)) {

    const files = fs.readdirSync(LAB_DIR);

    for (const file of files) {

      const filePath = path.join(LAB_DIR, file);

      let stat;
      try {
        stat = fs.statSync(filePath);
      } catch {
        continue;
      }

      if (!stat.isFile()) continue;

      if (now - stat.mtimeMs > WEEK) {
        try {
          fs.unlinkSync(filePath);
          console.log('🗑 Удалён старый файл анализа:', file);
        } catch (e) {
          console.error('❌ Не удалось удалить файл:', file, e.message);
        }
      }
    }
  }

  // ===== 2. ЧИСТКА lab_history В DB =====

  if (!fs.existsSync(DB_FILE)) return;

  let db;
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    console.error('❌ Не удалось прочитать DB для очистки истории:', e.message);
    return;
  }

  if (!Array.isArray(db.lab_history)) {
    console.log('ℹ️ lab_history отсутствует, чистка не требуется');
    return;
  }

  const before = db.lab_history.length;

  db.lab_history = db.lab_history.filter(item => {
    if (!item.date) return false;
    return (now - new Date(item.date).getTime()) < LAB_HISTORY_KEEP;
  });

  const after = db.lab_history.length;

  if (before !== after) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    console.log(`🧹 lab_history очищен: было ${before}, стало ${after}`);
  } else {
    console.log('ℹ️ lab_history чистить не нужно');
  }
}

module.exports = { cleanupLabs };
