# Website Requirements for TWA — Full Checklist

Everything your website must implement to work correctly as a Trusted Web Activity app.

---

## Table of Contents

1. [HTTPS & Security Headers](#1-https--security-headers)
2. [Web App Manifest](#2-web-app-manifest)
3. [Digital Asset Links — assetlinks.json](#3-digital-asset-links--assetlinksjson)
4. [Viewport & Mobile HTML](#4-viewport--mobile-html)
5. [Service Worker & Offline Support](#5-service-worker--offline-support)
6. [JavaScript Bridge — window.Android](#6-javascript-bridge--windowandroid)
7. [Push Notifications (FCM)](#7-push-notifications-fcm)
8. [Deep Links & URL Handling](#8-deep-links--url-handling)
9. [Camera & File Upload](#9-camera--file-upload)
10. [Location Access](#10-location-access)
11. [Biometric Authentication](#11-biometric-authentication)
12. [QR / Barcode Scanner](#12-qr--barcode-scanner)
13. [In-App Payments (Play Billing)](#13-in-app-payments-play-billing)
14. [File Downloads](#14-file-downloads)
15. [Splash Screen & Theme Colors](#15-splash-screen--theme-colors)
16. [Performance — Lighthouse Thresholds](#16-performance--lighthouse-thresholds)
17. [Navigation & Back Button](#17-navigation--back-button)
18. [Detecting the TWA Environment](#18-detecting-the-twa-environment)
19. [Common Mistakes & Gotchas](#19-common-mistakes--gotchas)

---

## 1. HTTPS & Security Headers

TWA refuses to launch if the URL is not served over HTTPS with a valid certificate.

**Required**

```
https://yourdomain.com   ✓
http://yourdomain.com    ✗  TWA will not open — falls back to Chrome
```

**Recommended security headers**

```http
Content-Security-Policy: default-src 'self'; script-src 'self'; ...
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

> Overly strict CSP can block the JavaScript bridge injected by the Android wrapper. If `window.Android` calls stop working, check your `script-src` directive — you may need `'unsafe-inline'` or a nonce.

---

## 2. Web App Manifest

The manifest is required for TWA to recognize your site as a PWA. Chrome validates it on every launch.

**Minimum manifest** (`/manifest.json` or `/manifest.webmanifest`)

```json
{
  "name": "My App",
  "short_name": "MyApp",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FFFFFF",
  "theme_color": "#6200EE",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

**Link it in every HTML page**

```html
<link rel="manifest" href="/manifest.json">
```

**Key field rules**

| Field | Requirement |
|-------|-------------|
| `display` | Must be `"standalone"` or `"fullscreen"` — `"browser"` breaks TWA mode |
| `start_url` | Must be within the verified origin |
| `icons` | At least one 192×192 PNG is required; 512×512 recommended |
| `theme_color` | Should match `theme.primary` in your `app.json` |
| `background_color` | Should match `theme.background` in your `app.json` |

**Maskable icon** (prevents white padding on Android adaptive icons)

```json
{
  "src": "/icons/icon-512-maskable.png",
  "sizes": "512x512",
  "type": "image/png",
  "purpose": "maskable"
}
```

---

## 3. Digital Asset Links — assetlinks.json

This is the most critical file. TWA uses it to verify that the Android app is allowed to wrap your website. Without it, Chrome shows the URL bar and TWA mode is broken.

**File location** — must be served at exactly this path:

```
https://yourdomain.com/.well-known/assetlinks.json
```

**File contents**

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.example.myapp",
      "sha256_cert_fingerprints": [
        "AB:CD:EF:12:34:56:78:90:..."
      ]
    }
  }
]
```

**Getting your SHA-256 fingerprint**

```bash
# From a debug keystore
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android

# From a release keystore
keytool -list -v -keystore release.jks -alias your-alias

# From a Play Store app (after upload)
# Google Play Console → Setup → App Signing → App signing key certificate
```

**Server requirements**

- Served as `application/json` content-type
- No redirects — the file must be at the exact path
- Must be accessible without authentication
- CORS is not required for this file

**Multi-app or multi-domain** — you can list multiple apps in the same file:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.example.myapp",
      "sha256_cert_fingerprints": ["AA:BB:CC:..."]
    }
  },
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.example.myapp.staging",
      "sha256_cert_fingerprints": ["DD:EE:FF:..."]
    }
  }
]
```

**Verify with Google's tool**

```
https://developers.google.com/digital-asset-links/tools/generator
```

---

## 4. Viewport & Mobile HTML

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#6200EE">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
```

**`viewport-fit=cover`** is required if you use `features.fullscreen: true` in `app.json` — otherwise content is clipped behind the system bars.

**Safe area insets** (fullscreen mode)

```css
body {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
```

---

## 5. Service Worker & Offline Support

Required when `features.offline: true` is set in `app.json`. Even without that flag, a service worker dramatically improves the user experience.

**Register the service worker**

```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(registration => {
    console.log('SW registered:', registration.scope);
  });
}
```

**Minimal service worker** (`/sw.js`)

```javascript
const CACHE_NAME = 'app-v1';
const PRECACHE = ['/', '/index.html', '/styles.css', '/app.js'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
```

**Bridge with the Android wrapper**

When `features.offline: true`, the Android side calls `window.Android.onOfflineStatusChange(isOffline)`. Implement this:

```javascript
window.Android = window.Android || {};
window.Android.onOfflineStatusChange = function(isOffline) {
  document.getElementById('offline-banner').hidden = !isOffline;
};
```

---

## 6. JavaScript Bridge — window.Android

The generated app injects a `window.Android` object into every page. Always guard calls with an availability check so the page works in regular browsers too.

**Safety wrapper** — add this once, early in your JS:

```javascript
const Android = window.Android || null;
const isAndroidApp = !!Android;
```

**Checking availability per feature**

```javascript
if (window.Android && typeof window.Android.showToast === 'function') {
  window.Android.showToast('Hello from web!');
}
```

**Core bridge methods always available**

```javascript
// Show a native Android toast message
window.Android.showToast('Saved!');

// Get app version info
const version = window.Android.getAppVersion(); // returns "1.0.0"
const versionCode = window.Android.getAppVersionCode(); // returns 1

// Share content using the Android share sheet
window.Android.shareContent('Check this out', 'https://example.com');

// Open a URL in external browser (not inside the TWA)
window.Android.openExternalUrl('https://other.com');

// Vibrate the device
window.Android.vibrate(200); // milliseconds

// Check if a specific feature is available
const hasCamera = window.Android.isFeatureAvailable('camera'); // returns boolean
```

---

## 7. Push Notifications (FCM)

Requires `features.notifications: true` and `firebase.enabled: true` in `app.json`, and the `notification` plugin.

**Request permission on the web side first**

```javascript
async function requestNotificationPermission() {
  if (!('Notification' in window)) return;

  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    // Tell the Android side the user granted it
    if (window.Android && window.Android.onNotificationPermissionGranted) {
      window.Android.onNotificationPermissionGranted();
    }
  }
}
```

**Topic subscriptions** (notification plugin)

```javascript
// Subscribe to a topic (e.g. "news", "promotions")
window.Android.subscribeToTopic('news');

// Unsubscribe
window.Android.unsubscribeFromTopic('news');

// Schedule a local notification (fires after delay in ms)
window.Android.scheduleLocalNotification('Reminder', 'Your cart is waiting!', 5000);

// Cancel all pending local notifications
window.Android.clearAllNotifications();
```

**Receiving notification data** — handle clicks that open a specific page:

```javascript
// The Android side calls this when the user taps a notification
window.Android = window.Android || {};
window.Android.onNotificationReceived = function(title, body, data) {
  // data is a JSON string, parse it
  const payload = JSON.parse(data || '{}');
  if (payload.screen) {
    navigate(payload.screen); // your router
  }
};
```

**Firebase service worker** for background notifications:

Create `/firebase-messaging-sw.js` at the root:

```javascript
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'YOUR_API_KEY',
  projectId: 'YOUR_PROJECT_ID',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage(payload => {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: '/icons/icon-192.png',
  });
});
```

---

## 8. Deep Links & URL Handling

URLs within your verified origin open directly inside the TWA. URLs outside it open in a Chrome Custom Tab.

**Handle app-to-web deep links**

When Android sends the user to a specific URL (e.g. from a notification tap), read query parameters on page load:

```javascript
const params = new URLSearchParams(window.location.search);
const action = params.get('action');   // e.g. "open_order"
const id = params.get('id');           // e.g. "123"

if (action === 'open_order') {
  openOrder(id);
}
```

**Prevent the TWA from navigating outside your domain**

If a link would leave your domain, open it externally:

```javascript
document.addEventListener('click', event => {
  const anchor = event.target.closest('a');
  if (!anchor) return;

  const url = new URL(anchor.href, location.href);
  if (url.origin !== location.origin) {
    event.preventDefault();
    if (window.Android) {
      window.Android.openExternalUrl(url.href);
    } else {
      window.open(url.href, '_blank');
    }
  }
});
```

---

## 9. Camera & File Upload

Requires `features.camera: true` and/or `features.fileUpload: true` in `app.json`.

**Camera access** — use the standard web API; Android grants the permission automatically if the user approved it at the OS level:

```javascript
async function openCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoElement.srcObject = stream;
  } catch (err) {
    // User denied or hardware unavailable
    console.error('Camera error:', err);
  }
}
```

**File upload** — use a standard `<input type="file">`:

```html
<input type="file" accept="image/*" capture="environment" id="photo-input">
```

```javascript
document.getElementById('photo-input').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('photo', file);
  await fetch('/api/upload', { method: 'POST', body: formData });
});
```

The Android wrapper sets up the `WebChromeClient.onShowFileChooser` callback automatically when `fileUpload` is enabled — no additional bridge code is needed.

---

## 10. Location Access

Requires `features.location: true` in `app.json`.

```javascript
async function getLocation() {
  if (!navigator.geolocation) {
    showError('Geolocation not supported');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    position => {
      const { latitude, longitude, accuracy } = position.coords;
      updateMap(latitude, longitude);
    },
    error => {
      switch (error.code) {
        case error.PERMISSION_DENIED:
          showError('Location permission denied');
          break;
        case error.POSITION_UNAVAILABLE:
          showError('Location unavailable');
          break;
        case error.TIMEOUT:
          showError('Location request timed out');
          break;
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}
```

> The Android `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` permissions are added to `AndroidManifest.xml` automatically. The runtime permission dialog is shown by Chrome when the web page calls `geolocation.getCurrentPosition`.

---

## 11. Biometric Authentication

Requires the `biometric` plugin.

```javascript
async function authenticateWithBiometric() {
  if (!window.Android || typeof window.Android.authenticateBiometric !== 'function') {
    // Fall back to password or skip
    return fallbackAuth();
  }

  window.Android.authenticateBiometric(
    'Confirm your identity',           // title
    'Use fingerprint or face to log in', // subtitle
    'Cancel'                           // negative button label
  );
}

// The Android side calls one of these callbacks:
window.Android.onBiometricSuccess = function() {
  // User authenticated — proceed
  unlockContent();
};

window.Android.onBiometricError = function(errorCode, errorMessage) {
  console.error('Biometric error:', errorCode, errorMessage);
  showError('Authentication failed: ' + errorMessage);
};

window.Android.onBiometricCancelled = function() {
  // User pressed Cancel — handle gracefully
};
```

---

## 12. QR / Barcode Scanner

Requires the `qr-scanner` plugin.

```javascript
function openQRScanner() {
  if (!window.Android || typeof window.Android.openQRScanner !== 'function') {
    alert('QR scanner not available');
    return;
  }
  window.Android.openQRScanner();
}

// Android calls this with the scanned result
window.Android.onQRCodeScanned = function(result) {
  console.log('Scanned:', result);

  // result might be a URL, a product code, plain text, etc.
  if (result.startsWith('http')) {
    window.location.href = result;
  } else {
    lookupProductCode(result);
  }
};

window.Android.onQRScanCancelled = function() {
  // User closed the scanner without scanning
};
```

---

## 13. In-App Payments (Play Billing)

Requires the `payments` plugin.

**Check availability first** — only works inside the Play Store app:

```javascript
async function initPayments() {
  if (!window.Android || typeof window.Android.queryProducts !== 'function') {
    showError('Payments not supported in this environment');
    return;
  }

  // Query available products/subscriptions by their Play Store product IDs
  window.Android.queryProducts(JSON.stringify(['product_id_1', 'sub_monthly']));
}

// Receives product details from Play Billing
window.Android.onProductsReceived = function(productsJson) {
  const products = JSON.parse(productsJson);
  renderProductList(products);
};

// Start a purchase flow
function purchaseProduct(productId) {
  window.Android.launchPurchaseFlow(productId);
}

// Purchase completed
window.Android.onPurchaseSuccess = function(purchaseToken, productId) {
  // IMPORTANT: verify purchaseToken server-side via Google Play Developer API
  verifyPurchaseOnServer(purchaseToken, productId);
};

window.Android.onPurchaseError = function(errorCode, message) {
  showError('Purchase failed: ' + message);
};

window.Android.onPurchaseCancelled = function() {
  // User closed the Play Store dialog
};
```

> Always verify `purchaseToken` on your server using the Google Play Developer API. Never grant entitlements based on the client callback alone.

---

## 14. File Downloads

Requires the `downloader` plugin.

```javascript
function downloadFile(url, filename) {
  if (window.Android && typeof window.Android.downloadFile === 'function') {
    // Uses the Android system DownloadManager — shows a notification with progress
    window.Android.downloadFile(url, filename, 'application/pdf');
  } else {
    // Regular browser download
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  }
}

// Progress updates (0–100)
window.Android.onDownloadProgress = function(downloadId, progress) {
  updateProgressBar(downloadId, progress);
};

window.Android.onDownloadComplete = function(downloadId, filePath) {
  showSuccess('Downloaded to: ' + filePath);
};

window.Android.onDownloadFailed = function(downloadId, reason) {
  showError('Download failed: ' + reason);
};
```

---

## 15. Splash Screen & Theme Colors

**`<meta name="theme-color">`** controls the status bar color while loading. Set it to match `theme.primary` in `app.json`:

```html
<meta name="theme-color" content="#6200EE">
```

For dark/light mode support:

```html
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#6200EE">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#3700B3">
```

**Minimize splash-to-page flash** — the Android splash screen shows until `DOMContentLoaded`. Keep your critical CSS inline and defer non-critical scripts:

```html
<head>
  <style>
    /* Critical above-the-fold CSS inlined here */
    body { margin: 0; background: #FFFFFF; font-family: sans-serif; }
  </style>
</head>
<body>
  <!-- content -->
  <script src="/app.js" defer></script>
</body>
```

---

## 16. Performance — Lighthouse Thresholds

Chrome validates that the page passes basic PWA criteria on every launch. A Lighthouse score below the thresholds causes the URL bar to reappear.

| Metric | Minimum | Target |
|--------|---------|--------|
| Performance | 50 | 80+ |
| First Contentful Paint | < 3 s | < 1.5 s |
| Time to Interactive | < 7.3 s | < 3.8 s |
| PWA — installable | Pass | Pass |
| PWA — manifest | Pass | Pass |
| PWA — service worker | Registered | Registered |

**Quick wins**

```html
<!-- Preload critical assets -->
<link rel="preload" href="/fonts/brand.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preconnect" href="https://api.yourdomain.com">

<!-- Lazy-load off-screen images -->
<img src="hero.jpg" loading="eager" fetchpriority="high" alt="Hero">
<img src="below-fold.jpg" loading="lazy" alt="Below fold">
```

---

## 17. Navigation & Back Button

The Android back button triggers browser history navigation by default. Handle edge cases explicitly:

**Prevent accidental exits from single-page apps**

```javascript
// Tell the Android app whether the back button should navigate history or exit
function updateBackBehavior() {
  if (window.Android && typeof window.Android.setCanGoBack === 'function') {
    window.Android.setCanGoBack(window.history.length > 1);
  }
}

window.addEventListener('popstate', updateBackBehavior);
updateBackBehavior();
```

**Custom back behavior** (e.g., close a modal before navigating back)

```javascript
// The Android side calls this before navigating back
window.Android.onBackPressed = function() {
  if (modalIsOpen()) {
    closeModal();
    return true; // true = we handled it, don't do native back
  }
  return false; // false = let Android handle it (navigate back or exit)
};
```

---

## 18. Detecting the TWA Environment

Use this to show Android-specific UI or skip features that don't make sense in a browser.

```javascript
const isAndroidApp = !!window.Android;
const isTWA = isAndroidApp || document.referrer.includes('android-app://');

if (isTWA) {
  // Hide "Download from Play Store" banner
  document.getElementById('install-banner').hidden = true;

  // Show native share button instead of clipboard copy
  document.getElementById('native-share-btn').hidden = false;
}

// More robust check using UA
const ua = navigator.userAgent;
const isInTWA = ua.includes('wv') && isAndroidApp; // WebView + bridge = TWA
```

---

## 19. Common Mistakes & Gotchas

| Problem | Cause | Fix |
|---------|-------|-----|
| URL bar appears inside app | `assetlinks.json` missing, wrong fingerprint, or served with redirect | Verify at `https://yourdomain.com/.well-known/assetlinks.json` directly; check for 301/302 |
| URL bar appears after Play Store install | Play Store signing fingerprint differs from debug fingerprint | Add Play App Signing fingerprint to `assetlinks.json` (get it from Play Console → App Signing) |
| `window.Android` is undefined | JS runs before bridge is injected | Wrap calls in `DOMContentLoaded` or check `typeof window.Android !== 'undefined'` |
| Biometric/QR/payments not working | Plugin not added to `app.json` or project not regenerated | Run `twa-generator plugin add <name>` then `twa-generator update` |
| White flash on launch | Heavy JS blocks render | Inline critical CSS, defer scripts |
| `display: browser` in manifest | TWA falls back to browser tab, no native chrome | Set `display` to `"standalone"` or `"fullscreen"` |
| Cross-origin requests blocked | CSP or CORS missing | Add `Access-Control-Allow-Origin` on your API; check `connect-src` in CSP |
| Notification clicks don't navigate | App not handling `intent` extras | Read query params on page load; use `?screen=X` in FCM notification click action |
| File chooser does nothing | `fileUpload` feature not enabled | Set `features.fileUpload: true` and regenerate |
| Location permission denied silently | `location` feature not enabled | Set `features.location: true` and regenerate |

---

## Quick Reference — `window.Android` API Surface

| Method | Plugin/Feature | Description |
|--------|---------------|-------------|
| `showToast(msg)` | core | Native toast |
| `getAppVersion()` | core | Version string |
| `getAppVersionCode()` | core | Version int |
| `shareContent(title, url)` | core | Android share sheet |
| `openExternalUrl(url)` | core | Open in external browser |
| `vibrate(ms)` | core | Haptic feedback |
| `isFeatureAvailable(name)` | core | Feature flag check |
| `setCanGoBack(bool)` | core | Control back button |
| `subscribeToTopic(topic)` | notification | FCM topic |
| `unsubscribeFromTopic(topic)` | notification | FCM topic |
| `scheduleLocalNotification(title, body, delayMs)` | notification | Local scheduled notification |
| `clearAllNotifications()` | notification | Cancel pending notifications |
| `authenticateBiometric(title, subtitle, cancel)` | biometric | Show biometric prompt |
| `openQRScanner()` | qr-scanner | Launch scanner activity |
| `downloadFile(url, name, mimeType)` | downloader | System download manager |
| `queryProducts(idsJson)` | payments | Fetch Play Billing products |
| `launchPurchaseFlow(productId)` | payments | Start purchase |

**Callbacks the Android side calls into your page**

| Callback | Triggered by |
|----------|-------------|
| `window.Android.onBiometricSuccess()` | Successful biometric auth |
| `window.Android.onBiometricError(code, msg)` | Failed biometric |
| `window.Android.onBiometricCancelled()` | User dismissed prompt |
| `window.Android.onQRCodeScanned(result)` | QR scan result |
| `window.Android.onQRScanCancelled()` | Scanner dismissed |
| `window.Android.onDownloadProgress(id, pct)` | Download progress |
| `window.Android.onDownloadComplete(id, path)` | Download finished |
| `window.Android.onDownloadFailed(id, reason)` | Download error |
| `window.Android.onProductsReceived(json)` | Products fetched |
| `window.Android.onPurchaseSuccess(token, id)` | Purchase completed |
| `window.Android.onPurchaseError(code, msg)` | Purchase failed |
| `window.Android.onPurchaseCancelled()` | Purchase dismissed |
| `window.Android.onNotificationReceived(title, body, data)` | Notification tapped |
| `window.Android.onOfflineStatusChange(isOffline)` | Network status changed |
| `window.Android.onBackPressed()` | Back button pressed — return true to consume |
