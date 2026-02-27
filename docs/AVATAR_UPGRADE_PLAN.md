# Khido Avatar Upgrade Plan: Building a Top-Notch Calming Companion

> **Goal:** Transform the avatar section into a best-in-class, calming AI companion that personalizes support from profile, games, and sounds—especially for advocacy (doctor visits, school meetings) and anxiety regulation.

---

## Version 1 Scope (Launch Focus)

**Two different concepts—don't confuse them:**

| Concept | Where | Meaning |
|--------|-------|---------|
| **Profile avatar (inner character)** | Profile screen | How the *user* describes themselves—their inner self. All 4 spirits (snow leopard, lizard, bear, bird) stay available. |
| **Avatar section (Khido)** | Chat screen | The *friend* talking to the user. For v1, Khido is the snow leopard. Future versions may add other friend personas. |

**V1:** Khido (the friend in the avatar chat) is the snow leopard. The profile picker remains unchanged—users choose their own inner character.

**V1 voice:** Use OpenAI TTS only (same API key as chat). No HeyGen, D-ID, or other providers.
- **Model:** `gpt-4o-mini-tts`
- **Calm voices to test:** `sage` (steady pacing, meditation), `shimmer` (soft, intimate), `nova` (add for empathy testing). Use `instructions: "Speak in a calm, soothing, and gentle tone."` to reinforce delivery. Test which sounds most empathetic.
- **Streaming:** Supported for lower latency; `wav` or `pcm` recommended for realtime playback.
- **Policy:** OpenAI requires disclosure that the voice is AI-generated.

**Personality & tone:**
- **Authentic friend:** Feels like talking to a real friend—warm, genuine, not robotic or clinical.
- **Empathy first:** Acknowledge feelings before offering solutions. Validate, don’t minimize.
- **Active listening:** Reflect back what the user shared. Show you heard them.
- **Never shame:** No judgment, no “you should have…” or guilt. Meet them where they are.
- **Tools over advice:** Provide practical support—hotlines, grounding steps, and encouragement to reach out to real people (friends, family, professionals) when helpful.

**Support tools to offer when appropriate:**
- Crisis hotlines (e.g., 988 Suicide & Crisis Lifeline in the US).
- Encouragement to talk to a trusted friend, family member, or professional.
- Grounding or coping techniques when the user is overwhelmed.
- Clear signposting that Khido supports but does not replace human connection.

---

## Executive Summary

Khido already has strong foundations: 4 avatar spirits (snow leopard, lizard, bear, bird), a chat API with mode inference (companion/advocacy/regulation), game analytics, and a rich profile. The upgrade plan focuses on **unifying personalization**, **avatar visual identity**, **calming UI/UX**, and **context-aware AI** to create a cohesive, peace-bringing experience.

---

## Part 1: Current State Analysis

### What Exists Today

| Component | Status | Notes |
|-----------|--------|-------|
| **Profile avatars** | ✅ 4 spirits | Snow leopard, lizard, bear, bird in `profile.tsx` |
| **Avatar chat screen** | ⚠️ Single video | Uses one `avatar-video.mp4` regardless of spirit choice |
| **Chat API** | ✅ Solid | OpenAI, mode inference, memory facts, crisis handling |
| **Profile store (client)** | ⚠️ Not synced | Rich data (calmAlias, comfortPhrase, supportGoal, etc.) stays in-memory |
| **API profile (server)** | ⚠️ Different schema | Uses stressTriggers, advocacyNeeds—not aligned with client |
| **Game events** | ✅ Logged | `garden-analytics.ts` → `/v1/game-events` |
| **Sounds** | ❌ Not tracked | No analytics or personalization from sound usage |
| **Avatar visuals** | ❌ Static video | No per-spirit avatar, no voice, no emotional expression |

### Key Gaps

