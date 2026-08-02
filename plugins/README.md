# TWA Generator — Plugin System

The plugin system lets you extend the generated Android project with additional native capabilities. Plugins inject Maven dependencies, Gradle plugin IDs, Android permissions, manifest entries, Kotlin source files, layout resources, and JavaScript bridge methods — all without modifying any core generator files.

---

## Available Plugins

| Plugin | Version | Description |
|--------|---------|-------------|
| `notification` | 1.0.0 | Enhanced push notifications: topic subscriptions, local scheduling, notification history |
| `biometric` | 1.0.0 | Biometric authentication (fingerprint, face unlock) using AndroidX Biometric |
| `qr-scanner` | 1.0.0 | QR code and barcode scanner using Google ML Kit + CameraX |
| `downloader` | 1.0.0 | Enhanced file download management with progress tracking via system DownloadManager |
| `payments` | 1.0.0 | Google Play Billing — in-app purchases and subscriptions |

---

## Using Plugins in app.json

Add a `"plugins"` array to your `app.json`. Each entry is either a plugin name string or an object with `name` and `options`:

```json
{
  "appName": "My App",
  "packageName": "com.example.myapp",
  "websiteUrl": "https://example.com",
  "version": { "code": 1, "name": "1.0.0" },
  "theme": { "primary": "#6200EE", "background": "#FFFFFF" },
  "plugins": ["notification", "biometric", "qr-scanner"]
}
```

Or with options:

```json
{
  "plugins": [
    "notification",
    { "name": "qr-scanner", "options": {} }
  ]
}
```

Then generate your project:

```bash
twa-generator create my-app-config --output my-android-app
```

---

## Plugin CLI Commands

```bash
# List all available built-in plugins
twa-generator plugin list

# Show details about a specific plugin
twa-generator plugin info qr-scanner

# Add a plugin to app.json in the current directory
twa-generator plugin add notification

# Add a plugin to app.json in a specific directory
twa-generator plugin add biometric ./my-app-config

# Remove a plugin from app.json
twa-generator plugin remove notification ./my-app-config
```

---

## JavaScript API (window.Android)

All methods below are available as `window.Android.<method>()` in your web page when running inside the generated Android app.

### notification plugin

```javascript
// Subscribe to a Firebase Messaging topic
window.Android.subscribeToTopic('news');

// Unsubscribe from a topic
window.Android.unsubscribeFromTopic('news');

// Schedule a local notification after a delay (milliseconds)
window.Android.scheduleLocalNotification('Reminder', 'Don\'t forget!', 5000);

// Cancel all pending notifications
window.Android.clearAllNotifications();
```

**Requires** `features.notifications: true` and `firebase.enabled: true` in app.json for FCM topic operations.

---

### biometric plugin

```javascript
// Check if biometric authentication is available on this device
const available = window.Android.isBiometricAvailable(); // returns boolean

// Authenticate with biometrics (result delivered via callback)
// Set up your callback registry first:
window.__biometricCallbacks = window.__biometricCallbacks || {};
const callbackId = 'auth_' + Date.now();
window.__biometricCallbacks[callbackId] = (error, success) => {
    if (success) {
        console.log('Authenticated!');
    } else {
        console.log('Failed:', error);
    }
};
window.Android.authenticateBiometric('Verify Identity', 'Use fingerprint to continue', callbackId);
```

---

### qr-scanner plugin

```javascript
// Open the QR scanner; result delivered via callback
window.__qrCallbacks = window.__qrCallbacks || {};
const callbackId = 'qr_' + Date.now();
window.__qrCallbacks[callbackId] = (result) => {
    if (result) {
        console.log('Scanned:', result);
    } else {
        console.log('Scan cancelled or failed');
    }
};
window.Android.scanQR(callbackId);
```

---

### downloader plugin

```javascript
// Enqueue a file download (returns download ID as number)
const downloadId = window.Android.downloadFile(
    'https://example.com/file.pdf',
    'file.pdf',
    'application/pdf'
);

// Check download progress
const statusJson = window.Android.getDownloadStatus(downloadId);
const status = JSON.parse(statusJson);
// { status: 'running', progress: 42, bytesDownloaded: 42000, bytesTotal: 100000 }

// Cancel a download
const cancelled = window.Android.cancelDownload(downloadId); // returns boolean
```

---

### payments plugin

