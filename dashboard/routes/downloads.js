'use strict';

const path = require('path');
const express = require('express');

const router = express.Router();

let buildStorage = null;

function init(storage) {
  buildStorage = storage;
}

// GET /api/downloads/:buildId/:filename
router.get('/:buildId/:filename', async (req, res) => {
  try {
    const { buildId, filename } = req.params;

    const build = await buildStorage.findById('builds', buildId);
    if (!build || build.userId !== req.user.userId) {
      return res.status(404).json({ error: 'Build not found' });
    }

    if (build.status !== 'success' || !build.artifactPaths || build.artifactPaths.length === 0) {
      return res.status(404).json({ error: 'No artifacts available for this build' });
    }

    // Find the artifact matching the requested filename
    const artifactPath = build.artifactPaths.find((p) => path.basename(p) === filename);
    if (!artifactPath) {
      return res.status(404).json({ error: `Artifact "${filename}" not found` });
    }

    res.download(artifactPath, filename, (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ error: 'Failed to send file' });
      }
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.init = init;
