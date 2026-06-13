'use strict';

const path = require('path');
const fs = require('fs-extra');
const ora = require('ora');

const { loadConfig } = require('./config-loader');
const { validateAndReport } = require('./validator');
const { processAssets } = require('./asset-manager');
const { renderDir, buildTemplateData } = require('./template-engine');
const logger = require('./logger');

const TEMPLATES_DIR = path.resolve(__dirname, '..', 'templates', 'android-twa');

/**
 * Convert a string to kebab-case.
 */
function toKebabCase(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Write the assetlinks.json placeholder file.
 * Users must replace the sha256_cert_fingerprints value with their actual signing certificate.
 */
async function writeAssetLinks(config, outputDir) {
  const wellKnownDir = path.join(outputDir, 'app', 'src', 'main', 'assets', '.well-known');
  await fs.ensureDir(wellKnownDir);

  const assetLinks = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: config.packageName,
        sha256_cert_fingerprints: [
          'REPLACE_WITH_YOUR_SHA256_CERT_FINGERPRINT',
        ],
      },
    },
  ];

  const assetLinksPath = path.join(wellKnownDir, 'assetlinks.json');
  await fs.writeFile(assetLinksPath, JSON.stringify(assetLinks, null, 2));
  logger.debug(`Written assetlinks.json placeholder to: ${assetLinksPath}`);
}

/**
 * Move Kotlin source files from the template placeholder path to the real package path.
 * Template generates files under kotlin/com/twa/app/
 * They need to be at kotlin/<packagePath>/
 */
