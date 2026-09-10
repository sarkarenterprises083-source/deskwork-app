// Verifies the Supabase access token sent by the client in the
// Authorization header, and returns the authenticated user (or null).

const { supabaseAdmin } = require('./supabaseAdmin');

async function verifyUser(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

module.exports = { verifyUser };
