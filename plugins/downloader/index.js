'use strict';

module.exports = {
  name: 'downloader',
  version: '1.0.0',
  description: 'Enhanced file download management with progress tracking',
  dependencies: [],  // Uses system DownloadManager
  gradlePlugins: [],
  permissions: [
    'android.permission.DOWNLOAD_WITHOUT_NOTIFICATION',
  ],
  manifestEntries: [
    '<receiver\n    android:name=".plugins.DownloadReceiver"\n    android:exported="true">\n    <intent-filter>\n        <action android:name="android.intent.action.DOWNLOAD_COMPLETE" />\n    </intent-filter>\n</receiver>',
  ],
  kotlinFiles: [
    { template: 'templates/DownloadManagerHelper.kt.ejs', dest: 'plugins/DownloadManagerHelper.kt' },
    { template: 'templates/DownloadReceiver.kt.ejs', dest: 'plugins/DownloadReceiver.kt' },
  ],
  layoutFiles: [],
  xmlFiles: [],
  bridgeMethodsTemplate: 'templates/downloader_bridge_methods.kt.ejs',
};
