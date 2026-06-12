// Telegram's HTML parse mode rejects the whole message (400) on stray
// < > &, so user-controlled text must be escaped or the notification is
// silently lost while the submitter still gets a success response.
var TELEGRAM_MAX_LENGTH = 4096;

function escapeTelegram(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sendTelegramMessage(text) {
  var token = process.env.TELEGRAM_BOT_TOKEN;
  var chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn('Telegram not configured — skipping notification');
    return Promise.resolve();
  }

  var body = text.length > TELEGRAM_MAX_LENGTH
    ? text.slice(0, TELEGRAM_MAX_LENGTH - 1) + '…'
    : text;

  return fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: body,
      parse_mode: 'HTML',
    }),
  }).then(function (r) {
    if (!r.ok) return r.json().then(function (e) { throw e; });
    return r.json();
  }).catch(function (err) {
    console.error('Telegram notification failed:', err && err.description ? err.description : err);
    throw err;
  });
}

module.exports = { sendTelegramMessage, escapeTelegram, TELEGRAM_MAX_LENGTH };
