'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');

const Storage = require('./services/storage');
const authService = require('./services/auth-service');
const projectService = require('./services/project-service');
const BuildService = require('./services/build-service');

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const buildRoutes = require('./routes/builds');
const downloadRoutes = require('./routes/downloads');
const requireAuth = require('./middleware/auth');

const PORT = process.env.PORT || 3000;

const DATA_DIR = path.resolve(__dirname, 'data');
const BUILDS_OUTPUT_DIR = path.resolve(DATA_DIR, 'builds');

// Warn if using default JWT secret
if (!process.env.JWT_SECRET) {
  console.warn('[WARNING] JWT_SECRET env var not set — using insecure default. Set JWT_SECRET in production.');
}

// Initialize storage and services
const storage = new Storage(DATA_DIR);
authService.init(storage);
projectService.init(storage);

const buildService = new BuildService(storage, BUILDS_OUTPUT_DIR);

// Pass storage/service to routes that need them
projectRoutes.init(storage);
buildRoutes.init(buildService, storage);
downloadRoutes.init(storage);

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', requireAuth, projectRoutes);
app.use('/api/builds', requireAuth, buildRoutes);
app.use('/api/downloads', requireAuth, downloadRoutes);

// SPA fallback — serve dashboard.html for /dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(err.statusCode || 500).json({ error: err.message || 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`TWA Dashboard running at http://localhost:${PORT}`);
    console.log(`  Login/Register: http://localhost:${PORT}/`);
    console.log(`  Dashboard:      http://localhost:${PORT}/dashboard`);
  });
}

module.exports = app;
