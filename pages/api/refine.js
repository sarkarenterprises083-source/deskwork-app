// Stateless 1-tap refinement route. No conversation history is stored
// server-side — the client resends the original source and the previous
// output on every call, and this route stitches them into one prompt.

const { checkRateLimit, MAX_REQUESTS_PER_WINDOW } = require('../../lib/rateLimit');
const { routeRequest } = require('../../lib/modelRouter');

// Raise the serverless function timeout from Vercel's 10s default to the
// Hobby-plan max, so slower model responses have time to complete.
export const maxDuration = 60;

const ACTION_PROMPTS = {
  summarize: 'Summarize the following text concisely.',
  shorten: 'Make the following text shorter while keeping the key meaning.',
  lengthen: 'Expand the following text with more detail and context.',
  formalize: 'Rewrite the following text in a more formal, professional tone.',
  simplify: 'Rewrite the following text in simple, plain language, avoiding jargon.',
  json_table:
    'Convert the key facts in the following text into a JSON array of objects, with ' +
    'consistent keys across all objects. Respond with ONLY the JSON array, no commentary.',
};

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

function buildRefinePrompt({ action, sourceText, previousOutput, instructions, targetLanguage }) {
  let instruction;
  if (action === 'custom') {
    instruction = instructions;
  } else if (action === 'translate') {
    if (!targetLanguage || !targetLanguage.trim()) {
      throw badRequest('Missing target language for translation.');
    }
    instruction = `Translate the following text into natural, fluent ${targetLanguage}, using that language's native script.`;
  } else {
    instruction = ACTION_PROMPTS[action];
  }
  if (!instruction) throw badRequest(`Unknown action: ${action}`);

  // Translation always re-reads the original source to avoid
  // "translation of a translation" drift. Everything else refines
  // whatever the user is currently looking at.
  const useSource = action === 'translate' || !previousOutput;
  const basedOn = useSource ? 'sourceText' : 'previousOutput';
  const workingText = useSource ? sourceText : previousOutput;

  if (!workingText || !workingText.trim()) {
    throw badRequest('Nothing to refine — missing source text or previous output.');
  }

  return {
    prompt: `${instruction}\n\nTEXT:\n${workingText}`,
    basedOn,
  };
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

  const { action, sourceText, previousOutput, instructions, targetLanguage } = req.body || {};

  let prompt, basedOn;
  try {
    ({ prompt, basedOn } = buildRefinePrompt({ action, sourceText, previousOutput, instructions, targetLanguage }));
  } catch (err) {
    return res.status(err.statusCode || 400).json({ error: err.message });
  }

  const model = routeRequest({
    hasFile: false,
    textLength: prompt.length,
    mode: 'refine',
  });

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
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
      const reason = candidate && candidate.finishReason ? ` (finishReason: ${candidate.finishReason})` : '';
      return res.status(502).json({ error: `Model returned no text content${reason}.` });
    }

    return res.status(200).json({ result: text, action, basedOn });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unexpected server error.' });
  }
}
