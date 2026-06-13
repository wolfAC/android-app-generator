'use strict';

const chalk = require('chalk');

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  step: 2,
  warn: 3,
  error: 4,
  success: 5,
};

let currentLevel = LOG_LEVELS.info;
let debugMode = false;

function timestamp() {
  const now = new Date();
  return chalk.gray(`[${now.toTimeString().slice(0, 8)}]`);
}

const logger = {
  setLevel(level) {
    if (LOG_LEVELS[level] !== undefined) {
      currentLevel = LOG_LEVELS[level];
    }
  },

  setDebug(enabled) {
    debugMode = enabled;
    if (enabled) {
      currentLevel = LOG_LEVELS.debug;
    }
  },

  debug(...args) {
    if (!debugMode && currentLevel > LOG_LEVELS.debug) return;
    console.log(timestamp(), chalk.gray('🔍 DEBUG'), chalk.gray(args.join(' ')));
  },

  info(...args) {
    if (currentLevel > LOG_LEVELS.info) return;
    console.log(timestamp(), chalk.blue('ℹ INFO '), chalk.white(args.join(' ')));
  },

  step(...args) {
    if (currentLevel > LOG_LEVELS.step) return;
    console.log(timestamp(), chalk.cyan('➤ STEP '), chalk.cyan(args.join(' ')));
  },

  warn(...args) {
    if (currentLevel > LOG_LEVELS.warn) return;
    console.warn(timestamp(), chalk.yellow('⚠ WARN '), chalk.yellow(args.join(' ')));
  },

  error(...args) {
    if (currentLevel > LOG_LEVELS.error) return;
    console.error(timestamp(), chalk.red('✖ ERROR'), chalk.red(args.join(' ')));
  },

  success(...args) {
    console.log(timestamp(), chalk.green('✔ SUCCESS'), chalk.green(args.join(' ')));
  },

  blank() {
    console.log();
  },

  divider() {
    console.log(chalk.gray('─'.repeat(60)));
  },

  title(text) {
    console.log();
    console.log(chalk.bold.cyan('═'.repeat(60)));
    console.log(chalk.bold.cyan(`  ${text}`));
    console.log(chalk.bold.cyan('═'.repeat(60)));
    console.log();
  },

  list(items, color = 'white') {
    items.forEach((item) => {
      console.log(chalk[color](`  • ${item}`));
    });
  },

  table(data) {
    console.table(data);
  },
};

module.exports = logger;
