# Plugin Architecture (Phase 2 Preview)

This directory will contain plugins that extend the TWA Generator.

## Planned Plugin API

Plugins hook into the generation lifecycle to add custom files, modify templates, or inject dependencies.

```javascript
// plugins/my-plugin/index.js
module.exports = {
  name: 'my-plugin',
  version: '1.0.0',

  // Called after config is loaded, before validation
  onConfigLoaded(config) {
    return config; // return modified config
  },

  // Called after templates are rendered, before final output
  onTemplatesRendered(outputDir, config) {
    // Add custom files, modify existing ones
  },

  // Called after full generation is complete
  onComplete(outputDir, config) {
    // Final post-processing
  },
};
```

## Planned Plugins

| Plugin | Description |
|--------|-------------|
| `@twa/plugin-ads` | Add AdMob/Google Ads integration |
| `@twa/plugin-analytics` | Add Google Analytics / Mixpanel |
| `@twa/plugin-offline` | Add offline caching with WorkManager |
| `@twa/plugin-camera` | Full camera integration with file upload |
| `@twa/plugin-biometric` | Biometric auth integration |
| `@twa/plugin-in-app-updates` | Google Play in-app update prompts |
| `@twa/plugin-shortcuts` | App shortcuts configuration |
| `@twa/plugin-widgets` | Android home screen widget scaffolding |

## Creating a Plugin

Coming in Phase 2. The plugin system will follow the same pattern as Vite/Rollup plugins.

## Using Plugins (app.json)

```json
{
  "plugins": [
    "@twa/plugin-ads",
    ["@twa/plugin-analytics", { "provider": "mixpanel" }]
  ]
}
```
