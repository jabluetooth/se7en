// Se7enWidget.kt
// AppWidget provider for Se7en gym tracker (Android).
// Package: com.se7en.gymtracker.widget
//
// Reads JSON from SharedPreferences key "se7en_widget_state" and renders
// medium (2×2) and large (4×2) RemoteViews layouts.

package com.se7en.gymtracker.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject

class Se7enWidget : AppWidgetProvider() {

    companion object {
        const val ACTION_WIDGET_UPDATE = "com.se7en.gymtracker.WIDGET_UPDATE"
        const val PREFS_NAME = "se7en_widget_prefs"
        const val PREFS_KEY = "se7en_widget_state"

        // ── Helpers ─────────────────────────────────────────────────────────

        fun readState(context: Context): WidgetState? {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val json = prefs.getString(PREFS_KEY, null) ?: return null
            return try {
                WidgetState.fromJson(JSONObject(json))
            } catch (_: Exception) {
                null
            }
        }

        fun formatElapsed(secs: Int): String {
            val m = secs / 60
            val s = secs % 60
            return "$m:${s.toString().padStart(2, '0')}"
        }

        fun formatRest(secs: Int): String {
            if (secs < 60) return ":${secs.toString().padStart(2, '0')}"
            val m = secs / 60
            val s = secs % 60
            return "$m:${s.toString().padStart(2, '0')}"
        }

        /** Update all widget instances. */
        fun updateAllWidgets(context: Context) {
            val awm = AppWidgetManager.getInstance(context)
            val component = ComponentName(context, Se7enWidget::class.java)
            val ids = awm.getAppWidgetIds(component)
            if (ids.isNotEmpty()) {
                val provider = Se7enWidget()
                provider.onUpdate(context, awm, ids)
            }
        }
    }

    // ── AppWidgetProvider overrides ─────────────────────────────────────────

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        val state = readState(context)
        for (id in appWidgetIds) {
            val family = appWidgetManager.getAppWidgetInfo(id)?.minWidth ?: 0
            val isLarge = family >= 250 // heuristic: large widget is ~4 cells wide
            val views = buildViews(context, state, isLarge)
            appWidgetManager.updateAppWidget(id, views)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_WIDGET_UPDATE) {
            updateAllWidgets(context)
        }
    }

    // ── RemoteViews builder ─────────────────────────────────────────────────

    private fun buildViews(context: Context, state: WidgetState?, isLarge: Boolean): RemoteViews {
        val layout = if (isLarge) R.layout.widget_large else R.layout.widget_medium
        val views = RemoteViews(context.packageName, layout)

        // Tap to open app
        val launchIntent = context.packageManager
            .getLaunchIntentForPackage(context.packageName)
            ?.apply { flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP }
        val pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        val pendingIntent = if (launchIntent != null)
            PendingIntent.getActivity(context, 0, launchIntent, pendingFlags)
        else null

        views.setOnClickPendingIntent(android.R.id.background, pendingIntent)

        if (state == null || !state.isActive) {
            // ── Idle state ────────────────────────────────────────────────
            views.setTextViewText(R.id.widget_exercise_name, "Se7en")
            views.setTextViewText(R.id.widget_set_counter, "No session")
            views.setTextViewText(R.id.widget_volume, "")
            views.setTextViewText(R.id.widget_timer, "")
            views.setViewVisibility(R.id.widget_rest_label, View.GONE)

            if (isLarge) {
                val nextLabel = if (state?.nextDayLabel.isNullOrBlank()) "Rest Day" else state?.nextDayLabel ?: "Rest Day"
                views.setTextViewText(R.id.widget_next_day, nextLabel)
                views.setTextViewText(R.id.widget_next_ex1, state?.nextExercises?.getOrNull(0) ?: "")
                views.setTextViewText(R.id.widget_next_ex2, state?.nextExercises?.getOrNull(1) ?: "")
                views.setTextViewText(R.id.widget_next_ex3, state?.nextExercises?.getOrNull(2) ?: "")
                views.setViewVisibility(R.id.widget_progress_bar, View.GONE)
            }
            return views
        }

        // ── Active session ────────────────────────────────────────────────
        views.setTextViewText(R.id.widget_exercise_name, state.exerciseName)

        val setCounter = if (state.restActive)
            "Rest ${formatRest(state.restRemaining)}"
        else
            "Set ${state.setNum}/${state.setTotal}"
        views.setTextViewText(R.id.widget_set_counter, setCounter)

        views.setTextViewText(R.id.widget_volume, "${state.sessionVolume} ${state.weightUnit}")
        views.setTextViewText(R.id.widget_timer, formatElapsed(state.elapsedSecs))

        if (state.restActive) {
            views.setViewVisibility(R.id.widget_rest_label, View.VISIBLE)
            views.setTextViewText(R.id.widget_rest_label, "Resting ${formatRest(state.restRemaining)}")
        } else {
            views.setViewVisibility(R.id.widget_rest_label, View.GONE)
        }

        if (isLarge) {
            // Day label
            views.setTextViewText(R.id.widget_next_day, state.dayLabel)
            // Top 3 exercises (active session shows current plan)
            views.setTextViewText(R.id.widget_next_ex1, state.exerciseName)
            views.setTextViewText(R.id.widget_next_ex2, "")
            views.setTextViewText(R.id.widget_next_ex3, "")
            views.setViewVisibility(R.id.widget_progress_bar, View.VISIBLE)

            // Set progress (0–10000 for ProgressBar max=10000)
            val progressPercent = if (state.totalSets > 0)
                (state.setsCompleted * 10000 / state.totalSets)
            else 0
            views.setProgressBar(R.id.widget_progress_bar, 10000, progressPercent, false)
        }

        return views
    }
}

