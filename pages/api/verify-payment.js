const crypto = require('crypto');
const { verifyUser } = require('../../lib/verifyUser');
const { supabaseAdmin } = require('../../lib/supabaseAdmin');

// How long a payment unlocks access for. Since this integration uses
// one-time Razorpay orders (not Razorpay Subscriptions), "monthly" here
// just means the user needs to pay again after this many days.
const SUBSCRIPTION_DAYS = 30;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Please sign in to upgrade.' });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body || {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment details.' });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    return res.status(400).json({
      error: 'Payment verification failed. If money was deducted, contact support with your payment ID.',
    });
  }

  const periodEnd = new Date(Date.now() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000);

  const { error } = await supabaseAdmin
    .from('users')
    .update({
      plan: 'paid',
      plan_tier: plan === 'basic' ? 'basic' : 'pro',
      subscription_status: 'active',
      current_period_end: periodEnd.toISOString(),
      razorpay_order_id,
      razorpay_payment_id,
    })
    .eq('id', user.id);

  if (error) {
    return res.status(500).json({
      error:
        'Payment succeeded but we could not update your account. Contact support with payment ID: ' +
        razorpay_payment_id,
    });
  }

  return res.status(200).json({ success: true, plan: 'paid', planTier: plan, currentPeriodEnd: periodEnd.toISOString() });
}
