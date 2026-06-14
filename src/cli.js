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

// ─── plugin ─────────────────────────────────────────────────────────────────

const pluginCmd = program
  .command('plugin')
  .description('Manage TWA Generator plugins');

pluginCmd
  .command('list')
  .description('List all available built-in plugins')
  .action(() => {
    const fs = require('fs-extra');
    const pluginsDir = path.resolve(__dirname, '..', 'plugins');

    logger.title('TWA Generator — Available Plugins');

    let plugins = [];
    try {
      plugins = fs.readdirSync(pluginsDir).filter((entry) => {
        try {
          const indexFile = path.join(pluginsDir, entry, 'index.js');
          return fs.existsSync(indexFile);
        } catch {
          return false;
        }
      });
    } catch (err) {
      logger.error(`Could not read plugins directory: ${err.message}`);
      process.exit(1);
    }

    if (plugins.length === 0) {
      logger.info('No plugins installed.');
      process.exit(0);
    }

    plugins.forEach((name) => {
      try {
        const plugin = require(path.join(pluginsDir, name, 'index.js'));
        logger.info(`  ${chalk.cyan(plugin.name)}@${plugin.version}  —  ${plugin.description || ''}`);
      } catch {
        logger.info(`  ${chalk.cyan(name)}  (failed to load)`);
      }
    });

    logger.blank();
    logger.info(`To use a plugin, add it to your app.json "plugins" array:`);
    logger.info(`  "plugins": ["${plugins[0]}"]`);
    process.exit(0);
  });

pluginCmd
  .command('info <name>')
  .description('Show details about a built-in plugin')
  .action((name) => {
    const pluginsDir = path.resolve(__dirname, '..', 'plugins');
    const pluginFile = path.join(pluginsDir, name, 'index.js');

    const fs = require('fs-extra');
    if (!fs.existsSync(pluginFile)) {
      logger.error(`Plugin "${name}" not found at ${pluginFile}`);
      process.exit(1);
    }

    try {
      const plugin = require(pluginFile);
      logger.title(`Plugin: ${plugin.name}`);
      logger.info(`Version:     ${plugin.version}`);
      logger.info(`Description: ${plugin.description || '(none)'}`);
      logger.blank();

      if (plugin.dependencies && plugin.dependencies.length > 0) {
        logger.info('Maven dependencies:');
        plugin.dependencies.forEach((d) => logger.info(`  ${d.configuration}("${d.artifact}")`));
        logger.blank();
      }
      if (plugin.gradlePlugins && plugin.gradlePlugins.length > 0) {
        logger.info('Gradle plugins:');
        plugin.gradlePlugins.forEach((p) => logger.info(`  id("${p.id}")`));
        logger.blank();
      }
      if (plugin.permissions && plugin.permissions.length > 0) {
        logger.info('Android permissions:');
        plugin.permissions.forEach((p) => logger.info(`  ${p}`));
        logger.blank();
      }
      if (plugin.kotlinFiles && plugin.kotlinFiles.length > 0) {
        logger.info('Kotlin files:');
        plugin.kotlinFiles.forEach((f) => logger.info(`  ${f.dest}`));
        logger.blank();
      }

      logger.info('Usage in app.json:');
      logger.info(`  "plugins": ["${plugin.name}"]`);
    } catch (err) {
      logger.error(`Failed to load plugin "${name}": ${err.message}`);
      process.exit(1);
    }

    process.exit(0);
  });

pluginCmd
  .command('add <name> [configDir]')
  .description('Add a plugin to app.json')
  .action(async (name, configDir) => {
    const fs = require('fs-extra');
    const targetDir = configDir ? path.resolve(configDir) : process.cwd();
    const configPath = path.join(targetDir, 'app.json');

    if (!fs.existsSync(configPath)) {
      logger.error(`app.json not found at: ${configPath}`);
      process.exit(1);
    }

    const pluginsDir = path.resolve(__dirname, '..', 'plugins');
    if (!fs.existsSync(path.join(pluginsDir, name, 'index.js'))) {
      logger.warn(`Plugin "${name}" is not a known built-in plugin — adding anyway`);
    }

    let config;
    try {
      config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    } catch (err) {
      logger.error(`Failed to read app.json: ${err.message}`);
      process.exit(1);
    }

    if (!Array.isArray(config.plugins)) {
      config.plugins = [];
    }

    if (config.plugins.includes(name) || config.plugins.some((p) => p && p.name === name)) {
      logger.warn(`Plugin "${name}" is already in app.json`);
      process.exit(0);
    }

    config.plugins.push(name);
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    logger.success(`Added plugin "${name}" to ${configPath}`);
    process.exit(0);
  });

pluginCmd
  .command('remove <name> [configDir]')
  .description('Remove a plugin from app.json')
  .action(async (name, configDir) => {
    const fs = require('fs-extra');
    const targetDir = configDir ? path.resolve(configDir) : process.cwd();
    const configPath = path.join(targetDir, 'app.json');

    if (!fs.existsSync(configPath)) {
      logger.error(`app.json not found at: ${configPath}`);
      process.exit(1);
    }

    let config;
    try {
      config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    } catch (err) {
      logger.error(`Failed to read app.json: ${err.message}`);
      process.exit(1);
    }

    if (!Array.isArray(config.plugins)) {
      logger.warn('No plugins configured in app.json');
      process.exit(0);
    }

    const before = config.plugins.length;
    config.plugins = config.plugins.filter((p) => {
      const n = typeof p === 'string' ? p : (p && p.name);
      return n !== name;
    });

    if (config.plugins.length === before) {
      logger.warn(`Plugin "${name}" was not found in app.json`);
      process.exit(0);
    }

    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    logger.success(`Removed plugin "${name}" from ${configPath}`);
    process.exit(0);
  });

// ─── dashboard ──────────────────────────────────────────────────────────────

program
  .command('dashboard')
  .description('Start the self-hosted web dashboard for the TWA Generator')
  .option('-p, --port <port>', 'Port to listen on', '3000')
  .option('--open', 'Open browser after starting')
  .action((options) => {
    const port = parseInt(options.port, 10) || 3000;
    process.env.PORT = String(port);

    const app = require('../dashboard/server');

    app.listen(port, () => {
      console.log(`TWA Dashboard running at http://localhost:${port}`);
      console.log(`  Login/Register: http://localhost:${port}/`);
      console.log(`  Dashboard:      http://localhost:${port}/dashboard`);
    });

    if (options.open) {
      setTimeout(() => {
        const url = `http://localhost:${port}`;
        const { exec } = require('child_process');
        const cmd = process.platform === 'win32' ? `start ${url}`
          : process.platform === 'darwin' ? `open ${url}`
          : `xdg-open ${url}`;
        exec(cmd);
      }, 1000);
    }
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
