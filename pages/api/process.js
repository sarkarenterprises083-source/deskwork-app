// Server-side route. Runs on Vercel's serverless functions, never in the browser,
// so the GOOGLE_API_KEY env var stays secret.

const { checkRateLimit, MAX_REQUESTS_PER_WINDOW } = require('../../lib/rateLimit');
const { routeRequest } = require('../../lib/modelRouter');

const SUMMARIZE_SYSTEM =
  "You summarize text accurately and concisely. Output only the summary itself, " +
  "with no preamble, no 'Here is a summary' framing, and no closing remarks.";

const BRIEF_SYSTEM =
  "You turn text or a document into a structured executive brief. Respond with ONLY a " +
  "raw JSON object, no markdown fences, no commentary, in this exact shape: " +
  '{"summary": ["point 1", "point 2", ...], "actionItems": ["action 1", "action 2", ...]}. ' +
  "The summary array holds concise executive-summary bullet points covering the key " +
  "information. The actionItems array holds concrete, actionable next steps or to-dos " +
  "implied or stated by the text — phrased as imperative tasks (e.g. \"Follow up with " +
  "vendor by Friday\", not \"the vendor needs to be followed up with\"). If the text has " +
  "no clear action items, return an empty array for actionItems rather than inventing one.";

const GENERATE_SYSTEM_TEMPLATE = (tone) =>
  `You are a skilled copywriter. Write the requested content in a ${tone.toLowerCase()} tone. ` +
  "Output only the finished piece, with no preamble, no meta-commentary, and no markdown " +
  "headers unless the format calls for them.";

const EXTRACT_SYSTEM =
  "You are a document extraction engine specialized in Indian business and " +
  "academic documents, including GST invoices, receipts, handwritten and " +
  "printed study notes, and documents written in or mixing any Indian regional " +
  "language (Bengali, Hindi, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, " +
  "Punjabi, Odia, Assamese, etc.) with English.\n\n" +
  "STRICT OUTPUT RULES:\n" +
  "1. Respond with ONLY a raw JSON array of objects, no markdown fences, no commentary.\n" +
  "2. All dates MUST be formatted as DD/MM/YYYY, regardless of source format.\n" +
  "3. All currency amounts MUST be in Indian Rupees, formatted as a string with the ₹ " +
  "symbol and comma-separated Indian numbering (e.g. \"₹1,24,500.00\"), unless the " +
  "document explicitly states another currency.\n" +
  "4. If a field is not present, use null. Never invent or guess a value.\n" +
  "5. Preserve regional-language text in its original native script (do not " +
  "transliterate to Latin script) unless the field list explicitly asks for an " +
  "English translation of that field.\n" +
  "6. For handwritten text, use your best reading. If a value is genuinely illegible, " +
  "use \"[illegible]\" for that field rather than guessing.\n" +
  "7. Numbers that are inherently numeric (rates, quantities) stay as plain numbers; " +
  "only currency fields get ₹ formatting.\n\n" +
  "EXAMPLE — GST Invoice. Fields: invoice_number, date, seller_name, buyer_name, gst_rate, total_amount.\n" +
  "Input: \"Tax Invoice / Invoice No: INV-2026/0113 / Date: 03-08-2026 / Seller: Ganguly " +
  "Electronics, Kolkata / Buyer: Riya Traders / Rate: 18% GST / Total: Rs. 24,780.00\"\n" +
  "Output: [{\"invoice_number\":\"INV-2026/0113\",\"date\":\"03/08/2026\",\"seller_name\":" +
  "\"Ganguly Electronics, Kolkata\",\"buyer_name\":\"Riya Traders\",\"gst_rate\":18," +
  "\"total_amount\":\"₹24,780.00\"}]\n\n" +
  "EXAMPLE — Handwritten note, Bengali script. Fields: topic, key_points, date_written.\n" +
  "Input: \"Topic: Newton এর সূত্র / ১. জড়তার সূত্র (Law of inertia) / Date: 14.7.26\"\n" +
  "Output: [{\"topic\":\"Newton এর সূত্র\",\"key_points\":[\"জড়তার সূত্র (Law of inertia)\"]," +
  "\"date_written\":\"14/07/2026\"}]\n\n" +
  "EXAMPLE — Handwritten note, Tamil script. Fields: topic, key_points.\n" +
  "Input: \"தலைப்பு: ஒளிச்சேர்க்கை / தாவரங்கள் சூரிய ஒளியை பயன்படுத்துகின்றன\"\n" +
  "Output: [{\"topic\":\"ஒளிச்சேர்க்கை\",\"key_points\":[\"தாவரங்கள் சூரிய ஒளியை பயன்படுத்துகின்றன\"]}]\n\n" +
  "EXAMPLE — Faded receipt with an illegible field. Fields: shop_name, date, total.\n" +
  "Input: \"[shop name faded] / Date: 22/1/26 / Total: Rs 75.00\"\n" +
  "Output: [{\"shop_name\":\"[illegible]\",\"date\":\"22/01/2026\",\"total\":\"₹75.00\"}]";


// Allow larger request bodies since attached photos/PDFs are sent as base64.
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '6mb',
    },
  },
};

// Raise the serverless function timeout from Vercel's 10s default to the
// Hobby-plan max, so large files or long documents have time to process.
export const maxDuration = 60;

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

  if (mode === 'brief') {
    const { text, file } = payload;
    const filePart = buildFilePart(file);
    if (!filePart && (!text || !text.trim())) {
      throw badRequest('Paste some text or attach a photo/document to brief.');
    }
    const parts = [];
    if (filePart) parts.push(filePart);
    parts.push({
      text: filePart
        ? 'Produce an executive summary and action items for the attached file.'
        : `Produce an executive summary and action items for the following text.\n\nTEXT:\n${text}`,
    });
    return { system: BRIEF_SYSTEM, parts };
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

  const selectedModel = routeRequest({
    hasFile: !!payload.file,
    textLength: (payload.text || payload.brief || '').length,
    mode,
  });

  let system, parts;
  try {
    ({ system, parts } = buildRequest(mode, payload));
  } catch (err) {
    return res.status(err.statusCode || 400).json({ error: err.message });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;
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
