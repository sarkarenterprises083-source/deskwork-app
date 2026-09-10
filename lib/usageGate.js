// Gates how many requests a free-plan user can make per day.
// Paid users (active subscription) bypass this entirely.

const FREE_DAILY_LIMIT = 10;

async function checkAndIncrementUsage(supabaseAdmin, userId) {
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('plan, daily_usage_count, daily_usage_date, subscription_status')
    .eq('id', userId)
    .single();

  if (error || !user) {
    return { allowed: false, reason: 'Account not found. Try signing out and back in.' };
  }

  const isPaid = user.plan === 'paid' && user.subscription_status === 'active';
  if (isPaid) return { allowed: true };

  const today = new Date().toISOString().slice(0, 10);
  const isNewDay = user.daily_usage_date !== today;
  const currentCount = isNewDay ? 0 : user.daily_usage_count;

  if (currentCount >= FREE_DAILY_LIMIT) {
    return {
      allowed: false,
      reason: `Free plan limit reached (${FREE_DAILY_LIMIT}/day). Upgrade for unlimited use.`,
    };
  }

  await supabaseAdmin
    .from('users')
    .update({ daily_usage_count: currentCount + 1, daily_usage_date: today })
    .eq('id', userId);

  return { allowed: true, remaining: FREE_DAILY_LIMIT - currentCount - 1 };
}

module.exports = { checkAndIncrementUsage, FREE_DAILY_LIMIT };
