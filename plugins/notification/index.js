'use strict';

module.exports = {
  name: 'notification',
  version: '1.0.0',
  description: 'Enhanced push notifications: topic subscriptions, local scheduling, notification history',
  dependencies: [
    { configuration: 'implementation', artifact: 'androidx.work:work-runtime-ktx:2.10.0' },
  ],
  gradlePlugins: [],
  permissions: [],  // POST_NOTIFICATIONS already handled by features.notifications
  manifestEntries: [],
  kotlinFiles: [
    { template: 'templates/NotificationPlugin.kt.ejs', dest: 'plugins/NotificationPlugin.kt' },
  ],
  layoutFiles: [],
  xmlFiles: [],
  bridgeMethodsTemplate: 'templates/notification_bridge_methods.kt.ejs',
};
