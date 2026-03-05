import { CodeBlock } from "@app/components/docs";

export default function Architecture() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Architecture</h1>
        <p className="text-foreground-muted">
          Compendus is a full-stack application with a web frontend, server API, and native iOS app.
          Both platforms communicate through a shared REST API.
        </p>
      </div>

      {/* Overview Diagram */}
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-3">System Overview</h2>
        <div className="bg-surface-elevated border border-border rounded-xl p-6 font-mono text-sm text-foreground overflow-x-auto">
          <pre>{`┌─────────────────────────────────────────────┐
│                 Clients                     │
│  ┌──────────────┐    ┌───────────────────┐  │
│  │   Web App    │    │    iOS App        │  │
│  │  React 19    │    │  SwiftUI          │  │
│  │  RSC + Vite  │    │  SwiftData        │  │
│  └──────┬───────┘    └────────┬──────────┘  │
└─────────┼─────────────────────┼─────────────┘
          │                     │
          │    REST API         │
          ▼                     ▼
┌─────────────────────────────────────────────┐
│              Hono Server                    │
│  ┌──────────────────────────────────────┐   │
│  │         API Routes (/api/*)          │   │
│  │  books, search, upload, reader,      │   │
│  │  convert, transcribe, wishlist, ...  │   │
│  └──────────────────────────────────────┘   │
│  ┌──────────────────────────────────────┐   │
│  │    React Flight Router (RSC/SSR)     │   │
│  │    Server Components + Actions       │   │
│  └──────────────────────────────────────┘   │
│  ┌──────────────────────────────────────┐   │
│  │       Background Job Queue           │   │
│  │  transcription, conversion, TTS      │   │
│  └──────────────────────────────────────┘   │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│           SQLite + Drizzle ORM              │
│  books, collections, tags, highlights,      │
│  bookmarks, readingSessions, wantedBooks    │
└─────────────────────────────────────────────┘`}</pre>
        </div>
      </section>

      {/* Web Architecture */}
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-3">Web Application</h2>
        <p className="text-foreground mb-4">
          The web app uses React Server Components via react-flight-router with Vite as the build
          tool and Hono as the server framework.
        </p>

        <h3 className="text-lg font-medium text-foreground mb-2">Key Technologies</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {[
            {
              name: "React 19 + RSC",
              desc: "Server Components for data fetching, Client Components for interactivity",
            },
            {
              name: "react-flight-router",
              desc: "File-based routing with React Server Components support",
            },
            {
              name: "Vite 8",
              desc: "Dev server with HMR, production bundler",
            },
            {
              name: "Hono",
              desc: "Lightweight HTTP server framework for API routes",
            },
            {
              name: "Drizzle ORM",
              desc: "Type-safe SQL query builder for SQLite",
            },
            {
              name: "Tailwind CSS 4",
              desc: "Utility-first CSS with design token system",
            },
          ].map((tech) => (
            <div key={tech.name} className="p-3 border border-border rounded-lg">
              <h4 className="font-medium text-foreground text-sm">{tech.name}</h4>
              <p className="text-xs text-foreground-muted mt-1">{tech.desc}</p>
            </div>
          ))}
        </div>

        <h3 className="text-lg font-medium text-foreground mb-2">Project Structure</h3>
        <CodeBlock language="text">{`app/
├── routes/           # Page routes (server + client components)
├── components/       # Reusable React components
├── actions/          # Server actions (mutations)
├── lib/
│   ├── api/          # API spec (single source of truth)
│   ├── db/           # Drizzle schema + migrations
│   ├── processing/   # Book file processing (epub, pdf, mobi, etc.)
│   └── search/       # Full-text search indexing
├── root.tsx          # Root layout
├── routes.ts         # Route configuration
└── styles.css        # Global CSS + design tokens

server/
├── index.ts          # Hono app with all route modules
└── routes/           # API route handlers
    ├── books.ts      # CRUD for books
    ├── search.ts     # Full-text search
    ├── upload.ts     # File upload + processing
    ├── reader.ts     # Reader endpoints (PDF pages, EPUB resources)
    ├── convert.ts    # Format conversion (PDF/MOBI → EPUB)
    ├── transcribe.ts # Audiobook transcription (Whisper)
    └── ...           # 14 route modules total`}</CodeBlock>

        <h3 className="text-lg font-medium text-foreground mt-6 mb-2">Data Flow</h3>
        <ol className="list-decimal list-inside space-y-2 text-foreground">
          <li>
            Server components in{" "}
            <code className="bg-surface-elevated px-1 rounded border border-border text-sm">
              app/routes/
            </code>{" "}
            fetch data directly from the database
          </li>
          <li>Data is passed to client components via props (RSC serialization)</li>
          <li>
            Client components use{" "}
            <code className="bg-surface-elevated px-1 rounded border border-border text-sm">
              useSearchParams()
            </code>{" "}
            for URL state and server actions for mutations
          </li>
          <li>
            API routes in{" "}
            <code className="bg-surface-elevated px-1 rounded border border-border text-sm">
              server/
            </code>{" "}
            handle REST requests from the iOS app and external clients
          </li>
        </ol>
      </section>

      {/* iOS Architecture */}
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-3">iOS Application</h2>
        <p className="text-foreground mb-4">
          The iOS app is a native SwiftUI application with SwiftData for local persistence. It
          communicates with the server via REST API for library syncing and book downloads.
        </p>

        <h3 className="text-lg font-medium text-foreground mb-2">Key Technologies</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {[
            {
              name: "SwiftUI",
              desc: "Declarative UI framework for all views",
            },
            {
              name: "SwiftData",
              desc: "Local persistence for downloaded books and settings",
            },
            {
              name: "Custom Reader Engine",
              desc: "Native EPUB (CoreText + UITextView) and PDF (PDFKit) rendering",
            },
            {
              name: "ZIPFoundation",
              desc: "EPUB extraction from ZIP archives",
            },
            {
              name: "Whisper.cpp",
              desc: "On-device audiobook transcription",
            },
            {
              name: "TTS Engine",
              desc: "Text-to-speech with pre-generation and caching",
            },
          ].map((tech) => (
            <div key={tech.name} className="p-3 border border-border rounded-lg">
              <h4 className="font-medium text-foreground text-sm">{tech.name}</h4>
              <p className="text-xs text-foreground-muted mt-1">{tech.desc}</p>
            </div>
          ))}
        </div>

        <h3 className="text-lg font-medium text-foreground mb-2">Reader Engine</h3>
        <CodeBlock language="text">{`Reader/
├── Engine/
│   ├── ReaderEngine.swift          # Protocol for all reader engines
│   ├── PDFEngine.swift             # PDFKit-based PDF rendering
│   └── Native/
│       ├── NativeEPUBEngine.swift  # Custom EPUB rendering
│       ├── NativePageViewController.swift  # UITextView pagination
│       ├── NativePaginationEngine.swift    # CoreText CTFramesetter
│       ├── AttributedStringBuilder.swift   # XHTML → NSAttributedString
│       ├── XHTMLContentParser.swift        # XHTML → ContentNode AST
│       └── ImageCache.swift        # Session-scoped image caching
└── Parser/
    ├── EPUBParser.swift            # ZIP extraction + XML parsing
    └── EPUBManifest.swift          # OPF data models`}</CodeBlock>
      </section>

      {/* Database */}
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-3">Database Schema</h2>
        <p className="text-foreground mb-4">
          Compendus uses SQLite with Drizzle ORM. The schema is defined in{" "}
          <code className="bg-surface-elevated px-1 rounded border border-border text-sm">
            app/lib/db/schema.ts
          </code>
          .
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-foreground-muted border-b border-border">
                <th className="pr-6 py-2">Table</th>
                <th className="py-2">Description</th>
              </tr>
            </thead>
            <tbody className="text-foreground">
              {[
                ["books", "Core book collection with metadata, file info, and reading state"],
                ["collections", "User-created groupings with hierarchical support"],
                ["booksCollections", "Junction table linking books to collections"],
                ["tags", "Color-coded tags for categorization"],
                ["booksTags", "Junction table linking books to tags"],
                ["bookmarks", "Position-based bookmarks within books"],
                ["highlights", "Text highlights with notes and colors"],
                ["readingSessions", "Reading time tracking (start/end, pages read)"],
                ["wantedBooks", "Wishlist items with metadata from external sources"],
              ].map(([table, desc]) => (
                <tr key={table} className="border-b border-border/50">
                  <td className="pr-6 py-2">
                    <code className="bg-surface-elevated px-1.5 py-0.5 rounded border border-border">
                      {table}
                    </code>
                  </td>
                  <td className="py-2 text-foreground-muted">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Background Processing */}
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-3">Background Processing</h2>
        <p className="text-foreground mb-3">
          Long-running operations are handled by a background job queue with real-time progress
          tracking via Server-Sent Events (SSE).
        </p>
        <ul className="list-disc list-inside space-y-2 text-foreground">
          <li>
            <strong>Format conversion</strong> — PDF/MOBI/AZW3 to EPUB
          </li>
          <li>
            <strong>Audiobook transcription</strong> — Whisper-based speech to text
          </li>
          <li>
            <strong>TTS pre-generation</strong> — Text-to-speech audio caching
          </li>
          <li>
            <strong>Multi-file audio merge</strong> — Combining audio tracks into single audiobook
          </li>
        </ul>
        <p className="text-sm text-foreground-muted mt-3">
          Job progress can be polled via{" "}
          <code className="bg-surface-elevated px-1 rounded border border-border">
            GET /api/jobs/:id
          </code>{" "}
          or streamed via{" "}
          <code className="bg-surface-elevated px-1 rounded border border-border">
            GET /api/jobs/:id/progress
          </code>{" "}
          (SSE).
        </p>
      </section>
    </div>
  );
}
