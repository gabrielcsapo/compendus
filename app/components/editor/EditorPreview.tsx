"use client";

import { useEffect, useMemo, useState } from "react";

interface EditorPreviewProps {
  content: string;
  filePath: string;
  bookId: string;
  onNavigate?: (absolutePath: string) => void;
}

/** Base CSS to ensure proper rendering of standard HTML elements in the preview */
const BASE_PREVIEW_CSS = `
  body { margin: 0; padding: 24px; font-family: serif; line-height: 1.6; color: #333; }
  ol, ul { padding-left: 2em; margin: 1em 0; }
  ol { list-style-type: decimal; }
  ul { list-style-type: disc; }
  li { display: list-item; margin: 0.25em 0; }
  nav ol, nav ul { list-style: none; padding-left: 1em; }
  nav li { margin: 0.5em 0; }
  h1 { font-size: 1.8em; margin: 0.67em 0; }
  h2 { font-size: 1.4em; margin: 0.75em 0; }
  h3 { font-size: 1.17em; margin: 0.83em 0; }
  p { margin: 1em 0; }
  a { color: #2563eb; }
  blockquote { margin: 1em 2em; padding-left: 1em; border-left: 3px solid #ccc; }
  img { max-width: 100%; height: auto; }
  table { border-collapse: collapse; margin: 1em 0; }
  td, th { border: 1px solid #ccc; padding: 0.5em; }
  code { font-family: monospace; background: #f3f4f6; padding: 0.1em 0.3em; border-radius: 3px; font-size: 0.9em; }
  pre { background: #f3f4f6; padding: 1em; overflow-x: auto; border-radius: 4px; }
  sup { vertical-align: super; font-size: 0.8em; }
  sub { vertical-align: sub; font-size: 0.8em; }
`;

/**
 * Get the directory portion of a file path.
 * e.g., "OEBPS/xhtml/chapter1.xhtml" → "OEBPS/xhtml/"
 */
function getFileDir(filePath: string): string {
  const lastSlash = filePath.lastIndexOf("/");
  return lastSlash >= 0 ? filePath.substring(0, lastSlash + 1) : "";
}

/**
 * Resolve a relative path against a base directory, handling ".." segments.
 * e.g., resolveRelativePath("OEBPS/xhtml/", "../css/style.css") → "OEBPS/css/style.css"
 */
function resolveRelativePath(baseDir: string, relativePath: string): string {
  if (relativePath.startsWith("/")) return relativePath.slice(1);

  const parts = (baseDir + relativePath).split("/");
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === "..") {
      resolved.pop();
    } else if (part !== "." && part !== "") {
      resolved.push(part);
    }
  }
  return resolved.join("/");
}

/**
 * Encode a resource path preserving "/" separators so relative URL resolution
 * inside loaded CSS files works correctly. Each segment is encoded individually.
 * e.g., "EPUB/css/shared culture.css" → "EPUB/css/shared%20culture.css"
 */
function encodeResourcePath(fullPath: string): string {
  return fullPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/**
 * Rewrite relative URLs in HTML content to use the reader resource API.
 * Resolves paths relative to the currently opened file, not the OPF directory.
 * Also strips EPUB-specific <script> tags that would error in the preview.
 */
function rewriteUrlsForPreview(html: string, bookId: string, fileDir: string): string {
  const baseUrl = `/api/reader/${bookId}/resource`;

  function resolveUrl(href: string): string {
    if (href.startsWith("http") || href.startsWith("//") || href.startsWith("data:") || href.startsWith("#")) {
      return href;
    }
    const fullPath = resolveRelativePath(fileDir, href);
    return `${baseUrl}/${encodeResourcePath(fullPath)}`;
  }

  return (
    html
      // Strip EPUB scripts (they reference runtime APIs we don't have)
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      // Remove inline event handlers like onload="..."
      .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "")
      // Rewrite <img src="...">
      .replace(
        /(<img[^>]+src=["'])([^"']+)(["'])/gi,
        (_, before, src, after) => `${before}${resolveUrl(src)}${after}`,
      )
      // Rewrite <link href="..."> (stylesheets)
      .replace(
        /(<link[^>]+href=["'])([^"']+)(["'])/gi,
        (_, before, href, after) => `${before}${resolveUrl(href)}${after}`,
      )
      // Rewrite <image xlink:href="..."> (SVG)
      .replace(
        /(<image[^>]+xlink:href=["'])([^"']+)(["'])/gi,
        (_, before, href, after) => `${before}${resolveUrl(href)}${after}`,
      )
      // Rewrite <video src="...">, <audio src="...">, <source src="...">
      .replace(
        /(<(?:video|audio|source)[^>]+src=["'])([^"']+)(["'])/gi,
        (_, before, src, after) => `${before}${resolveUrl(src)}${after}`,
      )
      // Rewrite <video poster="...">
      .replace(
        /(<video[^>]+poster=["'])([^"']+)(["'])/gi,
        (_, before, src, after) => `${before}${resolveUrl(src)}${after}`,
      )
      // Rewrite url() in inline styles
      .replace(
        /(url\(["']?)([^)"']+)(["']?\))/gi,
        (_, before, url, after) => {
          if (url.startsWith("http") || url.startsWith("data:")) return `${before}${url}${after}`;
          return `${before}${resolveUrl(url)}${after}`;
        },
      )
  );
}

