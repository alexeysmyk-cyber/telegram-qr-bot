const fs = require('fs');
const path = require('path');

// та же папка, куда мы сохраняем PDF
const LAB_DIR = path.join(__dirname, 'data');

const WEEK = 7 * 24 * 60 * 60 * 1000;

function cleanupLabs() {

  // если папки нет — просто выходим
  if (!fs.existsSync(LAB_DIR)) {
    console.log('⚠️ Папка с анализами не найдена, пропуск очистки:', LAB_DIR);
    return;
  }

  const now = Date.now();

  let files;
  try {
    files = fs.readdirSync(LAB_DIR);
  } catch (e) {
    console.error('❌ Не удалось прочитать папку анализов:', e.message);
    return;
  }

  for (const file of files) {

    const filePath = path.join(LAB_DIR, file);

    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch (e) {
      console.error('❌ Не удалось получить информацию о файле:', file, e.message);
      continue;
    }

    // пропускаем не-файлы (на случай папок)
    if (!stat.isFile()) continue;

    // старше недели?
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

module.exports = { cleanupLabs };
