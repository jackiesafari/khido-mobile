require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const crypto = require('crypto');

const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = OPENAI_API_KEY
  ? new OpenAI({ apiKey: OPENAI_API_KEY })
  : null;

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const ipBuckets = new Map();

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
    return res.status(429).json({
      error: 'Too many requests. Please wait a moment and try again.',
    });
  }

  return next();
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

const CRISIS_RESPONSE = "I'm really glad you told me. You deserve support right now. If you might hurt yourself or are in immediate danger, call emergency services now. In the US, you can call or text 988 for the Suicide & Crisis Lifeline. If you can, tell a trusted adult, family member, friend, or doctor right now so you are not alone.";

const KHIDDO_SYSTEM_PROMPT = `You are Khiddo, a kind and supportive AI friend. Your personality is:
- Like a warm 3rd grade teacher: patient, understanding, encouraging
- A person's best friend: you listen, care, and support them
- You are here to help with healthcare advocacy when needed (preparing for doctor visits, questions to ask, etc.)
- Never encourage self-harm, violence, or harmful behavior
- If someone expresses serious distress, loneliness, or thoughts of self-harm, respond with empathy and suggest they reach out to a trusted adult, parent, friend, or doctor. You can mention resources like the 988 Suicide & Crisis Lifeline (US) when appropriate
- Keep responses warm, concise, and conversational (2-4 sentences typically)
- Use simple language and a friendly tone
- Track what the user already said in this conversation and do not ask the same question twice
- When the user answers a question, acknowledge their answer before asking anything new
- Ask at most one follow-up question per reply, and only if it moves the conversation forward
- Prefer reflective, supportive statements over rapid-fire questions`;

app.use((req, res, next) => {
  const requestId = crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
});

app.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'khiddo-api' });
});

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    hasOpenAIKey: Boolean(OPENAI_API_KEY),
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

app.use('/chat', rateLimit);

app.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }
    if (messages.length === 0) {
      return res.status(400).json({ error: 'messages array cannot be empty' });
    }

    const normalizedMessages = messages.map((m) => ({
      role: m.role === 'avatar' ? 'assistant' : m.role,
      content: String(m.text || '').trim(),
    }));
    const hasInvalidMessage = normalizedMessages.some(
      (m) => !['user', 'assistant'].includes(m.role) || !m.content
    );
    if (hasInvalidMessage) {
      return res.status(400).json({ error: 'invalid messages format' });
    }

    const latestUserMessage = [...normalizedMessages]
      .reverse()
      .find((m) => m.role === 'user')?.content;
    if (latestUserMessage && hasCrisisSignal(latestUserMessage)) {
      return res.json({ reply: CRISIS_RESPONSE, safety: { crisisEscalation: true } });
    }

    if (!openai) {
      return res.status(503).json({
        error: 'Server is not fully configured. Missing OPENAI_API_KEY.',
      });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: KHIDDO_SYSTEM_PROMPT },
        ...normalizedMessages,
      ],
      max_tokens: 300,
      temperature: 0.6,
      frequency_penalty: 0.4,
    });

    const reply = completion.choices[0]?.message?.content?.trim() || "I'm here for you. Would you like to tell me more?";
    if (hasCrisisSignal(reply)) {
      return res.json({ reply: CRISIS_RESPONSE, safety: { crisisEscalation: true } });
    }

    res.json({ reply });
  } catch (err) {
    console.error(`[${req.requestId}] Chat error:`, err);
    res.status(500).json({
      error: 'Failed to get response',
      requestId: req.requestId,
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Khiddo API running on http://localhost:${PORT}`);
});
