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

// Allow larger request bodies since attached photos/PDFs are sent as base64.
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '6mb',
    },
  },
};

// Max size for an uploaded file, in bytes, before base64 encoding.
// Kept well under Vercel's request body limit (base64 adds ~33% size).
const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4MB

function buildFilePart(file) {
  if (!file) return null;
  const { mimeType, data } = file;
  if (!mimeType || !data) throw badRequest('Attached file is missing data.');
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
  if (!allowed.includes(mimeType)) {
    throw badRequest(`Unsupported file type: ${mimeType}. Use an image (JPEG/PNG/WebP) or a PDF.`);
  }
  // data is a base64 string; rough size check without decoding.
  const approxBytes = Math.ceil((data.length * 3) / 4);
  if (approxBytes > MAX_FILE_BYTES) {
    throw badRequest('File is too large. Please use a file under 4MB.');
  }
  return { inlineData: { mimeType, data } };
}

function buildRequest(mode, payload) {
  if (mode === 'summarize') {
    const { text, length, file } = payload;
    const filePart = buildFilePart(file);
    if (!filePart && (!text || !text.trim())) {
      throw badRequest('Paste some text or attach a photo/document to summarize.');
    }
    const parts = [];
    if (filePart) parts.push(filePart);
    parts.push({
      text: filePart
        ? `Summarize the attached file as ${length}.${text && text.trim() ? ` Additional context: ${text}` : ''}`
        : `Summarize the following text as ${length}.\n\nTEXT:\n${text}`,
    });
    return { system: SUMMARIZE_SYSTEM, parts };
  }

  if (mode === 'generate') {
    const { brief, type, tone } = payload;
    if (!brief || !brief.trim()) throw badRequest('Missing brief to generate from.');
    return {
      system: GENERATE_SYSTEM_TEMPLATE(tone || 'Professional'),
      parts: [{ text: `Write a ${(type || 'piece of content').toLowerCase()} based on this brief:\n\n${brief}` }],
    };
  }

  if (mode === 'extract') {
    const { text, fields, file } = payload;
    const filePart = buildFilePart(file);
    if (!filePart && (!text || !text.trim())) {
      throw badRequest('Paste some text or attach a photo/document to extract from.');
    }
    if (!Array.isArray(fields) || fields.length === 0) throw badRequest('Missing fields to extract.');
    const parts = [];
    if (filePart) parts.push(filePart);
    parts.push({
      text:
        `Extract these fields: ${fields.join(', ')}.\n\n` +
        (filePart ? `Read them from the attached file.` : `TEXT:\n${text}`) +
        (text && filePart && text.trim() ? `\n\nAdditional context: ${text}` : '') +
        `\n\nRespond with a JSON array of objects using exactly these keys: ${JSON.stringify(fields)}.`,
    });
    return { system: EXTRACT_SYSTEM, parts };
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

  let system, parts;
  try {
    ({ system, parts } = buildRequest(mode, payload));
  } catch (err) {
    return res.status(err.statusCode || 400).json({ error: err.message });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
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