async function relocateKotlinSources(config, outputDir) {
  const packagePath = config.packageName.replace(/\./g, '/');
  const kotlinBase = path.join(outputDir, 'app', 'src', 'main', 'kotlin');
  const placeholderDir = path.join(kotlinBase, 'com', 'twa', 'app');
  const targetDir = path.join(kotlinBase, ...config.packageName.split('.'));

  // If placeholder == target, nothing to do
  if (placeholderDir === targetDir) {
    return;
  }

  if (await fs.pathExists(placeholderDir)) {
    await fs.ensureDir(path.dirname(targetDir));
    // If target already exists (same path), skip
    if (!await fs.pathExists(targetDir)) {
      await fs.move(placeholderDir, targetDir, { overwrite: true });
      logger.debug(`Relocated Kotlin sources: com/twa/app -> ${packagePath}`);

      // Clean up empty placeholder directories
      try {
        let current = path.dirname(placeholderDir);
        while (current !== kotlinBase) {
          const entries = await fs.readdir(current);
          if (entries.length === 0) {
            await fs.rmdir(current);
            current = path.dirname(current);
          } else {
            break;
          }
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

class Generator {
  constructor() {
    this.spinner = null;
  }

  /**
   * Generate a complete Android TWA project.
   *
   * @param {string} configDir - Directory containing app.json
   * @param {string} [outputDir] - Where to write the project (default: ./output/<kebab-app-name>)
   * @returns {Promise<string>} Path to generated project
   */
  async generate(configDir, outputDir) {
    logger.title('TWA Generator — Generating Android Project');

    // --- Step 1: Load config ---
    logger.step('Loading configuration...');
    const config = await loadConfig(configDir);
    logger.info(`App: ${config.appName} (${config.packageName})`);
    logger.info(`URL: ${config.websiteUrl}`);

    // --- Step 2: Validate config ---
    logger.step('Validating configuration...');
    const validation = validateAndReport(config);
    if (!validation.valid) {
      throw new Error(
        `Configuration validation failed with ${validation.errors.length} error(s). ` +
        'Fix the issues above and try again.'
      );
    }
    if (validation.warnings.length > 0) {
      logger.warn(`${validation.warnings.length} warning(s) found — continuing anyway`);
    } else {
      logger.success('Configuration is valid');
    }

    // --- Step 3: Determine output directory ---
    const appNameKebab = toKebabCase(config.appName);
    const resolvedOutputDir = outputDir
      ? path.resolve(outputDir)
      : path.resolve(process.cwd(), 'output', appNameKebab);

    logger.info(`Output directory: ${resolvedOutputDir}`);

    // --- Step 4: Check if output dir exists ---
    if (await fs.pathExists(resolvedOutputDir)) {
      const entries = await fs.readdir(resolvedOutputDir);
      if (entries.length > 0) {
        logger.warn(`Output directory already exists and is not empty: ${resolvedOutputDir}`);
        logger.warn('Files will be overwritten.');
      }
    }

    await fs.ensureDir(resolvedOutputDir);

    // --- Step 5: Process assets ---
    this.spinner = ora({ text: 'Processing assets...', color: 'cyan' }).start();
    try {
      await processAssets(config, resolvedOutputDir);
      this.spinner.succeed('Assets processed');
    } catch (err) {
      this.spinner.fail(`Asset processing failed: ${err.message}`);
      logger.warn('Continuing without full asset processing...');
    }

    // --- Step 6: Render templates ---
    this.spinner = ora({ text: 'Rendering templates...', color: 'cyan' }).start();
    const templateData = buildTemplateData(config);

    try {
      await renderDir(TEMPLATES_DIR, resolvedOutputDir, templateData);
      this.spinner.succeed('Templates rendered');
    } catch (err) {
      this.spinner.fail(`Template rendering failed: ${err.message}`);
      throw err;
    }

    // --- Step 7: Relocate Kotlin sources to correct package path ---
    logger.step('Setting up Kotlin source directories...');
    await relocateKotlinSources(config, resolvedOutputDir);
    logger.success('Kotlin sources configured');

    // Make gradlew executable (template copy strips execute bit)
    const gradlewPath = path.join(resolvedOutputDir, 'gradlew');
    if (await fs.pathExists(gradlewPath)) {
      await fs.chmod(gradlewPath, 0o755);
    }

    // --- Step 8: Write assetlinks.json placeholder ---
    logger.step('Writing assetlinks.json placeholder...');
    await writeAssetLinks(config, resolvedOutputDir);

    // --- Step 9: Final success message ---
    logger.blank();
    logger.divider();
    logger.success(`Project generated successfully at: ${resolvedOutputDir}`);
    logger.blank();
    logger.info('Next steps:');
    logger.list([
      `cd ${resolvedOutputDir}`,
      'Open the project in Android Studio',
      `Replace assetlinks.json fingerprint with your signing certificate SHA-256`,
      `Host /.well-known/assetlinks.json on your server (${config.websiteUrl})`,
      'Run: ./gradlew assembleDebug',
      'Or open Android Studio and click Run',
    ], 'cyan');

    if (config.firebase && config.firebase.enabled) {
      logger.blank();
      logger.warn('Firebase is enabled. Remember to:');
      logger.list([
        'Download google-services.json from Firebase Console',
        `Replace the placeholder at: ${path.join(resolvedOutputDir, 'app', 'google-services.json')}`,
      ], 'yellow');
    }

    logger.divider();
    logger.blank();

    return resolvedOutputDir;
  }

  /**
   * Update an existing project by re-rendering templates and re-processing assets.
   *
   * @param {string} configDir - Directory containing app.json
   * @param {string} projectDir - Existing generated project directory
   * @returns {Promise<void>}
   */
  async update(configDir, projectDir) {
    logger.title('TWA Generator — Updating Android Project');

    const resolvedProjectDir = path.resolve(projectDir);
    if (!await fs.pathExists(resolvedProjectDir)) {
      throw new Error(`Project directory not found: ${resolvedProjectDir}`);
    }

    // --- Load and validate ---
    logger.step('Loading configuration...');
    const config = await loadConfig(configDir);

    logger.step('Validating configuration...');
    const validation = validateAndReport(config);
    if (!validation.valid) {
      throw new Error('Configuration validation failed. Fix the issues above and try again.');
    }

    // --- Re-process assets ---
    this.spinner = ora({ text: 'Re-processing assets...', color: 'cyan' }).start();
    try {
      await processAssets(config, resolvedProjectDir);
      this.spinner.succeed('Assets updated');
    } catch (err) {
      this.spinner.fail(`Asset processing failed: ${err.message}`);
      logger.warn('Continuing without asset update...');
    }

    // --- Re-render templates ---
    this.spinner = ora({ text: 'Re-rendering templates...', color: 'cyan' }).start();
    const templateData = buildTemplateData(config);
    try {
      await renderDir(TEMPLATES_DIR, resolvedProjectDir, templateData);
      this.spinner.succeed('Templates updated');
    } catch (err) {
      this.spinner.fail(`Template rendering failed: ${err.message}`);
      throw err;
    }

    // --- Relocate Kotlin sources ---
    await relocateKotlinSources(config, resolvedProjectDir);

    const gradlewPath = path.join(resolvedProjectDir, 'gradlew');
    if (await fs.pathExists(gradlewPath)) {
      await fs.chmod(gradlewPath, 0o755);
    }

    logger.blank();
    logger.success(`Project updated successfully at: ${resolvedProjectDir}`);
    logger.blank();
  }
}

module.exports = Generator;
