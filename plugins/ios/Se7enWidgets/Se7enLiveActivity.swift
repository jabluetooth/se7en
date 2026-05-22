// Se7enLiveActivity.swift
// ActivityKit Live Activity for Se7en gym tracker.
// Supports: Lock Screen (compact + expanded), Dynamic Island (compact + expanded).
// iOS 16.1+ required for Live Activities.

import ActivityKit
import SwiftUI
import WidgetKit

// MARK: - Attributes

public struct Se7enActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var exerciseName: String
        var setNum: Int
        var setTotal: Int
        var targetWeight: Double?
        var targetRepsLabel: String
        var setsCompleted: Int
        var totalSets: Int
        var sessionVolume: Int
        var elapsedSecs: Int
        var restActive: Bool
        var restRemaining: Int
        var restTotal: Int
        var restEndEpoch: Double  // unix milliseconds
        var dayLabel: String
        var planName: String
    }

    public var dayLabel: String
    public var planName: String

    public init(dayLabel: String, planName: String) {
        self.dayLabel = dayLabel
        self.planName = planName
    }
}

// MARK: - Color constants (duplicated from Se7enWidgets to keep the target self-contained)

private extension Color {
    static let obsidian    = Color(red: 0.047, green: 0.039, blue: 0.031)
    static let amber       = Color(red: 1.0,   green: 0.549, blue: 0.0)
    static let amberHigh   = Color(red: 1.0,   green: 0.663, blue: 0.251)
    static let skyBlue     = Color(red: 0.392, green: 0.824, blue: 1.0)
    static let warmWhite   = Color(red: 1.0,   green: 0.973, blue: 0.941)
    static let muted       = Color(red: 0.541, green: 0.478, blue: 0.416)
}

// MARK: - Helpers

private func formatElapsed(_ secs: Int) -> String {
    let m = secs / 60
    let s = secs % 60
    return "\(m):\(String(format: "%02d", s))"
}

private func formatRest(_ secs: Int) -> String {
    if secs < 60 { return ":\(String(format: "%02d", secs))" }
    let m = secs / 60
    let s = secs % 60
    return "\(m):\(String(format: "%02d", s))"
}

// MARK: - Compact ring (used in Dynamic Island)

private struct CompactRingView: View {
    var progress: Double
    var color: Color
    var size: CGFloat = 24
    var lineWidth: CGFloat = 3

    var body: some View {
        ZStack {
            Circle().stroke(color.opacity(0.15), lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: progress)
                .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
        .frame(width: size, height: size)
    }
}

// MARK: - Live Activity Widget

struct Se7enLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: Se7enActivityAttributes.self) { context in
            // ── Lock screen / notification banner UI ─────────────────────
            LockScreenView(context: context)
                .activityBackgroundTint(Color.obsidian)
                .activitySystemActionForegroundColor(.warmWhite)
        } dynamicIsland: { context in
            DynamicIsland {
                // ── Dynamic Island expanded ──────────────────────────────
                DynamicIslandExpandedRegion(.leading) {
                    ExpandedLeadingView(state: context.state)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    ExpandedTrailingView(state: context.state)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    ExpandedBottomView(state: context.state, attributes: context.attributes)
                }
                DynamicIslandExpandedRegion(.center) {
                    ExpandedCenterView(state: context.state)
                }
            } compactLeading: {
                // ── Compact left: rest ring or set ring ──────────────────
                let s = context.state
                if s.restActive {
                    let prog = s.restTotal > 0 ? Double(s.restRemaining) / Double(s.restTotal) : 0
                    CompactRingView(progress: prog, color: .skyBlue)
                } else {
                    let prog = s.totalSets > 0 ? Double(s.setsCompleted) / Double(s.totalSets) : 0
                    CompactRingView(progress: prog, color: .amber)
                }
            } compactTrailing: {
                // ── Compact right: exercise name truncated ───────────────
                let s = context.state
                Text(s.restActive ? formatRest(s.restRemaining) : s.exerciseName)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(s.restActive ? .skyBlue : .warmWhite)
                    .lineLimit(1)
            } minimal: {
                // ── Minimal: ring only ───────────────────────────────────
                let s = context.state
                if s.restActive {
                    let prog = s.restTotal > 0 ? Double(s.restRemaining) / Double(s.restTotal) : 0
                    CompactRingView(progress: prog, color: .skyBlue, size: 20, lineWidth: 2.5)
                } else {
                    let prog = s.totalSets > 0 ? Double(s.setsCompleted) / Double(s.totalSets) : 0
                    CompactRingView(progress: prog, color: .amber, size: 20, lineWidth: 2.5)
                }
            }
            .keylineTint(context.state.restActive ? .skyBlue : .amber)
            .widgetURL(URL(string: "se7en://session"))
        }
    }
}

// MARK: - Lock Screen view

private struct LockScreenView: View {
    let context: ActivityViewContext<Se7enActivityAttributes>
    @Environment(\.isLuminanceReduced) private var isLuminanceReduced

    private var s: Se7enActivityAttributes.ContentState { context.state }
    private var setProgress: Double {
        s.totalSets > 0 ? Double(s.setsCompleted) / Double(s.totalSets) : 0
    }
    private var restProgress: Double {
        s.restTotal > 0 ? Double(s.restRemaining) / Double(s.restTotal) : 0
    }

