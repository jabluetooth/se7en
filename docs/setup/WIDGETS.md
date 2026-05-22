# Se7en Widget System — Setup Guide

This guide walks through wiring the off-screen widget files (under `plugins/`) into
a real iOS and Android build after `npx expo prebuild`.

---

## Prerequisites

- Xcode 15+ (iOS 16.1 SDK for Live Activities)
- Android Studio Flamingo+ (compileSdk 34+)
- EAS CLI: `npm install -g eas-cli`
- Apple Developer account with App Groups capability enabled

---

## 1. Run Expo Prebuild

```bash
npx expo prebuild --clean
```

This generates the `ios/` and `android/` directories and applies the config plugin
(`plugins/withWidgets.js`) which handles:

- iOS entitlement: `com.apple.security.application-groups` → `group.com.se7en.gymtracker`
- iOS Info.plist: `NSSupportsLiveActivities = true`, `NSSupportsLiveActivitiesFrequentUpdates = true`
- Android: registers the widget receivers in `AndroidManifest.xml`

---

## 2. iOS — Add the Widget Extension in Xcode

### 2a. Open the workspace

```bash
open ios/Se7en.xcworkspace
```

### 2b. Add a new Widget Extension target

1. In Xcode, **File → New → Target…**
2. Choose **Widget Extension**
3. Name it exactly **`Se7enWidgets`**
4. Product Bundle Identifier: `com.se7en.gymtracker.Se7enWidgets`
5. Uncheck "Include Configuration Intent"
6. Click **Finish** — Xcode creates the target with placeholder files

### 2c. Copy the plugin Swift files into the new target

Replace the Xcode-generated placeholder files with the files from `plugins/ios/Se7enWidgets/`:

| Source file                              | Add to target        |
|------------------------------------------|----------------------|
| `plugins/ios/Se7enWidgets/SharedData.swift`        | `Se7enWidgets`       |
| `plugins/ios/Se7enWidgets/Se7enWidgets.swift`      | `Se7enWidgets`       |
| `plugins/ios/Se7enWidgets/Se7enLiveActivity.swift` | `Se7enWidgets`       |

> **Important:** Delete the Xcode-generated `Se7enWidgets.swift` placeholder before
> adding ours, to avoid duplicate `@main` declarations.

### 2d. Add the native module files to the main app target

| Source file                                        | Add to target |
|----------------------------------------------------|---------------|
| `plugins/ios/Se7enWidgets/SharedData.swift`        | `Se7en` (main) |
| `plugins/ios/Se7enWidgets/Se7enWidgetsBridge.m`    | `Se7en` (main) |
| `plugins/ios/Se7enWidgets/Se7enWidgetsBridge.swift`| `Se7en` (main) |

> `SharedData.swift` must be in **both** targets so both can read/write the
> App Group UserDefaults. The header guard in Xcode prevents duplicate symbols.
>
> Alternatively, create a shared framework — but for a managed workflow app
> duplicating the file is simpler and fully supported.

### 2e. Set App Group capability in both targets

For each target (`Se7en` and `Se7enWidgets`):

1. Select the target in Xcode
2. **Signing & Capabilities → + Capability → App Groups**
3. Add group: `group.com.se7en.gymtracker`

Both targets must be signed with a provisioning profile that includes this App Group.

### 2f. Set the WidgetKit extension's Info.plist

In the `Se7enWidgets` target's `Info.plist`, confirm:
- `NSExtension → NSExtensionPointIdentifier` = `com.apple.widgetkit-extension`

This is added automatically by Xcode when you create a Widget Extension target.

### 2g. Add ActivityKit entitlement (Live Activities)

For the **main app** target only:

1. Open the entitlements file (`Se7en.entitlements`) — it was already updated by
   the config plugin.
2. Confirm `com.apple.security.application-groups` contains `group.com.se7en.gymtracker`.

Live Activities do **not** require a separate entitlement key beyond App Groups and
the Info.plist flags set by the config plugin.

---

## 3. Android — Wire the Kotlin files

### 3a. Copy Kotlin source files

After prebuild, copy the Kotlin files to the Android source tree:

