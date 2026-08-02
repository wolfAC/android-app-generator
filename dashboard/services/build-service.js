'use strict';

const path = require('path');
const fs = require('fs-extra');
const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');

const Generator = require('../../src/generator');
const { build: builderBuild } = require('../../src/builder');
const projectService = require('./project-service');

class BuildService extends EventEmitter {
  constructor(storage, generatorOutputBase) {
    super();
    this.storage = storage;
    this.generatorOutputBase = generatorOutputBase;
    this.queue = [];
    this.isProcessing = false;
  }

  async enqueueBuild(userId, projectId, variant, format) {
    const buildId = uuidv4();
    const record = {
      id: buildId,
      userId,
      projectId,
      status: 'queued',
      variant: variant || 'debug',
      format: format || 'apk',
      projectDir: null,
      artifactPaths: [],
      log: [],
      error: null,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
    };

    await this.storage.insert('builds', record);
    this.queue.push(buildId);
    this._processQueue();
    return buildId;
  }

  _appendLog(buildId, message) {
    // Fire-and-forget log append to storage
    this.storage.findById('builds', buildId).then((build) => {
      if (!build) return;
      const log = [...(build.log || []), message];
      this.storage.update('builds', buildId, { log });
    }).catch(() => {});

    this.emit(`build:log:${buildId}`, message);
  }

  async _processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const buildId = this.queue.shift();

    try {
      const build = await this.storage.findById('builds', buildId);
      if (!build) {
        this.isProcessing = false;
        this._processQueue();
        return;
      }

      const project = await this.storage.findById('projects', build.projectId);
      if (!project) {
        await this.storage.update('builds', buildId, {
          status: 'failed',
          error: 'Project not found',
          completedAt: new Date().toISOString(),
        });
        this.emit(`build:complete:${buildId}`, { status: 'failed', error: 'Project not found' });
        this.isProcessing = false;
        this._processQueue();
        return;
      }

      await this._runBuild(build, project);
    } catch (err) {
      console.error(`[BuildService] Unexpected error processing build ${buildId}:`, err.message);
    } finally {
      this.isProcessing = false;
      this._processQueue();
    }
  }

  async _runBuild(build, project) {
    const buildId = build.id;

    await this.storage.update('builds', buildId, {
      status: 'generating',
      startedAt: new Date().toISOString(),
    });

    this._appendLog(buildId, '[INFO] Build started');
    this._appendLog(buildId, `[INFO] App: ${project.name}`);
    this._appendLog(buildId, `[INFO] Variant: ${build.variant}, Format: ${build.format}`);

    let configDir = null;
    let outputDir = null;

    try {
      // Step 1: Create config dir
      this._appendLog(buildId, '[STEP] Creating configuration directory...');
      configDir = await projectService.getProjectConfigDir(project);
      this._appendLog(buildId, `[INFO] Config dir: ${configDir}`);

      // Step 2: Create output dir
      outputDir = path.join(this.generatorOutputBase, buildId);
      await fs.ensureDir(outputDir);
      this._appendLog(buildId, `[INFO] Output dir: ${outputDir}`);

      // Step 3: Generate project
      this._appendLog(buildId, '[STEP] Generating Android project...');
      const generator = new Generator();
      await generator.generate(configDir, outputDir);
      this._appendLog(buildId, '[SUCCESS] Android project generated');

      await this.storage.update('builds', buildId, {
        projectDir: outputDir,
      });

      // Step 4: Build if format is apk or aab
      if (build.format === 'apk' || build.format === 'aab' || build.format === 'both') {
        await this.storage.update('builds', buildId, { status: 'building' });
        this.emit(`build:log:${buildId}`, `[STATUS] building`);

        const isRelease = build.variant === 'release';
        const buildApk = build.format === 'apk' || build.format === 'both';
        const buildAab = build.format === 'aab' || build.format === 'both';

        this._appendLog(buildId, `[STEP] Building ${build.format.toUpperCase()} (${build.variant})...`);

        const result = await builderBuild(outputDir, {
          release: isRelease,
          apk: buildApk,
          aab: buildAab,
        });

        const artifactPaths = result.artifacts || [];
        this._appendLog(buildId, `[SUCCESS] Build complete. Artifacts: ${artifactPaths.length}`);
        artifactPaths.forEach((p) => this._appendLog(buildId, `[ARTIFACT] ${p}`));

        await this.storage.update('builds', buildId, {
          status: 'success',
          artifactPaths,
          completedAt: new Date().toISOString(),
        });
      } else {
        // format === 'generate' — just generate, no compile
        await this.storage.update('builds', buildId, {
          status: 'success',
          artifactPaths: [],
          completedAt: new Date().toISOString(),
        });
      }

      this._appendLog(buildId, '[SUCCESS] Build pipeline complete');
      this.emit(`build:complete:${buildId}`, { status: 'success', artifactPaths: [] });

    } catch (err) {
      const errorMsg = err.message || String(err);
      this._appendLog(buildId, `[ERROR] ${errorMsg}`);
      await this.storage.update('builds', buildId, {
        status: 'failed',
        error: errorMsg,
        completedAt: new Date().toISOString(),
      });
      this.emit(`build:complete:${buildId}`, { status: 'failed', error: errorMsg });
    } finally {
      // Clean up temp config dir
      if (configDir) {
        fs.remove(configDir).catch(() => {});
      }
    }
  }

  async getBuildLog(buildId) {
    const build = await this.storage.findById('builds', buildId);
    return build ? (build.log || []) : [];
  }

  async getQueueStatus() {
    return {
      isProcessing: this.isProcessing,
      queueLength: this.queue.length,
      queue: [...this.queue],
    };
  }
}

module.exports = BuildService;
