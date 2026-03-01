import type { TTSVoice } from '@/lib/chat-api';

export type AvatarChatMessage = { role: 'user' | 'avatar'; text: string };

export const AVATAR_TTS_VOICE: TTSVoice = 'shimmer';

export const QUICK_PROMPTS = ['Help advocate for me', 'I need to vent', 'Guide me with breathing'] as const;

export const WELCOME_MESSAGES = [
  "Oh hey! So glad you're here. I'm Khido! Think of me as your available friend. So... how are you actually doing today?",
  "Hi there! I'm Khido, hoping to bring you some good vibes today. You can talk to me about anything. What's going on in your world today?",
  "Oh hey, you showed up! That already took courage. I'm Khido. I'm here for you, no judgment, just good energy. How's your heart feeling today?",
  "Hello, friend! I'm Khido. Tell me, how are you really doing? I actually want to know.",
] as const;

export const API_UNAVAILABLE_FALLBACK =
  "I'd love to chat, but I'm having trouble connecting right now. Please make sure the API server is running (cd api && npm start) and try again!";

export const KEYBOARD_SCROLL_DELAY_MS = 30;

export function createWelcomeMessage(): AvatarChatMessage {
  const index = Math.floor(Math.random() * WELCOME_MESSAGES.length);
  return { role: 'avatar', text: WELCOME_MESSAGES[index] };
}
