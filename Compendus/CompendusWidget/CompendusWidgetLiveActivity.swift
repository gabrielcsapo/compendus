//
//  CompendusWidgetLiveActivity.swift
//  CompendusWidget
//
//  Created by Gabriel Csapo on 2/7/26.
//

import ActivityKit
import WidgetKit
import SwiftUI

struct CompendusWidgetAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // Dynamic stateful properties about your activity go here!
        var emoji: String
    }

    // Fixed non-changing properties about your activity go here!
    var name: String
}

struct CompendusWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: CompendusWidgetAttributes.self) { context in
            // Lock screen/banner UI goes here
            VStack {
                Text("Hello \(context.state.emoji)")
            }
            .activityBackgroundTint(Color.cyan)
            .activitySystemActionForegroundColor(Color.black)

        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded UI goes here.  Compose the expanded UI through
                // various regions, like leading/trailing/center/bottom
                DynamicIslandExpandedRegion(.leading) {
                    Text("Leading")
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("Trailing")
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("Bottom \(context.state.emoji)")
                    // more content
                }
            } compactLeading: {
                Text("L")
            } compactTrailing: {
                Text("T \(context.state.emoji)")
            } minimal: {
                Text(context.state.emoji)
            }
            .widgetURL(URL(string: "http://www.apple.com"))
            .keylineTint(Color.red)
        }
    }
}

extension CompendusWidgetAttributes {
    fileprivate static var preview: CompendusWidgetAttributes {
        CompendusWidgetAttributes(name: "World")
    }
}

extension CompendusWidgetAttributes.ContentState {
    fileprivate static var smiley: CompendusWidgetAttributes.ContentState {
        CompendusWidgetAttributes.ContentState(emoji: "😀")
     }
     
     fileprivate static var starEyes: CompendusWidgetAttributes.ContentState {
         CompendusWidgetAttributes.ContentState(emoji: "🤩")
     }
}

#Preview("Notification", as: .content, using: CompendusWidgetAttributes.preview) {
   CompendusWidgetLiveActivity()
} contentStates: {
    CompendusWidgetAttributes.ContentState.smiley
    CompendusWidgetAttributes.ContentState.starEyes
}
