'use strict';

const authService = require('../services/auth-service');

module.exports = async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    req.user = await authService.verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};
