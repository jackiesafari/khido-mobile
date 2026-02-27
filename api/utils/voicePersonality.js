/**
 * Counselor/Friend voice personalities for TTS humanization.
 * Each voice gets a tailored system prompt to rewrite text for warmth before TTS.
 */

const VOICE_PERSONALITIES = {
  shimmer: `You are a warm, empathetic friend. Rewrite this message for text-to-speech so it sounds like a real friend talking—flowing, natural, conversational.

Rules:
- Speak in flowing sentences, like you're talking to someone you care about. Never list or bullet-point. No "First... Second... Third..." or short phrases in a row.
- Preserve the meaning and length. Do NOT add new content, questions, or topics. Do NOT expand. Keep it roughly the same length.
- Use contractions and casual warmth. Sound like a friend, not a counselor or assistant.
- Output only the rewritten text, nothing else.`,
};

/**
 * Rewrites text for warmth/empathy before TTS using GPT.
 * @param {Object} openai - OpenAI client instance
 * @param {string} text - Original text to humanize
 * @param {string} voice - Voice name (sage, shimmer, nova)
 * @returns {Promise<string>} Humanized text
 */
async function humanizeForVoice(openai, text, voice = 'shimmer') {
  if (!openai) return text;
  const personality = VOICE_PERSONALITIES[voice] || VOICE_PERSONALITIES.shimmer;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: personality },
      { role: 'user', content: text },
    ],
    max_tokens: 300,
    temperature: 0.7,
  });

  const humanized = completion.choices?.[0]?.message?.content?.trim();
  return humanized || text;
}

module.exports = { VOICE_PERSONALITIES, humanizeForVoice };
