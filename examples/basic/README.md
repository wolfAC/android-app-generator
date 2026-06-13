# Basic Example

This example generates a minimal Android TWA app for any HTTPS website.

## Usage

```bash
# From the root of android-app-generator
twa-generator create examples/basic

# Or with a custom output directory
twa-generator create examples/basic --output /path/to/my-app
```

## What it generates

- A complete Android Studio project
- TWA activity that opens `https://example.com`
- Material Design 3 splash screen
- Standard launcher icons (placeholder)
- Minimal permissions (Internet only)

## Customising

Edit `app.json` with your own values:

| Field | Description |
|-------|-------------|
| `appName` | Your app display name |
| `packageName` | Unique Android package (e.g. `com.mycompany.myapp`) |
| `websiteUrl` | Your HTTPS website URL |
| `theme.primary` | Primary brand color (hex) |
| `assets.icon` | Path to your 512x512 PNG icon |

## After generating

1. Open the generated project in Android Studio
2. Add your `google-services.json` if using Firebase
3. Update `assetlinks.json` with your signing certificate SHA-256
4. Host `/.well-known/assetlinks.json` on your server
5. Build and run!
