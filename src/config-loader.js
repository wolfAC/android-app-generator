'use strict';

const path = require('path');
const fs = require('fs-extra');
const logger = require('./logger');

/**
 * Returns the full default configuration object.
 * These defaults are merged with the user's app.json.
 */
function getDefaults() {
  return {
    appName: 'My TWA App',
    packageName: 'com.example.twaapp',
    websiteUrl: 'https://example.com',
    version: {
      code: 1,
      name: '1.0.0',
    },
    theme: {
      primary: '#6200EE',
      primaryDark: '#3700B3',
      accent: '#03DAC5',
      background: '#FFFFFF',
      surface: '#FFFFFF',
      onPrimary: '#FFFFFF',
      onBackground: '#000000',
    },
    features: {
      fullscreen: true,
      notifications: false,
      offline: false,
      camera: false,
      location: false,
      fileUpload: false,
      biometric: false,
      qrScanner: false,
    },
    firebase: {
      enabled: false,
      projectId: '',
      appId: '',
      apiKey: '',
      messagingSenderId: '',
      storageBucket: '',
    },
    android: {
      compileSdk: 35,
      minSdk: 24,
      targetSdk: 35,
      gradleVersion: '8.9',
      agpVersion: '8.7.0',
      kotlinVersion: '2.0.21',
    },
    orientation: 'unspecified',
    assets: {
      icon: null,
      splashIcon: null,
    },
    signing: {
      storeFile: null,
      storePassword: '',
      keyAlias: '',
      keyPassword: '',
    },
    customPermissions: [],
    deepLinks: [],
    splash: {
      backgroundColor: '#6200EE',
      iconSize: 'medium',
    },
  };
}

/**
 * Deep merge two objects. Values from `override` take precedence over `base`.
 * Arrays in `override` replace arrays in `base` (not concatenated).
 */
function deepMerge(base, override) {
  const result = Object.assign({}, base);
  for (const key of Object.keys(override)) {
    if (
      override[key] !== null &&
      typeof override[key] === 'object' &&
      !Array.isArray(override[key]) &&
      base[key] !== null &&
      typeof base[key] === 'object' &&
      !Array.isArray(base[key])
    ) {
      result[key] = deepMerge(base[key], override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result;
}

/**
 * Resolve asset paths relative to the configDir.
 * If a path is provided and exists, it is resolved to an absolute path.
 * If it does not exist, a warning is logged and null is set.
 */
function resolveAssets(config, configDir) {
  const resolved = Object.assign({}, config);

  if (config.assets) {
    resolved.assets = Object.assign({}, config.assets);

    ['icon', 'splashIcon'].forEach((key) => {
      const assetPath = config.assets[key];
      if (assetPath) {
        const absolutePath = path.isAbsolute(assetPath)
          ? assetPath
          : path.resolve(configDir, assetPath);

        if (fs.existsSync(absolutePath)) {
          resolved.assets[key] = absolutePath;
        } else {
          logger.warn(`Asset not found: ${assetPath} (resolved to ${absolutePath})`);
          resolved.assets[key] = null;
        }
      }
    });
  }

  return resolved;
}

/**
 * Load and merge app.json from the given configDir with defaults.
 * @param {string} configDir - Directory containing app.json
 * @returns {Object} Merged configuration object
 */
async function loadConfig(configDir) {
  const configPath = path.resolve(configDir, 'app.json');

  if (!fs.existsSync(configPath)) {
    throw new Error(`Configuration file not found: ${configPath}`);
  }

  let userConfig;
  try {
    const rawContent = await fs.readFile(configPath, 'utf-8');
    userConfig = JSON.parse(rawContent);
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`Invalid JSON in ${configPath}: ${err.message}`);
    }
    throw new Error(`Failed to read ${configPath}: ${err.message}`);
  }

  logger.debug(`Loaded config from: ${configPath}`);

  const defaults = getDefaults();
  const merged = deepMerge(defaults, userConfig);

  // Resolve asset paths relative to configDir
  const resolved = resolveAssets(merged, configDir);

  logger.debug(`Config merged with defaults. App: ${resolved.appName}, Package: ${resolved.packageName}`);

  return resolved;
}

module.exports = {
  loadConfig,
  getDefaults,
  deepMerge,
};
