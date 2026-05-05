//
//  CelebrationOverlay.swift
//  Compendus
//
//  Watches reading sessions and fires celebration banner toasts on milestones.
//  Mirrors web's `useReadingMilestones()` hook so behavior is consistent across
//  platforms (Duolingo-style positive feedback).
//
//  Triggers (each fires at most once per relevant unit):
//    - Daily goal hit  → once per day (keyed by YYYY-MM-DD)
//    - Streak milestone → at 3 / 7 / 14 / 30 / 60 / 100 / 200 / 365 days
//
//  Persistence is in UserDefaults so app relaunches don't replay celebrations.
//

import SwiftUI
import SwiftData

private let streakMilestones = [3, 7, 14, 30, 60, 100, 200, 365]

private enum DefaultsKeys {
    static let dailyGoalCelebratedFor = "compendus.celebrated.dailyGoal"
    static let highestStreakCelebrated = "compendus.celebrated.streak"
}

private func todayKey() -> String {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.dateFormat = "yyyy-MM-dd"
    return f.string(from: Date())
}

struct CelebrationOverlay<Content: View>: View {
    let content: () -> Content

    @Environment(ServerConfig.self) private var serverConfig
    @Query(sort: \ReadingSession.startedAt, order: .reverse) private var sessions: [ReadingSession]
    @AppStorage("compendus.dailyGoalMinutes") private var dailyGoalMinutes: Int = 15

    @State private var bannerMessage: String?
    @State private var bannerType: BannerToastType = .success
    @State private var hasInitializedBaseline = false

    init(@ViewBuilder content: @escaping () -> Content) {
        self.content = content
    }

    var body: some View {
        content()
            .bannerToast($bannerMessage, type: bannerType, duration: 5.5)
            .onChange(of: sessions, initial: true) { _, _ in
                evaluateMilestones()
            }
    }

    private func evaluateMilestones() {
        let (streak, todayMinutes) = computeStreakAndToday()

        // First sighting on this device: establish a baseline so we don't fire
        // celebrations for already-achieved milestones on launch.
        if !hasInitializedBaseline {
            hasInitializedBaseline = true
            let defaults = UserDefaults.standard
            if defaults.object(forKey: DefaultsKeys.highestStreakCelebrated) == nil {
                let highest = streakMilestones.filter { streak >= $0 }.last ?? 0
                defaults.set(highest, forKey: DefaultsKeys.highestStreakCelebrated)
            }
            if defaults.string(forKey: DefaultsKeys.dailyGoalCelebratedFor) == nil
                && todayMinutes >= dailyGoalMinutes {
                defaults.set(todayKey(), forKey: DefaultsKeys.dailyGoalCelebratedFor)
            }
            return
        }

        // --- Daily goal hit ---
        if todayMinutes >= dailyGoalMinutes,
           UserDefaults.standard.string(forKey: DefaultsKeys.dailyGoalCelebratedFor) != todayKey() {
            UserDefaults.standard.set(todayKey(), forKey: DefaultsKeys.dailyGoalCelebratedFor)
            bannerType = .celebration(emoji: "\u{1F389}", title: "Daily goal complete!")
            bannerMessage = "You read \(todayMinutes) minutes today. Keep that streak going."
            HapticFeedback.success()
            return
        }

        // --- Streak milestone ---
        let lastStreak = UserDefaults.standard.integer(forKey: DefaultsKeys.highestStreakCelebrated)
        if let justHit = streakMilestones.first(where: { streak >= $0 && lastStreak < $0 }) {
            UserDefaults.standard.set(justHit, forKey: DefaultsKeys.highestStreakCelebrated)
            let body: String
            if justHit >= 100 {
                body = "That's a serious habit. We're proud."
            } else if justHit >= 30 {
                body = "A whole month of daily reading. Beautiful."
            } else if justHit >= 7 {
                body = "A full week of reading every day. Keep going."
            } else {
                body = "Three days in a row — momentum is real."
            }
            bannerType = .celebration(emoji: "\u{1F525}", title: "\(justHit)-day streak!")
            bannerMessage = body
            HapticFeedback.success()
        }
    }

    private func computeStreakAndToday() -> (streak: Int, todayMinutes: Int) {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let pid = serverConfig.selectedProfileId ?? ""

        var daysWithReading: Set<Date> = []
        var todaySeconds = 0
        for s in sessions where s.profileId == pid || s.profileId.isEmpty {
            let day = calendar.startOfDay(for: s.startedAt)
            daysWithReading.insert(day)
            if day == today { todaySeconds += s.durationSeconds }
        }

        var count = 0
        var check = today
        if daysWithReading.contains(check) {
            count = 1
            check = calendar.date(byAdding: .day, value: -1, to: check)!
        } else {
            check = calendar.date(byAdding: .day, value: -1, to: check)!
            if !daysWithReading.contains(check) {
                return (0, todaySeconds / 60)
            }
        }
        while daysWithReading.contains(check) {
            count += 1
            check = calendar.date(byAdding: .day, value: -1, to: check)!
        }
        return (count, todaySeconds / 60)
    }
}
