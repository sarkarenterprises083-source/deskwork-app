// Server-side route. Runs on Vercel's serverless functions, never in the browser,
// so the GOOGLE_API_KEY env var stays secret.

const { checkRateLimit, MAX_REQUESTS_PER_WINDOW } = require('../../lib/rateLimit');

const SUMMARIZE_SYSTEM =
  "You summarize text accurately and concisely. Output only the summary itself, " +
  "with no preamble, no 'Here is a summary' framing, and no closing remarks.";

const GENERATE_SYSTEM_TEMPLATE = (tone) =>
  `You are a skilled copywriter. Write the requested content in a ${tone.toLowerCase()} tone. ` +
  "Output only the finished piece, with no preamble, no meta-commentary, and no markdown " +
  "headers unless the format calls for them.";

const EXTRACT_SYSTEM =
  "You extract structured data from text. Respond with ONLY a raw JSON array of objects, " +
  "no markdown fences, no commentary. If the text describes a single record, return an array " +
  "with one object. If a field cannot be found, use null for its value.";

const GEMINI_MODEL = 'gemini-3.6-flash';

function buildRequest(mode, payload) {
  if (mode === 'summarize') {
    const { text, length } = payload;
    if (!text || !text.trim()) throw badRequest('Missing text to summarize.');
    return {
      system: SUMMARIZE_SYSTEM,
      user: `Summarize the following text as ${length}.\n\nTEXT:\n${text}`,
    };
  }

  if (mode === 'generate') {
    const { brief, type, tone } = payload;
    if (!brief || !brief.trim()) throw badRequest('Missing brief to generate from.');
    return {
      system: GENERATE_SYSTEM_TEMPLATE(tone || 'Professional'),
      user: `Write a ${(type || 'piece of content').toLowerCase()} based on this brief:\n\n${brief}`,
    };
  }

  if (mode === 'extract') {
    const { text, fields } = payload;
    if (!text || !text.trim()) throw badRequest('Missing text to extract from.');
    if (!Array.isArray(fields) || fields.length === 0) throw badRequest('Missing fields to extract.');
    return {
      system: EXTRACT_SYSTEM,
      user:
        `Extract these fields: ${fields.join(', ')}.\n\nTEXT:\n${text}\n\n` +
        `Respond with a JSON array of objects using exactly these keys: ${JSON.stringify(fields)}.`,
    };
  }

  throw badRequest(`Unknown mode: ${mode}`);
}

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rate = checkRateLimit(req);
  res.setHeader('X-RateLimit-Limit', String(MAX_REQUESTS_PER_WINDOW));
  res.setHeader('X-RateLimit-Remaining', String(rate.remaining));
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.resetInSeconds));
    return res.status(429).json({
      error: `Too many requests. Try again in about ${Math.ceil(rate.resetInSeconds / 60)} minute(s).`,
    });
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Server is missing GOOGLE_API_KEY. Set it in your deployment\'s environment variables.',
    });
  }

  const { mode, ...payload } = req.body || {};

  let system, user;
  try {
    ({ system, user } = buildRequest(mode, payload));
  } catch (err) {
    return res.status(err.statusCode || 400).json({ error: err.message });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: user }] }],
        systemInstruction: { parts: [{ text: system }] },
        generationConfig: { maxOutputTokens: 1000 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Gemini API error: ${errText}` });
    }

    const data = await response.json();
    const candidate = data.candidates && data.candidates[0];
    const text = candidate && candidate.content && candidate.content.parts
      ? candidate.content.parts.map((p) => p.text || '').join('')
      : '';

    if (!text) {
      // Common cause: the response was cut off or blocked by safety settings.
      const reason = candidate && candidate.finishReason ? ` (finishReason: ${candidate.finishReason})` : '';
      return res.status(502).json({ error: `Model returned no text content${reason}.` });
    }

    return res.status(200).json({ result: text });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unexpected server error.' });
  }
}
