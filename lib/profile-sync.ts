import { supabase } from '@/utils/supabase';
import type { UserProfile } from '@/lib/profile-store';

type AppUserRow = {
  id: string;
  display_name: string | null;
};

type ProfileRow = {
  user_id: string;
  calm_alias: string | null;
  avatar_spirit: UserProfile['avatarSpirit'] | null;
  favorite_animal: string | null;
  comfort_phrase: string | null;
  support_goal: string | null;
  coping_style: UserProfile['copingStyle'] | null;
  sensory_reset: string | null;
  celebration_style: string | null;
  trigger_notes: string | null;
  check_in_window: UserProfile['checkInWindow'] | null;
  streak_days: number | null;
  current_badge: string | null;
  calm_points: number | null;
  current_streak: number | null;
  longest_streak: number | null;
  last_visit_date: string | null;
  app_visits: number | null;
  chat_sessions: number | null;
  games_completed: number | null;
  profile_completed: boolean | null;
  badges: unknown;
  features_used: unknown;
  reward_unlocked_video_ids: unknown;
  reward_watched_video_ids: unknown;
  reward_claimed_milestones: unknown;
  last_reward_watched_at: string | null;
  last_reward_video_id: string | null;
  level14_completions: number | null;
  stress_triggers: unknown;
  preferred_support_style: unknown;
  advocacy_needs: unknown;
  updated_at: string;
};

type ProfileStats = {
  currentStreak: number;
  longestStreak: number;
  lastVisitDate: string | null;
  appVisits: number;
  chatSessions: number;
  gamesCompleted: number;
  completedProfile: boolean;
  badges: string[];
  featuresUsed: string[];
};

type FeatureKey = 'profile' | 'avatar' | 'games' | 'sounds';

export type RewardVideoDecision = {
  selectedVideoKey: string;
  isNewVideo: boolean;
  unlockedMilestone: string | null;
  nextNewVideoAt: string | null;
};

const BADGE_SPROUT = 'Sprout';
const FEATURE_BADGE_KEYS: FeatureKey[] = ['profile', 'avatar', 'games', 'sounds'];

const EMPTY_PROFILE: UserProfile = {
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
  currentBadge: BADGE_SPROUT,
  calmPoints: 0,
};

