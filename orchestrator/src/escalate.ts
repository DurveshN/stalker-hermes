import { config } from "./config.js";

// Telegram delivery. Escalations reach the human on the same surface Hermes
// uses — text brief + an ElevenLabs voice note.
async function tg(method: string, body: Record<string, unknown>): Promise<boolean> {
  if (!config.telegram.enabled) return false;
  const res = await fetch(
    `https://api.telegram.org/bot${config.telegram.botToken}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: config.telegram.chatId, ...body }),
    },
  );
  if (!res.ok) console.error(`telegram ${method} failed`, res.status, await res.text());
  return res.ok;
}

export async function sendText(text: string): Promise<boolean> {
  return tg("sendMessage", { text, parse_mode: "Markdown", disable_web_page_preview: false });
}

// Send mp3 as an audio message (plays inline in Telegram).
export async function sendVoiceNote(audio: Buffer, caption: string): Promise<boolean> {
  if (!config.telegram.enabled) return false;
  const form = new FormData();
  form.append("chat_id", config.telegram.chatId);
  form.append("caption", caption.slice(0, 1000));
  form.append(
    "audio",
    new Blob([new Uint8Array(audio)], { type: "audio/mpeg" }),
    "intel-brief.mp3",
  );
  const res = await fetch(
    `https://api.telegram.org/bot${config.telegram.botToken}/sendAudio`,
    { method: "POST", body: form },
  );
  if (!res.ok) console.error("telegram sendAudio failed", res.status, await res.text());
  return res.ok;
}
