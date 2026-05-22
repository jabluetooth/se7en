// Se7enWidgetModule.kt
// React Native NativeModule for Android.
// Writes widget data to SharedPreferences and triggers an AppWidget update broadcast.

package com.se7en.gymtracker.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class Se7enWidgetModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "Se7enWidgets"

    /**
     * Receives the serialised WidgetState JSON from the JS layer and stores it
     * in SharedPreferences so the AppWidget provider can read it on the next update.
     * Also immediately triggers a widget refresh.
     */
    @ReactMethod
    fun setWidgetData(json: String) {
        try {
            val prefs = reactContext.getSharedPreferences(
                Se7enWidget.PREFS_NAME,
                Context.MODE_PRIVATE,
            )
            prefs.edit().putString(Se7enWidget.PREFS_KEY, json).apply()
            // Trigger a widget refresh immediately after writing new data
            refreshWidgets()
        } catch (_: Exception) {
            // Never throw back to JS
        }
    }

    /**
     * Sends an AppWidgetManager.ACTION_APPWIDGET_UPDATE broadcast to force all
     * Se7en widget instances to redraw with fresh data.
     */
    @ReactMethod
    fun refreshWidgets() {
        try {
            val awm = AppWidgetManager.getInstance(reactContext)
            val component = ComponentName(reactContext, Se7enWidget::class.java)
            val ids = awm.getAppWidgetIds(component)
            if (ids.isNotEmpty()) {
                val intent = Intent(reactContext, Se7enWidget::class.java).apply {
                    action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
                }
                reactContext.sendBroadcast(intent)
            }
        } catch (_: Exception) {
            // Never throw back to JS
        }
    }

    // Also expose reloadWidgets as an alias for iOS API parity
    @ReactMethod
    fun reloadWidgets() = refreshWidgets()
}
