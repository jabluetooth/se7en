// Se7enWidgets.swift
// Full WidgetKit extension for Se7en gym tracker.
// Supports: small, medium, large, coach (small), nextWorkout (small).
// Color system: obsidian bg #0C0A08, amber accent #FF8C00, sky rest #64D2FF,
//               warm white text #FFF8F0, muted #8A7A6A.

import SwiftUI
import WidgetKit

// MARK: - Color constants

private extension Color {
    static let obsidian    = Color(red: 0.047, green: 0.039, blue: 0.031)   // #0C0A08
    static let amber       = Color(red: 1.0,   green: 0.549, blue: 0.0)    // #FF8C00
    static let amberHigh   = Color(red: 1.0,   green: 0.663, blue: 0.251)  // #FFA940
    static let skyBlue     = Color(red: 0.392, green: 0.824, blue: 1.0)    // #64D2FF
    static let warmWhite   = Color(red: 1.0,   green: 0.973, blue: 0.941)  // #FFF8F0
    static let muted       = Color(red: 0.541, green: 0.478, blue: 0.416)  // #8A7A6A
    static let surface     = Color(red: 0.102, green: 0.082, blue: 0.063)  // #1A1510
}

// MARK: - Timeline Entry

struct WidgetEntry: TimelineEntry {
    let date: Date
    let data: WidgetData
}

// MARK: - Timeline Provider

