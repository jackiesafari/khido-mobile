import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { getAccessToken, supabase } from '@/utils/supabase';
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
let cachedApiStorageMode: 'postgres' | 'file' | 'unknown' | null = null;

type ApiHealthResponse = { storage?: string };

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data as { error?: string }).error || `Request failed: ${res.status}`;
    throw new Error(message);
  }
  return data as T;
}

function makeUuid() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  // UUID v4 fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

async function getApiStorageMode(accessToken: string): Promise<'postgres' | 'file' | 'unknown'> {
  if (cachedApiStorageMode) return cachedApiStorageMode;
  try {
    const health = await fetchJson<ApiHealthResponse>(`${CHAT_API_URL}/health`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (health.storage === 'postgres') {
      cachedApiStorageMode = 'postgres';
      return 'postgres';
    }
    if (health.storage === 'file') {
      cachedApiStorageMode = 'file';
      return 'file';
    }
  } catch {
    // Ignore probe failures and use unknown fallback mode.
  }
  cachedApiStorageMode = 'unknown';
  return 'unknown';
}

async function getOrCreateSupabaseUserId() {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return null;
  const authUserId = auth.user.id;

  const { data: existing, error: existingError } = await supabase
    .from('users')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle<{ id: string }>();
  if (existingError) throw existingError;
  if (existing) return existing.id;

  const { error: insertError } = await supabase.from('users').insert({
    id: authUserId,
    created_at: new Date().toISOString(),
    auth_user_id: authUserId,
    display_name: 'Friend',
    locale: 'en-US',
    timezone: 'America/New_York',
  });
  if (insertError && insertError.code !== '23505') throw insertError;

  const { data: created, error: createdError } = await supabase
    .from('users')
    .select('id')
    .eq('auth_user_id', authUserId)
    .single<{ id: string }>();
  if (createdError) throw createdError;
  return created.id;
}

async function ensureConversationSessionForSupabase(userId: string, sessionId: string, mode: ChatMode) {
  const { data: existing, error: existingError } = await supabase
    .from('conversation_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle<{ id: string }>();
  if (existingError) throw existingError;
  if (existing) return;

  const { error: insertError } = await supabase.from('conversation_sessions').insert({
    id: sessionId,
    user_id: userId,
    started_at: new Date().toISOString(),
    mode,
  });
  if (insertError && insertError.code !== '23505') throw insertError;
}

async function insertSupabaseMessage(sessionId: string, role: 'user' | 'assistant', text: string) {
  const { error } = await supabase.from('messages').insert({
    id: makeUuid(),
    session_id: sessionId,
    role,
    text,
    created_at: new Date().toISOString(),
    safety_flags: {},
  });
  if (error) throw error;
}

async function upsertSupabaseMemoryFact(userId: string, category: string, factKey: string, factValue: string, source: string) {
  const { error } = await supabase.from('memory_facts').upsert(
    {
      id: makeUuid(),
      user_id: userId,
      category,
      fact_key: factKey,
      fact_value: factValue,
      confidence: 0.6,
      source,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,fact_key' }
  );
  if (error) throw error;
}

async function extractAndUpsertMemoryFacts(userId: string, userText: string) {
  const text = userText.trim();
  if (!text) return;
  const lower = text.toLowerCase();
  const preferenceMatch = text.match(/(?:i like|i love|my favorite is)\s+(.+)/i);
  if (preferenceMatch?.[1]) {
    await upsertSupabaseMemoryFact(userId, 'preference', 'general_preference', preferenceMatch[1].trim(), 'chat');
  }
  if (lower.includes('anxious about') || lower.includes('stressed about') || lower.includes('worried about')) {
    await upsertSupabaseMemoryFact(userId, 'trigger', 'reported_trigger', text, 'chat');
  }
  if (lower.includes('doctor') || lower.includes('appointment')) {
    await upsertSupabaseMemoryFact(userId, 'advocacy', 'medical_visit_context', text, 'chat');
  }
}

async function persistChatFallbackToSupabase(params: {
  mode: ChatMode;
  sessionId: string;
  latestUserMessage: string;
  assistantReply: string;
}) {
  const supabaseUserId = await getOrCreateSupabaseUserId();
  if (!supabaseUserId) return;
  await ensureConversationSessionForSupabase(supabaseUserId, params.sessionId, params.mode);
  if (params.latestUserMessage.trim()) {
    await insertSupabaseMessage(params.sessionId, 'user', params.latestUserMessage.trim());
    await extractAndUpsertMemoryFacts(supabaseUserId, params.latestUserMessage);
  }
  await insertSupabaseMessage(params.sessionId, 'assistant', params.assistantReply.trim());
}

export async function ensurePhase1User(): Promise<Phase1Context> {
  const accessToken = await getAccessToken();
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
  const accessToken = await getAccessToken();
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

    const safeReply = v1Response.reply ?? "I'm here for you. Would you like to tell me more?";
    const modeUsed: ChatMode = mode;
    const storageMode = await getApiStorageMode(accessToken);
    if (v1Response.sessionId && storageMode !== 'postgres') {
      persistChatFallbackToSupabase({
        mode: modeUsed,
        sessionId: v1Response.sessionId,
        latestUserMessage,
        assistantReply: safeReply,
      }).catch((error) => {
        console.warn('[chat persistence fallback] failed', error);
      });
    }

    return safeReply;
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
  const token = await getAccessToken();
  const url = token ? `${CHAT_API_URL}/v1/speech` : `${CHAT_API_URL}/speech`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
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
