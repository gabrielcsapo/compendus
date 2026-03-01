import { useState, useRef, useEffect, type ReactNode } from "react";
import { codeToHtml } from "shiki";

const HIGHLIGHT_LANGS = new Set([
  "bash",
  "sh",
  "typescript",
  "javascript",
  "json",
  "html",
  "css",
  "yaml",
  "sql",
  "tsx",
  "jsx",
  "swift",
]);

export function CodeBlock({
  children,
  language,
}: {
  children: ReactNode;
  language?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const code = typeof children === "string" ? children : String(children);

  useEffect(() => {
    if (!language || !HIGHLIGHT_LANGS.has(language)) return;

    let cancelled = false;
    codeToHtml(code, { lang: language, theme: "github-dark" }).then((html) => {
      if (!cancelled) setHighlightedHtml(html);
    });
    return () => {
      cancelled = true;
    };
  }, [code, language]);

  const handleCopy = () => {
    const text = containerRef.current?.textContent ?? "";
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="my-4 rounded-xl overflow-hidden bg-code-bg">
      <div className="flex items-center justify-between px-4 py-2.5 bg-code-header">
        {language ? (
          <span className="text-xs text-gray-400 font-mono uppercase tracking-wide select-none">
            {language}
          </span>
        ) : (
          <span />
        )}
        <button
          onClick={handleCopy}
          className="px-3 py-1 text-xs font-medium text-gray-300 bg-code-button hover:bg-code-button-hover rounded-md transition-colors cursor-pointer"
          aria-label="Copy code"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <div ref={containerRef} className="p-5 overflow-x-auto text-sm leading-relaxed">
        {highlightedHtml ? (
          <div
            className="[&_pre]:!m-0 [&_pre]:!p-0 [&_pre]:!bg-transparent [&_code]:!font-mono"
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        ) : (
          <pre className="!m-0 !p-0 !bg-transparent">
            <code className="text-gray-200 font-mono">{children}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
