/**
 * Cloudflare Email Worker — receives inbound email for
 * maxtheodore@carlingtonburling.com and forwards it as JSON
 * to the Express inbox API.
 *
 * Deploy: npx wrangler deploy workers/email-worker.js
 *   --name carlington-inbound
 *   --var INBOUND_WEBHOOK_URL:https://carlingtonburling.com/api/inbound/cloudflare
 *   --secret INBOUND_SECRET
 *
 * MX records (set in Cloudflare DNS):
 *   route1.mx.cloudflare.net  priority 10
 *   route2.mx.cloudflare.net  priority 20
 *   route3.mx.cloudflare.net  priority 30
 */

export default {
  async email(message, env) {
    var raw = await new Response(message.raw).text();

    var payload = {
      from: message.from,
      to: message.to,
      subject: message.headers.get('subject') || '',
      messageId: message.headers.get('message-id') || '',
      raw: raw,
    };

    await fetch(env.INBOUND_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + env.INBOUND_SECRET,
      },
      body: JSON.stringify(payload),
    });
  },
};