// ── WidgetState data class ────────────────────────────────────────────────────

data class WidgetState(
    val isActive: Boolean,
    val planName: String,
    val dayLabel: String,
    val dayNum: Int,
    val exerciseName: String,
    val setNum: Int,
    val setTotal: Int,
    val targetWeight: Double?,
    val targetRepsLabel: String,
    val weightUnit: String,
    val setsCompleted: Int,
    val totalSets: Int,
    val sessionVolume: Int,
    val elapsedSecs: Int,
    val restActive: Boolean,
    val restRemaining: Int,
    val restTotal: Int,
    val restEndEpoch: Long,
    val nextDayLabel: String,
    val nextDayNum: Int,
    val nextExercises: List<String>,
    val coachSummary: String,
    val weekVolume: Int,
    val weekSessions: Int,
    val streakDays: Int,
) {
    companion object {
        fun fromJson(json: JSONObject): WidgetState {
            val nextExArray = json.optJSONArray("nextExercises")
            val nextExercises = mutableListOf<String>()
            if (nextExArray != null) {
                for (i in 0 until nextExArray.length()) {
                    nextExercises.add(nextExArray.getString(i))
                }
            }
            return WidgetState(
                isActive =         json.optBoolean("isActive", false),
                planName =         json.optString("planName", ""),
                dayLabel =         json.optString("dayLabel", ""),
                dayNum =           json.optInt("dayNum", 0),
                exerciseName =     json.optString("exerciseName", ""),
                setNum =           json.optInt("setNum", 0),
                setTotal =         json.optInt("setTotal", 0),
                targetWeight =     if (json.has("targetWeight") && !json.isNull("targetWeight"))
                                       json.getDouble("targetWeight") else null,
                targetRepsLabel =  json.optString("targetRepsLabel", ""),
                weightUnit =       json.optString("weightUnit", "kg"),
                setsCompleted =    json.optInt("setsCompleted", 0),
                totalSets =        json.optInt("totalSets", 0),
                sessionVolume =    json.optInt("sessionVolume", 0),
                elapsedSecs =      json.optInt("elapsedSecs", 0),
                restActive =       json.optBoolean("restActive", false),
                restRemaining =    json.optInt("restRemaining", 0),
                restTotal =        json.optInt("restTotal", 0),
                restEndEpoch =     json.optLong("restEndEpoch", 0L),
                nextDayLabel =     json.optString("nextDayLabel", ""),
                nextDayNum =       json.optInt("nextDayNum", 0),
                nextExercises =    nextExercises,
                coachSummary =     json.optString("coachSummary", ""),
                weekVolume =       json.optInt("weekVolume", 0),
                weekSessions =     json.optInt("weekSessions", 0),
                streakDays =       json.optInt("streakDays", 0),
            )
        }
    }
}
