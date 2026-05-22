// Se7enWidgetsBridge.swift
// React Native NativeModule implementation.
// Compiled in the *main app target*.
// Writes widget data to App Group UserDefaults and calls WidgetCenter/ActivityKit.

import Foundation
import WidgetKit

#if canImport(ActivityKit)
import ActivityKit
#endif

@objc(Se7enWidgets)
class Se7enWidgets: NSObject {

    // MARK: - RCTBridgeModule requirement

    @objc static func requiresMainQueueSetup() -> Bool { false }

    // MARK: - setWidgetData

    /// Receives the serialised WidgetState JSON from the JS layer and stores it
    /// in the App Group UserDefaults so the widget extension can read it.
    @objc func setWidgetData(_ json: String) {
        SharedData.writeWidgetDataJSON(json)
    }

    // MARK: - reloadWidgets

    /// Asks WidgetKit to reload all timeline entries immediately.
    @objc func reloadWidgets() {
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
    }

    // MARK: - startLiveActivity

    /// Starts an ActivityKit Live Activity with the supplied ContentState JSON.
    @objc func startLiveActivity(_ json: String) {
        guard #available(iOS 16.1, *) else { return }

        #if canImport(ActivityKit)
        guard
            let data = json.data(using: .utf8),
            let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return }

        // End any existing activity first
        Task {
            for activity in Activity<Se7enActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }

            let state = buildContentState(from: dict)
            let attributes = Se7enActivityAttributes(
                dayLabel: (dict["dayLabel"] as? String) ?? "",
                planName: (dict["planName"] as? String) ?? ""
            )

            do {
                let _ = try Activity<Se7enActivityAttributes>.request(
                    attributes: attributes,
                    contentState: state,
                    pushType: nil
                )
            } catch {
                // Live Activity may not be supported on this device/OS version
            }
        }
        #endif
    }

    // MARK: - updateLiveActivity

    /// Updates the running Live Activity's ContentState.
    @objc func updateLiveActivity(_ json: String) {
        guard #available(iOS 16.1, *) else { return }

        #if canImport(ActivityKit)
        guard
            let data = json.data(using: .utf8),
            let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return }

        let state = buildContentState(from: dict)

        Task {
            for activity in Activity<Se7enActivityAttributes>.activities {
                await activity.update(using: state)
            }
        }
        #endif
    }

    // MARK: - endLiveActivity

    /// Ends all running Live Activities with an immediate dismissal policy.
    @objc func endLiveActivity() {
        guard #available(iOS 16.1, *) else { return }

        #if canImport(ActivityKit)
        Task {
            for activity in Activity<Se7enActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
        }
        #endif
    }

    // MARK: - Private helpers

    @available(iOS 16.1, *)
    private func buildContentState(from dict: [String: Any]) -> Se7enActivityAttributes.ContentState {
        Se7enActivityAttributes.ContentState(
            exerciseName:    (dict["exerciseName"]    as? String) ?? "",
            setNum:          (dict["setNum"]          as? Int)    ?? 0,
            setTotal:        (dict["setTotal"]        as? Int)    ?? 0,
            targetWeight:    dict["targetWeight"]     as? Double,
            targetRepsLabel: (dict["targetRepsLabel"] as? String) ?? "",
            setsCompleted:   (dict["setsCompleted"]   as? Int)    ?? 0,
            totalSets:       (dict["totalSets"]       as? Int)    ?? 0,
            sessionVolume:   (dict["sessionVolume"]   as? Int)    ?? 0,
            elapsedSecs:     (dict["elapsedSecs"]     as? Int)    ?? 0,
            restActive:      (dict["restActive"]      as? Bool)   ?? false,
            restRemaining:   (dict["restRemaining"]   as? Int)    ?? 0,
            restTotal:       (dict["restTotal"]       as? Int)    ?? 0,
            restEndEpoch:    (dict["restEndEpoch"]    as? Double) ?? 0,
            dayLabel:        (dict["dayLabel"]        as? String) ?? "",
            planName:        (dict["planName"]        as? String) ?? ""
        )
    }
}
