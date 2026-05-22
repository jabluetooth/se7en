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
 *   - Registers the Se7enWidget AppWidgetProvider receiver in AndroidManifest.xml
 *     with intent-filters for APPWIDGET_UPDATE and the custom WIDGET_UPDATE action.
 *   - Registers a second receiver for the large (4×2) variant.
 */

'use strict';

const {
  withPlugins,
  withEntitlementsPlist,
  withInfoPlist,
  withAndroidManifest,
} = require('@expo/config-plugins');

const APP_GROUP_ID = 'group.com.se7en.gymtracker';
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

/**
 * Adds an <receiver> block for the given widget provider class to the
 * AndroidManifest <application> node.
 *
 * @param {object[]} application - The array of application nodes.
 * @param {string} receiverName  - Fully-qualified class name, e.g. ".widget.Se7enWidget"
 * @param {string} metaDataName  - android:name for the meta-data pointing to appwidget XML
 * @param {string} metaDataResource - android:resource, e.g. "@xml/se7en_widget_info"
 */
function addWidgetReceiver(application, receiverName, metaDataName, metaDataResource) {
  // Prevent duplicates
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
          {
            $: {
              'android:name': 'android.appwidget.action.APPWIDGET_UPDATE',
            },
          },
          {
            $: {
              'android:name': 'com.se7en.gymtracker.WIDGET_UPDATE',
            },
          },
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
    const application =
      mod.modResults.manifest.application;

    if (!application || application.length === 0) {
      return mod;
    }

    // Medium (2×2) widget
    addWidgetReceiver(
      application,
      `${WIDGET_PACKAGE}.Se7enWidget`,
      'android.appwidget.provider',
      '@xml/se7en_widget_info',
    );

    // Large (4×2) widget — same receiver class, different meta-data resource
    // In Android a single provider class handles all widget sizes at runtime
    // by checking the widget dimensions. We register a separate declaration
    // for the large variant so the launcher can distinguish them.
    // NOTE: if you want separate picker entries, you'd use a second subclass.
    // For simplicity we register a second meta-data tag on the same receiver
    // as an alias receiver with a distinct name suffix.
    addWidgetReceiver(
      application,
      `${WIDGET_PACKAGE}.Se7enWidgetLarge`,
      'android.appwidget.provider',
      '@xml/se7en_widget_large_info',
    );

    return mod;
  });
}

// ── Compose & export ──────────────────────────────────────────────────────────

/** @type {import('@expo/config-plugins').ConfigPlugin} */
function withWidgets(config) {
  return withPlugins(config, [
    withAppGroupEntitlement,
    withLiveActivitiesInfoPlist,
    withAndroidWidgetManifest,
  ]);
}

module.exports = withWidgets;