1. **Avatar visual mismatch:** User picks snow leopard/lizard/bear/bird in profile, but chat shows a generic video.
2. **Profile silo:** Client profile (comfortPhrase, supportGoal, sensoryReset, etc.) is never sent to the API.
3. **Game/sound context unused:** API stores game events but doesn’t inject them into chat context.
4. **Advocacy depth:** Mode exists but could be richer (scripts, checklists, school-specific support).
5. **Calming UX:** Bright blue background, generic UI—not yet optimized for anxiety reduction.

---

## Part 2: Research Summary (2025)

### AI Avatar & Chat Frameworks

| Tool | Best For | Integration |
|------|----------|-------------|
| **HeyGen** | Real-time streaming avatars, React Native via LiveKit | `@heygen/streaming-avatar`, WebRTC |
| **D-ID** | Photo-to-animation, simpler setup | REST API, ElevenLabs voice |
| **Inworld AI** | Emotional gestures, body language | Character engine, SDK |
| **Character.AI** | Memory, emotional inflection | API / platform |
| **Claude / GPT-4** | Context, emotional intelligence | Already using OpenAI |

**Recommendation:** Keep **OpenAI** for chat (already integrated). For visuals: **Phase 1** use per-spirit static/looping videos or Lottie; **Phase 2** evaluate HeyGen or Inworld for real-time lip-sync if budget allows.

### Mental Health & Advocacy

- **Wysa, Woebot:** Evidence-based CBT, guided journaling.
- **Advocate Ally:** Voice coaching for carers—natural speech, no forms.
- **Research:** AI explanations reduce anxiety; human advocacy remains essential. Khido should support, not replace, human support.

---

## Part 3: Architecture for Context Extraction

### 3.1 Unified Context Pipeline

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Profile Store   │     │  Game Analytics   │     │  Sound Usage     │
│  (client)        │     │  (garden, etc.)   │     │  (new)           │
└────────┬─────────┘     └────────┬─────────┘     └────────┬────────┘
         │                         │                         │
         ▼                         ▼                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Context Aggregation Layer                         │
│  - Sync profile to API on save                                       │
│  - Include game events in chat context                                │
│  - Include sound preferences & recent usage                           │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Chat API (enhanced system prompt)                  │
│  - Avatar spirit personality                                         │
│  - Profile: comfortPhrase, supportGoal, sensoryReset, triggers       │
│  - Game insights: what calmed them, what frustrated                   │
│  - Sound preferences                                                  │
│  - Advocacy scripts & checklists                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Data to Extract & Use

| Source | Data | Use in Chat |
|--------|------|-------------|
| **Profile** | displayName, calmAlias, avatarSpirit, favoriteAnimal, comfortPhrase, supportGoal, copingStyle, sensoryReset, celebrationStyle, triggerNotes | Greeting, tone, avoid triggers, suggest coping, celebrate wins |
| **Games** | level_completed, level_time_spent, calm_improved, frustrated, idle_period | Recommend games, acknowledge progress, avoid overstimulation |
| **Sounds** | activeSound, sessionDuration (new) | Suggest sounds, pair with regulation |
| **Chat history** | memory facts (already extracted) | Continuity, avoid repetition |

---

## Part 4: Implementation Plan

### Phase 1: Foundation (Weeks 1–2)

#### 1.1 Profile–API Sync

- [ ] Add `/v1/users/:userId/profile/sync` or extend PATCH to accept full client profile.
- [ ] Map client fields to API: `comfortPhrase`, `supportGoal`, `sensoryReset`, `celebrationStyle`, `triggerNotes`, `copingStyle`, `avatarSpirit`, `favoriteAnimal`, `calmAlias`.
- [ ] Call sync on profile save from `profile.tsx` (when authenticated).
- [ ] Update `buildSystemPrompt` in `server.js` to use these fields.

#### 1.2 Per-Spirit Avatar Visuals

- [ ] Create or source 4 avatar videos/animations (one per spirit: snow leopard, lizard, bear, bird).
- [ ] In `avatar.tsx`, select video based on `getProfileSnapshot().avatarSpirit`.
- [ ] Fallback to default if asset missing.

#### 1.3 Calming UI Overhaul

