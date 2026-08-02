'use strict';

const path = require('path');
const fs = require('fs-extra');

const { render } = require('./template-engine');
const { validatePlugin } = require('../plugins/plugin-api');
const logger = require('./logger');

/**
 * PluginManager loads, validates, and applies plugins to a generated Android project.
 *
 * Injection markers used in generated files:
 *
 *   AndroidManifest.xml:
 *     <!-- PLUGIN_PERMISSIONS_START -->
 *     <!-- PLUGIN_PERMISSIONS_END -->
 *     <!-- PLUGIN_MANIFEST_ENTRIES_START -->
 *     <!-- PLUGIN_MANIFEST_ENTRIES_END -->
 *
 *   app/build.gradle.kts:
 *     // PLUGIN_PLUGINS_START
 *     // PLUGIN_PLUGINS_END
 *     // PLUGIN_DEPENDENCIES_START
 *     // PLUGIN_DEPENDENCIES_END
 *
 *   AndroidBridge.kt:
 *     // PLUGIN_BRIDGE_METHODS_START
 *     // PLUGIN_BRIDGE_METHODS_END
 */
class PluginManager {
  /**
   * @param {string} builtinPluginsDir - Absolute path to the plugins/ directory
   */
  constructor(builtinPluginsDir) {
    this.builtinPluginsDir = builtinPluginsDir;
    /** @type {Array<{plugin: Object, options: Object}>} */
    this.loaded = [];
  }

  /**
   * Load plugins listed in config.plugins array.
   * Each entry is either a string "name" or {name, options}.
   * @param {Array<string|{name: string, options?: Object}>} pluginNames
   */
  async loadPlugins(pluginNames) {
    for (const entry of pluginNames) {
      const name = typeof entry === 'string' ? entry : entry.name;
      const options = (typeof entry === 'object' && entry.options) ? entry.options : {};

      const pluginDir = path.join(this.builtinPluginsDir, name);
      const pluginFile = path.join(pluginDir, 'index.js');

      if (!await fs.pathExists(pluginFile)) {
        logger.warn(`Plugin "${name}" not found at ${pluginFile} — skipping`);
        continue;
      }

      try {
        // Clear require cache so plugins can be reloaded in tests
        delete require.cache[require.resolve(pluginFile)];
        const plugin = require(pluginFile);
        validatePlugin(plugin);

        if (plugin.name !== name) {
          logger.warn(`Plugin at "${pluginDir}" has name "${plugin.name}" but directory is "${name}" — using directory name`);
        }

        this.loaded.push({ plugin, options, dir: pluginDir });
        logger.debug(`Loaded plugin: ${plugin.name}@${plugin.version}`);
      } catch (err) {
        logger.warn(`Failed to load plugin "${name}": ${err.message}`);
      }
    }
  }

