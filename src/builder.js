'use strict';

const path = require('path');
const fs = require('fs-extra');
const { spawn } = require('child_process');
const logger = require('./logger');

/**
 * Stream a child process output to the logger.
 * Resolves with exit code.
 */
function spawnAndStream(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    logger.debug(`Running: ${cmd} ${args.join(' ')} in ${cwd}`);

    const child = spawn(cmd, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });

    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach((line) => {
        const trimmed = line.trim();
        if (trimmed) {
          logger.debug(`[gradle] ${trimmed}`);
        }
      });
    });

    child.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach((line) => {
        const trimmed = line.trim();
        if (trimmed) {
          // Gradle prints progress to stderr; only log as error if it looks like an error
          if (trimmed.toLowerCase().includes('error') || trimmed.toLowerCase().includes('failed')) {
            logger.error(`[gradle] ${trimmed}`);
          } else {
            logger.debug(`[gradle] ${trimmed}`);
          }
        }
      });
    });

    child.on('close', (code) => {
      resolve(code);
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to spawn gradle: ${err.message}`));
    });
  });
}

/**
 * Find build artifacts after a successful build.
 * @param {string} projectDir
 * @param {string} variant - 'debug' or 'release'
 * @param {boolean} isAab - Whether to look for AAB instead of APK
 * @returns {Promise<string[]>} Array of found artifact paths
 */
async function findArtifacts(projectDir, variant, isAab) {
  const artifacts = [];

  if (isAab) {
    const aabPath = path.join(
      projectDir,
      'app', 'build', 'outputs', 'bundle', variant,
      `app-${variant}.aab`
    );
    if (await fs.pathExists(aabPath)) {
      artifacts.push(aabPath);
    }
  } else {
    const apkPath = path.join(
      projectDir,
      'app', 'build', 'outputs', 'apk', variant,
      `app-${variant}.apk`
    );
    if (await fs.pathExists(apkPath)) {
      artifacts.push(apkPath);
    }
  }

  return artifacts;
}

/**
 * Build the Android project.
 *
 * @param {string} projectDir - Root of the generated Android project
 * @param {Object} options
 * @param {boolean} [options.release=false] - Build release variant
 * @param {boolean} [options.aab=false] - Build Android App Bundle
 * @param {boolean} [options.apk=true] - Build APK
 * @returns {Promise<{ success: boolean, artifacts: string[] }>}
 */
async function build(projectDir, options = {}) {
  const {
    release = false,
    aab = false,
    apk = true,
  } = options;

  const resolvedDir = path.resolve(projectDir);

  if (!await fs.pathExists(resolvedDir)) {
    throw new Error(`Project directory does not exist: ${resolvedDir}`);
  }

  // Check for gradlew
  const gradlewPath = path.join(resolvedDir, 'gradlew');
  const gradlewBatPath = path.join(resolvedDir, 'gradlew.bat');

  const isWindows = process.platform === 'win32';
  const gradlewExecutable = isWindows ? gradlewBatPath : gradlewPath;

  if (!await fs.pathExists(gradlewExecutable)) {
    throw new Error(
      `gradlew not found at ${gradlewExecutable}. ` +
      'Run "gradle wrapper" inside the project directory first, or ensure gradlew is present.'
    );
  }

  // Ensure gradlew is executable on Unix
  if (!isWindows) {
    try {
      await fs.chmod(gradlewPath, '755');
    } catch {
      // Ignore chmod errors
    }
  }

  const variant = release ? 'release' : 'debug';
  const artifacts = [];

  // Build APK
  if (apk || !aab) {
    const task = release ? 'assembleRelease' : 'assembleDebug';
    logger.step(`Running gradle task: ${task}`);

    const cmd = isWindows ? gradlewBatPath : './gradlew';
    const exitCode = await spawnAndStream(cmd, [task, '--stacktrace'], resolvedDir);

    if (exitCode !== 0) {
      throw new Error(`Gradle build failed with exit code ${exitCode}`);
    }

    const found = await findArtifacts(resolvedDir, variant, false);
    artifacts.push(...found);
  }

  // Build AAB
  if (aab) {
    const task = 'bundleRelease';
    logger.step(`Running gradle task: ${task}`);

    const cmd = isWindows ? gradlewBatPath : './gradlew';
    const exitCode = await spawnAndStream(cmd, [task, '--stacktrace'], resolvedDir);

    if (exitCode !== 0) {
      throw new Error(`Gradle AAB build failed with exit code ${exitCode}`);
    }

    const found = await findArtifacts(resolvedDir, 'release', true);
    artifacts.push(...found);
  }

  if (artifacts.length > 0) {
    logger.success('Build artifacts:');
    artifacts.forEach((a) => logger.success(`  ${a}`));
  } else {
    logger.warn('Build completed but no artifacts found. Check the build output directory.');
  }

  return { success: true, artifacts };
}

module.exports = { build };
