import { Platform } from 'react-native';
import { getAccessToken } from '@/utils/supabase';
import { CHAT_API_URL } from '@/lib/chat-api';

type GardenEventType =
  | 'level_started'
  | 'tile_tap_pattern'
  | 'level_restart'
  | 'level_time_spent'
  | 'level_completed'
  | 'idle_period';

export type GardenAnalyticsEvent = {
  id: string;
  timestamp: string;
  sessionSeed: number;
  levelId: number;
  eventType: GardenEventType;
  payload: Record<string, unknown>;
};

const STORAGE_KEY = 'khido_garden_analytics_v1';
const memoryStore: GardenAnalyticsEvent[] = [];
let hydrated = false;

function makeEventId() {
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function getWebStorage(): Storage | null {
  if (Platform.OS !== 'web') return null;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function hydrateFromStorage() {
  if (hydrated) return;
  hydrated = true;
  const storage = getWebStorage();
  if (!storage) return;

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    for (const item of parsed) {
      if (item && typeof item === 'object') {
        memoryStore.push(item as GardenAnalyticsEvent);
      }
    }
  } catch {
    // Ignore malformed storage. Analytics should never break gameplay.
  }
}

function persistToStorage() {
  const storage = getWebStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(memoryStore));
  } catch {
    // Ignore quota errors and keep logging in memory.
  }
}

function toServerPayload(event: GardenAnalyticsEvent) {
  const durationMs = typeof event.payload.durationMs === 'number' ? event.payload.durationMs : undefined;
  return {
    gameType: 'garden_puzzle',
    eventType: event.eventType,
    durationMs,
    metadata: event,
  };
}

async function persistToApi(event: GardenAnalyticsEvent) {
  const token = await getAccessToken();
  if (!token) return;

  fetch(`${CHAT_API_URL}/v1/game-events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(toServerPayload(event)),
  }).catch(() => {
    // Keep analytics silent; we already persist locally.
  });
}

export function logGardenEvent(input: {
  sessionSeed: number;
  levelId: number;
  eventType: GardenEventType;
  payload?: Record<string, unknown>;
}): GardenAnalyticsEvent {
  hydrateFromStorage();

  const event: GardenAnalyticsEvent = {
    id: makeEventId(),
    timestamp: new Date().toISOString(),
    sessionSeed: input.sessionSeed,
    levelId: input.levelId,
    eventType: input.eventType,
    payload: input.payload ?? {},
  };

  memoryStore.push(event);
  persistToStorage();
  void persistToApi(event);
  return event;
}

export function getGardenAnalyticsSnapshot(): GardenAnalyticsEvent[] {
  hydrateFromStorage();
  return [...memoryStore];
}
