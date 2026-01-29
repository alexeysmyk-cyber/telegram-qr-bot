// misModule.js
module.exports = function initMisModule({
  bot,
  loadDB,
  saveDB,
  getUsername
}) {

  // ===== кнопка "Работа в МИС" =====
  bot.on('message', msg => {
    const chatId = msg.chat.id;
    if (msg.text !== '🏥 Работа в МИС') return;

    const db = loadDB();
    if (!db.whitelist.includes(chatId)) return;

    bot.sendMessage(chatId, '🏥 Работа в МИС', {
      reply_markup: {
        keyboard: [
          ['📅 Предстоящие визиты'],
          ['⬅️ Назад']
        ],
        resize_keyboard: true
      }
    });
  });

  // ===== callback'и МИС =====
  bot.on('callback_query', query => {
    const { data } = query;

    if (!data.startsWith('mis_')) return;

    if (data === 'mis_upcoming') {
      bot.answerCallbackQuery(query.id);
      bot.sendMessage(query.from.id, '📅 Предстоящие визиты (в разработке)');
    }
  });

};