```javascript
// Initialize billing (must be called before purchasing)
window.__billingCallbacks = window.__billingCallbacks || {};
window.__billingCallbacks['init_1'] = (ready) => {
    console.log('Billing ready:', ready);
};
window.Android.initBilling('init_1');

// Purchase a product by its Play Store product ID
window.__billingCallbacks['buy_1'] = (success, error) => {
    if (success) console.log('Purchase successful!');
    else console.log('Purchase failed:', error);
};
window.Android.purchaseProduct('premium_upgrade', 'buy_1');

// Get all owned purchases
window.__billingCallbacks['purchases_1'] = (productIds) => {
    // productIds is a JSON array of product ID strings
    console.log('Owned:', productIds);
};
window.Android.getPurchases('purchases_1');
```

---

## Creating a Custom Plugin

Create a directory under `plugins/<your-plugin-name>/` with an `index.js` and a `templates/` subdirectory.

### Plugin Contract (index.js)

```javascript
module.exports = {
  // Required
  name: 'my-plugin',        // Must match directory name
  version: '1.0.0',
  description: 'What this plugin does',

  // Maven deps injected into app/build.gradle.kts dependencies {}
  dependencies: [
    { configuration: 'implementation', artifact: 'com.example:library:1.0.0' },
  ],

  // Gradle plugin IDs injected into app/build.gradle.kts plugins {}
  gradlePlugins: [
    { id: 'com.some.plugin', version: '1.2.3', apply: true },
  ],

  // <uses-permission> entries injected into AndroidManifest.xml
  permissions: [
    'android.permission.CAMERA',
  ],

  // Raw <activity>/<receiver>/<service> XML blocks injected inside <application>
  manifestEntries: [
    `<activity android:name=".plugins.MyActivity" android:exported="false" />`,
  ],

  // Kotlin files to render (EJS) and copy to app/src/main/kotlin/<packagePath>/<dest>
  kotlinFiles: [
    { template: 'templates/MyHelper.kt.ejs', dest: 'plugins/MyHelper.kt' },
  ],

  // Layout XML files to copy to res/layout/
  layoutFiles: [
    { template: 'templates/activity_my.xml', dest: 'activity_my.xml' },
  ],

  // XML resource files to copy to res/xml/
  xmlFiles: [],

  // EJS file with Kotlin method bodies to inject into AndroidBridge.kt
  bridgeMethodsTemplate: 'templates/bridge_methods.kt.ejs',

  // Optional: called after all injections complete
  async onComplete(config, outputDir, templateData) {
    // Custom post-processing
  },
};
```

### Template Variables

All EJS templates receive the full `templateData` object which includes:

| Variable | Type | Description |
|----------|------|-------------|
| `packageName` | string | Android package name (e.g. `com.example.app`) |
| `packagePath` | string | Package as path (e.g. `com/example/app`) |
| `appName` | string | App display name |
| `websiteUrl` | string | Target website URL |
| `version` | `{code, name}` | App version |
| `theme` | object | Color theme values |
| `features` | object | Enabled feature flags |
| `firebase` | object | Firebase config |
| `android` | object | Android SDK versions |
| `activePlugins` | string[] | Names of all active plugins |
| `pluginOptions` | object | Options passed for this specific plugin |

### Bridge Methods Template

The `bridgeMethodsTemplate` file should contain only Kotlin method bodies (no `package` line, no class wrapper). They are injected directly inside the `AndroidBridge` class:

```kotlin
// templates/bridge_methods.kt.ejs
    @JavascriptInterface
    fun doSomething(param: String): String {
        return <%= packageName %>.plugins.MyHelper.process(param)
    }
```

### Injection Markers

The plugin manager relies on these marker comments in the generated files:

| File | Start marker | End marker |
|------|-------------|------------|
| `AndroidManifest.xml` | `<!-- PLUGIN_PERMISSIONS_START -->` | `<!-- PLUGIN_PERMISSIONS_END -->` |
| `AndroidManifest.xml` | `<!-- PLUGIN_MANIFEST_ENTRIES_START -->` | `<!-- PLUGIN_MANIFEST_ENTRIES_END -->` |
| `app/build.gradle.kts` | `// PLUGIN_PLUGINS_START` | `// PLUGIN_PLUGINS_END` |
| `app/build.gradle.kts` | `// PLUGIN_DEPENDENCIES_START` | `// PLUGIN_DEPENDENCIES_END` |
| `AndroidBridge.kt` | `// PLUGIN_BRIDGE_METHODS_START` | `// PLUGIN_BRIDGE_METHODS_END` |

---

## Error Handling

If a plugin fails during injection (e.g. a template renders incorrectly or a file is missing), the plugin manager logs a warning and continues with the next plugin. A single failing plugin does not abort the entire project generation.
