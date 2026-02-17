import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getAccessToken } from '@/lib/auth';

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

export async function sendChatMessage(messages: ChatMessage[]): Promise<string> {
  const accessToken = getAccessToken();
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
    body: JSON.stringify({ messages }),
  });
  return legacyResponse.reply ?? "I'm here for you. Would you like to tell me more?";
}
