const { verifyUser } = require('../../lib/verifyUser');
const { supabaseAdmin } = require('../../lib/supabaseAdmin');

export default async function handler(req, res) {
  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in.' });

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('plan, subscription_status, trial_ends_at, current_period_end')
    .eq('id', user.id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Account not found.' });

  const now = Date.now();
  const trialEndsAtMs = data.trial_ends_at ? new Date(data.trial_ends_at).getTime() : null;
  const isTrialActive = trialEndsAtMs !== null && trialEndsAtMs > now;
  const isPaid = data.plan === 'paid' && data.subscription_status === 'active';

  return res.status(200).json({
    plan: data.plan,
    isPaid,
    isTrialActive,
    trialEndsAt: data.trial_ends_at,
    trialDaysLeft: isTrialActive ? Math.ceil((trialEndsAtMs - now) / (24 * 60 * 60 * 1000)) : 0,
    currentPeriodEnd: data.current_period_end,
  });
}
