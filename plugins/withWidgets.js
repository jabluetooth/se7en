/**
 * withWidgets.js
 * Expo config plugin that wires up the Se7en off-screen widget system.
 *
 * iOS changes:
 *   - Adds the App Group entitlement so the main app and widget extension
 *     can share UserDefaults.
 *   - Sets NSSupportsLiveActivities and NSSupportsLiveActivitiesFrequentUpdates
 *     in Info.plist so ActivityKit is available at runtime.
 *
 * Android changes:
 *   - Registers the Se7enWidget and Se7enWidgetLarge AppWidgetProvider receivers
 *     in AndroidManifest.xml with intent-filters for APPWIDGET_UPDATE and the
 *     custom WIDGET_UPDATE action.
 *   - Copies Kotlin source files into the Android project's widget package.
 *   - Copies layout and xml resource files into the Android res directories.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const {
  withPlugins,
  withEntitlementsPlist,
  withInfoPlist,
  withAndroidManifest,
  withDangerousMod,
} = require('@expo/config-plugins');

const APP_GROUP_ID   = 'group.com.se7en.gymtracker';
const WIDGET_PACKAGE = 'com.se7en.gymtracker.widget';

// ── iOS: App Group entitlement ────────────────────────────────────────────────

function withAppGroupEntitlement(config) {
  return withEntitlementsPlist(config, (mod) => {
    const existing =
      mod.modResults['com.apple.security.application-groups'] ?? [];
    if (!existing.includes(APP_GROUP_ID)) {
      mod.modResults['com.apple.security.application-groups'] = [
        ...existing,
        APP_GROUP_ID,
      ];
    }
    return mod;
  });
}

// ── iOS: Info.plist Live Activities flags ─────────────────────────────────────

function withLiveActivitiesInfoPlist(config) {
  return withInfoPlist(config, (mod) => {
    mod.modResults['NSSupportsLiveActivities'] = true;
    mod.modResults['NSSupportsLiveActivitiesFrequentUpdates'] = true;
    return mod;
  });
}

// ── Android: Widget receiver in AndroidManifest ───────────────────────────────

function addWidgetReceiver(application, receiverName, metaDataName, metaDataResource) {
  const receivers = application[0].receiver ?? [];
  const alreadyAdded = receivers.some(
    (r) => r.$?.['android:name'] === receiverName,
  );
  if (alreadyAdded) return;

  const receiver = {
    $: {
      'android:name': receiverName,
      'android:label': 'Se7en Widget',
      'android:exported': 'true',
    },
    'intent-filter': [
      {
        action: [
          { $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } },
          { $: { 'android:name': 'com.se7en.gymtracker.WIDGET_UPDATE' } },
        ],
      },
    ],
    'meta-data': [
      {
        $: {
          'android:name': metaDataName,
          'android:resource': metaDataResource,
        },
      },
    ],
  };

  if (!application[0].receiver) {
    application[0].receiver = [];
  }
  application[0].receiver.push(receiver);
}

function withAndroidWidgetManifest(config) {
  return withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application;
    if (!application || application.length === 0) return mod;

    addWidgetReceiver(
      application,
      `${WIDGET_PACKAGE}.Se7enWidget`,
      'android.appwidget.provider',
      '@xml/se7en_widget_info',
    );

    addWidgetReceiver(
      application,
      `${WIDGET_PACKAGE}.Se7enWidgetLarge`,
      'android.appwidget.provider',
      '@xml/se7en_widget_large_info',
    );

    return mod;
  });
}

// ── Android: Copy Kotlin + resource files into the native project ─────────────
//
// These files live in plugins/android/ (version-controlled alongside JS source)
// and are copied into android/ (the generated Expo project) during prebuild.
// This keeps the canonical source in one place while ensuring the native build
// always has the latest files.

function withAndroidWidgetFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const projectRoot = mod.modRequest.projectRoot;
      const pluginSrc   = path.join(projectRoot, 'plugins', 'android');
      const androidRoot = path.join(projectRoot, 'android');
      const appSrc      = path.join(androidRoot, 'app', 'src', 'main');

      const widgetPkg = path.join(
        appSrc,
        'java', 'com', 'se7en', 'gymtracker', 'widget',
      );

      // Kotlin source files to copy
      const kotlinFiles = [
        'Se7enWidget.kt',
        'Se7enWidgetLarge.kt',
        'Se7enWidgetModule.kt',
        'Se7enWidgetPackage.kt',
      ];

      fs.mkdirSync(widgetPkg, { recursive: true });
      for (const file of kotlinFiles) {
        const src  = path.join(pluginSrc, file);
        const dest = path.join(widgetPkg, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
        }
      }

      // Resource files — { src relative to pluginSrc : dest relative to appSrc/res }
      const resourceFiles = [
        { src: path.join('res', 'layout', 'widget_medium.xml'), dest: path.join('res', 'layout', 'widget_medium.xml') },
        { src: path.join('res', 'layout', 'widget_large.xml'),  dest: path.join('res', 'layout', 'widget_large.xml')  },
        { src: path.join('res', 'xml', 'se7en_widget_info.xml'),       dest: path.join('res', 'xml', 'se7en_widget_info.xml')       },
        { src: path.join('res', 'xml', 'se7en_widget_large_info.xml'), dest: path.join('res', 'xml', 'se7en_widget_large_info.xml') },
      ];

      for (const { src, dest } of resourceFiles) {
        const srcPath  = path.join(pluginSrc, src);
        const destPath = path.join(appSrc, dest);
        if (fs.existsSync(srcPath)) {
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          fs.copyFileSync(srcPath, destPath);
        }
      }

      return mod;
    },
  ]);
}

// ── Compose & export ──────────────────────────────────────────────────────────

/** @type {import('@expo/config-plugins').ConfigPlugin} */
function withWidgets(config) {
  return withPlugins(config, [
    withAppGroupEntitlement,
    withLiveActivitiesInfoPlist,
    withAndroidWidgetManifest,
    withAndroidWidgetFiles,
  ]);
}

module.exports = withWidgets;
