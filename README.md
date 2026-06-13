# TWA Generator

A Node.js CLI tool that generates complete Android Studio projects (Trusted Web Activity apps) from a single config file. Convert any HTTPS website or PWA into a native Android app in minutes.

## Features

- Generates complete Kotlin + Gradle Android projects ready for Android Studio
- Supports TWA (Trusted Web Activity) via `android-browser-helper`
- Generates launcher icons in all densities from a single source image
- Configurable theme colors, permissions, and features
- Firebase push notifications (optional)
- Material Design 3 splash screen
- Adaptive icons (Android 8+)
- Deep link support
- Gradle 8.9 + AGP 8.7.0 + Kotlin 2.0.21

---

## Installation

```bash
# Clone the repo
git clone https://github.com/your-org/android-app-generator.git
cd android-app-generator

# Install dependencies
npm install

# Link globally (makes `twa-generator` available system-wide)
npm install -g .
```

> **Requirements:** Node.js >= 16, npm >= 8
> Optional: `sharp` for image resizing (installed automatically via npm install)

---

## Quick Start

```bash
# 1. Create a config file
twa-generator init my-app/

# 2. Edit my-app/app.json with your details

# 3. Generate the Android project
twa-generator create my-app/

# 4. Open in Android Studio and run!
```

---

## CLI Commands

### `twa-generator create <configDir>`

Generate a new Android project from `app.json` in the given directory.

```bash
twa-generator create ./my-app
twa-generator create ./my-app --output ./projects/my-android-app
twa-generator create ./my-app --debug
```

**Options:**
| Flag | Description |
|------|-------------|
| `-o, --output <dir>` | Custom output directory (default: `./output/<app-name>`) |
| `-d, --debug` | Enable verbose debug logging |

---

### `twa-generator build <projectDir>`

Build an APK or AAB from an existing generated project.

```bash
twa-generator build ./output/my-app
twa-generator build ./output/my-app --release
twa-generator build ./output/my-app --aab --release
```

**Options:**
| Flag | Description |
|------|-------------|
| `-r, --release` | Build release variant (default: debug) |
| `--aab` | Build Android App Bundle (.aab) |
| `--apk` | Build APK (default) |
| `-d, --debug` | Enable verbose debug logging |

> **Note:** Requires Java 17+ and the `gradlew` wrapper in the project directory.

---

### `twa-generator update <configDir>`

Re-render templates and re-process assets on an existing project (after changing app.json).

```bash
twa-generator update ./my-app --project ./output/my-app
```

**Options:**
| Flag | Description |
|------|-------------|
| `-p, --project <dir>` | Path to the existing generated project (required) |

---

### `twa-generator validate <configDir>`

Validate `app.json` without generating anything.

```bash
twa-generator validate ./my-app
```

---

### `twa-generator init [directory]`

Create a starter `app.json` in the given directory.

```bash
twa-generator init ./my-app
```

---

## Configuration Reference (`app.json`)

```jsonc
{
  // Required fields
  "appName": "My PWA App",              // Display name (shown in launcher)
  "packageName": "com.example.myapp",   // Unique Android package ID
  "websiteUrl": "https://example.com",  // Your website (must be HTTPS)

  // Version
  "version": {
    "code": 1,          // Integer, increment on each release
    "name": "1.0.0"     // Semver string shown to users
  },

  // Theme colors (hex: #RRGGBB or #RGB)
  "theme": {
    "primary": "#6200EE",       // Primary brand color
    "primaryDark": "#3700B3",   // Status bar / darker shade
    "accent": "#03DAC5",        // Secondary/accent color
    "background": "#FFFFFF",    // App background
    "surface": "#FFFFFF",       // Card/surface background
    "onPrimary": "#FFFFFF",     // Text on primary color
    "onBackground": "#000000"   // Text on background
  },

  // Feature flags
  "features": {
    "fullscreen": true,       // Immersive/fullscreen mode
    "notifications": false,   // Push notifications (requires firebase.enabled)
    "offline": false,         // Offline caching (Phase 2)
    "camera": false,          // CAMERA permission
    "location": false,        // Location permissions
    "fileUpload": false,      // File picker / storage permissions
    "biometric": false,       // Fingerprint/face auth
    "qrScanner": false        // QR/barcode scanner (Phase 2)
  },

  // Firebase (optional)
  "firebase": {
    "enabled": false,
    "projectId": "my-project",
    "appId": "1:123:android:abc",
    "apiKey": "AIzaSy...",
    "messagingSenderId": "123456789",
    "storageBucket": "my-project.appspot.com"
  },

  // Android build settings (optional — sensible defaults provided)
  "android": {
    "compileSdk": 35,
    "minSdk": 24,
    "targetSdk": 35,
    "gradleVersion": "8.9",
    "agpVersion": "8.7.0",
    "kotlinVersion": "2.0.21"
  },

  // Screen orientation: portrait, landscape, unspecified (default)
  "orientation": "unspecified",

  // Assets
  "assets": {
    "icon": "./icon.png",          // Path to 512x512 PNG (relative to app.json)
    "splashIcon": "./splash.png"   // Path to splash image (optional)
  },

  // Release signing (optional)
  "signing": {
    "storeFile": "./my-release.keystore",
    "storePassword": "password",
    "keyAlias": "my-key",
    "keyPassword": "password"
  },

  // Deep links (optional)
  "deepLinks": [
    { "scheme": "https", "host": "example.com", "path": "/products" }
  ],

  // Splash screen
  "splash": {
    "backgroundColor": "#6200EE",  // Defaults to theme.primary
    "iconSize": "medium"           // small | medium | large
  }
}
```

