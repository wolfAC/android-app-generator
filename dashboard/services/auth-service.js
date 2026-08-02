'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET || 'twa-dashboard-secret-change-in-production';
const JWT_EXPIRES = '7d';

let storage = null;

function init(storageInstance) {
  storage = storageInstance;
}

function _warnIfDefaultSecret() {
  if (!process.env.JWT_SECRET) {
    console.warn('[WARNING] JWT_SECRET env var not set — using insecure default. Set JWT_SECRET in production.');
  }
}

async function register(email, password) {
  _warnIfDefaultSecret();

  if (!email || !email.includes('@')) {
    throw Object.assign(new Error('Invalid email address'), { statusCode: 400 });
  }
  if (!password || password.length < 8) {
    throw Object.assign(new Error('Password must be at least 8 characters'), { statusCode: 400 });
  }

  const existing = await storage.findWhere('users', (u) => u.email === email);
  if (existing.length > 0) {
    throw Object.assign(new Error('Email already registered'), { statusCode: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = {
    id: uuidv4(),
    email,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  await storage.insert('users', user);

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  return { token, user: { id: user.id, email: user.email } };
}

async function login(email, password) {
  _warnIfDefaultSecret();

  if (!email || !password) {
    throw Object.assign(new Error('Email and password are required'), { statusCode: 400 });
  }

  const users = await storage.findWhere('users', (u) => u.email === email);
  if (users.length === 0) {
    throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });
  }

  const user = users[0];
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });
  }

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  return { token, user: { id: user.id, email: user.email } };
}

async function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { userId: decoded.userId, email: decoded.email };
  } catch (err) {
    throw Object.assign(new Error('Invalid or expired token'), { statusCode: 401 });
  }
}

async function getUserById(id) {
  const user = await storage.findById('users', id);
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

module.exports = { init, register, login, verifyToken, getUserById };
