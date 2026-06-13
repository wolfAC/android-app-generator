'use strict';

module.exports = {
  name: 'biometric',
  version: '1.0.0',
  description: 'Biometric authentication (fingerprint, face unlock) using AndroidX Biometric',
  dependencies: [
    { configuration: 'implementation', artifact: 'androidx.biometric:biometric:1.2.0-alpha05' },
  ],
  gradlePlugins: [],
  permissions: [
    'android.permission.USE_BIOMETRIC',
    'android.permission.USE_FINGERPRINT',
  ],
  manifestEntries: [],
  kotlinFiles: [
    { template: 'templates/BiometricHelper.kt.ejs', dest: 'plugins/BiometricHelper.kt' },
  ],
  layoutFiles: [],
  xmlFiles: [],
  bridgeMethodsTemplate: 'templates/biometric_bridge_methods.kt.ejs',
};
