import { CodeBlock } from "@app/components/docs";

export default function IOS() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">iOS App</h1>
        <p className="text-foreground-muted">
          Compendus includes a native iOS app built with SwiftUI and SwiftData that connects to the
          server for library management and book downloads.
        </p>
      </div>

      {/* Prerequisites */}
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-3">Prerequisites</h2>
        <ul className="list-disc list-inside space-y-2 text-foreground">
          <li>
            <strong>Xcode 15+</strong> — Required for building the iOS app
          </li>
          <li>
            <strong>iOS 17+</strong> — Minimum deployment target
          </li>
          <li>
            <strong>Compendus server</strong> — Running locally or on the network for the iOS app to
            connect to
          </li>
        </ul>
      </section>

      {/* Setup */}
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-3">Setup</h2>
        <ol className="list-decimal list-inside space-y-3 text-foreground">
          <li>
            Open the Xcode project at{" "}
            <code className="bg-surface-elevated px-1 rounded border border-border text-sm">
              Compendus/Compendus.xcodeproj
            </code>
          </li>
          <li>
            Swift Package Manager dependencies (ZIPFoundation, SwiftSoup) will resolve automatically
          </li>
          <li>
            Configure the server URL in the app&apos;s settings screen to point to your Compendus
            server
          </li>
          <li>Build and run on a device or simulator</li>
        </ol>
        <p className="text-sm text-foreground-muted mt-3">
          The dev server is configured with{" "}
          <code className="bg-surface-elevated px-1 rounded border border-border text-sm">
            host: true
          </code>{" "}
          so the iOS simulator can connect via the local network.
        </p>
      </section>

      {/* Features */}
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-3">Features</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              title: "Library Browsing",
              desc: "Browse your full library with search, filtering by format/type, and sorting options.",
            },
            {
              title: "Offline Reading",
              desc: "Download books for offline reading with background download support and progress tracking.",
            },
            {
              title: "Custom EPUB Reader",
              desc: "Native CoreText + UITextView-based EPUB renderer with pagination, highlights, and bookmarks.",
            },
            {
              title: "PDF Reader",
              desc: "PDFKit-based PDF viewer with annotation support and highlight persistence.",
            },
            {
              title: "Audiobook Player",
              desc: "Audio playback with chapter navigation, speed control, and sleep timer.",
            },
            {
              title: "Highlights & Notes",
              desc: "Create color-coded text highlights with notes. Synced to the server via REST API.",
            },
            {
              title: "Reading Sessions",
              desc: "Automatic reading time tracking with pages-read statistics.",
            },
            {
              title: "On-Device Transcription",
              desc: "Transcribe audiobooks locally using Whisper.cpp without sending audio to external services.",
            },
            {
              title: "Text-to-Speech",
              desc: "Built-in TTS with pre-generation and audio caching for read-along functionality.",
            },
            {
              title: "Home Screen Widget",
              desc: "WidgetKit widget showing currently reading books on the iOS home screen.",
            },
            {
              title: "Deep Linking",
              desc: "Open books directly via compendus://book/{bookId} URL scheme.",
            },
            {
              title: "Dark Mode",
              desc: "Full dark mode support with customizable reading themes (font, size, line height).",
            },
          ].map((feature) => (
            <div key={feature.title} className="p-4 border border-border rounded-lg">
              <h3 className="font-medium text-foreground text-sm mb-1">{feature.title}</h3>
              <p className="text-xs text-foreground-muted">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Architecture */}
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-3">Project Structure</h2>
        <CodeBlock language="text">{`Compendus/
├── Models/               # SwiftData models
│   ├── DownloadedBook    # Local book storage
│   ├── BookHighlight     # Highlight with XPath/position
│   ├── ReadingSession    # Reading statistics
│   ├── ReaderSettings    # Theme, font, size preferences
│   └── ...
├── Services/             # Business logic
│   ├── APIService        # REST API client
│   ├── DownloadManager   # Background URLSession downloads
│   ├── BookEditSyncService   # Edit sync to server
│   ├── AudiobookPlayerService # Audio playback
│   ├── OnDeviceTranscriptionService  # Whisper
│   ├── ReadAlongService  # Text-audio sync
│   └── ...
├── Reader/               # Reader engine
│   ├── Engine/
│   │   ├── ReaderEngine.swift       # Protocol
│   │   ├── PDFEngine.swift          # PDFKit
│   │   └── Native/                  # Custom EPUB
│   └── Parser/
│       ├── EPUBParser.swift         # ZIP + XML
│       └── EPUBManifest.swift       # OPF models
└── Views/                # SwiftUI views
    ├── Library/          # Book grid/list
    ├── Reader/           # Reading interface
    ├── Highlights/       # Highlight management
    ├── Downloads/        # Download progress
    ├── Settings/         # App preferences
    └── Components/       # Reusable UI`}</CodeBlock>
      </section>

      {/* Reader Engine Details */}
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-3">Reader Engine</h2>
        <p className="text-foreground mb-4">
          The iOS app uses a custom-built reader engine with native iOS rendering:
        </p>
        <div className="space-y-4">
          <div className="border border-border rounded-lg p-4">
            <h3 className="font-medium text-foreground mb-2">EPUB Rendering Pipeline</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-foreground-muted">
              <li>
                <strong>EPUBParser</strong> — Extracts ZIP, parses OPF metadata and spine order
              </li>
              <li>
                <strong>XHTMLContentParser</strong> — Parses XHTML into ContentNode AST (headings,
                paragraphs, images, lists)
              </li>
              <li>
                <strong>AttributedStringBuilder</strong> — Converts ContentNode AST into
                NSAttributedString with styles
              </li>
              <li>
                <strong>NativePaginationEngine</strong> — Uses CoreText CTFramesetter to paginate
                text
              </li>
              <li>
                <strong>NativePageViewController</strong> — Hosts UITextView for each page with
                gesture handling
              </li>
            </ol>
          </div>
          <div className="border border-border rounded-lg p-4">
            <h3 className="font-medium text-foreground mb-2">Reader Features</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-foreground-muted">
              <li>Text highlights with XPath-based range serialization</li>
              <li>epub:type footnote detection with popover presentation</li>
              <li>Fixed-layout (FXL) rendering with rendition:spread blank page detection</li>
              <li>SVG cover detection and rendering</li>
              <li>Background chapter parsing with async image pre-loading</li>
              <li>Session-scoped NSCache-based image caching</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Server Communication */}
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-3">Server Communication</h2>
        <p className="text-foreground mb-3">
          The iOS app communicates with the Compendus server through the REST API. Key interactions:
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-foreground-muted border-b border-border">
                <th className="pr-6 py-2">Operation</th>
                <th className="py-2">Endpoint</th>
              </tr>
            </thead>
            <tbody className="text-foreground">
              {[
                ["Browse library", "GET /api/library"],
                ["Search books", "GET /api/search?q=..."],
                ["Get book details", "GET /api/books/:id"],
                ["Download book file", "GET /books/:id.:format"],
                ["Download cover", "GET /covers/:id.jpg"],
                ["Update book metadata", "PUT /api/books/:id"],
                ["Upload transcript", "PUT /api/books/:id/transcript"],
                ["Get EPUB resources", "GET /api/reader/:id/resource/*"],
              ].map(([op, endpoint]) => (
                <tr key={op} className="border-b border-border/50">
                  <td className="pr-6 py-2 text-foreground">{op}</td>
                  <td className="py-2">
                    <code className="bg-surface-elevated px-1.5 py-0.5 rounded border border-border text-xs">
                      {endpoint}
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
