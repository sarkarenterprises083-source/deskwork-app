// Routes a request to the cheapest model that can handle it.
// Rule: anything with an attached file needs a vision-capable model.
// Text-only requests go to the fast/cheap tier unless they're long or
// explicitly complex.

const MODELS = {
  fast: 'gemini-3.6-flash', // cheap, fast, vision-capable
  strong: 'gemini-3.6-pro', // higher reasoning, still vision-capable
};

function routeRequest({ hasFile, textLength = 0, mode, complexity }) {
  if (hasFile) {
    // Extraction from messy documents (handwriting, mixed scripts, faded
    // receipts) benefits from the stronger model; summarizing a clean
    // photo/PDF is usually fine on the fast tier.
    return mode === 'extract' ? MODELS.strong : MODELS.fast;
  }

  if (textLength < 4000 && complexity !== 'high') {
    return MODELS.fast;
  }

  return MODELS.strong;
}

module.exports = { routeRequest, MODELS };
