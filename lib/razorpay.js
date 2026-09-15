// Thin wrapper around Razorpay's REST API using fetch + Basic Auth,
// so no extra npm package/install step is required.

function getAuthHeader() {
  const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  if (!keyId || !keySecret) {
    throw new Error('Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET env vars.');
  }
  const token = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  return `Basic ${token}`;
}

async function createOrder({ amount, currency = 'INR', receipt, notes }) {
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify({ amount, currency, receipt, notes }),
  });
  const data = await res.json();
  if (!res.ok) {
    const code = data.error && data.error.code ? data.error.code : 'unknown_error';
    const description = data.error && data.error.description ? data.error.description : 'Could not create Razorpay order.';
    throw new Error(`Razorpay error [${code}]: ${description}`);
  }
  return data;
}

module.exports = { create 