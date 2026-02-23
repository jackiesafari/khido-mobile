require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let Pool = null;
try {
  ({ Pool } = require('pg'));
} catch {
  Pool = null;
}

const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');
const DATABASE_URL = process.env.DATABASE_URL || null;
const SUPABASE_URL = process.env.SUPABASE_URL || null;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || null;
const MODES = ['companion', 'advocacy', 'regulation'];
const MESSAGE_ROLES = ['user', 'assistant'];

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const ipBuckets = new Map();

function nowISO() {
  return new Date().toISOString();
}

function getDefaultLocalDb() {
  return {
    users: [],
    consents: [],
    profiles: [],
    conversationSessions: [],
    messages: [],
    memoryFacts: [],
    gameEvents: [],
  };
}

function loadLocalDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    const db = getDefaultLocalDb();
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
    return db;
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return { ...getDefaultLocalDb(), ...JSON.parse(raw) };
  } catch {
    return getDefaultLocalDb();
  }
}

const localDb = loadLocalDb();
function saveLocalDb() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(localDb, null, 2));
}

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

function rateLimit(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  const bucket = ipBuckets.get(ip);

  if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    ipBuckets.set(ip, { count: 1, windowStart: now });
    return next();
  }
  bucket.count += 1;
  if (bucket.count > RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterSeconds = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - bucket.windowStart)) / 1000);
    res.set('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
  }
  return next();
}

function normalizeLegacyMessages(messages) {
  return messages.map((m) => ({
    role: m.role === 'avatar' ? 'assistant' : m.role,
    content: String(m.text || '').trim(),
  }));
}

function normalizeV1Messages(messages) {
  return messages.map((m) => ({
    role: m.role,
    content: String(m.content || '').trim(),
  }));
}

function isValidMessageArray(messages) {
  return (
    Array.isArray(messages) &&
    messages.length > 0 &&
    messages.every((m) => MESSAGE_ROLES.includes(m.role) && typeof m.content === 'string' && m.content.length > 0)
  );
}

const CRISIS_TERMS = [
  'kill myself',
  'end my life',
  'suicide',
  'want to die',
  'hurt myself',
  'self harm',
  'self-harm',
  'overdose',
  'cut myself',
  'no reason to live',
];

function hasCrisisSignal(text) {
  const normalized = text.toLowerCase();
  return CRISIS_TERMS.some((term) => normalized.includes(term));
}

const CRISIS_RESPONSE =
  "I'm really glad you told me. You deserve support right now. If you might hurt yourself or are in immediate danger, call emergency services now. In the US, you can call or text 988 for the Suicide & Crisis Lifeline. If you can, tell a trusted adult, family member, friend, or doctor right now so you are not alone.";

function parseJsonSafe(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function buildSystemPrompt({ mode, profile, memoryFacts, recentAssistantQuestions }) {
  const basePrompt = `You are Khido, a kind and supportive AI friend.
- Be warm, concise, and conversational (2-4 sentences).
- Use simple language and a gentle, encouraging tone.
- Acknowledge the user's most recent feeling or preference before asking anything new.
- Ask at most one follow-up question and only if it helps.
- Never ask the exact same question again if it was already asked recently.
- Never encourage harmful behavior.
- Do not provide diagnosis or medication instructions.
- For possible emergencies, tell users to seek immediate local professional help.`;

  const modeInstruction =
    mode === 'advocacy'
      ? `Advocacy mode: provide practical, concrete help with healthcare visits. Offer:
- one short script users can say to a doctor
- 2-3 specific questions to ask
- what to bring or track before the visit
- one next step checklist item`
      : mode === 'regulation'
        ? 'Regulation mode: prioritize calming support. Keep tone slower and grounding-focused.'
        : 'Companion mode: prioritize connection, reassurance, and low-pressure conversation.';

  const profileInstruction = profile
    ? `User profile:
- stress triggers: ${JSON.stringify(profile.stressTriggers)}
- preferred support style: ${JSON.stringify(profile.preferredSupportStyle)}
- advocacy needs: ${JSON.stringify(profile.advocacyNeeds)}`
    : 'User profile: not set.';

  const memoryInstruction =
    memoryFacts.length > 0
      ? `Known memory facts:\n${memoryFacts
          .map((fact) => `- ${fact.category}: ${fact.factValue} (confidence ${fact.confidence})`)
          .join('\n')}`
      : 'Known memory facts: none yet.';

  const repetitionInstruction =
    recentAssistantQuestions.length > 0
      ? `Recent assistant questions to avoid repeating:\n${recentAssistantQuestions.map((q) => `- ${q}`).join('\n')}`
      : 'No recent questions to avoid.';

  return [basePrompt, modeInstruction, profileInstruction, memoryInstruction, repetitionInstruction].join('\n\n');
}

function getLatestUserContent(messages) {
  return [...messages].reverse().find((m) => m.role === 'user')?.content || '';
}

async function generateAssistantReply({ mode, messages, profile, memoryFacts, recentAssistantQuestions }) {
  if (!openai) {
    throw Object.assign(new Error('Server is not fully configured. Missing OPENAI_API_KEY.'), { statusCode: 503 });
  }
  const systemPrompt = buildSystemPrompt({ mode, profile, memoryFacts, recentAssistantQuestions });
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    max_tokens: 320,
    temperature: 0.6,
    frequency_penalty: 0.4,
  });
  return completion.choices[0]?.message?.content?.trim() || "I'm here for you. Would you like to tell me more?";
}