struct Se7enProvider: TimelineProvider {
    func placeholder(in context: Context) -> WidgetEntry {
        WidgetEntry(date: .now, data: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (WidgetEntry) -> Void) {
        completion(WidgetEntry(date: .now, data: SharedData.readWidgetData()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WidgetEntry>) -> Void) {
        let data = SharedData.readWidgetData()
        let entry = WidgetEntry(date: .now, data: data)

        // Refresh every 5 min during active session, 30 min when idle
        let refreshInterval: TimeInterval = data.isActive ? 5 * 60 : 30 * 60
        let nextRefresh = Date(timeIntervalSinceNow: refreshInterval)
        let timeline = Timeline(entries: [entry], policy: .after(nextRefresh))
        completion(timeline)
    }
}

// MARK: - Shared sub-views

/// Circular progress ring used in multiple widget sizes
struct RingView: View {
    var progress: Double        // 0.0 – 1.0
    var ringColor: Color
    var trackColor: Color
    var lineWidth: CGFloat = 6
    var size: CGFloat = 44

    var body: some View {
        ZStack {
            Circle()
                .stroke(trackColor, lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: progress)
                .stroke(
                    AngularGradient(
                        gradient: Gradient(colors: [ringColor, ringColor.opacity(0.6)]),
                        center: .center,
                        startAngle: .degrees(-90),
                        endAngle: .degrees(270)
                    ),
                    style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
        }
        .frame(width: size, height: size)
    }
}

/// Format elapsed seconds as m:ss
private func formatElapsed(_ secs: Int) -> String {
    let m = secs / 60
    let s = secs % 60
    return "\(m):\(String(format: "%02d", s))"
}

/// Format rest remaining as :ss or m:ss
private func formatRest(_ secs: Int) -> String {
    if secs < 60 { return ":\(String(format: "%02d", secs))" }
    let m = secs / 60
    let s = secs % 60
    return "\(m):\(String(format: "%02d", s))"
}

// MARK: - Small widget (active session / rest timer)

struct SmallWidgetView: View {
    let entry: WidgetEntry

    private var d: WidgetData { entry.data }
    private var setProgress: Double {
        d.totalSets > 0 ? Double(d.setsCompleted) / Double(d.totalSets) : 0
    }
    private var restProgress: Double {
        d.restTotal > 0 ? Double(d.restRemaining) / Double(d.restTotal) : 0
    }

    var body: some View {
        ZStack {
            Color.obsidian.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 4) {
                // Header row: app icon stub + plan label
                HStack(spacing: 6) {
                    RoundedRectangle(cornerRadius: 5)
                        .fill(Color.amber)
                        .frame(width: 20, height: 20)
                        .overlay(
                            Text("7")
                                .font(.system(size: 11, weight: .black))
                                .foregroundColor(.black)
                        )
                    Text(d.isActive ? d.dayLabel : "Se7en")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(.muted)
                        .lineLimit(1)
                    Spacer()
                }

                Spacer()

                // Centre: rest ring or set ring
                HStack(spacing: 10) {
                    if d.restActive {
                        ZStack {
                            RingView(
                                progress: restProgress,
                                ringColor: .skyBlue,
                                trackColor: Color.skyBlue.opacity(0.15),
                                lineWidth: 5,
                                size: 40
                            )
                            Text(formatRest(d.restRemaining))
                                .font(.system(size: 10, weight: .heavy, design: .monospaced))
                                .foregroundColor(.skyBlue)
                        }
                    } else {
                        ZStack {
                            RingView(
                                progress: setProgress,
                                ringColor: .amber,
                                trackColor: Color.amber.opacity(0.15),
                                lineWidth: 5,
                                size: 40
                            )
                            Text("\(d.setsCompleted)")
                                .font(.system(size: 12, weight: .black))
                                .foregroundColor(.amber)
                        }
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text(d.isActive ? d.exerciseName : "No session")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(.warmWhite)
                            .lineLimit(2)
                        if d.isActive {
                            Text(d.restActive ? "resting" : "Set \(d.setNum)/\(d.setTotal)")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundColor(.muted)
                        }
                    }
                }

                Spacer()

                // Bottom: session timer / volume
                if d.isActive {
                    HStack {
                        Label(formatElapsed(d.elapsedSecs), systemImage: "clock")
                            .font(.system(size: 9, weight: .medium))
                            .foregroundColor(.muted)
                        Spacer()
                        Text("\(d.sessionVolume) \(d.weightUnit)")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(.amber)
                    }
                }
            }
            .padding(12)
        }
    }
}

// MARK: - Medium widget (exercise name + set progress + timer + volume bar)

struct MediumWidgetView: View {
    let entry: WidgetEntry

    private var d: WidgetData { entry.data }
    private var setProgress: Double {
        d.totalSets > 0 ? Double(d.setsCompleted) / Double(d.totalSets) : 0
    }

    var body: some View {
        ZStack {
            Color.obsidian.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 6) {
                // ── Header ──────────────────────────────────────────────
                HStack(spacing: 8) {
                    RoundedRectangle(cornerRadius: 6)
                        .fill(LinearGradient(
                            colors: [Color.amber, Color.amberHigh],
                            startPoint: .topLeading, endPoint: .bottomTrailing
                        ))
                        .frame(width: 26, height: 26)
                        .overlay(
                            Text("7")
                                .font(.system(size: 14, weight: .black))
                                .foregroundColor(.black)
                        )
                    VStack(alignment: .leading, spacing: 1) {
                        Text(d.planName.isEmpty ? "Se7en" : d.planName)
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(.muted)
                        Text(d.isActive ? d.dayLabel : "No Active Session")
                            .font(.system(size: 13, weight: .heavy))
                            .foregroundColor(.warmWhite)
                            .lineLimit(1)
                    }
                    Spacer()
                    if d.isActive {
                        VStack(alignment: .trailing, spacing: 1) {
                            Text(formatElapsed(d.elapsedSecs))
                                .font(.system(size: 13, weight: .bold, design: .monospaced))
                                .foregroundColor(.warmWhite)
                            Text("elapsed")
                                .font(.system(size: 9))
                                .foregroundColor(.muted)
                        }
                    }
                }

                Divider().background(Color.muted.opacity(0.3))

                // ── Current exercise + set info ──────────────────────────
                if d.isActive {
                    HStack(alignment: .center, spacing: 12) {
                        // Set ring
                        ZStack {
                            RingView(
                                progress: d.restActive ? Double(d.restRemaining) / max(Double(d.restTotal), 1) : setProgress,
                                ringColor: d.restActive ? .skyBlue : .amber,
                                trackColor: (d.restActive ? Color.skyBlue : Color.amber).opacity(0.12),
                                lineWidth: 6,
                                size: 52
                            )
                            if d.restActive {
                                VStack(spacing: 0) {
                                    Text(formatRest(d.restRemaining))
                                        .font(.system(size: 11, weight: .heavy, design: .monospaced))
                                        .foregroundColor(.skyBlue)
                                    Text("rest")
                                        .font(.system(size: 8))
                                        .foregroundColor(.skyBlue.opacity(0.7))
                                }
                            } else {
                                VStack(spacing: 0) {
                                    Text("\(d.setsCompleted)")
                                        .font(.system(size: 16, weight: .black))
                                        .foregroundColor(.amber)
                                    Text("/\(d.totalSets)")
                                        .font(.system(size: 9))
                                        .foregroundColor(.muted)
                                }
                            }
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            Text(d.exerciseName)
                                .font(.system(size: 15, weight: .heavy))
                                .foregroundColor(.warmWhite)
                                .lineLimit(2)
                            HStack(spacing: 8) {
                                if !d.targetRepsLabel.isEmpty {
                                    Label(d.targetRepsLabel + " reps", systemImage: "repeat")
                                        .font(.system(size: 10, weight: .medium))
                                        .foregroundColor(.muted)
                                }
                                if let w = d.targetWeight, w > 0 {
                                    Label("\(Int(w)) \(d.weightUnit)", systemImage: "scalemass")
                                        .font(.system(size: 10, weight: .medium))
                                        .foregroundColor(.muted)
                                }
                            }
                            Text("Set \(d.setNum) of \(d.setTotal)")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundColor(.amber.opacity(0.8))
                        }
                        Spacer()
                    }

                    // ── Volume progress bar ────────────────────────────────
                    Spacer()
                    HStack(spacing: 6) {
                        Text("Vol")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(.muted)
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule()
                                    .fill(Color.amber.opacity(0.12))
                                    .frame(height: 4)
                                Capsule()
                                    .fill(LinearGradient(colors: [Color.amber, Color.amberHigh], startPoint: .leading, endPoint: .trailing))
                                    .frame(width: geo.size.width * setProgress, height: 4)
                            }
                        }
                        .frame(height: 4)
                        Text("\(d.sessionVolume)")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(.amber)
                    }
                } else {
                    // Idle state — show next workout info
                    HStack(spacing: 10) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Next Workout")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.muted)
                            Text(d.nextDayLabel.isEmpty ? "Rest" : d.nextDayLabel)
                                .font(.system(size: 18, weight: .heavy))
                                .foregroundColor(.warmWhite)
                            ForEach(d.nextExercises.prefix(3), id: \.self) { name in
                                Text("• " + name)
                                    .font(.system(size: 10))
                                    .foregroundColor(.muted)
                            }
                        }
                        Spacer()
                        VStack(spacing: 8) {
                            StatBadge(value: "\(d.streakDays)", label: "streak", color: .amber)
                            StatBadge(value: "\(d.weekSessions)", label: "this wk", color: .skyBlue)
                        }
                    }
                }
            }
            .padding(14)
        }
    }
}

