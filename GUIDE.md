# TWA Generator — Complete Usage Guide

Convert any HTTPS website or PWA into a native Android app using the command line or the built-in web dashboard.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Installation](#2-installation)
3. [Quick Start (5 minutes)](#3-quick-start-5-minutes)
4. [CLI Commands](#4-cli-commands)
   - [init](#41-twa-generator-init)
   - [validate](#42-twa-generator-validate)
   - [create](#43-twa-generator-create)
   - [build](#44-twa-generator-build)
   - [update](#45-twa-generator-update)
   - [plugin](#46-twa-generator-plugin)
   - [dashboard](#47-twa-generator-dashboard)
5. [app.json Configuration Reference](#5-appjson-configuration-reference)
6. [Assets (Icons & Splash)](#6-assets-icons--splash)
7. [Plugins](#7-plugins)
8. [Web Dashboard](#8-web-dashboard)
9. [After Generating — Digital Asset Links](#9-after-generating--digital-asset-links)
10. [Building for Release & Play Store](#10-building-for-release--play-store)
11. [Generated Project Structure](#11-generated-project-structure)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | >= 16 | |
| pnpm | >= 8 | |
| Java (JDK) | 17 | Only needed to run `build`; not needed to generate |
| Android Studio | Any recent | Optional; for opening / editing the project |

> **Your website must be served over HTTPS.** TWA will not work with plain HTTP.

---

## 2. Installation

```bash
# Clone the repository
git clone https://github.com/your-org/android-app-generator.git
cd android-app-generator

# Install dependencies
pnpm install

# Make the CLI available globally
pnpm install -g .

# Verify installation
twa-generator --version
```

After installation, the `twa-generator` command is available anywhere in your terminal.

---

## 3. Quick Start (5 minutes)

```bash
# Step 1 — Create a config folder and starter app.json
twa-generator init my-app

# Step 2 — Open and edit the config
#   Fill in appName, packageName, websiteUrl at minimum
nano my-app/app.json

# Step 3 — Validate the config (optional but recommended)
twa-generator validate my-app

# Step 4 — Generate the Android project
twa-generator create my-app

# Step 5 — Open in Android Studio
# The project is in ./output/<your-app-name>/
# OR build directly from the CLI:
twa-generator build output/my-awesome-app
```

---

## 4. CLI Commands

### 4.1 `twa-generator init`

Creates a starter `app.json` in a directory.

```bash
twa-generator init                    # creates app.json in current directory
twa-generator init ./my-app           # creates ./my-app/app.json
```

Edit the generated file before proceeding.

---

### 4.2 `twa-generator validate`

Checks `app.json` for errors without creating any files.

```bash
twa-generator validate ./my-app
```

Run this after editing `app.json` to catch problems early. Exits with code `0` on success, `1` on errors.

---

### 4.3 `twa-generator create`

Generates the complete Android Studio project from `app.json`.

```bash
# Basic
twa-generator create ./my-app

# Custom output path
twa-generator create ./my-app --output ./projects/android

# Verbose output
twa-generator create ./my-app --debug
```

**Options**

| Flag | Default | Description |
|------|---------|-------------|
| `-o, --output <dir>` | `./output/<appName>` | Where to write the Android project |
| `-d, --debug` | off | Print detailed step-by-step logs |

**What gets generated:**
- Full Kotlin + Gradle 8.9 project
- `MainActivity`, `SplashActivity`, `TwaApplication` Kotlin files
- Launcher icons in all 5 mipmap densities (48 → 192 px)
- Round icons and adaptive icon foreground
- Material Design 3 theme with your brand colors
- Permissions based on the feature flags you enabled
- Firebase integration files (if `firebase.enabled: true`)
- Plugin source files (if any plugins listed)

---

### 4.4 `twa-generator build`

Compiles the generated project into an APK or AAB using Gradle.

> Requires Java 17 on your `PATH`.

```bash
# Debug APK (default)
twa-generator build ./output/my-app

# Release APK
twa-generator build ./output/my-app --release

# Release AAB (for Play Store)
twa-generator build ./output/my-app --aab --release

# Both APK and AAB at once
twa-generator build ./output/my-app --apk --aab --release
```

**Options**

| Flag | Description |
|------|-------------|
| `-r, --release` | Build release variant instead of debug |
| `--apk` | Build APK (default when no format flag given) |
| `--aab` | Build Android App Bundle (.aab) |
| `-d, --debug` | Verbose Gradle output |

**Output locations**

| Format | Path |
|--------|------|
| Debug APK | `app/build/outputs/apk/debug/app-debug.apk` |
| Release APK | `app/build/outputs/apk/release/app-release.apk` |
| Release AAB | `app/build/outputs/bundle/release/app-release.aab` |

---

### 4.5 `twa-generator update`

Re-generates an existing project after you edit `app.json` (e.g. changed a color, URL, or feature flag). Faster than running `create` again because it only re-renders changed files.

```bash
twa-generator update ./my-app --project ./output/my-app
```

**Options**

| Flag | Description |
|------|-------------|
| `-p, --project <dir>` | Path to the already-generated Android project (required) |

---

### 4.6 `twa-generator plugin`

Manage plugins for a project without manually editing `app.json`.

```bash
# List all available plugins
twa-generator plugin list

# Show details about a plugin
twa-generator plugin info qr-scanner

# Add a plugin to app.json
twa-generator plugin add notification ./my-app

# Remove a plugin from app.json
twa-generator plugin remove notification ./my-app
```

After adding or removing a plugin, run `twa-generator update` to apply the change to the generated project.

---

### 4.7 `twa-generator dashboard`

Start the local web dashboard (see [Section 8](#8-web-dashboard)).

```bash
# Default port 3000
twa-generator dashboard

# Custom port
twa-generator dashboard --port 8080

# Open browser automatically
twa-generator dashboard --open
```

**Options**

| Flag | Default | Description |
|------|---------|-------------|
| `-p, --port <port>` | `3000` | Port to listen on |
| `--open` | off | Open `http://localhost:<port>` in the browser after start |

---

## 5. app.json Configuration Reference

The config file lives at `<your-config-dir>/app.json`. Only `appName`, `packageName`, and `websiteUrl` are required. Everything else has sensible defaults.

```jsonc
{
  // ── Required ──────────────────────────────────────────────────────────────
  "appName": "My PWA App",             // Shown in the Android launcher
  "packageName": "com.example.myapp",  // Unique reverse-domain ID, lowercase only
  "websiteUrl": "https://example.com", // Must be HTTPS

  // ── Version ───────────────────────────────────────────────────────────────
  "version": {
    "code": 1,       // Integer — increment every Play Store upload
    "name": "1.0.0"  // Semver string shown to users
  },

  // ── Theme (all values are #RRGGBB hex) ────────────────────────────────────
  "theme": {
    "primary":       "#6200EE",  // Brand color — toolbar and status bar
    "primaryDark":   "#3700B3",  // Darker shade for status bar on older Android
    "accent":        "#03DAC5",  // FAB and secondary elements
    "background":    "#FFFFFF",  // Activity background
    "surface":       "#FFFFFF",  // Card/sheet backgrounds
    "onPrimary":     "#FFFFFF",  // Text/icons on primary color
    "onBackground":  "#000000"   // Text/icons on background
  },

  // ── Feature flags ─────────────────────────────────────────────────────────
  "features": {
    "fullscreen":    false,  // Hides status and navigation bars
    "notifications": false,  // Push notifications — also requires firebase.enabled
    "offline":       false,  // Service Worker offline caching bridge
    "camera":        false,  // Adds CAMERA permission to AndroidManifest
    "location":      false,  // Adds ACCESS_FINE_LOCATION + COARSE_LOCATION
    "fileUpload":    false,  // Adds READ/WRITE_EXTERNAL_STORAGE permissions
    "biometric":     false,  // Fingerprint / face unlock
    "qrScanner":     false   // QR + barcode scanner
  },

  // ── Plugins ───────────────────────────────────────────────────────────────
  // Each entry is a plugin name, or { "name": "...", "options": {} }
  "plugins": [],
  // Available: "notification" | "biometric" | "qr-scanner" | "downloader" | "payments"

  // ── Firebase (optional) ───────────────────────────────────────────────────
  "firebase": {
    "enabled":           false,
    "projectId":         "my-project",
    "appId":             "1:123456:android:abcdef",
    "apiKey":            "AIzaSy...",
    "messagingSenderId": "123456789",
    "storageBucket":     "my-project.appspot.com"
  },

  // ── Android SDK (optional — defaults shown) ───────────────────────────────
  "android": {
    "compileSdk":    35,
    "minSdk":        24,     // Android 7.0 — supports ~99% of devices
    "targetSdk":     35,
    "gradleVersion": "8.9",
    "agpVersion":    "8.7.0",
    "kotlinVersion": "2.0.21"
  },

  // ── Screen orientation ────────────────────────────────────────────────────
  // "unspecified" | "portrait" | "landscape" | "sensorLandscape"
  "orientation": "unspecified",

  // ── Assets ────────────────────────────────────────────────────────────────
  "assets": {
    "icon":        "./icon.png",   // 512×512 PNG; relative to app.json location
    "splashIcon":  "./splash.png"  // 1024×1024 PNG for the splash screen
  },

  // ── Splash screen ─────────────────────────────────────────────────────────
  "splash": {
    "backgroundColor": "#6200EE",  // Defaults to theme.primary
    "iconSize":        "medium"    // "small" | "medium" | "large"
  },

  // ── Release signing (optional — needed for release builds) ────────────────
  "signing": {
    "storeFile":     "./my-release.keystore",
    "storePassword": "yourStorePassword",
    "keyAlias":      "my-key",
    "keyPassword":   "yourKeyPassword"
  },

  // ── Deep links (optional) ─────────────────────────────────────────────────
  "deepLinks": [
    { "scheme": "https", "host": "example.com", "path": "/products" }
  ]
}
```

---

## 6. Assets (Icons & Splash)

### Icon

- **Recommended:** 512 × 512 px PNG with transparency
- Place it anywhere and set `assets.icon` to its path (relative to `app.json`)
- The generator produces all 5 standard mipmap densities automatically:

| Folder | Size |
|--------|------|
| `mipmap-mdpi` | 48 × 48 px |
| `mipmap-hdpi` | 72 × 72 px |
| `mipmap-xhdpi` | 96 × 96 px |
| `mipmap-xxhdpi` | 144 × 144 px |
| `mipmap-xxxhdpi` | 192 × 192 px |

Round icon and adaptive icon foreground are also generated from the same source.

> If `assets.icon` is omitted, a placeholder icon is auto-generated using the first letter of `appName`.

### Splash Image

- **Recommended:** 1024 × 1024 px PNG
- Set `assets.splashIcon` to its path
- Background color comes from `splash.backgroundColor` (defaults to `theme.primary`)
- Size on screen is controlled by `splash.iconSize`: `small` (120 dp), `medium` (200 dp), `large` (288 dp)

---

## 7. Plugins

Plugins inject native Android features (Kotlin code, Gradle deps, permissions, JS bridge methods) into the generated project without touching any core files.

### Available Plugins

| Plugin | What it adds |
|--------|-------------|
| `notification` | Topic subscriptions, local notification scheduling, notification history |
| `biometric` | Fingerprint / face unlock via AndroidX Biometric |
| `qr-scanner` | QR code + barcode scanning via ML Kit + CameraX |
| `downloader` | File download management with progress tracking (system DownloadManager) |
| `payments` | Google Play Billing — in-app purchases and subscriptions |

### Step 1 — Add to app.json

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

Or use the CLI to add without editing JSON manually:

```bash
twa-generator plugin add notification ./my-app
twa-generator plugin add biometric ./my-app
```

### Step 2 — Generate the project

```bash
twa-generator create ./my-app
```

### Step 3 — Call plugin methods from your web page

Every plugin exposes a `window.Android` JavaScript API inside the app:

```javascript
// notification plugin
window.Android.subscribeTopic('news');
window.Android.scheduleNotification('Reminder', 'Check your order', 60000);

// biometric plugin
window.Android.authenticateBiometric('Confirm your identity', (success, error) => {
  if (success) console.log('Authenticated!');
});

// qr-scanner plugin
window.Android.startQrScan((result) => {
  console.log('Scanned:', result);
});

// downloader plugin
window.Android.downloadFile('https://example.com/file.pdf', 'report.pdf');

// payments plugin
window.Android.launchBillingFlow('premium_monthly');
```

> Run `twa-generator plugin info <name>` for the full JavaScript API of each plugin.

---

## 8. Web Dashboard

The dashboard is a self-hosted web app that lets you manage projects and trigger builds through a browser instead of the CLI.

### Start the dashboard

```bash
twa-generator dashboard --port 3000 --open
```

Open [http://localhost:3000](http://localhost:3000) if it doesn't open automatically.

### Step-by-step walkthrough

**1. Register an account**

On first launch, go to the **Register** tab, enter your email and a password (min 8 characters), then click **Create Account**. You are redirected to the dashboard automatically.

**2. Create a project**

Click **+ New Project** in the sidebar. Fill in the form:

- **Basic Info** — App Name, Package Name (e.g. `com.yourcompany.app`), Website URL
- **Version** — Version Name (`1.0.0`) and Version Code (`1`)
- **Branding** — Pick primary and background colors using the color pickers
- **Assets** — Drag and drop (or click to browse) your icon and splash image
- **Features** — Toggle the capabilities your app needs
- **Plugins** — Check any plugins to include
- **Firebase** — Toggle on and fill in credentials if you need push notifications

Click **Save Project**.

**3. Generate the Android project**

After saving, three action buttons become active:

| Button | What it does |
|--------|-------------|
| **Generate Project** | Runs the generator only — no Gradle compilation |
| **Build APK (Debug)** | Generates + compiles a debug APK |
| **Build AAB (Release)** | Generates + compiles a release AAB for Play Store |

Click any of them. A real-time build log appears showing every step.

**4. Download artifacts**

When a build succeeds, a **Download** button appears below the log. Click it to download the `.apk` or `.aab` file directly from the browser.

**5. Build history**

Click **Build History** (top right of the project form) to see all previous builds for the current project, re-view their logs, download old artifacts, or delete records.

**6. Edit a project**

Select a project from the sidebar, change any field, and click **Save Project** again. Run a new build to apply the changes.

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port to listen on (overridden by `--port`) |
| `JWT_SECRET` | insecure default | **Set this in production** to a long random string |

```bash
JWT_SECRET=your-very-long-random-secret twa-generator dashboard --port 3000
```

---

## 9. After Generating — Digital Asset Links

TWA requires your server to declare ownership of the Android app. Without this, Chrome shows its own browser UI instead of a full-screen app.

### Step 1 — Get your SHA-256 fingerprint

**Debug builds** (auto-signed by Android Studio):
```bash
keytool -list -v \
  -keystore ~/.android/debug.keystore \
  -alias androiddebugkey \
  -storepass android \
  -keypass android
```

**Release builds** (your keystore):
```bash
keytool -list -v \
  -keystore ./my-release.keystore \
  -alias my-key
```

Copy the `SHA256:` value (format: `AA:BB:CC:...`).

### Step 2 — Create the assetlinks.json file

Create this file and host it at `https://yourdomain.com/.well-known/assetlinks.json`:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.example.myapp",
    "sha256_cert_fingerprints": [
      "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99"
    ]
  }
}]
```

Replace `package_name` with your `packageName` and paste your actual fingerprint.

### Step 3 — Verify

```bash
# Using Google's tool:
# https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://yourdomain.com&relation=delegate_permission/common.handle_all_urls
```

Or use the [Statement List Generator](https://developers.google.com/digital-asset-links/tools/generator) to validate.

> The file must be served with `Content-Type: application/json` and must be reachable without redirects.

---

## 10. Building for Release & Play Store

### Step 1 — Create a signing keystore

```bash
keytool -genkey -v \
  -keystore my-release.keystore \
  -alias my-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Keep this file safe. Losing it means you can never update your app on the Play Store.

### Step 2 — Add signing config to app.json

```json
"signing": {
  "storeFile": "./my-release.keystore",
  "storePassword": "yourStorePassword",
  "keyAlias": "my-key",
  "keyPassword": "yourKeyPassword"
}
```

### Step 3 — Regenerate and build

```bash
twa-generator create ./my-app
twa-generator build ./output/my-app --aab --release
```

The signed AAB is at:
```
output/my-app/app/build/outputs/bundle/release/app-release.aab
```

### Step 4 — Upload to Play Store

1. Go to [Google Play Console](https://play.google.com/console)
2. Create a new app
3. Go to **Release → Production → Create new release**
4. Upload the `.aab` file
5. Fill in store listing details and submit for review

### Incrementing versions

Before each new Play Store release, bump `version.code` (must increase) and `version.name` in `app.json`, then regenerate and rebuild.

---

## 11. Generated Project Structure

```
output/my-app/
├── app/
│   ├── src/
│   │   └── main/
│   │       ├── kotlin/com/example/myapp/
│   │       │   ├── MainActivity.kt              # TWA entry point
│   │       │   ├── SplashActivity.kt            # Branded splash screen
│   │       │   ├── TwaApplication.kt            # Application class
│   │       │   └── MyFirebaseMessagingService.kt  # (if notifications enabled)
│   │       ├── res/
│   │       │   ├── mipmap-mdpi/                 # 48×48 launcher icon
│   │       │   ├── mipmap-hdpi/                 # 72×72 launcher icon
│   │       │   ├── mipmap-xhdpi/                # 96×96 launcher icon
│   │       │   ├── mipmap-xxhdpi/               # 144×144 launcher icon
│   │       │   ├── mipmap-xxxhdpi/              # 192×192 launcher icon
│   │       │   ├── drawable/                    # Splash image, notification icon
│   │       │   ├── values/                      # Colors, strings, themes
│   │       │   ├── values-night/                # Dark mode overrides
│   │       │   └── xml/                         # Network security config
│   │       ├── assets/
│   │       │   └── .well-known/
│   │       │       └── assetlinks.json          # Placeholder — replace with real one
│   │       └── AndroidManifest.xml
│   ├── build.gradle.kts
│   ├── google-services.json                     # Replace with real Firebase config
│   └── proguard-rules.pro
├── gradle/wrapper/
│   ├── gradle-wrapper.jar
│   └── gradle-wrapper.properties
├── build.gradle.kts
├── settings.gradle.kts
├── gradle.properties
├── gradlew                                      # Unix Gradle wrapper
└── gradlew.bat                                  # Windows Gradle wrapper
```

---

## 12. Troubleshooting

### `sharp` not found / icons not generated

```bash
pnpm install sharp
```

Without `sharp`, the generator falls back to a text-based placeholder icon. Install it to enable proper icon resizing.

---

### `gradlew not found` error when running `build`

The Gradle wrapper is bundled in the generated project. If it's missing:

```bash
cd output/my-app
gradle wrapper --gradle-version 8.9
```

---

### `JAVA_HOME` not set / Java not found

```bash
# Check Java version (need 17+)
java -version

# Set JAVA_HOME (Linux/macOS example)
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk
export PATH=$JAVA_HOME/bin:$PATH
```

---

### App shows browser UI instead of full-screen

The Digital Asset Links verification failed. Check:

1. `https://yourdomain.com/.well-known/assetlinks.json` is reachable (no 404, no redirect)
2. The `package_name` in `assetlinks.json` exactly matches `packageName` in `app.json`
3. The `sha256_cert_fingerprints` matches the certificate used to sign the APK
4. No trailing slashes or whitespace in the domain

Use the [Statement List Validator](https://developers.google.com/digital-asset-links/tools/generator) to check.

---

### TWA page shows blank / ERR_CONNECTION_REFUSED

- Your website must be live and reachable on HTTPS when the app runs
- Test the URL in Chrome on the same device
- Ensure `websiteUrl` in `app.json` matches the URL Chrome opens

---

### Build fails with `Execution failed for task ':app:processDebugGoogleServices'`

Firebase is enabled but `google-services.json` contains placeholder values. Either:
- Replace `output/my-app/app/google-services.json` with your real Firebase config file, or
- Set `firebase.enabled: false` in `app.json` and regenerate

---

### Dashboard login shows "Invalid token" after restart

The dashboard stores sessions as JWTs. By default it uses an insecure secret that changes between processes. Set a persistent secret:

```bash
JWT_SECRET=a-long-random-string-here twa-generator dashboard
```

---

### Port already in use

```bash
twa-generator dashboard --port 3001
```
