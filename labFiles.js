const fs = require('fs');
const path = require('path');

const LAB_DIR = path.join(__dirname, 'files', 'labs');

// гарантируем папку
if (!fs.existsSync(LAB_DIR)) {
  fs.mkdirSync(LAB_DIR, { recursive: true });
}

// сохранить PDF из base64
function saveLabFile(base64, appointmentId) {
  const buffer = Buffer.from(base64, 'base64');

  const fileName = `lab_${appointmentId}_${Date.now()}.pdf`;
  const filePath = path.join(LAB_DIR, fileName);

  fs.writeFileSync(filePath, buffer);

  return { fileName, filePath };
}

module.exports = { saveLabFile, LAB_DIR };
