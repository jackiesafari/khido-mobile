begin;

alter table public.profiles
  add column if not exists reward_unlocked_video_ids jsonb,
  add column if not exists reward_watched_video_ids jsonb,
  add column if not exists reward_claimed_milestones jsonb,
  add column if not exists last_reward_watched_at timestamptz,
  add column if not exists last_reward_video_id text,
  add column if not exists level14_completions integer;

alter table public.profiles
  alter column reward_unlocked_video_ids set default '[]'::jsonb,
  alter column reward_watched_video_ids set default '[]'::jsonb,
  alter column reward_claimed_milestones set default '[]'::jsonb,
  alter column level14_completions set default 0;

update public.profiles
set
  reward_unlocked_video_ids = coalesce(reward_unlocked_video_ids, '[]'::jsonb),
  reward_watched_video_ids = coalesce(reward_watched_video_ids, '[]'::jsonb),
  reward_claimed_milestones = coalesce(reward_claimed_milestones, '[]'::jsonb),
  level14_completions = coalesce(level14_completions, 0);

alter table public.profiles
  alter column reward_unlocked_video_ids set not null,
  alter column reward_watched_video_ids set not null,
  alter column reward_claimed_milestones set not null,
  alter column level14_completions set not null;

commit;
