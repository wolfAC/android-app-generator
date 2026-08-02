'use strict';

const express = require('express');
const projectService = require('../services/project-service');
const { iconUpload, splashUpload } = require('../middleware/upload');

const router = express.Router();

let buildStorage = null;

function init(storage) {
  buildStorage = storage;
}

async function getProjectWithBuildCount(project, storage) {
  let buildCount = 0;
  if (storage) {
    const builds = await storage.findWhere('builds', (b) => b.projectId === project.id);
    buildCount = builds.length;
  }
  return Object.assign({}, project, { buildCount });
}

// GET /api/projects
router.get('/', async (req, res) => {
  try {
    const projects = await projectService.listProjects(req.user.userId);
    const withCounts = await Promise.all(
      projects.map((p) => getProjectWithBuildCount(p, buildStorage))
    );
    res.json(withCounts);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// POST /api/projects
router.post('/', async (req, res) => {
  try {
    const { config } = req.body || {};
    if (!config) return res.status(400).json({ error: 'config is required' });
    const project = await projectService.createProject(req.user.userId, config, null, null);
    res.status(201).json(project);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// GET /api/projects/:id
router.get('/:id', async (req, res) => {
  try {
    const project = await projectService.getProject(req.params.id, req.user.userId);
    res.json(project);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// PUT /api/projects/:id
router.put('/:id', async (req, res) => {
  try {
    const { config, iconPath, splashPath } = req.body || {};
    const patch = {};
    if (config !== undefined) patch.config = config;
    if (iconPath !== undefined) patch.iconPath = iconPath;
    if (splashPath !== undefined) patch.splashPath = splashPath;

    const project = await projectService.updateProject(req.params.id, req.user.userId, patch);
    res.json(project);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', async (req, res) => {
  try {
    await projectService.deleteProject(req.params.id, req.user.userId);
    res.json({ success: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// POST /api/projects/:id/icon
router.post('/:id/icon', iconUpload, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No icon file uploaded' });

    const iconPath = req.file.path;
    await projectService.updateProject(req.params.id, req.user.userId, { iconPath });

    const iconUrl = `/api/projects/${req.params.id}/icon/file`;
    res.json({ iconUrl, iconPath });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// POST /api/projects/:id/splash
router.post('/:id/splash', splashUpload, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No splash file uploaded' });

    const splashPath = req.file.path;
    await projectService.updateProject(req.params.id, req.user.userId, { splashPath });

    const splashUrl = `/api/projects/${req.params.id}/splash/file`;
    res.json({ splashUrl, splashPath });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.init = init;