// MARK: - Large widget (full exercise list + stats grid)

struct LargeWidgetView: View {
    let entry: WidgetEntry

    private var d: WidgetData { entry.data }
    private var setProgress: Double {
        d.totalSets > 0 ? Double(d.setsCompleted) / Double(d.totalSets) : 0
    }

    var body: some View {
        ZStack {
            Color.obsidian.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 8) {
                // ── Header ──────────────────────────────────────────────
                HStack(spacing: 8) {
                    RoundedRectangle(cornerRadius: 7)
                        .fill(LinearGradient(
                            colors: [Color.amber, Color.amberHigh],
                            startPoint: .topLeading, endPoint: .bottomTrailing
                        ))
                        .frame(width: 32, height: 32)
                        .overlay(
                            Text("7")
                                .font(.system(size: 17, weight: .black))
                                .foregroundColor(.black)
                        )
                    VStack(alignment: .leading, spacing: 1) {
                        Text(d.planName.isEmpty ? "Se7en" : d.planName)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(.muted)
                        Text(d.isActive ? d.dayLabel : "No Active Session")
                            .font(.system(size: 16, weight: .heavy))
                            .foregroundColor(.warmWhite)
                    }
                    Spacer()
                    if d.isActive {
                        VStack(alignment: .trailing, spacing: 1) {
                            Text(formatElapsed(d.elapsedSecs))
                                .font(.system(size: 15, weight: .bold, design: .monospaced))
                                .foregroundColor(.warmWhite)
                            Text("elapsed")
                                .font(.system(size: 9))
                                .foregroundColor(.muted)
                        }
                    }
                }

                Divider().background(Color.muted.opacity(0.3))

                if d.isActive {
                    // ── Active session layout ────────────────────────────
                    HStack(alignment: .top, spacing: 14) {
                        // Large set ring
                        ZStack {
                            RingView(
                                progress: d.restActive ? Double(d.restRemaining) / max(Double(d.restTotal), 1) : setProgress,
                                ringColor: d.restActive ? .skyBlue : .amber,
                                trackColor: (d.restActive ? Color.skyBlue : Color.amber).opacity(0.12),
                                lineWidth: 8,
                                size: 70
                            )
                            VStack(spacing: 1) {
                                if d.restActive {
                                    Text(formatRest(d.restRemaining))
                                        .font(.system(size: 14, weight: .heavy, design: .monospaced))
                                        .foregroundColor(.skyBlue)
                                    Text("rest")
                                        .font(.system(size: 9))
                                        .foregroundColor(.skyBlue.opacity(0.7))
                                } else {
                                    Text("\(d.setsCompleted)")
                                        .font(.system(size: 20, weight: .black))
                                        .foregroundColor(.amber)
                                    Text("/\(d.totalSets)")
                                        .font(.system(size: 10))
                                        .foregroundColor(.muted)
                                }
                            }
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            Text(d.exerciseName)
                                .font(.system(size: 17, weight: .heavy))
                                .foregroundColor(.warmWhite)
                                .lineLimit(2)
                            Text("Set \(d.setNum) of \(d.setTotal)")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(.amber.opacity(0.9))
                            HStack(spacing: 10) {
                                if !d.targetRepsLabel.isEmpty {
                                    Label(d.targetRepsLabel, systemImage: "repeat")
                                        .font(.system(size: 11))
                                        .foregroundColor(.muted)
                                }
                                if let w = d.targetWeight, w > 0 {
                                    Label("\(Int(w)) \(d.weightUnit)", systemImage: "scalemass")
                                        .font(.system(size: 11))
                                        .foregroundColor(.muted)
                                }
                            }
                        }
                        Spacer()
                    }

                    // ── Stats grid ───────────────────────────────────────
                    HStack(spacing: 0) {
                        StatCell(value: formatElapsed(d.elapsedSecs), label: "Time", icon: "clock", color: .warmWhite)
                        Divider().frame(height: 40).background(Color.muted.opacity(0.3))
                        StatCell(value: "\(d.sessionVolume)", label: "Volume", icon: "scalemass", color: .amber)
                        Divider().frame(height: 40).background(Color.muted.opacity(0.3))
                        StatCell(value: d.restActive ? formatRest(d.restRemaining) : "--", label: "Rest", icon: "timer", color: .skyBlue)
                    }
                    .background(Color.surface.opacity(0.6))
                    .cornerRadius(10)

                    // ── Volume progress bar ────────────────────────────────
                    VStack(alignment: .leading, spacing: 3) {
                        HStack {
                            Text("Session Progress")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.muted)
                            Spacer()
                            Text("\(d.setsCompleted)/\(d.totalSets) sets")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundColor(.amber)
                        }
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule()
                                    .fill(Color.amber.opacity(0.12))
                                    .frame(height: 6)
                                Capsule()
                                    .fill(LinearGradient(colors: [Color.amber, Color.amberHigh], startPoint: .leading, endPoint: .trailing))
                                    .frame(width: geo.size.width * setProgress, height: 6)
                            }
                        }
                        .frame(height: 6)
                    }
                } else {
                    // ── Idle / next workout layout ───────────────────────
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Next Workout")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(.muted)
                        Text(d.nextDayLabel.isEmpty ? "Rest Day" : d.nextDayLabel)
                            .font(.system(size: 22, weight: .heavy))
                            .foregroundColor(.warmWhite)
                        ForEach(Array(d.nextExercises.prefix(3).enumerated()), id: \.offset) { _, name in
                            HStack(spacing: 6) {
                                Circle()
                                    .fill(Color.amber)
                                    .frame(width: 5, height: 5)
                                Text(name)
                                    .font(.system(size: 12))
                                    .foregroundColor(.muted)
                            }
                        }
                    }
                    Spacer()
                    // Weekly stats row
                    HStack(spacing: 0) {
                        StatCell(value: "\(d.streakDays)", label: "Streak", icon: "flame", color: .amber)
                        Divider().frame(height: 40).background(Color.muted.opacity(0.3))
                        StatCell(value: "\(d.weekSessions)", label: "Sessions", icon: "checkmark.circle", color: .skyBlue)
                        Divider().frame(height: 40).background(Color.muted.opacity(0.3))
                        StatCell(value: "\(d.weekVolume)", label: "Wk Vol", icon: "scalemass", color: .warmWhite)
                    }
                    .background(Color.surface.opacity(0.6))
                    .cornerRadius(10)
                }

                Spacer(minLength: 0)
            }
            .padding(16)
        }
    }
}

