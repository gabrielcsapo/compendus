"use client";

import { useEffect, useState, useCallback, useRef, lazy, Suspense } from "react";
import { useEditorSession } from "./hooks/useEditorSession";
import { EditorToolbar } from "./EditorToolbar";
import { EditorSidebar } from "./EditorSidebar";
import { EditorPreview } from "./EditorPreview";

const EditorPane = lazy(() => import("./EditorPane"));

interface EpubEditorShellProps {
  bookId: string;
  bookTitle: string;
  returnUrl: string;
}

export function EpubEditorShell({ bookId, bookTitle, returnUrl }: EpubEditorShellProps) {
  const session = useEditorSession(bookId);

  const [activeFile, setActiveFile] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [previewContent, setPreviewContent] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeFileRef = useRef(activeFile);
  activeFileRef.current = activeFile;

  // Detect dark mode
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Open session on mount
  useEffect(() => {
    session.openSession();
  }, []);

  // Auto-select first spine item when structure loads
  useEffect(() => {
    if (session.structure && !activeFile) {
      const firstSpineId = session.structure.spine[0];
      const firstItem = session.structure.manifest.find((m) => m.id === firstSpineId);
      if (firstItem) {
        handleFileSelect(firstItem.absolutePath);
      }
    }
  }, [session.structure]);

  // Keyboard shortcut: Ctrl/Cmd+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (isDirty) handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isDirty]);

  const handleFileSelect = useCallback(
    async (path: string) => {
      // Save current file to session before switching (if dirty)
      if (isDirty && activeFileRef.current) {
        // Flush pending save timer
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        // The file content is already saved to the server session via debounced setFileContent calls
      }

      setIsLoadingFile(true);
      setActiveFile(path);
      setIsDirty(false);

      try {
        const content = await session.loadFile(path);
        setFileContent(content);
        setPreviewContent(content);
      } catch {
        setFileContent("// Error loading file");
      } finally {
        setIsLoadingFile(false);
      }
    },
    [session, isDirty],
  );

  const handleContentChange = useCallback(
    (newContent: string) => {
      setFileContent(newContent);
      setIsDirty(true);

      // Debounced save to server session (in-memory, not to disk)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await session.saveFile(activeFileRef.current, newContent);
          // Update preview with saved content
          setPreviewContent(newContent);
        } catch {
          // Silently ignore save-to-session errors
        }
      }, 300);
    },
    [session],
  );

  const handleSave = useCallback(async () => {
    // Flush any pending debounced save
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    // Ensure current file content is saved to session
    if (activeFile && fileContent) {
      await session.saveFile(activeFile, fileContent);
    }

    // Save session to disk
    await session.saveSession();
    setIsDirty(false);
    setPreviewContent(fileContent);
  }, [session, activeFile, fileContent]);

  const handleSpineReorder = useCallback(
    async (newSpine: string[]) => {
      await session.updateStructure(newSpine);
    },
    [session],
  );

  const handleAddChapter = useCallback(
    async (path: string, content: string, mediaType: string) => {
      await session.addNewFile(path, content, mediaType, true);
    },
    [session],
  );

  const handlePreviewNavigate = useCallback(
    (absolutePath: string) => {
      if (!session.structure) return;
      // Find the manifest item matching the resolved path
      const item = session.structure.manifest.find(
        (m) => m.absolutePath === absolutePath || m.href === absolutePath,
      );
      if (item) {
        handleFileSelect(item.absolutePath);
      }
    },
    [session.structure, handleFileSelect],
  );

  const handleDeleteFile = useCallback(
    async (path: string) => {
      await session.deleteFile(path);
      // If the deleted file was active, clear the editor
      if (activeFile === path) {
        setActiveFile("");
        setFileContent("");
        setPreviewContent("");
        setIsDirty(false);
      }
    },
    [session, activeFile],
  );

  // Loading state
  if (session.status === "loading" || session.status === "idle") {
    return (
      <div className="h-screen flex flex-col bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-foreground-muted text-sm">Loading EPUB editor...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (session.status === "error") {
    return (
      <div className="h-screen flex flex-col bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-error mx-auto mb-3">
              <path
                fillRule="evenodd"
                d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-error font-medium mb-1">Failed to load editor</p>
            <p className="text-foreground-muted text-sm mb-4">{session.error}</p>
            <a href={returnUrl} className="btn btn-secondary">
              Back to book
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!session.structure) return null;

  return (
    <div className="h-screen flex flex-col bg-background">
      <EditorToolbar
        bookTitle={bookTitle}
        activeFile={activeFile}
        isDirty={isDirty}
        isSaving={session.status === "saving"}
        returnUrl={returnUrl}
        onSave={handleSave}
      />

      <div className="flex-1 flex overflow-hidden">
        <EditorSidebar
          structure={session.structure}
          activeFile={activeFile}
          onFileSelect={handleFileSelect}
          onSpineReorder={handleSpineReorder}
          onAddChapter={handleAddChapter}
          onDeleteFile={handleDeleteFile}
        />

        {activeFile ? (
          <>
            {/* Code editor */}
            <Suspense
              fallback={
                <div className="flex-1 flex items-center justify-center bg-background">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              }
            >
              {isLoadingFile ? (
                <div className="flex-1 flex items-center justify-center bg-background">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <EditorPane
                  content={fileContent}
                  filePath={activeFile}
                  isDark={isDark}
                  onChange={handleContentChange}
                />
              )}
            </Suspense>

            {/* Preview */}
            <EditorPreview
              content={previewContent}
              filePath={activeFile}
              bookId={bookId}
              onNavigate={handlePreviewNavigate}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-foreground-muted text-sm">
            Select a file from the sidebar to start editing
          </div>
        )}
      </div>
    </div>
  );
}
