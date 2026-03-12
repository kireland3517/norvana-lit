export function requireAdmin(req) {
  const pw =
    req.headers['x-admin-password'] ||
    (req.body && req.body.adminPassword);

  if (!pw || pw !== process.env.ADMIN_PASSWORD) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
}
