import { config } from "./config.js";
import { convex, api } from "./convexClient.js";

// ElevenLabs TTS → mp3 bytes. Voice does real work: the crew's brief is
// delivered as an audible intel briefing (power-up).
export async function synthesizeVoice(text: string): Promise<Buffer | null> {
  if (!config.elevenlabs.enabled) return null;
  const clipped = text.slice(0, 2500); // keep briefs short + cheap
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${config.elevenlabs.voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": config.elevenlabs.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: clipped,
        model_id: "eleven_turbo_v2_5",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    },
  );
  if (!res.ok) {
    console.error("ElevenLabs error", res.status, await res.text());
    return null;
  }
  return Buffer.from(await res.arrayBuffer());
}

// Store audio in Convex file storage → durable URL for dashboard + alert record.
export async function uploadVoiceToConvex(audio: Buffer): Promise<string | null> {
  try {
    const uploadUrl = await convex.mutation(api.files.generateUploadUrl, {});
    const up = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "audio/mpeg" },
      body: audio,
    });
    const { storageId } = (await up.json()) as { storageId: string };
    const url = await convex.query(api.files.getUrl, { storageId: storageId as any });
    return url ?? null;
  } catch (e) {
    console.error("voice upload failed", e);
    return null;
  }
}
