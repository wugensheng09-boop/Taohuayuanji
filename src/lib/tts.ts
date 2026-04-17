import { postUpstreamJson } from "@/lib/upstream-api";

export interface NpcVoiceProfile {
  profileId: string;
  voice: string;
  /** Playback speed multiplier (0.5 ~ 2.0). Lower = slower. */
  speed: number;
}

export interface TtsPacket {
  audioBase64: string;
  mimeType: string;
  syncWeights: number[];
  voiceProfile: string;
  /** Suggested playback rate for the Audio element */
  playbackRate: number;
}

function resolveVoiceForNpc(npcId: string): NpcVoiceProfile {
  if (npcId === "aqiao") {
    return {
      profileId: "young_male",
      voice: process.env.TTS_VOICE_AQIAO ?? "Noah",
      speed: 0.92,
    };
  }
  if (npcId === "chief") {
    return {
      profileId: "elder_male",
      voice: process.env.TTS_VOICE_CHIEF ?? "Eric",
      speed: 0.82,
    };
  }
  if (npcId === "peer_fisher") {
    return {
      profileId: "adult_male",
      voice: process.env.TTS_VOICE_PEER ?? "Roger",
      speed: 0.95,
    };
  }
  return {
    profileId: "narrator",
    voice: process.env.TTS_VOICE_DEFAULT ?? "Brenda",
    speed: 0.85,
  };
}

function buildSyncWeights(text: string): number[] {
  const chars = Array.from(text);
  if (chars.length === 0) {
    return [];
  }
  return chars.map((ch) => {
    if (/\s/.test(ch)) return 0.08;
    if (/[，；：]/.test(ch)) return 0.75;
    if (/[。！？!?]/.test(ch)) return 1.15;
    if (/["“”()（）《》【】…]/.test(ch)) return 0.45;
    if (/[a-zA-Z0-9]/.test(ch)) return 0.75;
    return 1;
  });
}

export async function synthesizeNpcTts(npcId: string, text: string): Promise<TtsPacket | null> {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  const voiceProfile = resolveVoiceForNpc(npcId);

  try {
    const payload = await postUpstreamJson<Partial<TtsPacket>>({
      path: "/tts",
      body: {
        npcId,
        text: trimmed,
        voiceProfile,
      },
      timeoutMs: 18000,
    });

    if (!payload.audioBase64 || !payload.mimeType) {
      return null;
    }

    return {
      audioBase64: payload.audioBase64,
      mimeType: payload.mimeType,
      syncWeights:
        Array.isArray(payload.syncWeights) && payload.syncWeights.length > 0
          ? payload.syncWeights
          : buildSyncWeights(trimmed),
      voiceProfile:
        typeof payload.voiceProfile === "string" && payload.voiceProfile.trim().length > 0
          ? payload.voiceProfile
          : voiceProfile.profileId,
      playbackRate:
        typeof payload.playbackRate === "number" && Number.isFinite(payload.playbackRate)
          ? payload.playbackRate
          : voiceProfile.speed,
    };
  } catch {
    return null;
  }
}
