"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  type ReaderSettings,
  DEFAULT_SETTINGS,
  validateSettings,
} from "@/lib/reader/settings";

const STORAGE_KEY = "reader-settings";

/**
 * Hook to manage reader settings with localStorage persistence
 */
export function useReaderSettings(bookId?: string) {
  // Global settings
  const [globalSettings, setGlobalSettings] = useState<ReaderSettings>(() => {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return validateSettings(JSON.parse(stored));
      }
    } catch {
      // Ignore parse errors
    }
    return DEFAULT_SETTINGS;
  });

  // Book-specific overrides
  const [bookSettings, setBookSettings] = useState<Partial<ReaderSettings>>(() => {
    if (typeof window === "undefined" || !bookId) return {};

    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}-${bookId}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Ignore parse errors
    }
    return {};
  });

  // Merged settings (book overrides global)
  const settings = useMemo(
    () => validateSettings({ ...globalSettings, ...bookSettings }),
    [globalSettings, bookSettings],
  );

  // Persist global settings
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(globalSettings));
    } catch {
      // Ignore storage errors
    }
  }, [globalSettings]);

  // Persist book settings
  useEffect(() => {
    if (!bookId) return;

    try {
      if (Object.keys(bookSettings).length > 0) {
        localStorage.setItem(`${STORAGE_KEY}-${bookId}`, JSON.stringify(bookSettings));
      } else {
        localStorage.removeItem(`${STORAGE_KEY}-${bookId}`);
      }
    } catch {
      // Ignore storage errors
    }
  }, [bookId, bookSettings]);

  // Update a global setting
  const updateGlobalSetting = useCallback(
    <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => {
      setGlobalSettings((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // Update a book-specific setting
  const updateBookSetting = useCallback(
    <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => {
      setBookSettings((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // Reset book-specific settings
  const resetBookSettings = useCallback(() => {
    setBookSettings({});
  }, []);

  // Reset all settings to defaults
  const resetAllSettings = useCallback(() => {
    setGlobalSettings(DEFAULT_SETTINGS);
    setBookSettings({});
  }, []);

  return {
    settings,
    globalSettings,
    bookSettings,
    updateGlobalSetting,
    updateBookSetting,
    resetBookSettings,
    resetAllSettings,
  };
}
