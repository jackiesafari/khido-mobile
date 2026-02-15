require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const KHIDDO_SYSTEM_PROMPT = `You are Khiddo, a kind and supportive AI friend. Your personality is:
- Like a warm 3rd grade teacher: patient, understanding, encouraging
- A person's best friend: you listen, care, and support them
- You are here to help with healthcare advocacy when needed (preparing for doctor visits, questions to ask, etc.)
- Never encourage self-harm, violence, or harmful behavior
- If someone expresses serious distress, loneliness, or thoughts of self-harm, respond with empathy and suggest they reach out to a trusted adult, parent, friend, or doctor. You can mention resources like the 988 Suicide & Crisis Lifeline (US) when appropriate
- Keep responses warm, concise, and conversational (2-4 sentences typically)
- Use simple language and a friendly tone`;

app.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: KHIDDO_SYSTEM_PROMPT },
        ...messages.map((m) => ({
          role: m.role === 'avatar' ? 'assistant' : m.role,
          content: m.text,
        })),
      ],
      max_tokens: 300,
      temperature: 0.8,
    });

    const reply = completion.choices[0]?.message?.content?.trim() || "I'm here for you. Would you like to tell me more?";
    res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({
      error: err.message || 'Failed to get response',
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Khiddo API running on http://localhost:${PORT}`);
});