  /**
   * Run all loaded plugins against the generated output directory.
   * @param {Object} config - Full merged config
   * @param {string} outputDir - Absolute path to the generated project
   * @param {Object} templateData - Template data built by buildTemplateData()
   */
  async applyPlugins(config, outputDir, templateData) {
    const manifestPath = path.join(outputDir, 'app', 'src', 'main', 'AndroidManifest.xml');
    const gradlePath = path.join(outputDir, 'app', 'build.gradle.kts');

    // Compute kotlin output base for this package
    const packagePath = config.packageName.replace(/\./g, '/');
    const kotlinBase = path.join(outputDir, 'app', 'src', 'main', 'kotlin', ...config.packageName.split('.'));
    const bridgePath = path.join(kotlinBase, 'AndroidBridge.kt');

    for (const { plugin, options, dir } of this.loaded) {
      logger.debug(`Applying plugin: ${plugin.name}`);

      // Build per-plugin template data (add pluginOptions)
      const pluginTemplateData = Object.assign({}, templateData, { pluginOptions: options });

      try {
        // 1. Inject permissions into AndroidManifest.xml
        if (plugin.permissions && plugin.permissions.length > 0) {
          await this._injectPermissions(manifestPath, plugin.permissions);
        }

        // 2. Inject manifest application entries
        if (plugin.manifestEntries && plugin.manifestEntries.length > 0) {
          await this._injectManifestEntries(manifestPath, plugin.manifestEntries);
        }

        // 3. Inject Gradle dependencies
        if (plugin.dependencies && plugin.dependencies.length > 0) {
          await this._injectDependencies(gradlePath, plugin.dependencies);
        }

        // 4. Inject Gradle plugins
        if (plugin.gradlePlugins && plugin.gradlePlugins.length > 0) {
          await this._injectGradlePlugins(gradlePath, plugin.gradlePlugins);
        }

        // 5. Render and copy Kotlin files
        if (plugin.kotlinFiles && plugin.kotlinFiles.length > 0) {
          await this._renderAndCopyKotlinFiles(plugin, dir, kotlinBase, pluginTemplateData);
        }

        // 6. Render and copy layout files
        if (plugin.layoutFiles && plugin.layoutFiles.length > 0) {
          await this._renderAndCopyLayoutFiles(plugin, dir, outputDir, pluginTemplateData);
        }

        // 7. Render and copy XML resource files
        if (plugin.xmlFiles && plugin.xmlFiles.length > 0) {
          await this._renderAndCopyXmlFiles(plugin, dir, outputDir, pluginTemplateData);
        }

        // 8. Inject bridge methods into AndroidBridge.kt
        if (plugin.bridgeMethodsTemplate) {
          await this._injectBridgeMethods(bridgePath, plugin, dir, pluginTemplateData);
        }

        // 9. Call onComplete hook
        if (typeof plugin.onComplete === 'function') {
          await plugin.onComplete(config, outputDir, pluginTemplateData);
        }

        logger.debug(`Plugin "${plugin.name}" applied successfully`);
      } catch (err) {
        logger.warn(`Plugin "${plugin.name}" failed during injection: ${err.message}`);
      }
    }
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  /**
   * Insert <uses-permission> lines before <!-- PLUGIN_PERMISSIONS_END -->.
   * Matches the marker with its leading indentation so injection stays clean.
   * @param {string} manifestPath
   * @param {string[]} permissions
   */
  async _injectPermissions(manifestPath, permissions) {
    let content = await fs.readFile(manifestPath, 'utf-8');

    const marker = '<!-- PLUGIN_PERMISSIONS_END -->';
    if (!content.includes(marker)) {
      logger.warn(`Manifest missing ${marker} marker — cannot inject permissions`);
      return;
    }

    const lines = permissions
      .map(p => `    <uses-permission android:name="${p}" />`)
      .join('\n');

    // Replace the full indented marker line so indentation stays consistent
    content = content.replace(/^([ \t]*)<!-- PLUGIN_PERMISSIONS_END -->/m, `${lines}\n$1<!-- PLUGIN_PERMISSIONS_END -->`);
    await fs.writeFile(manifestPath, content, 'utf-8');
  }

  /**
   * Insert XML application-level entries before <!-- PLUGIN_MANIFEST_ENTRIES_END -->.
   * @param {string} manifestPath
   * @param {string[]} entries
   */
  async _injectManifestEntries(manifestPath, entries) {
    let content = await fs.readFile(manifestPath, 'utf-8');

    const marker = '<!-- PLUGIN_MANIFEST_ENTRIES_END -->';
    if (!content.includes(marker)) {
      logger.warn(`Manifest missing ${marker} marker — cannot inject manifest entries`);
      return;
    }

    // Normalize each entry to 8-space indentation.
    // Each entry may be a raw multiline XML string from the plugin definition.
    // We strip any common leading whitespace, then re-indent to 8 spaces.
    const block = entries.map(e => {
      const lines = e.split('\n').filter(l => l.trim().length > 0);
      // Find minimum indentation across non-empty lines
      const minIndent = lines.reduce((min, l) => {
        const indent = l.match(/^([ \t]*)/)[1].length;
        return Math.min(min, indent);
      }, Infinity);
      const base = isFinite(minIndent) ? minIndent : 0;
      return lines.map(l => `        ${l.slice(base)}`).join('\n');
    }).join('\n\n');

    content = content.replace(/^([ \t]*)<!-- PLUGIN_MANIFEST_ENTRIES_END -->/m, `${block}\n$1<!-- PLUGIN_MANIFEST_ENTRIES_END -->`);
    await fs.writeFile(manifestPath, content, 'utf-8');
  }

  /**
   * Insert implementation(...) lines before // PLUGIN_DEPENDENCIES_END.
   * @param {string} gradlePath
   * @param {Array<{configuration: string, artifact: string}>} deps
   */
  async _injectDependencies(gradlePath, deps) {
    let content = await fs.readFile(gradlePath, 'utf-8');

    const marker = '// PLUGIN_DEPENDENCIES_END';
    if (!content.includes(marker)) {
      logger.warn(`build.gradle.kts missing ${marker} marker — cannot inject dependencies`);
      return;
    }

    const lines = deps
      .map(d => `    ${d.configuration}("${d.artifact}")`)
      .join('\n');

    content = content.replace(/^([ \t]*)\/\/ PLUGIN_DEPENDENCIES_END/m, `${lines}\n$1// PLUGIN_DEPENDENCIES_END`);
    await fs.writeFile(gradlePath, content, 'utf-8');
  }

  /**
   * Insert id(...) plugin entries before // PLUGIN_PLUGINS_END.
   * @param {string} gradlePath
   * @param {Array<{id: string, version?: string, apply?: boolean}>} plugins
   */
  async _injectGradlePlugins(gradlePath, plugins) {
    let content = await fs.readFile(gradlePath, 'utf-8');

    const marker = '// PLUGIN_PLUGINS_END';
    if (!content.includes(marker)) {
      logger.warn(`build.gradle.kts missing ${marker} marker — cannot inject Gradle plugins`);
      return;
    }

    const lines = plugins.map(p => {
      let line = `    id("${p.id}")`;
      if (p.version) line += ` version "${p.version}"`;
      if (p.apply === false) line += ' apply false';
      return line;
    }).join('\n');

    content = content.replace(/^([ \t]*)\/\/ PLUGIN_PLUGINS_END/m, `${lines}\n$1// PLUGIN_PLUGINS_END`);
    await fs.writeFile(gradlePath, content, 'utf-8');
  }

  /**
   * Render each plugin Kotlin file (EJS) and copy to the correct package path.
   * @param {Object} plugin
   * @param {string} pluginDir
   * @param {string} kotlinBase  - Absolute path to app/src/main/kotlin/<package>
   * @param {Object} templateData
   */
  async _renderAndCopyKotlinFiles(plugin, pluginDir, kotlinBase, templateData) {
    for (const { template, dest } of plugin.kotlinFiles) {
      const templatePath = path.join(pluginDir, template);
      const destPath = path.join(kotlinBase, dest);

      await fs.ensureDir(path.dirname(destPath));

      if (template.endsWith('.ejs')) {
        const rendered = await render(templatePath, templateData);
        await fs.writeFile(destPath, rendered, 'utf-8');
      } else {
        await fs.copy(templatePath, destPath);
      }
      logger.debug(`Plugin "${plugin.name}": wrote Kotlin file ${destPath}`);
    }
  }

  /**
   * Render each plugin layout file and copy to res/layout/.
   * @param {Object} plugin
   * @param {string} pluginDir
   * @param {string} outputDir
   * @param {Object} templateData
   */
  async _renderAndCopyLayoutFiles(plugin, pluginDir, outputDir, templateData) {
    const layoutDir = path.join(outputDir, 'app', 'src', 'main', 'res', 'layout');
    await fs.ensureDir(layoutDir);

    for (const { template, dest } of plugin.layoutFiles) {
      const templatePath = path.join(pluginDir, template);
      const destPath = path.join(layoutDir, dest);

      if (template.endsWith('.ejs')) {
        const rendered = await render(templatePath, templateData);
        await fs.writeFile(destPath, rendered, 'utf-8');
      } else {
        await fs.copy(templatePath, destPath);
      }
      logger.debug(`Plugin "${plugin.name}": wrote layout file ${destPath}`);
    }
  }

  /**
   * Render each plugin XML resource file and copy to res/xml/.
   * @param {Object} plugin
   * @param {string} pluginDir
   * @param {string} outputDir
   * @param {Object} templateData
   */
  async _renderAndCopyXmlFiles(plugin, pluginDir, outputDir, templateData) {
    const xmlDir = path.join(outputDir, 'app', 'src', 'main', 'res', 'xml');
    await fs.ensureDir(xmlDir);

    for (const { template, dest } of plugin.xmlFiles) {
      const templatePath = path.join(pluginDir, template);
      const destPath = path.join(xmlDir, dest);

      if (template.endsWith('.ejs')) {
        const rendered = await render(templatePath, templateData);
        await fs.writeFile(destPath, rendered, 'utf-8');
      } else {
        await fs.copy(templatePath, destPath);
      }
      logger.debug(`Plugin "${plugin.name}": wrote XML file ${destPath}`);
    }
  }

  /**
   * Render the bridge methods template and inject before // PLUGIN_BRIDGE_METHODS_END.
   * @param {string} bridgePath  - Absolute path to AndroidBridge.kt
   * @param {Object} plugin
   * @param {string} pluginDir
   * @param {Object} templateData
   */
  async _injectBridgeMethods(bridgePath, plugin, pluginDir, templateData) {
    if (!await fs.pathExists(bridgePath)) {
      logger.warn(`Plugin "${plugin.name}": AndroidBridge.kt not found at ${bridgePath} — skipping bridge injection`);
      return;
    }

    const templatePath = path.join(pluginDir, plugin.bridgeMethodsTemplate);
    if (!await fs.pathExists(templatePath)) {
      logger.warn(`Plugin "${plugin.name}": bridge methods template not found: ${templatePath}`);
      return;
    }

    const endMarker = '// PLUGIN_BRIDGE_METHODS_END';
    let content = await fs.readFile(bridgePath, 'utf-8');

    if (!content.includes(endMarker)) {
      logger.warn(`Plugin "${plugin.name}": AndroidBridge.kt missing ${endMarker} marker`);
      return;
    }

    let methods;
    if (plugin.bridgeMethodsTemplate.endsWith('.ejs')) {
      methods = await render(templatePath, templateData);
    } else {
      methods = await fs.readFile(templatePath, 'utf-8');
    }

    // Ensure methods end with a newline before the marker (preserve marker indentation)
    const trimmed = methods.trimEnd();
    content = content.replace(/^([ \t]*)\/\/ PLUGIN_BRIDGE_METHODS_END/m, `${trimmed}\n$1// PLUGIN_BRIDGE_METHODS_END`);
    await fs.writeFile(bridgePath, content, 'utf-8');
  }
}

module.exports = PluginManager;