async function resolveSupabaseUserFromAuthHeader(authHeader) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: authHeader,
    },
  });
  if (!response.ok) return null;
  return response.json();
}

function createStore() {
  const canUsePostgres = Boolean(DATABASE_URL && Pool);

  if (canUsePostgres) {
    const pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    return {
      mode: 'postgres',
      async init() {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY,
            created_at TIMESTAMPTZ NOT NULL,
            auth_user_id TEXT UNIQUE,
            display_name TEXT,
            age_band TEXT,
            locale TEXT,
            timezone TEXT,
            pronouns TEXT
          );
          ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id TEXT UNIQUE;
          CREATE TABLE IF NOT EXISTS consents (
            user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            chat_personalization_enabled BOOLEAN NOT NULL,
            game_personalization_enabled BOOLEAN NOT NULL,
            analytics_enabled BOOLEAN NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL
          );
          CREATE TABLE IF NOT EXISTS profiles (
            user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            stress_triggers JSONB NOT NULL,
            preferred_support_style JSONB NOT NULL,
            advocacy_needs JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL
          );
          CREATE TABLE IF NOT EXISTS conversation_sessions (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            started_at TIMESTAMPTZ NOT NULL,
            ended_at TIMESTAMPTZ,
            mode TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS messages (
            id UUID PRIMARY KEY,
            session_id UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
            role TEXT NOT NULL,
            text TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL,
            safety_flags JSONB NOT NULL
          );
          CREATE TABLE IF NOT EXISTS memory_facts (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            category TEXT NOT NULL,
            fact_key TEXT NOT NULL,
            fact_value TEXT NOT NULL,
            confidence DOUBLE PRECISION NOT NULL,
            source TEXT NOT NULL,
            last_seen_at TIMESTAMPTZ NOT NULL,
            UNIQUE (user_id, fact_key)
          );
          CREATE TABLE IF NOT EXISTS game_events (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            game_type TEXT NOT NULL,
            event_type TEXT NOT NULL,
            intensity INTEGER,
            duration_ms INTEGER,
            metadata JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL
          );
        `);
      },
      async countUsers() {
        const result = await pool.query('SELECT COUNT(*)::int AS count FROM users');
        return result.rows[0]?.count || 0;
      },
      async createUser(payload = {}) {
        const user = {
          id: crypto.randomUUID(),
          createdAt: nowISO(),
          authUserId: payload.authUserId || null,
          displayName: payload.displayName || null,
          ageBand: payload.ageBand || null,
          locale: payload.locale || 'en-US',
          timezone: payload.timezone || 'America/New_York',
          pronouns: payload.pronouns || null,
        };
        await pool.query(
          `INSERT INTO users (id, created_at, auth_user_id, display_name, age_band, locale, timezone, pronouns)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            user.id,
            user.createdAt,
            user.authUserId,
            user.displayName,
            user.ageBand,
            user.locale,
            user.timezone,
            user.pronouns,
          ]
        );
        await pool.query(
          `INSERT INTO consents
            (user_id, chat_personalization_enabled, game_personalization_enabled, analytics_enabled, updated_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [user.id, true, true, true, nowISO()]
        );
        await pool.query(
          `INSERT INTO profiles (user_id, stress_triggers, preferred_support_style, advocacy_needs, updated_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            user.id,
            JSON.stringify([]),
            JSON.stringify({ tone: 'warm', pace: 'calm', questionFrequency: 'low' }),
            JSON.stringify({ doctorAnxiety: false, dismissalConcern: false, languageSupport: null }),
            nowISO(),
          ]
        );
        return user;
      },
      async findGuestUser() {
        const result = await pool.query(`SELECT * FROM users WHERE display_name = 'Guest' AND auth_user_id IS NULL LIMIT 1`);
        const row = result.rows[0];
        if (!row) return null;
        return {
          id: row.id,
          createdAt: row.created_at,
          authUserId: row.auth_user_id,
          displayName: row.display_name,
          ageBand: row.age_band,
          locale: row.locale,
          timezone: row.timezone,
          pronouns: row.pronouns,
        };
      },
      async getUserByAuthUserId(authUserId) {
        const result = await pool.query('SELECT * FROM users WHERE auth_user_id = $1 LIMIT 1', [authUserId]);
        const row = result.rows[0];
        if (!row) return null;
        return {
          id: row.id,
          createdAt: row.created_at,
          authUserId: row.auth_user_id,
          displayName: row.display_name,
          ageBand: row.age_band,
          locale: row.locale,
          timezone: row.timezone,
          pronouns: row.pronouns,
        };
      },
      async getOrCreateUserForAuth(authUser, payload = {}) {
        const existing = await this.getUserByAuthUserId(authUser.id);
        if (existing) return existing;

        const displayName =
          payload.displayName ||
          authUser.user_metadata?.name ||
          authUser.email?.split('@')?.[0] ||
          'Friend';
        return this.createUser({
          authUserId: authUser.id,
          displayName,
          locale: payload.locale || authUser.user_metadata?.locale || 'en-US',
          timezone: payload.timezone || 'America/New_York',
        });
      },
      async getUserById(userId) {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        const row = result.rows[0];
        if (!row) return null;
        return {
          id: row.id,
          createdAt: row.created_at,
          authUserId: row.auth_user_id,
          displayName: row.display_name,
          ageBand: row.age_band,
          locale: row.locale,
          timezone: row.timezone,
          pronouns: row.pronouns,
        };
      },
      async getConsentByUserId(userId) {
        const result = await pool.query('SELECT * FROM consents WHERE user_id = $1', [userId]);
        const row = result.rows[0];
        if (!row) return null;
        return {
          userId: row.user_id,
          chatPersonalizationEnabled: row.chat_personalization_enabled,
          gamePersonalizationEnabled: row.game_personalization_enabled,
          analyticsEnabled: row.analytics_enabled,
          updatedAt: row.updated_at,
        };
      },
      async getProfileByUserId(userId) {
        const result = await pool.query('SELECT * FROM profiles WHERE user_id = $1', [userId]);
        const row = result.rows[0];
        if (!row) return null;
        return {
          userId: row.user_id,
          stressTriggers: parseJsonSafe(row.stress_triggers, []),
          preferredSupportStyle: parseJsonSafe(row.preferred_support_style, {}),
          advocacyNeeds: parseJsonSafe(row.advocacy_needs, {}),
          updatedAt: row.updated_at,
        };
      },
      async getMemoryFacts(userId, limit = 8) {
        const result = await pool.query(
          `SELECT * FROM memory_facts WHERE user_id = $1 ORDER BY last_seen_at DESC LIMIT $2`,
          [userId, limit]
        );
        return result.rows.map((row) => ({
          id: row.id,
          userId: row.user_id,
          category: row.category,
          factKey: row.fact_key,
          factValue: row.fact_value,
          confidence: row.confidence,
          source: row.source,
          lastSeenAt: row.last_seen_at,
        }));
      },
      async upsertMemoryFact(userId, category, factKey, factValue, source) {
        await pool.query(
          `INSERT INTO memory_facts
            (id, user_id, category, fact_key, fact_value, confidence, source, last_seen_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (user_id, fact_key)
           DO UPDATE SET
             category = EXCLUDED.category,
             fact_value = EXCLUDED.fact_value,
             source = EXCLUDED.source,
             last_seen_at = EXCLUDED.last_seen_at,
             confidence = LEAST(1, memory_facts.confidence + 0.1)`,
          [crypto.randomUUID(), userId, category, factKey, factValue, 0.6, source, nowISO()]
        );
      },
      async getOrCreateSession(userId, sessionId, mode = 'companion') {
        if (sessionId) {
          const existing = await pool.query(
            `SELECT * FROM conversation_sessions WHERE id = $1 AND user_id = $2 LIMIT 1`,
            [sessionId, userId]
          );
          if (existing.rows[0]) {
            return {
              id: existing.rows[0].id,
              userId: existing.rows[0].user_id,
              startedAt: existing.rows[0].started_at,
              endedAt: existing.rows[0].ended_at,
              mode: existing.rows[0].mode,
            };
          }
        }

        const created = {
          id: crypto.randomUUID(),
          userId,
          startedAt: nowISO(),
          endedAt: null,
          mode: MODES.includes(mode) ? mode : 'companion',
        };
        await pool.query(
          `INSERT INTO conversation_sessions (id, user_id, started_at, ended_at, mode)
           VALUES ($1, $2, $3, $4, $5)`,
          [created.id, created.userId, created.startedAt, created.endedAt, created.mode]
        );
        return created;
      },
      async getRecentAssistantQuestions(sessionId, limit = 5) {
        const result = await pool.query(
          `SELECT text FROM messages
           WHERE session_id = $1 AND role = 'assistant'
           ORDER BY created_at DESC
           LIMIT $2`,
          [sessionId, limit]
        );
        return result.rows.map((row) => row.text).filter((text) => text.includes('?'));
      },
      async insertMessage({ sessionId, role, text, safetyFlags = {} }) {
        await pool.query(
          `INSERT INTO messages (id, session_id, role, text, created_at, safety_flags)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [crypto.randomUUID(), sessionId, role, text, nowISO(), JSON.stringify(safetyFlags)]
        );
      },
      async updateProfile(userId, patch) {
        const user = await this.getUserById(userId);
        const profile = await this.getProfileByUserId(userId);
        if (!user || !profile) return null;

        const nextUser = { ...user };
        const allowedUserFields = ['displayName', 'ageBand', 'locale', 'timezone', 'pronouns'];
        for (const field of allowedUserFields) {
          if (Object.prototype.hasOwnProperty.call(patch, field)) nextUser[field] = patch[field];
        }

        await pool.query(
          `UPDATE users
           SET display_name = $2, age_band = $3, locale = $4, timezone = $5, pronouns = $6
           WHERE id = $1`,
          [userId, nextUser.displayName, nextUser.ageBand, nextUser.locale, nextUser.timezone, nextUser.pronouns]
        );

        const updatedProfile = {
          ...profile,
          stressTriggers:
            Object.prototype.hasOwnProperty.call(patch, 'stressTriggers') && Array.isArray(patch.stressTriggers)
              ? patch.stressTriggers
              : profile.stressTriggers,
          preferredSupportStyle:
            Object.prototype.hasOwnProperty.call(patch, 'preferredSupportStyle') &&
            typeof patch.preferredSupportStyle === 'object'
              ? { ...profile.preferredSupportStyle, ...patch.preferredSupportStyle }
              : profile.preferredSupportStyle,
          advocacyNeeds:
            Object.prototype.hasOwnProperty.call(patch, 'advocacyNeeds') && typeof patch.advocacyNeeds === 'object'
              ? { ...profile.advocacyNeeds, ...patch.advocacyNeeds }
              : profile.advocacyNeeds,
          updatedAt: nowISO(),
        };

        await pool.query(
          `UPDATE profiles
           SET stress_triggers = $2, preferred_support_style = $3, advocacy_needs = $4, updated_at = $5
           WHERE user_id = $1`,
          [
            userId,
            JSON.stringify(updatedProfile.stressTriggers),
            JSON.stringify(updatedProfile.preferredSupportStyle),
            JSON.stringify(updatedProfile.advocacyNeeds),
            updatedProfile.updatedAt,
          ]
        );
        return { user: nextUser, profile: updatedProfile };
      },
      async updateConsents(userId, patch) {
        const consent = await this.getConsentByUserId(userId);
        if (!consent) return null;
        const next = { ...consent };
        const fields = ['chatPersonalizationEnabled', 'gamePersonalizationEnabled', 'analyticsEnabled'];
        for (const field of fields) {
          if (Object.prototype.hasOwnProperty.call(patch, field) && typeof patch[field] === 'boolean') {
            next[field] = patch[field];
          }
        }
        next.updatedAt = nowISO();
        await pool.query(
          `UPDATE consents
           SET chat_personalization_enabled = $2,
               game_personalization_enabled = $3,
               analytics_enabled = $4,
               updated_at = $5
           WHERE user_id = $1`,
          [userId, next.chatPersonalizationEnabled, next.gamePersonalizationEnabled, next.analyticsEnabled, next.updatedAt]
        );
        return next;
      },
      async insertGameEvent(payload) {
        const event = {
          id: crypto.randomUUID(),
          userId: payload.userId,
          gameType: payload.gameType,
          eventType: payload.eventType,
          intensity: typeof payload.intensity === 'number' ? payload.intensity : null,
          durationMs: typeof payload.durationMs === 'number' ? payload.durationMs : null,
          metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {},
          createdAt: nowISO(),
        };
        await pool.query(
          `INSERT INTO game_events
            (id, user_id, game_type, event_type, intensity, duration_ms, metadata, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            event.id,
            event.userId,
            event.gameType,
            event.eventType,
            event.intensity,
            event.durationMs,
            JSON.stringify(event.metadata),
            event.createdAt,
          ]
        );
        return event;
      },
      async getRecentGameEvents(userId, limit = 10) {
        const result = await pool.query(
          `SELECT * FROM game_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
          [userId, limit]
        );
        return result.rows.map((row) => ({
          id: row.id,
          userId: row.user_id,
          gameType: row.game_type,
          eventType: row.event_type,
          intensity: row.intensity,
          durationMs: row.duration_ms,
          metadata: parseJsonSafe(row.metadata, {}),
          createdAt: row.created_at,
        }));
      },
    };
  }

  return {
    mode: 'file',
    async init() {},
    async countUsers() {
      return localDb.users.length;
    },
    async createUser(payload = {}) {
      const user = {
        id: crypto.randomUUID(),
        createdAt: nowISO(),
        authUserId: payload.authUserId || null,
        displayName: payload.displayName || null,
        ageBand: payload.ageBand || null,
        locale: payload.locale || 'en-US',
        timezone: payload.timezone || 'America/New_York',
        pronouns: payload.pronouns || null,
      };
      localDb.users.push(user);
      localDb.consents.push({
        userId: user.id,
        chatPersonalizationEnabled: true,
        gamePersonalizationEnabled: true,
        analyticsEnabled: true,
        updatedAt: nowISO(),
      });
      localDb.profiles.push({
        userId: user.id,
        stressTriggers: [],
        preferredSupportStyle: { tone: 'warm', pace: 'calm', questionFrequency: 'low' },
        advocacyNeeds: { doctorAnxiety: false, dismissalConcern: false, languageSupport: null },
        updatedAt: nowISO(),
      });
      saveLocalDb();
      return user;
    },
    async findGuestUser() {
      return localDb.users.find((u) => u.displayName === 'Guest' && !u.authUserId) || null;
    },
    async getUserByAuthUserId(authUserId) {
      return localDb.users.find((u) => u.authUserId === authUserId) || null;
    },
    async getOrCreateUserForAuth(authUser, payload = {}) {
      const existing = await this.getUserByAuthUserId(authUser.id);
      if (existing) return existing;
      const displayName = payload.displayName || authUser.user_metadata?.name || authUser.email?.split('@')?.[0] || 'Friend';
      return this.createUser({
        authUserId: authUser.id,
        displayName,
        locale: payload.locale || authUser.user_metadata?.locale || 'en-US',
      });
    },
    async getUserById(userId) {
      return localDb.users.find((u) => u.id === userId) || null;
    },
    async getConsentByUserId(userId) {
      return localDb.consents.find((c) => c.userId === userId) || null;
    },
    async getProfileByUserId(userId) {
      return localDb.profiles.find((p) => p.userId === userId) || null;
    },
    async getMemoryFacts(userId, limit = 8) {
      return localDb.memoryFacts
        .filter((fact) => fact.userId === userId)
        .sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime())
        .slice(0, limit);
    },
    async upsertMemoryFact(userId, category, factKey, factValue, source) {
      const existing = localDb.memoryFacts.find((f) => f.userId === userId && f.factKey === factKey);
      if (existing) {
        existing.factValue = factValue;
        existing.category = category;
        existing.source = source;
        existing.lastSeenAt = nowISO();
        existing.confidence = Math.min(1, Number((existing.confidence + 0.1).toFixed(2)));
      } else {
        localDb.memoryFacts.push({
          id: crypto.randomUUID(),
          userId,
          category,
          factKey,
          factValue,
          confidence: 0.6,
          source,
          lastSeenAt: nowISO(),
        });
      }
      saveLocalDb();
    },
    async getOrCreateSession(userId, sessionId, mode = 'companion') {
      if (sessionId) {
        const existing = localDb.conversationSessions.find((s) => s.id === sessionId && s.userId === userId);
        if (existing) return existing;
      }
      const created = {
        id: crypto.randomUUID(),
        userId,
        startedAt: nowISO(),
        endedAt: null,
        mode: MODES.includes(mode) ? mode : 'companion',
      };
      localDb.conversationSessions.push(created);
      saveLocalDb();
      return created;
    },
    async getRecentAssistantQuestions(sessionId, limit = 5) {
      return localDb.messages
        .filter((m) => m.sessionId === sessionId && m.role === 'assistant')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limit)
        .map((m) => m.text)
        .filter((text) => text.includes('?'));
    },
    async insertMessage({ sessionId, role, text, safetyFlags = {} }) {
      localDb.messages.push({
        id: crypto.randomUUID(),
        sessionId,
        role,
        text,
        createdAt: nowISO(),
        safetyFlags,
      });
      saveLocalDb();
    },
    async updateProfile(userId, patch) {
      const user = localDb.users.find((u) => u.id === userId);
      const profile = localDb.profiles.find((p) => p.userId === userId);
      if (!user || !profile) return null;

      const allowedUserFields = ['displayName', 'ageBand', 'locale', 'timezone', 'pronouns'];
      for (const field of allowedUserFields) {
        if (Object.prototype.hasOwnProperty.call(patch, field)) user[field] = patch[field];
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'stressTriggers') && Array.isArray(patch.stressTriggers)) {
        profile.stressTriggers = patch.stressTriggers;
      }
      if (
        Object.prototype.hasOwnProperty.call(patch, 'preferredSupportStyle') &&
        typeof patch.preferredSupportStyle === 'object'
      ) {
        profile.preferredSupportStyle = { ...profile.preferredSupportStyle, ...patch.preferredSupportStyle };
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'advocacyNeeds') && typeof patch.advocacyNeeds === 'object') {
        profile.advocacyNeeds = { ...profile.advocacyNeeds, ...patch.advocacyNeeds };
      }
      profile.updatedAt = nowISO();
      saveLocalDb();
      return { user, profile };
    },
    async updateConsents(userId, patch) {
      const consent = localDb.consents.find((c) => c.userId === userId);
      if (!consent) return null;
      const fields = ['chatPersonalizationEnabled', 'gamePersonalizationEnabled', 'analyticsEnabled'];
      for (const field of fields) {
        if (Object.prototype.hasOwnProperty.call(patch, field) && typeof patch[field] === 'boolean') {
          consent[field] = patch[field];
        }
      }
      consent.updatedAt = nowISO();
      saveLocalDb();
      return consent;
    },
    async insertGameEvent(payload) {
      const event = {
        id: crypto.randomUUID(),
        userId: payload.userId,
        gameType: payload.gameType,
        eventType: payload.eventType,
        intensity: typeof payload.intensity === 'number' ? payload.intensity : null,
        durationMs: typeof payload.durationMs === 'number' ? payload.durationMs : null,
        metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {},
        createdAt: nowISO(),
      };
      localDb.gameEvents.push(event);
      saveLocalDb();
      return event;
    },
    async getRecentGameEvents(userId, limit = 10) {
      return localDb.gameEvents
        .filter((e) => e.userId === userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limit);
    },
  };
}

const store = createStore();

async function extractMemoryFactsFromUserMessage(userId, userText) {
  const text = userText.trim();
  const lower = text.toLowerCase();
  const preferenceMatch = text.match(/(?:i like|i love|my favorite is)\s+(.+)/i);
  if (preferenceMatch?.[1]) {
    await store.upsertMemoryFact(userId, 'preference', 'general_preference', preferenceMatch[1].trim(), 'chat');
  }
  if (lower.includes('anxious about') || lower.includes('stressed about') || lower.includes('worried about')) {
    await store.upsertMemoryFact(userId, 'trigger', 'reported_trigger', text, 'chat');
  }
  if (lower.includes('doctor') || lower.includes('appointment')) {
    await store.upsertMemoryFact(userId, 'advocacy', 'medical_visit_context', text, 'chat');
  }
}

async function getRecommendationsForUser(userId) {
  const recentGames = await store.getRecentGameEvents(userId, 10);
  const recentFacts = await store.getMemoryFacts(userId, 5);
  const hasCalmImproved = recentGames.some((e) => e.eventType === 'calm_improved');
  const hasFrustrated = recentGames.some((e) => e.eventType === 'frustrated');

  const recommendations = [];
  if (hasFrustrated) recommendations.push('Try a lower-intensity calming activity and use shorter game sessions (2-3 minutes).');
  if (hasCalmImproved) recommendations.push('Repeat the same calming game tactic that worked recently before difficult moments.');
  if (recentFacts.some((fact) => fact.category === 'advocacy')) {
    recommendations.push('Before your next visit, write 2 top concerns and 3 questions to ask your doctor.');
  }
  if (recommendations.length === 0) {
    recommendations.push('Take one slow breathing break now and check in with how your body feels afterward.');
  }
  return recommendations;
}

async function getAuthedAppUser(req, res) {
  const authUser = req.authUser;
  if (!authUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  const user = await store.getOrCreateUserForAuth(authUser, {});
  return user;
}

async function handlePhase1Chat({ req, res, messages, userId, mode, sessionId }) {
  if (!isValidMessageArray(messages)) return res.status(400).json({ error: 'invalid messages format' });

  const user = await store.getUserById(userId);
  if (!user) return res.status(404).json({ error: 'user not found' });

  const resolvedMode = MODES.includes(mode) ? mode : 'companion';
  const session = await store.getOrCreateSession(user.id, sessionId, resolvedMode);
  const profile = await store.getProfileByUserId(user.id);
  const memoryFacts = await store.getMemoryFacts(user.id);
  const recentAssistantQuestions = await store.getRecentAssistantQuestions(session.id);
  const latestUserContent = getLatestUserContent(messages);

  if (latestUserContent && hasCrisisSignal(latestUserContent)) {
    return res.json({ reply: CRISIS_RESPONSE, sessionId: session.id, safety: { crisisEscalation: true } });
  }

  const reply = await generateAssistantReply({
    mode: resolvedMode,
    messages,
    profile,
    memoryFacts,
    recentAssistantQuestions,
  });

  if (latestUserContent) {
    await store.insertMessage({ sessionId: session.id, role: 'user', text: latestUserContent, safetyFlags: {} });
    await extractMemoryFactsFromUserMessage(user.id, latestUserContent);
  }

  const safeReply = hasCrisisSignal(reply) ? CRISIS_RESPONSE : reply;
  await store.insertMessage({
    sessionId: session.id,
    role: 'assistant',
    text: safeReply,
    safetyFlags: hasCrisisSignal(reply) ? { crisisEscalation: true } : {},
  });

  return res.json({ reply: safeReply, sessionId: session.id, mode: resolvedMode });
}

app.use((req, res, next) => {
  const requestId = crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
});

app.get('/', (req, res) => {
  const accept = (req.headers.accept || '').toLowerCase();
  const isBrowser = accept.includes('text/html');
  if (isBrowser) {
    res.status(200).type('html').send(`<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Khido Sign-In</title></head><body>
<script>
(function(){
  var hash = window.location.hash || '';
  if (hash.indexOf('access_token') !== -1) {
    var next = 'khido://auth';
    window.location.replace('/auth/callback?next=' + encodeURIComponent(next) + hash);
    return;
  }
  document.body.innerHTML = '<p style="font-family:system-ui;padding:24px;color:#333;">' +
    'If you were trying to sign in to Khido, the link may have opened incorrectly.</p>' +
    '<p style="font-family:system-ui;padding:0 24px;color:#666;">Return to the Khido app and try again, or use the 6-digit code from your email.</p>';
})();
</script><p style="font-family:system-ui;padding:24px;color:#666;">Loading...</p></body></html>`);
    return;
  }
  res.status(200).json({ status: 'ok', service: 'khido-api', storage: store.mode, version: 'phase1-auth' });
});

app.get('/auth/callback', (req, res) => {
  const requestedNext = typeof req.query.next === 'string' ? req.query.next : '';
  const safeNext = requestedNext.startsWith('khido://') || requestedNext.startsWith('exp://')
    ? requestedNext
    : 'khido://auth';

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Khido Sign-In</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #1f2937; }
    a { color: #2563eb; font-weight: 600; }
  </style>
</head>
<body>
  <p>Finishing sign in...</p>
  <p>If the app does not open automatically, <a id="open-link" href="#">tap here</a>.</p>
  <script>
    (function () {
      const nextUrl = ${JSON.stringify(safeNext)};
      const queryParams = new URLSearchParams(window.location.search);
      queryParams.delete('next');

      const hashParams = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
      hashParams.forEach((value, key) => {
        if (!queryParams.has(key)) queryParams.set(key, value);
      });

      const separator = nextUrl.includes('?') ? '&' : '?';
      const finalUrl = queryParams.toString() ? nextUrl + separator + queryParams.toString() : nextUrl;

      const link = document.getElementById('open-link');
      if (link) link.setAttribute('href', finalUrl);

      window.location.replace(finalUrl);
    })();
  </script>
</body>
</html>`;

  res.status(200).type('html').send(html);
});

app.get('/health', async (_req, res) => {
  const userCount = await store.countUsers();
  res.status(200).json({
    status: 'ok',
    storage: store.mode,
    hasOpenAIKey: Boolean(OPENAI_API_KEY),
    hasDatabaseUrl: Boolean(DATABASE_URL),
    hasSupabaseConfig: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
    timestamp: nowISO(),
    uptimeSeconds: Math.floor(process.uptime()),
    users: userCount,
  });
});

app.use(['/chat', '/v1/chat'], rateLimit);

async function requireSupabaseAuth(req, res, next) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(503).json({ error: 'Supabase auth is not configured on the server.' });
  }
  try {
    const authUser = await resolveSupabaseUserFromAuthHeader(req.headers.authorization || '');
    if (!authUser?.id) return res.status(401).json({ error: 'Unauthorized' });
    req.authUser = authUser;
    return next();
  } catch (err) {
    console.error(`[${req.requestId}] auth error:`, err);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

app.use('/v1', requireSupabaseAuth);

app.post('/v1/users', async (req, res) => {
  const user = await store.getOrCreateUserForAuth(req.authUser, req.body || {});
  res.status(201).json({ user });
});

app.get('/v1/users/:userId/profile', async (req, res) => {
  const authedUser = await getAuthedAppUser(req, res);
  if (!authedUser) return;
  if (req.params.userId !== authedUser.id) return res.status(403).json({ error: 'Forbidden' });

  return res.json({
    user: authedUser,
    consent: await store.getConsentByUserId(authedUser.id),
    profile: await store.getProfileByUserId(authedUser.id),
    memoryFacts: await store.getMemoryFacts(authedUser.id),
  });
});

app.patch('/v1/users/:userId/profile', async (req, res) => {
  const authedUser = await getAuthedAppUser(req, res);
  if (!authedUser) return;
  if (req.params.userId !== authedUser.id) return res.status(403).json({ error: 'Forbidden' });

  const updated = await store.updateProfile(authedUser.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'user or profile not found' });
  return res.json(updated);
});

