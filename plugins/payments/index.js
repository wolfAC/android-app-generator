'use strict';

module.exports = {
  name: 'payments',
  version: '1.0.0',
  description: 'Google Play Billing — in-app purchases and subscriptions',
  dependencies: [
    { configuration: 'implementation', artifact: 'com.android.billingclient:billing-ktx:7.1.1' },
  ],
  gradlePlugins: [],
  permissions: [],  // No special manifest permissions needed
  manifestEntries: [],
  kotlinFiles: [
    { template: 'templates/BillingManager.kt.ejs', dest: 'plugins/BillingManager.kt' },
  ],
  layoutFiles: [],
  xmlFiles: [],
  bridgeMethodsTemplate: 'templates/payments_bridge_methods.kt.ejs',
};