// MARK: - Coach widget (small)

struct CoachWidgetView: View {
    let entry: WidgetEntry

    var body: some View {
        ZStack {
            Color.obsidian.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    RoundedRectangle(cornerRadius: 5)
                        .fill(Color.amber)
                        .frame(width: 20, height: 20)
                        .overlay(
                            Text("7")
                                .font(.system(size: 11, weight: .black))
                                .foregroundColor(.black)
                        )
                    Text("AI Coach")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(.muted)
                }
                Spacer()
                Text(entry.data.coachSummary.isEmpty ? "Train smart. Train Se7en." : entry.data.coachSummary)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(.warmWhite)
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)
            }
            .padding(12)
        }
    }
}

// MARK: - Next Workout widget (small)

struct NextWorkoutWidgetView: View {
    let entry: WidgetEntry

    private var d: WidgetData { entry.data }

    var body: some View {
        ZStack {
            Color.obsidian.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    RoundedRectangle(cornerRadius: 5)
                        .fill(Color.amber)
                        .frame(width: 20, height: 20)
                        .overlay(
                            Text("7")
                                .font(.system(size: 11, weight: .black))
                                .foregroundColor(.black)
                        )
                    Text("Next")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(.muted)
                }
                Spacer()
                Text(d.nextDayLabel.isEmpty ? "Rest Day" : d.nextDayLabel)
                    .font(.system(size: 14, weight: .heavy))
                    .foregroundColor(.warmWhite)
                ForEach(d.nextExercises.prefix(3), id: \.self) { name in
                    Text("· \(name)")
                        .font(.system(size: 9))
                        .foregroundColor(.muted)
                        .lineLimit(1)
                }
            }
            .padding(12)
        }
    }
}

