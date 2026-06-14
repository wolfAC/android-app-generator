'use strict';

const express = require('express');

const router = express.Router();

let buildService = null;
let buildStorage = null;

function init(service, storage) {
  buildService = service;
  buildStorage = storage;
}

// GET /api/builds
router.get('/', async (req, res) => {
  try {
    let builds = await buildStorage.findWhere('builds', (b) => b.userId === req.user.userId);
    builds.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    builds = builds.slice(0, 50);
    res.json(builds);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// POST /api/builds
router.post('/', async (req, res) => {
  try {
    const { projectId, variant, format } = req.body || {};
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });

    const buildId = await buildService.enqueueBuild(
      req.user.userId,
      projectId,
      variant || 'debug',
      format || 'apk'
    );

    const build = await buildStorage.findById('builds', buildId);
    res.status(202).json({ buildId, status: build.status });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// GET /api/builds/:id
router.get('/:id', async (req, res) => {
  try {
    const build = await buildStorage.findById('builds', req.params.id);
    if (!build || build.userId !== req.user.userId) {
      return res.status(404).json({ error: 'Build not found' });
    }
    res.json(build);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// GET /api/builds/:id/stream  — SSE
router.get('/:id/stream', async (req, res) => {
  const buildId = req.params.id;

  // Verify ownership
  const build = await buildStorage.findById('builds', buildId);
  if (!build || build.userId !== req.user.userId) {
    return res.status(404).json({ error: 'Build not found' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  function sendEvent(data) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  // Send all existing log lines immediately
  const existingLog = build.log || [];
  existingLog.forEach((line) => sendEvent({ type: 'log', message: line }));

  // Send current status
  sendEvent({ type: 'status', status: build.status });

  // If already complete, close immediately
  const terminalStatuses = ['success', 'failed', 'cancelled'];
  if (terminalStatuses.includes(build.status)) {
    sendEvent({
      type: 'complete',
      status: build.status,
      artifactPaths: build.artifactPaths || [],
      error: build.error || null,
    });
    res.end();
    return;
  }

  // Heartbeat every 15s
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  // Subscribe to log events
  function onLog(message) {
    sendEvent({ type: 'log', message });
  }

  // Subscribe to complete event
  function onComplete(result) {
    sendEvent({ type: 'status', status: result.status });
    if (result.status === 'success') {
      sendEvent({
        type: 'complete',
        status: 'success',
        artifactPaths: result.artifactPaths || [],
      });
    } else {
      sendEvent({
        type: 'error',
        error: result.error || 'Build failed',
      });
    }
    cleanup();
    res.end();
  }

  function cleanup() {
    clearInterval(heartbeat);
    buildService.removeListener(`build:log:${buildId}`, onLog);
    buildService.removeListener(`build:complete:${buildId}`, onComplete);
  }

  buildService.on(`build:log:${buildId}`, onLog);
  buildService.once(`build:complete:${buildId}`, onComplete);

  req.on('close', cleanup);
});

// DELETE /api/builds/:id
router.delete('/:id', async (req, res) => {
  try {
    const build = await buildStorage.findById('builds', req.params.id);
    if (!build || build.userId !== req.user.userId) {
      return res.status(404).json({ error: 'Build not found' });
    }
    await buildStorage.delete('builds', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.init = init;