const DEFAULT_STATS: ProfileStats = {
  currentStreak: 0,
  longestStreak: 0,
  lastVisitDate: null,
  appVisits: 0,
  chatSessions: 0,
  gamesCompleted: 0,
  completedProfile: false,
  badges: [BADGE_SPROUT],
  featuresUsed: [],
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function ensureNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function ensureStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function uniqStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function parseLegacyStats(value: unknown, fallbackStreak: number, fallbackPoints: number): ProfileStats {
  if (!isObjectRecord(value)) {
    return {
      ...DEFAULT_STATS,
      currentStreak: fallbackStreak,
      longestStreak: fallbackStreak,
      badges: fallbackPoints > 0 ? [BADGE_SPROUT] : [...DEFAULT_STATS.badges],
    };
  }

  const badges = ensureStringArray(value.badges);
  const featuresUsed = ensureStringArray(value.featuresUsed);

  return {
    currentStreak: ensureNumber(value.currentStreak, fallbackStreak),
    longestStreak: ensureNumber(value.longestStreak, fallbackStreak),
    lastVisitDate: typeof value.lastVisitDate === 'string' ? value.lastVisitDate : null,
    appVisits: ensureNumber(value.appVisits, 0),
    chatSessions: ensureNumber(value.chatSessions, 0),
    gamesCompleted: ensureNumber(value.gamesCompleted, 0),
    completedProfile: Boolean(value.completedProfile),
    badges: badges.length > 0 ? badges : [BADGE_SPROUT],
    featuresUsed,
  };
}

function rowToStats(row: ProfileRow): ProfileStats {
  const legacy = parseLegacyStats(row.advocacy_needs, ensureNumber(row.streak_days, 0), ensureNumber(row.calm_points, 0));
  const currentStreak = ensureNumber(row.current_streak, legacy.currentStreak);
  return {
    currentStreak,
    longestStreak: ensureNumber(row.longest_streak, Math.max(legacy.longestStreak, currentStreak)),
    lastVisitDate: row.last_visit_date ?? legacy.lastVisitDate,
    appVisits: ensureNumber(row.app_visits, legacy.appVisits),
    chatSessions: ensureNumber(row.chat_sessions, legacy.chatSessions),
    gamesCompleted: ensureNumber(row.games_completed, legacy.gamesCompleted),
    completedProfile: typeof row.profile_completed === 'boolean' ? row.profile_completed : legacy.completedProfile,
    badges: (() => {
      const direct = ensureStringArray(row.badges);
      return direct.length ? direct : legacy.badges;
    })(),
    featuresUsed: (() => {
      const direct = ensureStringArray(row.features_used);
      return direct.length ? direct : legacy.featuresUsed;
    })(),
  };
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function previousIsoDate(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function scoreMultiplier(currentStreak: number): number {
  return currentStreak > 1 ? 1.5 : 1;
}

function awardPoints(basePoints: number, currentStreak: number): number {
  return Math.round(basePoints * scoreMultiplier(currentStreak));
}

function normalizeBadges(stats: ProfileStats, points: number): string[] {
  const set = new Set<string>(stats.badges.length ? stats.badges : [BADGE_SPROUT]);
  set.add(BADGE_SPROUT);
  if (stats.currentStreak >= 7) set.add('On Fire');
  if (stats.currentStreak >= 30) set.add('Zen Master');
  if (stats.chatSessions >= 10) set.add('Chatterbox');
  if (stats.appVisits >= 100) set.add('Dedicated');
  if (FEATURE_BADGE_KEYS.every((feature) => stats.featuresUsed.includes(feature))) set.add('Explorer');
  if (points >= 1000) set.add('Calm Champion');
  return Array.from(set);
}

function pickCurrentBadge(badges: string[]): string {
  return badges[badges.length - 1] ?? BADGE_SPROUT;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function nowIsoTimestamp() {
  return new Date().toISOString();
}

function plusHours(isoTimestamp: string, hours: number): string {
  const date = new Date(isoTimestamp);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

function canWatchNewVideo(lastWatchedAt: string | null): boolean {
  if (!lastWatchedAt) return true;
  const last = new Date(lastWatchedAt).getTime();
  if (!Number.isFinite(last)) return true;
  return Date.now() - last >= 24 * 60 * 60 * 1000;
}

function buildRewardMilestones(input: {
  level14Completions: number;
  currentStreak: number;
  gamesCompleted: number;
  calmPoints: number;
  badges: string[];
}): string[] {
  const milestones: string[] = [];
  if (input.level14Completions >= 1) milestones.push('level14:first');
  if (input.currentStreak >= 3) milestones.push('streak:3');
  if (input.currentStreak >= 7) milestones.push('streak:7');
  if (input.currentStreak >= 30) milestones.push('streak:30');

  const gamesBuckets = Math.floor(input.gamesCompleted / 10);
  for (let i = 1; i <= gamesBuckets; i += 1) milestones.push(`games:${i * 10}`);

  const pointsBuckets = Math.floor(input.calmPoints / 100);
  for (let i = 1; i <= pointsBuckets; i += 1) milestones.push(`points:${i * 100}`);

  for (const badge of input.badges) milestones.push(`badge:${slugify(badge)}`);
  return uniqStrings(milestones);
}

export function calculateProfileCompletion(profile: UserProfile): number {
  const requiredFields = [
    profile.displayName,
    profile.calmAlias,
    profile.favoriteAnimal,
    profile.comfortPhrase,
    profile.supportGoal,
    profile.sensoryReset,
    profile.celebrationStyle,
  ];
  const filled = requiredFields.filter((field) => normalizeText(field).length > 0).length;
  return Math.round((filled / requiredFields.length) * 100);
}

async function getAuthedUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

async function getOrCreateAppUser(): Promise<AppUserRow | null> {
  const authUser = await getAuthedUser();
  if (!authUser) return null;

  const { data: existing, error: existingError } = await supabase
    .from('users')
    .select('id, display_name')
    .eq('auth_user_id', authUser.id)
    .maybeSingle<AppUserRow>();
  if (existingError) throw existingError;
  if (existing) return existing;

  const displayName = 'Friend';
  const insertPayload = {
    id: authUser.id,
    created_at: new Date().toISOString(),
    auth_user_id: authUser.id,
    display_name: displayName || 'Friend',
    locale: 'en-US',
    timezone: 'America/New_York',
  };
  const { error: insertError } = await supabase.from('users').insert(insertPayload);
  if (insertError && insertError.code !== '23505') throw insertError;

  const { data: created, error: createdError } = await supabase
    .from('users')
    .select('id, display_name')
    .eq('auth_user_id', authUser.id)
    .single<AppUserRow>();
  if (createdError) throw createdError;
  return created;
}

async function ensureProfileRow(userId: string) {
  const { data: existing, error: existingError } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle<{ user_id: string }>();
  if (existingError) throw existingError;
  if (existing) return;

  const { error: insertError } = await supabase.from('profiles').insert({
    user_id: userId,
    stress_triggers: [],
    preferred_support_style: {},
    advocacy_needs: DEFAULT_STATS,
    streak_days: 0,
    current_badge: BADGE_SPROUT,
    calm_points: 0,
    current_streak: 0,
    longest_streak: 0,
    last_visit_date: null,
    app_visits: 0,
    chat_sessions: 0,
    games_completed: 0,
    profile_completed: false,
    badges: [BADGE_SPROUT],
    features_used: [],
    reward_unlocked_video_ids: [],
    reward_watched_video_ids: [],
    reward_claimed_milestones: [],
    last_reward_watched_at: null,
    last_reward_video_id: null,
    level14_completions: 0,
    updated_at: new Date().toISOString(),
  });
  if (insertError && insertError.code !== '23505') throw insertError;
}

async function fetchProfileRow(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'user_id, calm_alias, avatar_spirit, favorite_animal, comfort_phrase, support_goal, coping_style, sensory_reset, celebration_style, trigger_notes, check_in_window, streak_days, current_badge, calm_points, current_streak, longest_streak, last_visit_date, app_visits, chat_sessions, games_completed, profile_completed, badges, features_used, stress_triggers, preferred_support_style, advocacy_needs, updated_at'
      + ', reward_unlocked_video_ids, reward_watched_video_ids, reward_claimed_milestones, last_reward_watched_at, last_reward_video_id, level14_completions'
    )
    .eq('user_id', userId)
    .maybeSingle<ProfileRow>();
  if (error) throw error;
  return data;
}

function mapRowToProfile(row: ProfileRow, userDisplayName: string | null): UserProfile {
  const stats = rowToStats(row);
  const calmPoints = ensureNumber(row.calm_points, 0);
  const badges = normalizeBadges(stats, calmPoints);
  const currentBadge = row.current_badge || pickCurrentBadge(badges);

  return {
    displayName: normalizeText(userDisplayName),
    calmAlias: normalizeText(row.calm_alias),
    avatarSpirit: row.avatar_spirit ?? 'snowleopard',
    favoriteAnimal: normalizeText(row.favorite_animal),
    comfortPhrase: normalizeText(row.comfort_phrase),
    supportGoal: normalizeText(row.support_goal),
    copingStyle: row.coping_style ?? 'breathing',
    sensoryReset: normalizeText(row.sensory_reset),
    celebrationStyle: normalizeText(row.celebration_style),
    triggerNotes: normalizeText(row.trigger_notes),
    checkInWindow: row.check_in_window ?? 'evening',
    streakDays: stats.currentStreak,
    currentBadge,
    calmPoints,
  };
}

type MutationContext = {
  stats: ProfileStats;
  calmPoints: number;
};

type MutationResult = {
  stats?: ProfileStats;
  calmPoints?: number;
};

async function mutateGamification(mutate: (ctx: MutationContext) => MutationResult | null) {
  const appUser = await getOrCreateAppUser();
  if (!appUser) return null;
  await ensureProfileRow(appUser.id);
  const row = await fetchProfileRow(appUser.id);
  if (!row) return null;

  const existingPoints = ensureNumber(row.calm_points, 0);
  const stats = rowToStats(row);
  const next = mutate({ stats: { ...stats }, calmPoints: existingPoints });
  if (!next) return null;

  const nextStats = next.stats ?? stats;
  const nextCalmPoints = next.calmPoints ?? existingPoints;
  nextStats.longestStreak = Math.max(nextStats.longestStreak, nextStats.currentStreak);
  nextStats.badges = normalizeBadges(nextStats, nextCalmPoints);
  const currentBadge = pickCurrentBadge(nextStats.badges);

  const { error } = await supabase
    .from('profiles')
    .update({
      current_streak: nextStats.currentStreak,
      longest_streak: nextStats.longestStreak,
      last_visit_date: nextStats.lastVisitDate,
      app_visits: nextStats.appVisits,
      chat_sessions: nextStats.chatSessions,
      games_completed: nextStats.gamesCompleted,
      profile_completed: nextStats.completedProfile,
      badges: nextStats.badges,
      features_used: nextStats.featuresUsed,
      streak_days: nextStats.currentStreak,
      current_badge: currentBadge,
      calm_points: nextCalmPoints,
      advocacy_needs: nextStats,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', appUser.id);
  if (error) throw error;

  return {
    streakDays: nextStats.currentStreak,
    calmPoints: nextCalmPoints,
    currentBadge,
  };
}

export async function loadProfileFromSupabase(): Promise<UserProfile | null> {
  const appUser = await getOrCreateAppUser();
  if (!appUser) return null;
  await ensureProfileRow(appUser.id);
  const row = await fetchProfileRow(appUser.id);
  if (!row) return { ...EMPTY_PROFILE, displayName: normalizeText(appUser.display_name) };
  return mapRowToProfile(row, appUser.display_name);
}

export async function saveProfileToSupabase(profile: UserProfile): Promise<UserProfile | null> {
  const appUser = await getOrCreateAppUser();
  if (!appUser) return null;
  await ensureProfileRow(appUser.id);
  const row = await fetchProfileRow(appUser.id);
  if (!row) return null;

  const nextDisplayName = normalizeText(profile.displayName) || 'Friend';
  const { error: updateUserError } = await supabase.from('users').update({ display_name: nextDisplayName }).eq('id', appUser.id);
  if (updateUserError) throw updateUserError;

  const currentStats = rowToStats(row);
  const currentStreak = currentStats.currentStreak;
  const nextProfileCompletion = calculateProfileCompletion(profile);
  const shouldAwardCompletion = nextProfileCompletion === 100 && !currentStats.completedProfile;
  const nextPoints = ensureNumber(row.calm_points, 0) + (shouldAwardCompletion ? awardPoints(50, currentStreak) : 0);
  if (shouldAwardCompletion) currentStats.completedProfile = true;
  currentStats.badges = normalizeBadges(currentStats, nextPoints);
  const nextBadge = pickCurrentBadge(currentStats.badges);

  const { error: updateProfileError } = await supabase
    .from('profiles')
    .update({
      calm_alias: normalizeText(profile.calmAlias) || null,
      avatar_spirit: profile.avatarSpirit,
      favorite_animal: normalizeText(profile.favoriteAnimal) || null,
      comfort_phrase: normalizeText(profile.comfortPhrase) || null,
      support_goal: normalizeText(profile.supportGoal) || null,
      coping_style: profile.copingStyle,
      sensory_reset: normalizeText(profile.sensoryReset) || null,
      celebration_style: normalizeText(profile.celebrationStyle) || null,
      trigger_notes: normalizeText(profile.triggerNotes) || null,
      check_in_window: profile.checkInWindow,
      profile_completed: currentStats.completedProfile,
      badges: currentStats.badges,
      calm_points: nextPoints,
      current_badge: nextBadge,
      streak_days: currentStreak,
      advocacy_needs: currentStats,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', appUser.id);
  if (updateProfileError) throw updateProfileError;

  return {
    ...profile,
    displayName: nextDisplayName,
    calmPoints: nextPoints,
    currentBadge: nextBadge,
    streakDays: currentStreak,
  };
}

export async function applyDailyVisitReward() {
  return mutateGamification(({ stats, calmPoints }) => {
    const today = todayIsoDate();
    if (stats.lastVisitDate === today) return null;
    const wasYesterday = stats.lastVisitDate === previousIsoDate(today);
    const nextStreak = wasYesterday ? stats.currentStreak + 1 : 1;
    const nextStats: ProfileStats = {
      ...stats,
      currentStreak: nextStreak,
      longestStreak: Math.max(stats.longestStreak, nextStreak),
      lastVisitDate: today,
      appVisits: stats.appVisits + 1,
    };
    return {
      stats: nextStats,
      calmPoints: calmPoints + awardPoints(10, nextStreak),
    };
  });
}

export async function recordChatSession() {
  return mutateGamification(({ stats, calmPoints }) => ({
    stats: {
      ...stats,
      chatSessions: stats.chatSessions + 1,
    },
    calmPoints: calmPoints + awardPoints(15, stats.currentStreak),
  }));
}

export async function recordGameCompletion() {
  return mutateGamification(({ stats, calmPoints }) => ({
    stats: {
      ...stats,
      gamesCompleted: stats.gamesCompleted + 1,
    },
    calmPoints: calmPoints + awardPoints(25, stats.currentStreak),
  }));
}

export async function markFeatureUsed(feature: FeatureKey) {
  return mutateGamification(({ stats }) => {
    if (stats.featuresUsed.includes(feature)) return null;
    return {
      stats: {
        ...stats,
        featuresUsed: [...stats.featuresUsed, feature],
      },
    };
  });
}

export async function consumeLevel14Reward(availableVideoKeys: string[]): Promise<RewardVideoDecision | null> {
  const appUser = await getOrCreateAppUser();
  if (!appUser) return null;
  await ensureProfileRow(appUser.id);
  const row = await fetchProfileRow(appUser.id);
  if (!row) return null;

  const uniqueAvailable = uniqStrings(availableVideoKeys);
  if (uniqueAvailable.length === 0) return null;

  const stats = rowToStats(row);
  const calmPoints = ensureNumber(row.calm_points, 0);
  const level14Completions = ensureNumber(row.level14_completions, 0) + 1;

  const unlocked = uniqStrings(ensureStringArray(row.reward_unlocked_video_ids));
  const watched = uniqStrings(ensureStringArray(row.reward_watched_video_ids));
  const claimed = uniqStrings(ensureStringArray(row.reward_claimed_milestones));
  const activeBadges = normalizeBadges(stats, calmPoints);

  const milestoneQueue = buildRewardMilestones({
    level14Completions,
    currentStreak: stats.currentStreak,
    gamesCompleted: stats.gamesCompleted,
    calmPoints,
    badges: activeBadges,
  });
  const nextMilestone = milestoneQueue.find((milestone) => !claimed.includes(milestone)) ?? null;

  let unlockedMilestone: string | null = null;
  if (nextMilestone) {
    const nextVideo = uniqueAvailable.find((key) => !unlocked.includes(key));
    if (nextVideo) {
      unlocked.push(nextVideo);
      unlockedMilestone = nextMilestone;
    }
    claimed.push(nextMilestone);
  }

  if (unlocked.length === 0) {
    unlocked.push(uniqueAvailable[0]);
  }

  const lastWatchedAt = row.last_reward_watched_at;
  const canWatchNew = canWatchNewVideo(lastWatchedAt);
  const unseenUnlocked = unlocked.filter((key) => !watched.includes(key));

  let selectedVideoKey: string;
  let isNewVideo = false;
  let nextNewVideoAt: string | null = null;
  const nowIso = nowIsoTimestamp();

  if (canWatchNew && unseenUnlocked.length > 0) {
    selectedVideoKey = unseenUnlocked[0];
    watched.push(selectedVideoKey);
    isNewVideo = true;
  } else {
    selectedVideoKey =
      row.last_reward_video_id && uniqueAvailable.includes(row.last_reward_video_id)
        ? row.last_reward_video_id
        : unlocked[0];
    if (!canWatchNew && lastWatchedAt) {
      nextNewVideoAt = plusHours(lastWatchedAt, 24);
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      reward_unlocked_video_ids: uniqStrings(unlocked),
      reward_watched_video_ids: uniqStrings(watched),
      reward_claimed_milestones: uniqStrings(claimed),
      last_reward_watched_at: isNewVideo ? nowIso : row.last_reward_watched_at,
      last_reward_video_id: selectedVideoKey,
      level14_completions: level14Completions,
      updated_at: nowIso,
    })
    .eq('user_id', appUser.id);
  if (error) throw error;

  return {
    selectedVideoKey,
    isNewVideo,
    unlockedMilestone,
    nextNewVideoAt,
  };
}
