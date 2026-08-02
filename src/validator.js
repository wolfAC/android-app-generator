'use strict';

const path = require('path');
const fs = require('fs');
const semver = require('semver');
const logger = require('./logger');

const KNOWN_PLUGINS = (() => {
  try {
    const pluginsDir = path.resolve(__dirname, '..', 'plugins');
    return fs.readdirSync(pluginsDir).filter((entry) => {
      try {
        return fs.statSync(path.join(pluginsDir, entry)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
})();

const PACKAGE_NAME_REGEX = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
const HTTPS_URL_REGEX = /^https:\/\/.+/;

/**
 * Validate a hex color string.
 * Accepts #RGB, #RRGGBB, #RRGGBBAA formats.
 */
function isValidHexColor(color) {
  return HEX_COLOR_REGEX.test(color);
}

/**
 * Validate the configuration object.
 * @param {Object} config - Merged configuration object
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validate(config) {
  const errors = [];
  const warnings = [];

  // --- appName ---
  if (!config.appName || typeof config.appName !== 'string' || config.appName.trim() === '') {
    errors.push('appName is required and must be a non-empty string');
  }

  // --- packageName ---
  if (!config.packageName) {
    errors.push('packageName is required');
  } else if (typeof config.packageName !== 'string') {
    errors.push('packageName must be a string');
  } else if (!PACKAGE_NAME_REGEX.test(config.packageName)) {
    errors.push(
      `packageName "${config.packageName}" is invalid. Must match pattern: com.example.appname ` +
      '(lowercase letters, digits, underscores; at least two segments separated by dots)'
    );
  }

  // --- websiteUrl ---
  if (!config.websiteUrl) {
    errors.push('websiteUrl is required');
  } else if (typeof config.websiteUrl !== 'string') {
    errors.push('websiteUrl must be a string');
  } else if (!HTTPS_URL_REGEX.test(config.websiteUrl)) {
    errors.push(`websiteUrl must start with https://. Got: "${config.websiteUrl}"`);
  } else {
    try {
      const url = new URL(config.websiteUrl);
      if (url.protocol !== 'https:') {
        errors.push(`websiteUrl must use HTTPS protocol. Got: "${config.websiteUrl}"`);
      }
    } catch {
      errors.push(`websiteUrl is not a valid URL: "${config.websiteUrl}"`);
    }
  }

  // --- version ---
  if (!config.version) {
    errors.push('version object is required (with code and name fields)');
  } else {
    if (config.version.code === undefined || config.version.code === null) {
      errors.push('version.code is required');
    } else if (
      !Number.isInteger(config.version.code) ||
      config.version.code < 1
    ) {
      errors.push(`version.code must be a positive integer. Got: ${config.version.code}`);
    }

    if (!config.version.name) {
      errors.push('version.name is required');
    } else if (typeof config.version.name !== 'string') {
      errors.push('version.name must be a string');
    } else {
      // Allow semver-like strings: 1.0.0, 1.0, 1.0.0-beta.1, etc.
      const coerced = semver.coerce(config.version.name);
      if (!coerced) {
        errors.push(
          `version.name "${config.version.name}" is not a valid semver-like string ` +
          '(examples: "1.0.0", "2.3.1", "1.0.0-beta.1")'
        );
      }
    }
  }

  // --- theme ---
  if (config.theme) {
    const colorFields = ['primary', 'background'];
    const optionalColorFields = ['primaryDark', 'accent', 'surface', 'onPrimary', 'onBackground'];

    colorFields.forEach((field) => {
      if (!config.theme[field]) {
        errors.push(`theme.${field} is required`);
      } else if (!isValidHexColor(config.theme[field])) {
        errors.push(
          `theme.${field} "${config.theme[field]}" is not a valid hex color ` +
          '(must be #RGB, #RRGGBB, or #RRGGBBAA)'
        );
      }
    });

    optionalColorFields.forEach((field) => {
      if (config.theme[field] && !isValidHexColor(config.theme[field])) {
        warnings.push(
          `theme.${field} "${config.theme[field]}" is not a valid hex color — will be ignored`
        );
      }
    });
  } else {
    errors.push('theme object is required');
  }

  // --- features ---
  if (config.features) {
    const boolFields = [
      'fullscreen', 'notifications', 'offline', 'camera',
      'location', 'fileUpload', 'biometric', 'qrScanner',
    ];
    boolFields.forEach((field) => {
      if (config.features[field] !== undefined && typeof config.features[field] !== 'boolean') {
        warnings.push(`features.${field} should be a boolean, got: ${typeof config.features[field]}`);
      }
    });
  }

  // --- firebase ---
  if (config.firebase && config.firebase.enabled) {
    if (!config.firebase.projectId || config.firebase.projectId.trim() === '') {
      warnings.push('firebase.enabled is true but firebase.projectId is not set');
    }
    if (!config.firebase.appId || config.firebase.appId.trim() === '') {
      warnings.push('firebase.enabled is true but firebase.appId is not set');
    }
    if (!config.firebase.apiKey || config.firebase.apiKey.trim() === '') {
      warnings.push('firebase.enabled is true but firebase.apiKey is not set');
    }
  }

  // --- assets (warnings only) ---
  if (config.assets) {
    if (!config.assets.icon) {
      warnings.push(
        'assets.icon not provided — a placeholder icon will be generated using the first letter of appName'
      );
    }
    if (!config.assets.splashIcon) {
      warnings.push(
        'assets.splashIcon not provided — the app icon will be used for the splash screen'
      );
    }
  }

  // --- android config ---
  if (config.android) {
    if (config.android.minSdk && config.android.minSdk < 21) {
      warnings.push(
        `android.minSdk ${config.android.minSdk} is very low — TWA requires API 21+. Recommended: 24+`
      );
    }
    if (config.android.compileSdk && config.android.compileSdk < config.android.targetSdk) {
      errors.push(
        `android.compileSdk (${config.android.compileSdk}) must be >= android.targetSdk (${config.android.targetSdk})`
      );
    }
  }

  // --- plugins ---
  if (config.plugins !== undefined) {
    if (!Array.isArray(config.plugins)) {
      errors.push('plugins must be an array');
    } else {
      config.plugins.forEach((entry, i) => {
        const name = typeof entry === 'string' ? entry : (entry && entry.name);
        if (!name || typeof name !== 'string') {
          errors.push(`plugins[${i}] must be a string or an object with a "name" field`);
          return;
        }
        if (KNOWN_PLUGINS.length > 0 && !KNOWN_PLUGINS.includes(name)) {
          warnings.push(
            `plugins[${i}]: unknown plugin "${name}". ` +
            `Known plugins: ${KNOWN_PLUGINS.join(', ')}`
          );
        }
      });
    }
  }

  // --- signing (warnings for incomplete config) ---
  if (config.signing && config.signing.storeFile) {
    if (!config.signing.keyAlias) {
      warnings.push('signing.storeFile is set but signing.keyAlias is missing');
    }
    if (!config.signing.storePassword) {
      warnings.push('signing.storeFile is set but signing.storePassword is missing');
    }
  }

  const valid = errors.length === 0;

  return { valid, errors, warnings };
}

/**
 * Validate and print results to logger.
 * @param {Object} config
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateAndReport(config) {
  const result = validate(config);

  if (result.warnings.length > 0) {
    logger.blank();
    logger.warn(`Validation warnings (${result.warnings.length}):`);
    result.warnings.forEach((w) => logger.warn(`  • ${w}`));
  }

  if (result.errors.length > 0) {
    logger.blank();
    logger.error(`Validation errors (${result.errors.length}):`);
    result.errors.forEach((e) => logger.error(`  • ${e}`));
  }

  return result;
}

module.exports = {
  validate,
  validateAndReport,
  isValidHexColor,
};
