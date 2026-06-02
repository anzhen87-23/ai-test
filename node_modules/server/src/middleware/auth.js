const jwt = require('jsonwebtoken');

module.exports = function authMiddleware(ctx, next) {
  const header = ctx.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    ctx.status = 401;
    ctx.body = { error: 'Unauthorized' };
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    ctx.state.userId = payload.sub;
    return next();
  } catch (err) {
    ctx.status = 401;
    ctx.body = { error: 'Invalid or expired token' };
  }
};