- [ ] Replace bright blue (`#7BAEF9`) with softer palette: muted teals, soft grays, gentle gradients.
- [ ] Reduce contrast, use rounded corners, subtle shadows.
- [ ] Add optional “calm mode”: dimmed colors, reduced motion.
- [ ] Typography: readable, warm sans-serif; avoid harsh weights.

### Phase 2: Context Integration (Weeks 3–4)

#### 2.1 Game Context in Chat

- [ ] In `handlePhase1Chat`, fetch `getRecentGameEvents(userId, 10)`.
- [ ] Add to system prompt: “Recent activities: Path Garden completed, Breathing Orb used when stressed…”
- [ ] Use `getRecommendationsForUser` (already exists) and inject top recommendation into prompt when relevant.

#### 2.2 Sound Analytics & Preferences

- [ ] Add `lib/sound-analytics.ts`: log `sound_started`, `sound_stopped`, `durationMs`.
- [ ] POST to `/v1/sound-events` (new endpoint) or extend `game-events` with `gameType: 'sound'`.
- [ ] Store `sensoryReset` from profile; use in prompt: “User prefers nature sounds for reset.”

#### 2.3 Enhanced Advocacy Mode

- [ ] Expand advocacy prompt with:
  - Doctor visit: script opener, 3 questions, pre-visit checklist.
  - School meeting: IEP/504 prep, question list, follow-up steps.
- [ ] Add quick prompts: “Prep me for a doctor visit,” “Help me with a school meeting.”
- [ ] Optional: structured output (JSON) for scripts/checklists that the UI can render.

### Phase 3: Avatar Personality & Polish (Weeks 5–6)

#### 3.1 Spirit-Specific Personas

- [ ] Define persona traits per spirit in `server.js`:
  - Snow leopard: perceptive, resilient, observant.
  - Lizard: adaptable, observant, patient.
  - Bear: grounded, protective, steady.
  - Bird: bright, uplifting, hopeful.
- [ ] Inject into system prompt: “You embody the [spirit] spirit: [traits]. Use this energy in your tone.”

#### 3.2 Welcome & Quick Prompts

- [ ] Welcome message uses: displayName, avatarSpirit, supportGoal, comfortPhrase.
- [ ] Quick prompts: dynamic from profile (e.g., “Remind me: [comfortPhrase]”, “Help with: [supportGoal]”).
- [ ] Add advocacy-specific prompts when `supportGoal` mentions doctor/school.

#### 3.3 Crisis & Safety

- [ ] Keep existing crisis detection and 988 response.
- [ ] Add Resources modal/screen with hotlines, grounding exercises.
- [ ] Ensure avatar never minimizes severity of self-harm language.

### Phase 4: Advanced (Future)

#### 4.1 Voice Avatar (HeyGen / D-ID)

- [ ] Evaluate HeyGen React Native + LiveKit for real-time avatar.
- [ ] Create 4 avatar videos (one per spirit) with HeyGen or similar.
- [ ] Integrate TTS (e.g., ElevenLabs) for spoken responses.
- [ ] Add toggle: text-only vs. voice.

#### 4.2 Emotional Expression

- [ ] Map chat sentiment to avatar state (calm, concerned, encouraging).
- [ ] Use Lottie or video variants for different moods.
- [ ] Subtle animations (breathing, blinking) for presence.

#### 4.3 Proactive Check-Ins

- [ ] Use `checkInWindow` from profile for push notifications.
- [ ] “How are you feeling?” prompts at preferred times.
- [ ] Link to avatar chat from notification.

---

## Part 5: Technical Specifications

### 5.1 API Changes

| Endpoint | Change |
|----------|--------|
| `PATCH /v1/users/:userId/profile` | Accept full client profile schema |
| `POST /v1/chat` | Optional: include `profileSnapshot` in body for demo/unauthenticated |
| `POST /v1/sound-events` | New: `{ soundId, eventType, durationMs }` |
| `GET /v1/users/:userId/profile` | Return merged profile (DB + client overrides) |

### 5.2 Client Changes

