'use strict';

const { Command } = require('commander');
const path = require('path');
const chalk = require('chalk');

const Generator = require('./generator');
const { loadConfig } = require('./config-loader');
const { validateAndReport } = require('./validator');
const { build } = require('./builder');
const logger = require('./logger');

const program = new Command();

program
  .name('twa-generator')
  .description('Generate complete Android TWA projects from a config file')
  .version('1.0.0');

// ─── create ─────────────────────────────────────────────────────────────────

program
  .command('create <configDir>')
  .description('Generate a new Android TWA project from app.json in <configDir>')
  .option('-o, --output <outputDir>', 'Output directory for the generated project')
  .option('-d, --debug', 'Enable debug logging')
  .option('--no-assets', 'Skip asset processing (faster for template testing)')
  .action(async (configDir, options) => {
    if (options.debug) {
      logger.setDebug(true);
    }

    try {
      const generator = new Generator();
      const resolvedConfig = path.resolve(configDir);
      const outputDir = options.output ? path.resolve(options.output) : undefined;

      await generator.generate(resolvedConfig, outputDir);
      process.exit(0);
    } catch (err) {
      logger.error(err.message);
      if (options.debug && err.stack) {
        logger.debug(err.stack);
      }
      process.exit(1);
    }
  });

// ─── build ──────────────────────────────────────────────────────────────────

program
  .command('build <projectDir>')
  .description('Build APK or AAB from an existing generated Android project')
  .option('-r, --release', 'Build release variant (default: debug)')
  .option('--aab', 'Build Android App Bundle (.aab) instead of APK')
  .option('--apk', 'Build APK (default behavior, can combine with --aab)')
  .option('-d, --debug', 'Enable debug logging')
  .action(async (projectDir, options) => {
    if (options.debug) {
      logger.setDebug(true);
    }

    try {
      const resolvedDir = path.resolve(projectDir);
      logger.title('TWA Generator — Building Android Project');
      logger.info(`Project: ${resolvedDir}`);
      logger.info(`Variant: ${options.release ? 'release' : 'debug'}`);
      logger.info(`Format:  ${options.aab ? 'AAB' : 'APK'}`);

      const result = await build(resolvedDir, {
        release: Boolean(options.release),
        aab: Boolean(options.aab),
        apk: !options.aab || Boolean(options.apk),
      });

      if (result.success) {
        logger.success('Build succeeded!');
        if (result.artifacts.length > 0) {
          logger.info('Artifacts:');
          result.artifacts.forEach((a) => logger.info(`  ${a}`));
        }
      }

      process.exit(0);
    } catch (err) {
      logger.error(`Build failed: ${err.message}`);
      if (options.debug && err.stack) {
        logger.debug(err.stack);
      }
      process.exit(1);
    }
  });

// ─── update ─────────────────────────────────────────────────────────────────

program
  .command('update <configDir>')
  .description('Update an existing generated project with new config/assets')
  .option('-p, --project <projectDir>', 'Path to the existing generated project')
  .option('-d, --debug', 'Enable debug logging')
  .action(async (configDir, options) => {
    if (options.debug) {
      logger.setDebug(true);
    }

    if (!options.project) {
      logger.error('--project <projectDir> is required for the update command');
      logger.info('Usage: twa-generator update <configDir> --project <projectDir>');
      process.exit(1);
    }

    try {
      const generator = new Generator();
      const resolvedConfig = path.resolve(configDir);
      const resolvedProject = path.resolve(options.project);

      await generator.update(resolvedConfig, resolvedProject);
      process.exit(0);
    } catch (err) {
      logger.error(err.message);
      if (options.debug && err.stack) {
        logger.debug(err.stack);
      }
      process.exit(1);
    }
  });

// ─── validate ───────────────────────────────────────────────────────────────

program
  .command('validate <configDir>')
  .description('Validate app.json in <configDir> without generating a project')
  .option('-d, --debug', 'Enable debug logging')
  .action(async (configDir, options) => {
    if (options.debug) {
      logger.setDebug(true);
    }

    logger.title('TWA Generator — Validating Configuration');

    try {
      const resolvedConfig = path.resolve(configDir);
      logger.step(`Loading config from: ${resolvedConfig}`);

      const config = await loadConfig(resolvedConfig);
      logger.info(`App: ${config.appName}`);
      logger.info(`Package: ${config.packageName}`);
      logger.info(`URL: ${config.websiteUrl}`);
      logger.blank();

      const result = validateAndReport(config);

      logger.blank();
      if (result.valid) {
        logger.success('Configuration is valid!');
        if (result.warnings.length > 0) {
          logger.warn(`${result.warnings.length} warning(s) — review above`);
        }
        process.exit(0);
      } else {
        logger.error(`Configuration has ${result.errors.length} error(s) — see above`);
        process.exit(1);
      }
    } catch (err) {
      logger.error(err.message);
      if (options.debug && err.stack) {
        logger.debug(err.stack);
      }
      process.exit(1);
    }
  });

// ─── init ───────────────────────────────────────────────────────────────────

program
  .command('init [directory]')
  .description('Create a new app.json config file interactively (optional: specify directory)')
  .action(async (directory, options) => {
    const targetDir = directory ? path.resolve(directory) : process.cwd();
    const configPath = path.join(targetDir, 'app.json');

    const fs = require('fs-extra');
    if (await fs.pathExists(configPath)) {
      logger.warn(`app.json already exists at: ${configPath}`);
      logger.info('Use --force to overwrite (not yet implemented)');
      process.exit(1);
    }

    // Default starter config
    const starterConfig = {
      appName: 'My PWA App',
      packageName: 'com.example.mypwaapp',
      websiteUrl: 'https://example.com',
      version: { code: 1, name: '1.0.0' },
      theme: { primary: '#6200EE', background: '#FFFFFF' },
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
      firebase: { enabled: false },
    };

    await fs.ensureDir(targetDir);
    await fs.writeFile(configPath, JSON.stringify(starterConfig, null, 2));
    logger.success(`Created app.json at: ${configPath}`);
    logger.info('Edit the file with your app details, then run:');
    logger.info(`  twa-generator create ${targetDir}`);
    process.exit(0);
  });

// ─── Global error handler ────────────────────────────────────────────────────

program.on('command:*', () => {
  logger.error(`Unknown command: ${program.args.join(' ')}`);
  logger.info('Run twa-generator --help for a list of available commands');
  process.exit(1);
});

// Show help if no command provided
if (process.argv.length <= 2) {
  program.help();
}

program.parse(process.argv);
