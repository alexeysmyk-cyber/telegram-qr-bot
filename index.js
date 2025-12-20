

// === НАСТРОЙКИ ===
const TOKEN = '8482523179:AAFQzWkCz2LrkTWif6Jfn8sXQ-PVxbp0nvs';
const bot = new TelegramBot(TOKEN, { polling: true });

// Базовая ссылка НСПК
const BASE_URL = 'https://qr.nspk.ru/AS1A003RTQJV7SPH85OPSMRVK29EOS71';

// Базовые параметры
const BASE_PARAMS = {
  type: '01',
  bank: '100000000111',
  cur: 'RUB',
};

// === СТАРТ ===
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    '👋 Привет!\n\nОтправь сумму платежа в рублях.\nНапример:\n👉 150 или 99.50'
  );
});

// === ОБРАБОТКА СООБЩЕНИЙ ===
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text || text.startsWith('/')) return;

  const rubles = parseFloat(text.replace(',', '.'));
  if (isNaN(rubles) || rubles <= 0) {
    return bot.sendMessage(chatId, '❌ Введите корректную сумму, например 150.50');
  }

  const kop = Math.round(rubles * 100);

  // Формируем ссылку
  const params = {
    ...BASE_PARAMS,
    sum: kop.toString(),
  };

  const query = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const payLink = `${BASE_URL}?${query}`;

  // QR через бесплатный API
  const qrUrl =
    'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' +
    encodeURIComponent(payLink);

  // Отправляем QR + ссылку
  await bot.sendPhoto(chatId, qrUrl, {
    caption:
      `💰 Сумма: ${rubles} ₽\n` +
      `🔢 В копейках: ${kop}\n\n` +
      `🔗 Ссылка:\n${payLink}`,
  });
});

console.log('🤖 Bot started and ready');

