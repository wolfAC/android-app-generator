'use strict';

const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

let storage = null;

function init(storageInstance) {
  storage = storageInstance;
}

async function createProject(userId, config, iconPath, splashPath) {
  const project = {
    id: uuidv4(),
    userId,
    name: config.appName || 'Unnamed App',
    config,
    iconPath: iconPath || null,
    splashPath: splashPath || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return storage.insert('projects', project);
}

async function getProject(id, userId) {
  const project = await storage.findById('projects', id);
  if (!project || project.userId !== userId) {
    const err = new Error('Project not found');
    err.statusCode = 404;
    throw err;
  }
  return project;
}

async function listProjects(userId) {
  const projects = await storage.findWhere('projects', (p) => p.userId === userId);
  return projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

async function updateProject(id, userId, patch) {
  const project = await getProject(id, userId);
  const updated = Object.assign({}, patch, { updatedAt: new Date().toISOString() });
  if (patch.config) {
    updated.name = patch.config.appName || project.name;
  }
  return storage.update('projects', id, updated);
}

async function deleteProject(id, userId) {
  await getProject(id, userId);
  return storage.delete('projects', id);
}

async function getProjectConfigDir(project) {
  const tmpDir = path.join(require('os').tmpdir(), `twa-project-${project.id}-${Date.now()}`);
  await fs.ensureDir(tmpDir);

  // Build app.json with asset paths pointing to saved icon/splash
  const config = Object.assign({}, project.config);
  if (!config.assets) config.assets = {};

  if (project.iconPath && await fs.pathExists(project.iconPath)) {
    config.assets.icon = project.iconPath;
  }
  if (project.splashPath && await fs.pathExists(project.splashPath)) {
    config.assets.splashIcon = project.splashPath;
  }

  await fs.writeFile(path.join(tmpDir, 'app.json'), JSON.stringify(config, null, 2), 'utf-8');

  return tmpDir;
}

module.exports = {
  init,
  createProject,
  getProject,
  listProjects,
  updateProject,
  deleteProject,
  getProjectConfigDir,
};
