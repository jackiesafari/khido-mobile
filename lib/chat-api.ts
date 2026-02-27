import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { getAccessToken } from '@/lib/auth';
import { getProfileSnapshot } from '@/lib/profile-store';
import { ensureAudioDirectory, getAudioDirectory } from '@/lib/audio-manager';

function getChatApiUrl(): string {
  const configuredUrl = Constants.expoConfig?.extra?.chatApiUrl;
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '');
  }
  return Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001';
}

export const CHAT_API_URL = getChatApiUrl();

export type ChatMessage = { role: 'user' | 'avatar'; text: string };
export type ChatMode = 'companion' | 'advocacy' | 'regulation';

type Phase1Context = {
  userId: string;
  sessionId: string | null;
  authToken: string;
};

let cachedContext: Phase1Context | null = null;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data as { error?: string }).error || `Request failed: ${res.status}`;
    throw new Error(message);
  }
  return data as T;
}

export async function ensurePhase1User(): Promise<Phase1Context> {
  const accessToken = getAccessToken();
  if (!accessToken) {
    throw new Error('User is not authenticated');
  }
  if (cachedContext && cachedContext.authToken === accessToken) {
    return cachedContext;
  }

  const data = await fetchJson<{ user: { id: string } }>(`${CHAT_API_URL}/v1/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ displayName: 'Friend', locale: 'en-US' }),
  });

  cachedContext = {
    userId: data.user.id,
    sessionId: null,
    authToken: accessToken,
  };

  return cachedContext;
}

export function resetPhase1Session() {
  if (cachedContext) {
    cachedContext.sessionId = null;
  }
}

function inferModeFromText(text: string): ChatMode {
  const lower = text.toLowerCase();
  if (lower.includes('doctor') || lower.includes('appointment') || lower.includes('advoc') || lower.includes('school meeting')) {
    return 'advocacy';
  }
  if (lower.includes('panic') || lower.includes('calm') || lower.includes('breathe') || lower.includes('anxious')) {
    return 'regulation';
  }
  return 'companion';
}

const profileSnapshotForApi = () => {
  const p = getProfileSnapshot();
  return {
    displayName: p.displayName,
    comfortPhrase: p.comfortPhrase,
    supportGoal: p.supportGoal,
    copingStyle: p.copingStyle,
    sensoryReset: p.sensoryReset,
    triggerNotes: p.triggerNotes,
    calmAlias: p.calmAlias,
    avatarSpirit: p.avatarSpirit,
  };
};

export async function sendChatMessage(messages: ChatMessage[]): Promise<string> {
  const accessToken = getAccessToken();
  const profileSnapshot = profileSnapshotForApi();

  if (accessToken) {
    const context = await ensurePhase1User();
    const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.text || '';
    const mode = inferModeFromText(latestUserMessage);

    const v1Response = await fetchJson<{ reply: string; sessionId?: string }>(`${CHAT_API_URL}/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        userId: context.userId,
        sessionId: context.sessionId,
        mode,
        profileSnapshot,
        messages: messages.map((m) => ({
          role: m.role === 'avatar' ? 'assistant' : m.role,
          content: m.text,
        })),
      }),
    });

    if (v1Response.sessionId) {
      context.sessionId = v1Response.sessionId;
    }

    return v1Response.reply ?? "I'm here for you. Would you like to tell me more?";
  }

  // Demo fallback for non-authenticated sessions.
  const legacyResponse = await fetchJson<{ reply: string }>(`${CHAT_API_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, profileSnapshot }),
  });
  return legacyResponse.reply ?? "I'm here for you. Would you like to tell me more?";
}

export type TTSVoice = 'sage' | 'shimmer' | 'nova';

/** Fetches TTS audio for the given text. Returns a local file URI for playback. */
export async function fetchTTSAudio(
  text: string,
  voice: TTSVoice = 'sage',
  options?: { skipHumanize?: boolean }
): Promise<string> {
  const url = getAccessToken() ? `${CHAT_API_URL}/v1/speech` : `${CHAT_API_URL}/speech`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      text: text.slice(0, 4096),
      voice,
      skipHumanize: options?.skipHumanize,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `TTS failed: ${res.status}`);
  }

  const base64 = (data as { audio?: string }).audio;
  if (!base64) throw new Error('No audio in TTS response');

  // Try file-based storage first (fixes "no storage directory for audio")
  if (Platform.OS !== 'web') {
    try {
      await ensureAudioDirectory();
      const audioDir = getAudioDirectory();
      if (audioDir) {
        const filePath = `${audioDir}avatar_${voice}_${Date.now()}.mp3`;
        await FileSystem.writeAsStringAsync(filePath, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        return filePath.startsWith('file://') ? filePath : `file://${filePath}`;
      }
    } catch {
      // Fall through to data URI
    }
  }

  return `data:audio/mpeg;base64,${base64}`;
}
