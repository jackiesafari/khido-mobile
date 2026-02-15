import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Chat API URL
 * - Production: Set EXPO_PUBLIC_CHAT_API_URL in .env (e.g. your Railway URL)
 * - Dev / Simulator: localhost (iOS) or 10.0.2.2 (Android emulator)
 */
function getChatApiUrl(): string {
  const productionUrl = Constants.expoConfig?.extra?.chatApiUrl;
  if (!__DEV__ && productionUrl) {
    return productionUrl.replace(/\/$/, ''); // strip trailing slash
  }
  return Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001';
}

export const CHAT_API_URL = getChatApiUrl();

export type ChatMessage = { role: 'user' | 'avatar'; text: string };

export async function sendChatMessage(messages: ChatMessage[]): Promise<string> {
  const res = await fetch(`${CHAT_API_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }

  const data = await res.json();
  return data.reply ?? "I'm here for you. Would you like to tell me more?";
}