app.patch('/v1/users/:userId/consents', async (req, res) => {
  const authedUser = await getAuthedAppUser(req, res);
  if (!authedUser) return;
  if (req.params.userId !== authedUser.id) return res.status(403).json({ error: 'Forbidden' });

  const consent = await store.updateConsents(authedUser.id, req.body || {});
  if (!consent) return res.status(404).json({ error: 'consent not found' });
  return res.json({ consent });
});

app.post('/v1/game-events', async (req, res) => {
  const authedUser = await getAuthedAppUser(req, res);
  if (!authedUser) return;

  const { gameType, eventType, intensity, durationMs, metadata } = req.body || {};
  if (!gameType || !eventType) return res.status(400).json({ error: 'gameType and eventType are required' });

  const event = await store.insertGameEvent({
    userId: authedUser.id,
    gameType,
    eventType,
    intensity,
    durationMs,
    metadata,
  });

  if (eventType === 'calm_improved') {
    await store.upsertMemoryFact(authedUser.id, 'coping', `game_${gameType}_effective`, `${gameType} helped reduce stress`, 'game');
  }
  if (eventType === 'frustrated') {
    await store.upsertMemoryFact(authedUser.id, 'coping', `game_${gameType}_frustrating`, `${gameType} may feel overstimulating`, 'game');
  }
  return res.status(201).json({ event });
});

