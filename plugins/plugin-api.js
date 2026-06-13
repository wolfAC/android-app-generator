'use strict';

/**
 * Plugin API Contract
 *
 * Every plugin must export an object matching this shape.
 * All fields except `name` and `version` are optional — omit or set to [] / null
 * if the plugin does not use that extension point.
 *
 * @typedef {Object} PluginDefinition
 * @property {string}   name             - Unique id matching the folder name
 * @property {string}   version          - Semver version string
 * @property {string}   [description]    - Human-readable description
 *
 * @property {Array<{configuration: string, artifact: string}>} [dependencies]
 *   Maven deps injected into app/build.gradle.kts dependencies {}
 *   configuration: e.g. 'implementation', 'debugImplementation', 'testImplementation'
 *   artifact:      e.g. 'group:name:version'
 *
 * @property {Array<{id: string, version?: string, apply?: boolean}>} [gradlePlugins]
 *   Gradle plugin IDs injected into app/build.gradle.kts plugins {}
 *
 * @property {string[]} [permissions]
 *   Android permission names (without 'android.permission.' prefix is also accepted,
 *   but providing the full name like 'android.permission.CAMERA' is preferred).
 *   Injected as <uses-permission> elements into AndroidManifest.xml.
 *
 * @property {string[]} [manifestEntries]
 *   Raw XML strings (e.g. <activity>, <receiver>, <service> blocks) injected
 *   inside <application> in AndroidManifest.xml.
 *
 * @property {Array<{template: string, dest: string}>} [kotlinFiles]
 *   Kotlin files to render (EJS) and copy into the package path.
 *   template: path relative to the plugin's root directory
 *   dest:     path relative to app/src/main/kotlin/<packagePath>/
 *
 * @property {Array<{template: string, dest: string}>} [layoutFiles]
 *   Layout XML files to render and copy into res/layout/.
 *   template: path relative to the plugin's root directory
 *   dest:     filename in res/layout/
 *
 * @property {Array<{template: string, dest: string}>} [xmlFiles]
 *   XML resource files to render and copy into res/xml/.
 *   template: path relative to the plugin's root directory
 *   dest:     filename in res/xml/
 *
 * @property {string|null} [bridgeMethodsTemplate]
 *   Path (relative to plugin root) to an EJS file containing Kotlin method bodies
 *   (no class wrapper, no package line) to inject into AndroidBridge.kt.
 *
 * @property {function(config: Object, outputDir: string, templateData: Object): Promise<void>} [onComplete]
 *   Called after all other injections are done for this plugin.
 */

/**
 * Example minimal plugin:
 *
 * module.exports = {
 *   name: 'my-plugin',
 *   version: '1.0.0',
 *   description: 'Does something useful',
 *
 *   dependencies: [
 *     { configuration: 'implementation', artifact: 'com.example:library:1.0.0' },
 *   ],
 *   gradlePlugins: [],
 *   permissions: ['android.permission.VIBRATE'],
 *   manifestEntries: [],
 *   kotlinFiles: [
 *     { template: 'templates/MyHelper.kt.ejs', dest: 'plugins/MyHelper.kt' },
 *   ],
 *   layoutFiles: [],
 *   xmlFiles: [],
 *   bridgeMethodsTemplate: 'templates/bridge_methods.kt.ejs',
 *
 *   async onComplete(config, outputDir, templateData) {
 *     // custom post-processing
 *   },
 * };
 */

/**
 * Validate that a loaded plugin object has the required fields.
 * Throws if the plugin is malformed.
 * @param {Object} plugin
 */
function validatePlugin(plugin) {
  if (!plugin || typeof plugin !== 'object') {
    throw new Error('Plugin must be an object');
  }
  if (typeof plugin.name !== 'string' || !plugin.name) {
    throw new Error('Plugin must have a non-empty string "name" field');
  }
  if (typeof plugin.version !== 'string' || !plugin.version) {
    throw new Error(`Plugin "${plugin.name}" must have a non-empty string "version" field`);
  }

  // Optional array fields — if present they must be arrays
  const arrayFields = ['dependencies', 'gradlePlugins', 'permissions', 'manifestEntries', 'kotlinFiles', 'layoutFiles', 'xmlFiles'];
  for (const field of arrayFields) {
    if (plugin[field] !== undefined && !Array.isArray(plugin[field])) {
      throw new Error(`Plugin "${plugin.name}": "${field}" must be an array`);
    }
  }

  // onComplete must be a function if present
  if (plugin.onComplete !== undefined && typeof plugin.onComplete !== 'function') {
    throw new Error(`Plugin "${plugin.name}": "onComplete" must be a function`);
  }
}

module.exports = { validatePlugin };
