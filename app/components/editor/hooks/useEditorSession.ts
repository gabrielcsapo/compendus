import { useState, useCallback, useRef, useEffect } from "react";
import type { EpubStructure } from "../../../lib/editor/types";

type SessionStatus = "idle" | "loading" | "ready" | "saving" | "error";

export function useEditorSession(bookId: string) {
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [structure, setStructure] = useState<EpubStructure | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sessionOpenedRef = useRef(false);

  const openSession = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch(`/api/editor/${bookId}/session/open`, { method: "POST" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to open session");
      setStructure(data.structure);
      setStatus("ready");
      sessionOpenedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  }, [bookId]);

  const closeSession = useCallback(async () => {
    if (!sessionOpenedRef.current) return;
    try {
      await fetch(`/api/editor/${bookId}/session`, {
        method: "DELETE",
        keepalive: true,
      });
    } catch {
      // Best effort cleanup
    }
    sessionOpenedRef.current = false;
  }, [bookId]);

  const loadFile = useCallback(
    async (path: string): Promise<string> => {
      const res = await fetch(`/api/editor/${bookId}/file?path=${encodeURIComponent(path)}`);
      if (!res.ok) throw new Error("Failed to load file");
      return res.text();
    },
    [bookId],
  );

  const saveFile = useCallback(
    async (path: string, content: string): Promise<void> => {
      const res = await fetch(`/api/editor/${bookId}/file?path=${encodeURIComponent(path)}`, {
        method: "PUT",
        headers: { "Content-Type": "text/plain" },
        body: content,
      });
      if (!res.ok) throw new Error("Failed to save file");
    },
    [bookId],
  );

  const saveSession = useCallback(async (): Promise<void> => {
    setStatus("saving");
    try {
      const res = await fetch(`/api/editor/${bookId}/session/save`, { method: "POST" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to save");
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setStatus("error");
    }
  }, [bookId]);

  const updateStructure = useCallback(
    async (newSpine: string[]): Promise<void> => {
      const res = await fetch(`/api/editor/${bookId}/structure`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spine: newSpine }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to update structure");
      setStructure(data.structure);
    },
    [bookId],
  );

  const addNewFile = useCallback(
    async (path: string, content: string, mediaType: string, addToSpine: boolean = false): Promise<void> => {
      const res = await fetch(`/api/editor/${bookId}/file/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, content, mediaType, addToSpine }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to add file");
      setStructure(data.structure);
    },
    [bookId],
  );

  const deleteFile = useCallback(
    async (path: string): Promise<void> => {
      const res = await fetch(`/api/editor/${bookId}/file?path=${encodeURIComponent(path)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to delete file");
      setStructure(data.structure);
    },
    [bookId],
  );

  const refreshStructure = useCallback(async () => {
    const res = await fetch(`/api/editor/${bookId}/structure`);
    const data = await res.json();
    if (data.success) setStructure(data.structure);
  }, [bookId]);

  // Cleanup session on unmount
  useEffect(() => {
    return () => {
      if (sessionOpenedRef.current) {
        fetch(`/api/editor/${bookId}/session`, {
          method: "DELETE",
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, [bookId]);

  return {
    status,
    structure,
    error,
    openSession,
    closeSession,
    loadFile,
    saveFile,
    saveSession,
    updateStructure,
    addNewFile,
    deleteFile,
    refreshStructure,
  };
}