app.get('/v1/recommendations/:userId', async (req, res) => {
  const authedUser = await getAuthedAppUser(req, res);
  if (!authedUser) return;
  if (req.params.userId !== authedUser.id) return res.status(403).json({ error: 'Forbidden' });

  return res.json({
    userId: authedUser.id,
    recommendations: await getRecommendationsForUser(authedUser.id),
  });
});

app.post('/v1/chat', async (req, res) => {
  try {
    const authedUser = await getAuthedAppUser(req, res);
    if (!authedUser) return;

    const { mode = 'companion', sessionId, messages } = req.body || {};
    const normalizedMessages = normalizeV1Messages(messages || []);
    return await handlePhase1Chat({
      req,
      res,
      messages: normalizedMessages,
      userId: authedUser.id,
      mode,
      sessionId,
    });
  } catch (err) {
    const statusCode = err?.statusCode || 500;
    console.error(`[${req.requestId}] /v1/chat error:`, err);
    return res.status(statusCode).json({
      error: statusCode === 503 ? err.message : 'Failed to get response',
      requestId: req.requestId,
    });
  }
});

// Legacy non-auth endpoint used by demo mode.
app.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array required' });
    }
    const normalizedMessages = normalizeLegacyMessages(messages);
    if (!isValidMessageArray(normalizedMessages)) {
      return res.status(400).json({ error: 'invalid messages format' });
    }

    let legacyUser = await store.findGuestUser();
    if (!legacyUser) legacyUser = await store.createUser({ displayName: 'Guest' });

    return await handlePhase1Chat({
      req,
      res,
      messages: normalizedMessages,
      userId: legacyUser.id,
      mode: 'companion',
      sessionId: null,
    });
  } catch (err) {
    const statusCode = err?.statusCode || 500;
    console.error(`[${req.requestId}] /chat error:`, err);
    return res.status(statusCode).json({
      error: statusCode === 503 ? err.message : 'Failed to get response',
      requestId: req.requestId,
    });
  }
});

async function start() {
  await store.init();
  if (DATABASE_URL && !Pool) {
    console.warn('DATABASE_URL is set, but package "pg" is not installed. Falling back to file storage.');
  }
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Khido API running on http://localhost:${PORT} (storage: ${store.mode})`);
  });
}

start().catch((err) => {
  console.error('Failed to start API:', err);
  process.exit(1);
});
