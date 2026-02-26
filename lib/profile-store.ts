import { useSyncExternalStore } from 'react';

export type AvatarSpirit = 'bear' | 'lizard' | 'snowleopard' | 'bird';
export type CopingStyle = 'breathing' | 'movement' | 'sound' | 'journaling' | 'talking';
export type CheckInWindow = 'morning' | 'afternoon' | 'evening' | 'flexible';
export type UserProfile = {
  displayName: string;
  calmAlias: string;
  avatarSpirit: AvatarSpirit;
  favoriteAnimal: string;
  comfortPhrase: string;
  supportGoal: string;
  copingStyle: CopingStyle;
  sensoryReset: string;
  celebrationStyle: string;
  triggerNotes: string;
  checkInWindow: CheckInWindow;
  streakDays: number;
  currentBadge: string;
  calmPoints: number;
};

const defaultProfile: UserProfile = {
  displayName: 'Friend',
  calmAlias: 'Steady Explorer',
  avatarSpirit: 'bear',
  favoriteAnimal: 'Snow leopard',
  comfortPhrase: 'I can take this one breath at a time.',
  supportGoal: 'Help me de-stress quickly after a hard moment.',
  copingStyle: 'breathing',
  sensoryReset: 'Nature sounds',
  celebrationStyle: 'Small daily wins',
  triggerNotes: '',
  checkInWindow: 'evening',
  streakDays: 14,
  currentBadge: 'Sprout',
  calmPoints: 1260,
};

let profileState: UserProfile = defaultProfile;
const listeners = new Set<() => void>();

export function getProfileSnapshot(): UserProfile {
  return profileState;
}

export function updateProfile(patch: Partial<UserProfile>) {
  profileState = { ...profileState, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useProfile() {
  const profile = useSyncExternalStore(subscribe, getProfileSnapshot, getProfileSnapshot);
  return [profile, updateProfile] as const;
}
