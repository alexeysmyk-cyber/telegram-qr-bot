const fs = require('fs');
const path = require('path');

// 👉 ПАПКА ДЛЯ ХРАНЕНИЯ АНАЛИЗОВ
// будет: /app/data
const LAB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(process.cwd(), 'db.json');


// гарантируем, что папка существует
if (!fs.existsSync(LAB_DIR)) {
  fs.mkdirSync(LAB_DIR, { recursive: true });
  console.log('📂 Создана папка для анализов:', LAB_DIR);
}

// сохранить PDF из base64
function saveLabFile(base64, appointmentId) {
  const buffer = Buffer.from(base64, 'base64');

  const fileName = `lab_${appointmentId}_${Date.now()}.pdf`;
  const filePath = path.join(LAB_DIR, fileName);

  console.log('📂 СОХРАНЯЕМ ФАЙЛ АНАЛИЗОВ В:', filePath);

  fs.writeFileSync(filePath, buffer);

  return { fileName, filePath };
}

module.exports = { saveLabFile, LAB_DIR };