/**
 * Script injected into the preview iframe to intercept link clicks.
 * Internal links (relative, same-document) post a message to the parent.
 * External links open in a new tab. Fragment-only links scroll in place.
 */
const LINK_INTERCEPT_SCRIPT = `
<script>
document.addEventListener('click', function(e) {
  var anchor = e.target.closest('a');
  if (!anchor) return;
  var href = anchor.getAttribute('href');
  if (!href) return;

  e.preventDefault();

  // Fragment-only: scroll within the preview
  if (href.startsWith('#')) {
    var target = document.getElementById(href.slice(1)) || document.querySelector('[name="' + href.slice(1) + '"]');
    if (target) target.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  // External links: open in new tab
  if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) {
    window.open(href, '_blank', 'noopener');
    return;
  }

  // Strip fragment from href for file navigation
  var filePart = href.split('#')[0];
  if (filePart) {
    window.parent.postMessage({ type: 'epub-editor-navigate', href: filePart }, '*');
  }
});
</script>
`;

/**
 * Inject base preview CSS and link intercept script into XHTML content.
 * Inserts into <head> if present, or prepends if not.
 */
function injectPreviewHelpers(html: string): string {
  const styleTag = `<style data-preview-base>${BASE_PREVIEW_CSS}</style>`;
  const injection = `${styleTag}\n${LINK_INTERCEPT_SCRIPT}`;

  // Try to inject into <head>
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/(<head[^>]*>)/i, `$1\n${injection}`);
  }

  // No <head> — prepend
  return `${injection}\n${html}`;
}

export function EditorPreview({ content, filePath, bookId, onNavigate }: EditorPreviewProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  const isTextFile = filePath.endsWith(".xhtml") ||
    filePath.endsWith(".html") ||
    filePath.endsWith(".htm");

  const isCssFile = filePath.endsWith(".css");

  // Listen for navigation messages from the iframe
  useEffect(() => {
    if (!onNavigate) return;

    const fileDir = getFileDir(filePath);

    function handleMessage(e: MessageEvent) {
      if (e.data?.type !== "epub-editor-navigate") return;
      const href = e.data.href as string;
      if (!href) return;

      // Resolve the relative href against the current file's directory
      const absolutePath = resolveRelativePath(fileDir, href);
      onNavigate!(absolutePath);
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [filePath, onNavigate]);

  const srcdoc = useMemo(() => {
    if (!isTextFile && !isCssFile) return null;

    if (isCssFile) {
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${BASE_PREVIEW_CSS}</style>
  <style>${content}</style>
</head>
<body>
  <h1>CSS Preview</h1>
  <h2>Heading 2</h2>
  <h3>Heading 3</h3>
  <p>This is a paragraph of <strong>bold</strong> and <em>italic</em> text to preview your stylesheet.</p>
  <p>Another paragraph with <a href="#">a link</a> for testing.</p>
  <blockquote><p>This is a blockquote for testing.</p></blockquote>
  <ol><li>Ordered list item 1</li><li>Ordered list item 2</li></ol>
  <ul><li>Unordered list item 1</li><li>Unordered list item 2</li></ul>
  <nav>
    <h2>Navigation</h2>
    <ol><li><a href="#">Chapter 1</a></li><li><a href="#">Chapter 2</a></li></ol>
  </nav>
</body>
</html>`;
    }

    // Resolve URLs relative to the currently opened file's directory
    const fileDir = getFileDir(filePath);
    let result = rewriteUrlsForPreview(content, bookId, fileDir);
    result = injectPreviewHelpers(result);
    return result;
  }, [content, filePath, bookId, refreshKey]);

  if (!isTextFile && !isCssFile) {
    return (
      <div className="flex-1 flex items-center justify-center text-foreground-muted text-sm border-l border-border bg-surface-elevated">
        <div className="text-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 mx-auto mb-2 opacity-30">
            <path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625Z" clipRule="evenodd" />
          </svg>
          <p>Preview not available for this file type</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-[0_0_45%] flex flex-col border-l border-border bg-white">
      {/* Preview header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-surface text-xs text-foreground-muted">
        <span>Preview</span>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="hover:text-foreground transition-colors"
          title="Refresh preview"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path
              fillRule="evenodd"
              d="M13.836 2.477a.75.75 0 0 1 .75.75v3.182a.75.75 0 0 1-.75.75h-3.182a.75.75 0 0 1 0-1.5h1.37l-.84-.841a4.5 4.5 0 0 0-7.08.681.75.75 0 0 1-1.3-.75 6 6 0 0 1 9.44-.908l.84.84V3.227a.75.75 0 0 1 .75-.75Zm-.911 7.5A.75.75 0 0 1 13.199 11a6 6 0 0 1-9.44.908l-.84-.84v1.836a.75.75 0 0 1-1.5 0V9.723a.75.75 0 0 1 .75-.75h3.182a.75.75 0 0 1 0 1.5H4.07l.84.841a4.5 4.5 0 0 0 7.08-.681.75.75 0 0 1 1.025-.274l-.091.068Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* iframe */}
      {srcdoc && (
        <iframe
          key={refreshKey}
          srcDoc={srcdoc}
          className="flex-1 w-full border-0"
          sandbox="allow-same-origin allow-scripts"
          title="EPUB Preview"
        />
      )}
    </div>
  );
}
