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
  displayName: '',
  calmAlias: '',
  avatarSpirit: 'snowleopard',
  favoriteAnimal: '',
  comfortPhrase: '',
  supportGoal: '',
  copingStyle: 'breathing',
  sensoryReset: '',
  celebrationStyle: '',
  triggerNotes: '',
  checkInWindow: 'evening',
  streakDays: 0,
  currentBadge: 'Sprout',
  calmPoints: 0,
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
