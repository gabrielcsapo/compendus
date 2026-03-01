import { Link } from "react-router";

const features = [
  {
    title: "Multi-Format Support",
    description:
      "Read and manage PDF, EPUB, MOBI, CBR, CBZ ebooks, M4B/MP3/M4A audiobooks, and comic archives.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: "Automatic Metadata",
    description:
      "Fetch book metadata, covers, and descriptions from Google Books and Open Library automatically.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: "Reading Progress",
    description:
      "Track reading progress, create highlights with notes, bookmark pages, and log reading sessions.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "iOS & Web",
    description:
      "Native iOS app with custom EPUB/PDF reader engine plus a full-featured responsive web interface.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: "Full-Text Search",
    description:
      "Search across titles, authors, descriptions, and optionally within book content itself.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    title: "Collections & Tags",
    description:
      "Organize your library with hierarchical collections, color-coded tags, and series tracking.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
];

const quickLinks = [
  { to: "/getting-started", label: "Getting Started", description: "Install and run Compendus locally" },
  { to: "/api", label: "API Reference", description: "Browse all REST API endpoints" },
  { to: "/architecture", label: "Architecture", description: "Understand the technical design" },
  { to: "/formats", label: "Supported Formats", description: "View all supported file types" },
  { to: "/ios", label: "iOS App", description: "Set up the native iOS client" },
];

export default function Home() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-4">
          Compendus Documentation
        </h1>
        <p className="text-lg text-foreground-muted max-w-2xl">
          Compendus is a self-hosted personal digital library manager. Upload,
          organize, and read books across web and iOS with automatic metadata,
          full-text search, and reading progress tracking.
        </p>
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-2xl font-semibold text-foreground mb-4">
          Quick Links
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {quickLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="block p-4 border border-border rounded-xl hover:border-primary/40 hover:shadow-paper-hover transition-all group"
            >
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                {link.label}
              </h3>
              <p className="text-sm text-foreground-muted mt-1">
                {link.description}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* Features */}
      <div>
        <h2 className="text-2xl font-semibold text-foreground mb-4">
          Features
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-5 border border-border rounded-xl"
            >
              <div className="w-10 h-10 bg-primary-light text-primary rounded-lg flex items-center justify-center mb-3">
                {feature.icon}
              </div>
              <h3 className="font-semibold text-foreground mb-1">
                {feature.title}
              </h3>
              <p className="text-sm text-foreground-muted">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Tech Stack */}
      <div>
        <h2 className="text-2xl font-semibold text-foreground mb-4">
          Tech Stack
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            "React 19",
            "Vite",
            "Hono",
            "SQLite",
            "Tailwind CSS",
            "Drizzle ORM",
            "SwiftUI",
            "SwiftData",
          ].map((tech) => (
            <div
              key={tech}
              className="px-4 py-2 bg-surface-elevated border border-border rounded-lg text-sm font-medium text-foreground text-center"
            >
              {tech}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
