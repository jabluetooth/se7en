// SharedData.swift
// Se7en — App Group UserDefaults bridge between the main app and WidgetKit extension.
// App Group: group.com.se7en.gymtracker

import Foundation

private let appGroupID = "group.com.se7en.gymtracker"
private let widgetDataKey = "se7en_widget_state"

// MARK: - WidgetData (Codable mirror of the JS WidgetState)

struct WidgetData: Codable {
    // session status
    var isActive: Bool
    // workout context
    var planName: String
    var dayLabel: String
    var dayNum: Int
    var cycleNum: Int
    // current exercise
    var exerciseName: String
    var setNum: Int
    var setTotal: Int
    var targetWeight: Double?
    var targetRepsLabel: String
    var weightUnit: String
    // session stats
    var setsCompleted: Int
    var totalSets: Int
    var sessionVolume: Int
    var elapsedSecs: Int
    // rest timer
    var restActive: Bool
    var restRemaining: Int
    var restTotal: Int
    var restEndEpoch: Double   // unix milliseconds
    // next workout (idle state)
    var nextDayLabel: String
    var nextDayNum: Int
    var nextExercises: [String]
    // coach widget
    var coachSummary: String
    // progress snapshot
    var weekVolume: Int
    var weekSessions: Int
    var streakDays: Int
    var updatedAt: Double

    // MARK: Fallback default
    static var placeholder: WidgetData {
        WidgetData(
            isActive: false,
            planName: "Se7en",
            dayLabel: "Day 1",
            dayNum: 1,
            cycleNum: 1,
            exerciseName: "Bench Press",
            setNum: 1,
            setTotal: 4,
            targetWeight: 80,
            targetRepsLabel: "8–12",
            weightUnit: "kg",
            setsCompleted: 0,
            totalSets: 20,
            sessionVolume: 0,
            elapsedSecs: 0,
            restActive: false,
            restRemaining: 0,
            restTotal: 90,
            restEndEpoch: 0,
            nextDayLabel: "Pull Day",
            nextDayNum: 2,
            nextExercises: ["Pull-ups", "Barbell Row", "Face Pulls"],
            coachSummary: "Great work this week! Consider adding weight to your bench.",
            weekVolume: 12500,
            weekSessions: 3,
            streakDays: 4,
            updatedAt: 0
        )
    }
}

// MARK: - SharedData

enum SharedData {
    // MARK: Read
    static func readWidgetData() -> WidgetData {
        guard
            let defaults = UserDefaults(suiteName: appGroupID),
            let jsonString = defaults.string(forKey: widgetDataKey),
            let data = jsonString.data(using: .utf8)
        else {
            return .placeholder
        }

        do {
            return try JSONDecoder().decode(WidgetData.self, from: data)
        } catch {
            // Return placeholder rather than crashing the widget extension
            return .placeholder
        }
    }

    // MARK: Write
    static func writeWidgetData(_ widgetData: WidgetData) {
        guard let defaults = UserDefaults(suiteName: appGroupID) else { return }
        do {
            let data = try JSONEncoder().encode(widgetData)
            let jsonString = String(data: data, encoding: .utf8)
            defaults.set(jsonString, forKey: widgetDataKey)
        } catch {
            // Silently fail — widget will show stale data
        }
    }

    // MARK: Write from raw JSON string (called from the native module)
    static func writeWidgetDataJSON(_ jsonString: String) {
        guard let defaults = UserDefaults(suiteName: appGroupID) else { return }
        defaults.set(jsonString, forKey: widgetDataKey)
    }
}