---

## Asset Requirements

| Asset | Recommended Size | Format |
|-------|-----------------|--------|
| `assets.icon` | 512x512 | PNG (with transparency) |
| `assets.splashIcon` | 1024x1024 | PNG |

If no icon is provided, a placeholder is generated using the first letter of `appName`.

### Generated Icon Densities

| Density | Size |
|---------|------|
| mdpi | 48x48 |
| hdpi | 72x72 |
| xhdpi | 96x96 |
| xxhdpi | 144x144 |
| xxxhdpi | 192x192 |

---

## After Generating a Project

### 1. Set Up Digital Asset Links

TWA requires your website to verify ownership of your Android app.

Create `/.well-known/assetlinks.json` on your server:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.example.myapp",
    "sha256_cert_fingerprints": ["YOUR_SHA256_FINGERPRINT"]
  }
}]
```

Get your SHA-256 fingerprint:
```bash
keytool -list -v -keystore my-release.keystore -alias my-key
```

### 2. Build the APK

```bash
cd output/my-app
./gradlew assembleDebug
# APK: app/build/outputs/apk/debug/app-debug.apk
```

### 3. Build Release AAB (for Play Store)

```bash
./gradlew bundleRelease
# AAB: app/build/outputs/bundle/release/app-release.aab
```

---

## Project Structure (Generated)

```
output/my-app/
├── app/
│   ├── src/main/
│   │   ├── kotlin/com/example/myapp/
│   │   │   ├── MainActivity.kt        # TWA entry point
│   │   │   ├── SplashActivity.kt      # Branded splash screen
│   │   │   ├── TwaApplication.kt      # Application class
│   │   │   └── MyFirebaseMessagingService.kt  # (if notifications enabled)
│   │   ├── res/
│   │   │   ├── mipmap-*/              # Launcher icons (all densities)
│   │   │   ├── drawable/              # Splash image + notification icon
│   │   │   ├── values/                # Colors, strings, themes
│   │   │   ├── values-night/          # Dark mode theme overrides
│   │   │   └── xml/                   # Network security config
│   │   └── AndroidManifest.xml
│   ├── build.gradle.kts
│   ├── google-services.json           # Firebase (replace with real one)
│   └── proguard-rules.pro
├── gradle/wrapper/
│   └── gradle-wrapper.properties
├── build.gradle.kts
├── settings.gradle.kts
├── gradle.properties
├── gradlew
└── gradlew.bat
```

---

## Phase Roadmap

### Phase 1 (Current) — Foundation
- [x] CLI tool with create/build/update/validate/init commands
- [x] EJS template engine
- [x] Full Android TWA project generation
- [x] Icon resizing (all densities + adaptive icons)
- [x] Firebase push notifications
- [x] Material Design 3 themes
- [x] Deep link support
- [x] Signing config

### Phase 2 — Enhanced Features
- [ ] Interactive `init` wizard (Inquirer.js prompts)
- [ ] Offline caching plugin (WorkManager + Service Worker bridge)
- [ ] QR scanner integration
- [ ] In-app update prompts (Google Play Core)
- [ ] App shortcuts
- [ ] Plugin architecture

### Phase 3 — Distribution
- [ ] Play Store upload automation (`bundletool` + Google Play API)
- [ ] CI/CD template generation (GitHub Actions / Bitrise)
- [ ] Multi-flavor support (dev/staging/production)
- [ ] Incremental updates (hot-reload config changes)
- [ ] Web dashboard for config management

---

## Plugin Architecture (Phase 2 Preview)

See [plugins/README.md](plugins/README.md) for the planned plugin API.

---

## Troubleshooting

**`sharp` not found**
```bash
npm install sharp
```
Without sharp, placeholder icons are generated but image resizing is skipped.

**`gradlew` not found in generated project**
```bash
cd output/my-app
gradle wrapper --gradle-version 8.9
```

**TWA shows web browser UI instead of full-screen app**

Your `assetlinks.json` may not be set up correctly. Verify:
1. The file is accessible at `https://yourdomain.com/.well-known/assetlinks.json`
2. The `sha256_cert_fingerprints` matches your APK's signing certificate
3. The `package_name` matches your `packageName` in app.json

Use [TWA Verification tool](https://developers.google.com/digital-asset-links/tools/generator) to validate.

---

## License

MIT