```bash
# From the project root
cp plugins/android/Se7enWidget.kt \
   android/app/src/main/java/com/se7en/gymtracker/widget/Se7enWidget.kt

cp plugins/android/Se7enWidgetModule.kt \
   android/app/src/main/java/com/se7en/gymtracker/widget/Se7enWidgetModule.kt

cp plugins/android/Se7enWidgetPackage.kt \
   android/app/src/main/java/com/se7en/gymtracker/widget/Se7enWidgetPackage.kt
```

Create the directory first if needed:
```bash
mkdir -p android/app/src/main/java/com/se7en/gymtracker/widget
```

### 3b. Copy layout and XML resources

```bash
cp plugins/android/res/layout/widget_medium.xml \
   android/app/src/main/res/layout/widget_medium.xml

cp plugins/android/res/layout/widget_large.xml \
   android/app/src/main/res/layout/widget_large.xml

cp plugins/android/res/xml/se7en_widget_info.xml \
   android/app/src/main/res/xml/se7en_widget_info.xml

cp plugins/android/res/xml/se7en_widget_large_info.xml \
   android/app/src/main/res/xml/se7en_widget_large_info.xml
```

### 3c. Add string resources

The widget XML metadata references string resources. Add these to
`android/app/src/main/res/values/strings.xml`:

```xml
<string name="widget_description_medium">Se7en workout tracker — medium widget</string>
<string name="widget_description_large">Se7en workout tracker — large widget</string>
```

### 3d. Register the ReactPackage in MainApplication.kt

Open `android/app/src/main/java/com/se7en/gymtracker/MainApplication.kt` and add
the package to the `getPackages()` list:

```kotlin
import com.se7en.gymtracker.widget.Se7enWidgetPackage

override fun getPackages(): List<ReactPackage> = listOf(
    // ... existing packages ...
    Se7enWidgetPackage(),
)
```

### 3e. Verify AndroidManifest.xml

Confirm the config plugin wrote the receiver entries correctly. Open
`android/app/src/main/AndroidManifest.xml` and look for:

```xml
<receiver
    android:name="com.se7en.gymtracker.widget.Se7enWidget"
    android:exported="true">
    <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
        <action android:name="com.se7en.gymtracker.WIDGET_UPDATE" />
    </intent-filter>
    <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/se7en_widget_info" />
</receiver>
```

If it's missing, run `npx expo prebuild` again or add it manually.

---

## 4. EAS Build Notes

### eas.json configuration

The widget system requires a **development build** or a proper production build.
It will not work in Expo Go.

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  }
}
```

### iOS EAS Build

EAS Cloud does not automatically add the widget extension target. You have two options:

**Option A — Local prebuild + archive:**
1. Run `npx expo prebuild --clean`
2. Follow the Xcode steps above
3. Archive and upload via Xcode Organizer

**Option B — Custom EAS build hook:**
Add a `eas-build-pre-install.sh` that copies the Swift files and uses `xcodegen`
or `tuist` to add the target programmatically. This is an advanced setup.

For the MVP, Option A is recommended.

### Android EAS Build

Android widgets work with standard EAS Cloud builds after:
1. Committing the copied Kotlin/layout/XML files to the repo
2. Registering `Se7enWidgetPackage` in `MainApplication.kt`
3. Pushing and running `eas build --platform android`

---

## 5. Testing

### iOS

1. Build and run on a physical device (WidgetKit does not work fully in the Simulator).
2. Long-press the home screen → tap `+` → search "Se7en".
3. Start a workout in the app and observe the widget updating.
4. Test Live Activities: start a session and check the Lock Screen and Dynamic Island.

### Android

1. Build and install via `adb install` or Android Studio.
2. Long-press the home screen → Widgets → Se7en.
3. Tap the widget to open the app; start a session and observe updates.

---

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Widget shows stale data | App Group not set on both targets | Re-add the App Group capability and re-sign |
| Live Activity not starting | `NSSupportsLiveActivities` missing | Verify Info.plist or re-run prebuild |
| "Se7enWidgets" module null on Android | Package not registered | Add `Se7enWidgetPackage()` to `MainApplication.kt` |
| Widget not appearing in Android picker | Receiver not in manifest / missing meta-data resource | Verify manifest and resource copy steps |
| TypeScript errors on `widgetService` | Missing `@react-native-async-storage/async-storage` types | Already a dependency — run `npm install` |