| File | Change |
|------|--------|
| `lib/profile-store.ts` | Add `syncProfileToApi()` when authenticated |
| `app/profile.tsx` | Call sync on save |
| `app/avatar.tsx` | Per-spirit video, calming styles, Resources modal |
| `lib/chat-api.ts` | Send profile snapshot for demo; include avatarSpirit in context |
| `lib/sound-analytics.ts` | New: log sound usage, POST to API |
| `app/sounds.tsx` | Integrate sound analytics |

### 5.3 Asset Requirements

| Asset | Description |
|-------|-------------|
| `avatar-snowleopard.mp4` | Looping video, calm expression |
| `avatar-lizard.mp4` | Same |
| `avatar-bear.mp4` | Same |
| `avatar-bird.mp4` | Same |
| Optional: Lottie variants | Per-mood (calm, concerned, encouraging) |

---

## Part 6: Calming Design Guidelines

### Color Palette (Suggested)

- **Background:** `#0F172A` → `#1E3A5F` (deep navy gradient)
- **Cards:** `rgba(15, 23, 42, 0.68)` with soft border
- **Accent:** `#14B8A6` (teal), `#5EEAD4` (light teal)
- **Text:** `#F8FAFC`, `#CBD5E1`, `#94A3B8`
- **Avatar bubble:** Soft white `rgba(255,255,255,0.95)` with gentle shadow

### Typography

- Headers: 600–800 weight, 22–30px
- Body: 400–500, 15–16px, line-height 1.5
- Avoid ALL CAPS for long text

### Motion

- Prefer `easing: Easing.inOut(Easing.sin)` for breathing/calm animations.
- Avoid sudden flashes or aggressive transitions.
- Optional: “Reduce motion” setting for accessibility.

---

## Part 7: Success Metrics

| Metric | Target |
|--------|--------|
| Profile sync success rate | > 95% on save |
| Chat uses profile fields | 100% of requests |
| Game events in context | When available, included |
| Avatar matches spirit | 100% (correct video shown) |
| Crisis response time | Immediate (no model delay) |
| User feedback (qualitative) | “Feels calming,” “Remembers me” |

---

## Part 8: Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Profile sync fails (offline) | Queue sync, retry on reconnect |
| API profile schema drift | Versioned sync, migration path |
| Avatar assets large | Compress videos, lazy load |
| Over-personalization feels creepy | User control over what’s used; clear consent |
| Voice/streaming cost | Phase 4; start with static/Lottie |

---

## Appendix A: System Prompt Enhancement (Draft)

```
You are Khido, a kind and supportive AI friend. You embody the [AVATAR_SPIRIT] spirit: [SPIRIT_TRAITS].

- Be warm, concise, and conversational (2-4 sentences).
- Use simple language and a gentle, encouraging tone.
- Call the user [DISPLAY_NAME] when appropriate.
- Their comfort phrase is: [COMFORT_PHRASE]—use it when it fits.
- Their main goal: [SUPPORT_GOAL]. Keep support aligned with this.
- They regulate best through: [COPING_STYLE]. Suggest this when relevant.
- For sensory reset they prefer: [SENSORY_RESET].
- Avoid these topics: [TRIGGER_NOTES].
- Celebrate wins in this style: [CELEBRATION_STYLE].

Recent activities: [GAME_EVENTS_SUMMARY]. Use this to personalize suggestions.

[MODE_SPECIFIC_INSTRUCTION]
```

---

## Appendix B: File Checklist

- [ ] `khido/docs/AVATAR_UPGRADE_PLAN.md` (this file)
- [ ] `khido/lib/profile-sync.ts` (new)
- [ ] `khido/lib/sound-analytics.ts` (new)
- [ ] `khido/api/server.js` (profile schema, game/sound context, spirit personas)
- [ ] `khido/app/avatar.tsx` (per-spirit video, calming UI)
- [ ] `khido/app/profile.tsx` (sync on save)
- [ ] `khido/app/sounds.tsx` (analytics integration)
- [ ] `khido/assets/images/avatar-*.mp4` (4 spirit videos)

---

*Document version: 1.0 | Created: Feb 2026*
