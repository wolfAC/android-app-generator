'use strict';

module.exports = {
  name: 'qr-scanner',
  version: '1.0.0',
  description: 'QR code and barcode scanner using Google ML Kit',
  dependencies: [
    { configuration: 'implementation', artifact: 'com.google.mlkit:barcode-scanning:17.3.0' },
    { configuration: 'implementation', artifact: 'androidx.camera:camera-core:1.4.1' },
    { configuration: 'implementation', artifact: 'androidx.camera:camera-camera2:1.4.1' },
    { configuration: 'implementation', artifact: 'androidx.camera:camera-lifecycle:1.4.1' },
    { configuration: 'implementation', artifact: 'androidx.camera:camera-view:1.4.1' },
  ],
  gradlePlugins: [],
  permissions: [
    'android.permission.CAMERA',
  ],
  manifestEntries: [
    '<activity\n    android:name=".plugins.QrScannerActivity"\n    android:exported="false"\n    android:screenOrientation="portrait"\n    android:theme="@style/Theme.AppCompat.NoActionBar" />',
  ],
  kotlinFiles: [
    { template: 'templates/QrScannerActivity.kt.ejs', dest: 'plugins/QrScannerActivity.kt' },
  ],
  layoutFiles: [
    { template: 'templates/activity_qr_scanner.xml', dest: 'activity_qr_scanner.xml' },
  ],
  xmlFiles: [],
  bridgeMethodsTemplate: 'templates/qr_bridge_methods.kt.ejs',
};
