'use strict';

const path = require('path');
const fs = require('fs-extra');
const logger = require('./logger');

// Launcher icon densities: density name -> size in pixels
const LAUNCHER_ICON_DENSITIES = [
  { density: 'mipmap-mdpi',    size: 48  },
  { density: 'mipmap-hdpi',    size: 72  },
  { density: 'mipmap-xhdpi',   size: 96  },
  { density: 'mipmap-xxhdpi',  size: 144 },
  { density: 'mipmap-xxxhdpi', size: 192 },
];

// Foreground adaptive icon size
const ADAPTIVE_ICON_SIZE = 108;
const ADAPTIVE_CANVAS_SIZE = 432;

let sharp;
try {
  sharp = require('sharp');
} catch {
  logger.warn('sharp module not available — image processing will be skipped and originals copied');
  sharp = null;
}

/**
 * Parse a hex color to RGBA values (0-255).
 * Supports #RGB, #RRGGBB, #RRGGBBAA
 */
function parseHexColor(hex) {
  const h = hex.replace('#', '');
  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
      alpha: 255,
    };
  }
  if (h.length === 6) {
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      alpha: 255,
    };
  }
  if (h.length === 8) {
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      alpha: parseInt(h.slice(6, 8), 16),
    };
  }
  return { r: 98, g: 0, b: 238, alpha: 255 }; // fallback: Material purple
}

/**
 * Generate a placeholder SVG icon with the first letter of the app name.
 * Returns SVG as a Buffer.
 */
function generatePlaceholderSvg(appName, primaryColor) {
  const letter = (appName || 'A').trim()[0].toUpperCase();
  const color = parseHexColor(primaryColor || '#6200EE');
  const bg = `rgb(${color.r},${color.g},${color.b})`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${bg}" rx="64" ry="64"/>
  <text x="256" y="340" font-family="Arial, Helvetica, sans-serif" font-size="280" font-weight="bold"
        fill="white" text-anchor="middle">${letter}</text>
</svg>`;

  return Buffer.from(svg);
}

/**
 * Generate a circular crop mask for round icons.
 * Returns SVG as a Buffer.
 */
function generateCircleMask(size) {
  const half = size / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <circle cx="${half}" cy="${half}" r="${half}" fill="white"/>
</svg>`;
  return Buffer.from(svg);
}

/**
 * Process and resize a source image using sharp.
 * If sharp is unavailable, copies the source file as-is.
 */
async function resizeImage(srcBuffer, width, height, outputPath) {
  if (!sharp) {
    // Just ensure the directory and write the buffer unchanged
    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, srcBuffer);
    return;
  }

  await fs.ensureDir(path.dirname(outputPath));
  await sharp(srcBuffer)
    .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outputPath);
}

/**
 * Generate a circular (round) icon by compositing a circle mask.
 */
async function generateRoundIcon(srcBuffer, size, outputPath) {
  if (!sharp) {
    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, srcBuffer);
    return;
  }

  const circleMask = generateCircleMask(size);
  const resized = await sharp(srcBuffer)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await fs.ensureDir(path.dirname(outputPath));
  await sharp(resized)
    .composite([{ input: circleMask, blend: 'dest-in' }])
    .png()
    .toFile(outputPath);
}

/**
 * Generate adaptive icon foreground: centered on a transparent canvas.
 */
async function generateAdaptiveForeground(srcBuffer, outputPath) {
  if (!sharp) {
    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, srcBuffer);
    return;
  }

  const foreground = await sharp(srcBuffer)
    .resize(ADAPTIVE_ICON_SIZE, ADAPTIVE_ICON_SIZE, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const offsetX = Math.floor((ADAPTIVE_CANVAS_SIZE - ADAPTIVE_ICON_SIZE) / 2);
  const offsetY = Math.floor((ADAPTIVE_CANVAS_SIZE - ADAPTIVE_ICON_SIZE) / 2);

  await fs.ensureDir(path.dirname(outputPath));
  await sharp({
    create: {
      width: ADAPTIVE_CANVAS_SIZE,
      height: ADAPTIVE_CANVAS_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: foreground, top: offsetY, left: offsetX }])
    .png()
    .toFile(outputPath);
}