// MARK: - Helper sub-views

private struct StatBadge: View {
    let value: String
    let label: String
    let color: Color

    var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 14, weight: .heavy, design: .monospaced))
                .foregroundColor(color)
            Text(label)
                .font(.system(size: 8, weight: .medium))
                .foregroundColor(.muted)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(color.opacity(0.08))
        .cornerRadius(8)
    }
}

private struct StatCell: View {
    let value: String
    let label: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(spacing: 2) {
            Image(systemName: icon)
                .font(.system(size: 11))
                .foregroundColor(color.opacity(0.7))
            Text(value)
                .font(.system(size: 13, weight: .heavy, design: .monospaced))
                .foregroundColor(color)
            Text(label)
                .font(.system(size: 8))
                .foregroundColor(.muted)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }
}

// MARK: - Widget definitions

// Se7enSessionWidget_SmallView dispatches to the right layout based on
// the WidgetFamily injected by the system at render time.
struct Se7enSessionWidget_SmallView: View {
    @Environment(\.widgetFamily) var family
    let entry: WidgetEntry

    var body: some View {
        switch family {
        case .systemSmall:  SmallWidgetView(entry: entry)
        case .systemMedium: MediumWidgetView(entry: entry)
        case .systemLarge:  LargeWidgetView(entry: entry)
        default:            SmallWidgetView(entry: entry)
        }
    }
}

struct Se7enSessionWidgetV2: Widget {
    let kind: String = "Se7enSessionWidgetV2"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Se7enProvider()) { entry in
            Se7enSessionWidget_SmallView(entry: entry)
                .containerBackground(.clear, for: .widget)
        }
        .configurationDisplayName("Se7en Workout")
        .description("Track your active workout session from your home screen.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct Se7enCoachWidget: Widget {
    let kind: String = "Se7enCoachWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Se7enProvider()) { entry in
            CoachWidgetView(entry: entry)
                .containerBackground(.clear, for: .widget)
        }
        .configurationDisplayName("Se7en AI Coach")
        .description("See your latest AI coaching insight at a glance.")
        .supportedFamilies([.systemSmall])
    }
}

struct Se7enNextWorkoutWidget: Widget {
    let kind: String = "Se7enNextWorkoutWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Se7enProvider()) { entry in
            NextWorkoutWidgetView(entry: entry)
                .containerBackground(.clear, for: .widget)
        }
        .configurationDisplayName("Se7en Next Workout")
        .description("See what's coming up in your training plan.")
        .supportedFamilies([.systemSmall])
    }
}

// MARK: - Widget Bundle

@main
struct Se7enWidgetBundle: WidgetBundle {
    @WidgetBundleBuilder
    var body: some Widget {
        Se7enSessionWidgetV2()
        Se7enCoachWidget()
        Se7enNextWorkoutWidget()
        // Live Activity / Dynamic Island — requires iOS 16.1+
        if #available(iOSApplicationExtension 16.1, *) {
            Se7enLiveActivityWidget()
        }
    }
}
