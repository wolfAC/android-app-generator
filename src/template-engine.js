'use strict';

const path = require('path');
const fs = require('fs-extra');
const ejs = require('ejs');
const logger = require('./logger');

/**
 * Render a single EJS template file with the given data.
 * @param {string} templatePath - Absolute path to the .ejs template file
 * @param {Object} data - Template variables
 * @returns {Promise<string>} Rendered content
 */
async function render(templatePath, data) {
  const templateContent = await fs.readFile(templatePath, 'utf-8');
  try {
    return ejs.render(templateContent, data, {
      filename: templatePath, // Enables includes relative to template location
      async: false,
    });
  } catch (err) {
    throw new Error(`Template render error in ${templatePath}: ${err.message}`);
  }
}

/**
 * Recursively render all .ejs files from templateDir into outputDir.
 * Non-.ejs files are copied as-is.
 *
 * The `packagePath` in data is used to rewrite the placeholder kotlin path:
 *   kotlin/com/twa/app  →  kotlin/<packagePath>
 *
 * @param {string} templateDir - Root of template directory
 * @param {string} outputDir - Root of output directory
 * @param {Object} data - Template variables (must include packagePath)
 */
async function renderDir(templateDir, outputDir, data) {
  const entries = await fs.readdir(templateDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(templateDir, entry.name);

    if (entry.isDirectory()) {
      // Rewrite the placeholder package path to the real package path
      const dirName = rewritePathSegment(entry.name, data);
      const destDir = path.join(outputDir, dirName);
      await renderDir(srcPath, destDir, data);
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.ejs')) {
        // Render the EJS template and write without the .ejs extension
        const outputName = entry.name.slice(0, -4); // strip .ejs
        const destPath = path.join(outputDir, outputName);
        await fs.ensureDir(outputDir);
        const rendered = await render(srcPath, data);
        await fs.writeFile(destPath, rendered, 'utf-8');
        logger.debug(`Rendered: ${destPath}`);
      } else {
        // Copy non-template files as-is
        await fs.ensureDir(outputDir);
        await fs.copy(srcPath, path.join(outputDir, entry.name));
        logger.debug(`Copied:   ${path.join(outputDir, entry.name)}`);
      }
    }
  }
}

/**
 * Rewrite special directory name placeholders.
 * The template uses "app" as the placeholder package directory under kotlin/.
 * We don't need to rewrite directory names since the kotlin source path is
 * handled by constructing it from packagePath in the generator.
 */
function rewritePathSegment(segment, data) {
  // No renaming needed for directory names in our template structure
  return segment;
}

/**
 * Build the template data object from config.
 * Adds computed fields needed by templates.
 * @param {Object} config - Merged config
 * @returns {Object} Template data
 */
function buildTemplateData(config) {
  // packagePath: com.example.app -> com/example/app
  const packagePath = config.packageName.replace(/\./g, '/');

  // kebab-case app name for directory names
  const appNameKebab = (config.appName || 'app')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Normalize version: support both {code, name} and {code: n, name: "x"} forms
  const version = {
    code: (config.version && config.version.code) || 1,
    name: (config.version && config.version.name) || '1.0.0',
  };

  // Theme with safe defaults
  const theme = Object.assign(
    {
      primary: '#6200EE',
      primaryDark: '#3700B3',
      accent: '#03DAC5',
      background: '#FFFFFF',
      surface: '#FFFFFF',
      onPrimary: '#FFFFFF',
      onBackground: '#000000',
    },
    config.theme || {}
  );

  // Features with safe defaults
  const features = Object.assign(
    {
      fullscreen: true,
      notifications: false,
      offline: false,
      camera: false,
      location: false,
      fileUpload: false,
      biometric: false,
      qrScanner: false,
      bridge: false,
    },
    config.features || {}
  );

  // Firebase
  const firebase = Object.assign(
    {
      enabled: false,
      projectId: '',
      appId: '',
      apiKey: '',
      messagingSenderId: '',
      storageBucket: '',
    },
    config.firebase || {}
  );

  // Android build config
  const android = Object.assign(
    {
      compileSdk: 35,
      minSdk: 24,
      targetSdk: 35,
      gradleVersion: '8.9',
      agpVersion: '8.7.0',
      kotlinVersion: '2.0.21',
    },
    config.android || {}
  );

  return {
    // Core
    appName: config.appName || 'My TWA App',
    packageName: config.packageName || 'com.example.twaapp',
    websiteUrl: config.websiteUrl || 'https://example.com',
    appNameKebab,

    // Computed
    packagePath,
    applicationId: config.packageName || 'com.example.twaapp',
    mainActivityClass: 'MainActivity',

    // Version
    version,

    // Theme
    theme,

    // Features
    features,

    // Firebase
    firebase,

    // Android build
    android,

    // Other config
    orientation: config.orientation || 'unspecified',
    signing: config.signing || {},
    customPermissions: config.customPermissions || [],
    deepLinks: config.deepLinks || [],
    splash: Object.assign({ backgroundColor: theme.primary, iconSize: 'medium' }, config.splash || {}),

    // Computed: whether native WebView bridge is needed
    nativeBridgeEnabled:
      !!(features.camera || features.qrScanner || features.biometric ||
         features.fileUpload || features.location || features.notifications),

    // Plugins
    plugins: config.plugins || [],
    activePlugins: (config.plugins || []).map(p => typeof p === 'string' ? p : p.name),

    // Generation metadata
    generatedAt: new Date().toISOString(),
    generatorVersion: '1.0.0',
  };
}

module.exports = {
  render,
  renderDir,
  buildTemplateData,
};