    var body: some View {
        HStack(spacing: 14) {
            // Ring
            ZStack {
                if s.restActive {
                    CompactRingView(progress: restProgress, color: .skyBlue, size: 52, lineWidth: 5)
                    VStack(spacing: 0) {
                        Text(formatRest(s.restRemaining))
                            .font(.system(size: 12, weight: .heavy, design: .monospaced))
                            .foregroundColor(isLuminanceReduced ? .white : .skyBlue)
                        Text("rest")
                            .font(.system(size: 8))
                            .foregroundColor(.muted)
                    }
                } else {
                    CompactRingView(progress: setProgress, color: .amber, size: 52, lineWidth: 5)
                    VStack(spacing: 0) {
                        Text("\(s.setsCompleted)")
                            .font(.system(size: 16, weight: .black))
                            .foregroundColor(isLuminanceReduced ? .white : .amber)
                        Text("/\(s.totalSets)")
                            .font(.system(size: 9))
                            .foregroundColor(.muted)
                    }
                }
            }

            // Exercise info
            VStack(alignment: .leading, spacing: 3) {
                Text(s.exerciseName)
                    .font(.system(size: 15, weight: .heavy))
                    .foregroundColor(.warmWhite)
                    .lineLimit(1)
                Text("Set \(s.setNum) of \(s.setTotal) · \(context.attributes.dayLabel)")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(.muted)
                if !s.targetRepsLabel.isEmpty {
                    Text("\(s.targetRepsLabel) reps" + (s.targetWeight.map { " @ \(Int($0)) kg" } ?? ""))
                        .font(.system(size: 10))
                        .foregroundColor(isLuminanceReduced ? .warmWhite : .amber.opacity(0.8))
                }
            }

            Spacer()

            // Session timer + volume
            VStack(alignment: .trailing, spacing: 4) {
                Text(formatElapsed(s.elapsedSecs))
                    .font(.system(size: 13, weight: .bold, design: .monospaced))
                    .foregroundColor(.warmWhite)
                Text("\(s.sessionVolume) kg")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(isLuminanceReduced ? .warmWhite : .amber)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }
}

// MARK: - Dynamic Island expanded sub-views

private struct ExpandedLeadingView: View {
    let state: Se7enActivityAttributes.ContentState
    @Environment(\.isLuminanceReduced) private var isLuminanceReduced

    private var setProgress: Double {
        state.totalSets > 0 ? Double(state.setsCompleted) / Double(state.totalSets) : 0
    }
    private var restProgress: Double {
        state.restTotal > 0 ? Double(state.restRemaining) / Double(state.restTotal) : 0
    }

    var body: some View {
        ZStack {
            if state.restActive {
                CompactRingView(progress: restProgress, color: .skyBlue, size: 44, lineWidth: 4)
                Text(formatRest(state.restRemaining))
                    .font(.system(size: 10, weight: .heavy, design: .monospaced))
                    .foregroundColor(isLuminanceReduced ? .white : .skyBlue)
            } else {
                CompactRingView(progress: setProgress, color: .amber, size: 44, lineWidth: 4)
                VStack(spacing: 0) {
                    Text("\(state.setsCompleted)")
                        .font(.system(size: 13, weight: .black))
                        .foregroundColor(isLuminanceReduced ? .white : .amber)
                    Text("/\(state.totalSets)")
                        .font(.system(size: 8))
                        .foregroundColor(.muted)
                }
            }
        }
        .padding(.leading, 8)
    }
}

private struct ExpandedTrailingView: View {
    let state: Se7enActivityAttributes.ContentState
    @Environment(\.isLuminanceReduced) private var isLuminanceReduced

    var body: some View {
        VStack(alignment: .trailing, spacing: 2) {
            Text(formatElapsed(state.elapsedSecs))
                .font(.system(size: 12, weight: .bold, design: .monospaced))
                .foregroundColor(.warmWhite)
            Text("\(state.sessionVolume) kg")
                .font(.system(size: 10))
                .foregroundColor(isLuminanceReduced ? .warmWhite : .amber)
        }
        .padding(.trailing, 8)
    }
}

private struct ExpandedCenterView: View {
    let state: Se7enActivityAttributes.ContentState

    var body: some View {
        VStack(spacing: 2) {
            Text(state.exerciseName)
                .font(.system(size: 13, weight: .heavy))
                .foregroundColor(.warmWhite)
                .lineLimit(1)
            Text("Set \(state.setNum)/\(state.setTotal)")
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(.amber.opacity(0.8))
        }
    }
}

private struct ExpandedBottomView: View {
    let state: Se7enActivityAttributes.ContentState
    let attributes: Se7enActivityAttributes
    @Environment(\.isLuminanceReduced) private var isLuminanceReduced

    private var setProgress: Double {
        state.totalSets > 0 ? Double(state.setsCompleted) / Double(state.totalSets) : 0
    }

    var body: some View {
        VStack(spacing: 6) {
            // Progress bar
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color.amber.opacity(0.15))
                        .frame(height: 4)
                    Capsule()
                        .fill(isLuminanceReduced
                              ? Color.white
                              : LinearGradient(colors: [Color.amber, Color.amberHigh], startPoint: .leading, endPoint: .trailing))
                        .frame(width: geo.size.width * setProgress, height: 4)
                }
            }
            .frame(height: 4)
            .padding(.horizontal, 16)

            // Target info row
            if !state.targetRepsLabel.isEmpty || state.targetWeight != nil {
                HStack(spacing: 12) {
                    if !state.targetRepsLabel.isEmpty {
                        Label(state.targetRepsLabel + " reps", systemImage: "repeat")
                            .font(.system(size: 10))
                            .foregroundColor(isLuminanceReduced ? .warmWhite : .muted)
                    }
                    if let w = state.targetWeight, w > 0 {
                        Label("\(Int(w)) kg", systemImage: "scalemass")
                            .font(.system(size: 10))
                            .foregroundColor(isLuminanceReduced ? .warmWhite : .muted)
                    }
                    Spacer()
                    Text(attributes.planName)
                        .font(.system(size: 9))
                        .foregroundColor(.muted)
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 4)
            }
        }
    }
}
