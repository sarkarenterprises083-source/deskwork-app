const { verifyUser } = require('../../lib/verifyUser');
const { createOrder } = require('../../lib/razorpay');

// Your two plans, in paise (smallest currency unit).
const PLANS = {
  basic: { amountPaise: 9900, label: 'Basic — ₹99/mo' },
  pro: { amountPaise: 29900, label: 'Pro — ₹299/mo' },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Please sign in to upgrade.' });
  }

  const { plan } = req.body || {};
  const selected = PLANS[plan];
  if (!selected) {
    return res.status(400).json({ error: `Unknown plan: ${plan}. Choose "basic" or "pro".` });
  }

  try {
    const order = await createOrder({
      amount: selected.amountPaise,
      currency: 'INR',
      receipt: `deskwork_${plan}_${user.id}_${Date.now()}`,
      notes: { userId: user.id, email: user.email || '', plan },
    });

    return res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      plan,
      planLabel: selected.label,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Could not start checkout.' });
  }
}