/**
 * Write the ic_launcher_foreground.xml adaptive icon XML resource.
 */
async function writeAdaptiveIconXml(resDir) {
  // Foreground drawable (vector or bitmap reference)
  const foregroundXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;

  const anydpiDir = path.join(resDir, 'mipmap-anydpi-v26');
  await fs.ensureDir(anydpiDir);
  await fs.writeFile(path.join(anydpiDir, 'ic_launcher.xml'), foregroundXml);
  await fs.writeFile(path.join(anydpiDir, 'ic_launcher_round.xml'), foregroundXml);
  logger.debug('Written adaptive icon XML resources');
}

/**
 * Write the ic_launcher_background color to colors.xml or via a dedicated resource.
 * We add it to the existing colors.xml later via template — here we just note it.
 */

/**
 * Main entry point: process all assets for the project.
 * @param {Object} config - Merged config
 * @param {string} outputDir - Root of generated project
 */
async function processAssets(config, outputDir) {
  logger.step('Processing assets...');

  const resDir = path.join(
    outputDir,
    'app', 'src', 'main', 'res'
  );

  // --- Determine source icon buffer ---
  let iconBuffer;
  if (config.assets && config.assets.icon) {
    try {
      iconBuffer = await fs.readFile(config.assets.icon);
      logger.debug(`Using provided icon: ${config.assets.icon}`);
    } catch (err) {
      logger.warn(`Could not read icon file: ${err.message}. Generating placeholder.`);
      iconBuffer = null;
    }
  }

  if (!iconBuffer) {
    logger.info('Generating placeholder icon from app name initial');
    const svgBuffer = generatePlaceholderSvg(config.appName, config.theme && config.theme.primary);
    if (sharp) {
      iconBuffer = await sharp(svgBuffer).png().toBuffer();
    } else {
      iconBuffer = svgBuffer; // Will be saved as SVG data (not ideal, but graceful fallback)
    }
  }

  // --- Generate launcher icons in all densities ---
  logger.step('Generating launcher icons...');
  for (const { density, size } of LAUNCHER_ICON_DENSITIES) {
    const densityDir = path.join(resDir, density);

    // Standard square icon
    const squarePath = path.join(densityDir, 'ic_launcher.png');
    await resizeImage(iconBuffer, size, size, squarePath);

    // Round icon
    const roundPath = path.join(densityDir, 'ic_launcher_round.png');
    await generateRoundIcon(iconBuffer, size, roundPath);

    // Adaptive foreground icon (in mipmap dirs)
    const foregroundPath = path.join(densityDir, 'ic_launcher_foreground.png');
    await generateAdaptiveForeground(iconBuffer, foregroundPath);

    logger.debug(`Generated icons for ${density} (${size}x${size})`);
  }

  // --- Adaptive icon XMLs ---
  await writeAdaptiveIconXml(resDir);

  // --- Splash screen image ---
  logger.step('Processing splash screen...');
  const drawableDir = path.join(resDir, 'drawable');
  await fs.ensureDir(drawableDir);

  let splashBuffer;
  if (config.assets && config.assets.splashIcon) {
    try {
      splashBuffer = await fs.readFile(config.assets.splashIcon);
      logger.debug(`Using provided splash icon: ${config.assets.splashIcon}`);
    } catch {
      splashBuffer = iconBuffer;
    }
  } else {
    splashBuffer = iconBuffer;
  }

  const splashPath = path.join(drawableDir, 'splash.png');
  await resizeImage(splashBuffer, 1024, 1024, splashPath);
  logger.debug('Written splash.png (1024x1024)');

  // Write a notification icon (24dp equivalent, single density in drawable)
  const notifPath = path.join(drawableDir, 'ic_notification.png');
  await resizeImage(iconBuffer, 96, 96, notifPath);

  logger.success('Assets processed successfully');
}

module.exports = {
  processAssets,
  generatePlaceholderSvg,
  LAUNCHER_ICON_DENSITIES,
};
