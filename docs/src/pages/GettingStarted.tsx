import { CodeBlock } from "@app/components/docs";

export default function GettingStarted() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Getting Started
        </h1>
        <p className="text-foreground-muted">
          Set up Compendus on your local machine or deploy with Docker.
        </p>
      </div>

      {/* Prerequisites */}
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-3">
          Prerequisites
        </h2>
        <ul className="list-disc list-inside space-y-2 text-foreground">
          <li>
            <strong>Node.js 20+</strong> — Required runtime
          </li>
          <li>
            <strong>pnpm</strong> — Package manager (
            <code className="bg-surface-elevated px-1.5 py-0.5 rounded text-sm border border-border">
              npm install -g pnpm
            </code>
            )
          </li>
          <li>
            <strong>Git LFS</strong> — Required for cloning (large binary
            tracking)
          </li>
        </ul>
      </section>

      {/* Clone and Install */}
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-3">
          Installation
        </h2>
        <p className="text-foreground mb-3">
          Clone the repository and install dependencies:
        </p>
        <CodeBlock language="bash">{`# Install Git LFS (if not already installed)
git lfs install

# Clone the repository
git clone https://github.com/gabrielcsapo/compendus.git
cd compendus

# Install dependencies
pnpm install`}</CodeBlock>
      </section>

      {/* Database Setup */}
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-3">
          Database Setup
        </h2>
        <p className="text-foreground mb-3">
          Compendus uses SQLite with Drizzle ORM. Initialize the database:
        </p>
        <CodeBlock language="bash">{`# Generate database schema
pnpm db:generate

# Run migrations
pnpm db:migrate`}</CodeBlock>
        <p className="text-sm text-foreground-muted mt-2">
          The database file is stored at{" "}
          <code className="bg-surface-elevated px-1 rounded border border-border">
            data/compendus.db
          </code>
          . Book files are stored in{" "}
          <code className="bg-surface-elevated px-1 rounded border border-border">
            data/books/
          </code>{" "}
          and covers in{" "}
          <code className="bg-surface-elevated px-1 rounded border border-border">
            data/covers/
          </code>
          .
        </p>
      </section>

      {/* Environment Variables */}
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-3">
          Environment Variables
        </h2>
        <p className="text-foreground mb-3">
          Create a{" "}
          <code className="bg-surface-elevated px-1 rounded border border-border">
            .env
          </code>{" "}
          file in the project root:
        </p>
        <CodeBlock language="bash">{`# Google Books API key (for metadata fetching)
GOOGLE_BOOKS_API_KEY=your_api_key_here`}</CodeBlock>
        <p className="text-sm text-foreground-muted mt-2">
          The Google Books API key is optional but recommended for automatic
          metadata fetching. Without it, metadata must be entered manually.
        </p>
      </section>

      {/* Running the Dev Server */}
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-3">
          Development Server
        </h2>
        <p className="text-foreground mb-3">
          Start the development server:
        </p>
        <CodeBlock language="bash">{`pnpm dev`}</CodeBlock>
        <p className="text-foreground mt-3">
          The app will be available at{" "}
          <code className="bg-surface-elevated px-1 rounded border border-border">
            http://localhost:3000
          </code>
          . The dev server includes hot module reloading, API routes, and React
          Server Components support.
        </p>
      </section>

      {/* Production Build */}
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-3">
          Production Build
        </h2>
        <CodeBlock language="bash">{`# Build the application
pnpm build

# Start the production server
pnpm start`}</CodeBlock>
        <p className="text-sm text-foreground-muted mt-2">
          The build process compiles worker threads, bundles React Server
          Components, and copies database migrations.
        </p>
      </section>

      {/* Docker */}
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-3">
          Docker Deployment
        </h2>
        <p className="text-foreground mb-3">
          Compendus includes Docker support for easy deployment:
        </p>
        <CodeBlock language="bash">{`# Build and run with Docker Compose
docker compose up -d

# Or build the image directly
docker build -t compendus .
docker run -p 3000:3000 -v ./data:/app/data compendus`}</CodeBlock>
        <p className="text-sm text-foreground-muted mt-2">
          Mount the{" "}
          <code className="bg-surface-elevated px-1 rounded border border-border">
            data/
          </code>{" "}
          directory as a volume to persist your library across container
          restarts.
        </p>
      </section>

      {/* Available Scripts */}
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-3">
          Available Scripts
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-foreground-muted border-b border-border">
                <th className="pr-4 py-2">Command</th>
                <th className="py-2">Description</th>
              </tr>
            </thead>
            <tbody className="text-foreground">
              {[
                ["pnpm dev", "Start development server with HMR"],
                ["pnpm build", "Build for production"],
                ["pnpm start", "Start production server"],
                ["pnpm db:generate", "Generate database schema"],
                ["pnpm db:migrate", "Run database migrations"],
                ["pnpm db:studio", "Open Drizzle Studio (DB browser)"],
                ["pnpm test", "Run test suite"],
                ["pnpm test:watch", "Run tests in watch mode"],
                ["pnpm lint", "Run linter (oxfmt + oxlint)"],
              ].map(([cmd, desc]) => (
                <tr key={cmd} className="border-b border-border/50">
                  <td className="pr-4 py-2">
                    <code className="bg-surface-elevated px-1.5 py-0.5 rounded border border-border">
                      {cmd}
                    </code>
                  </td>
                  <td className="py-2 text-foreground-muted">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
