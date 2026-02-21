"use client";

import React from "react";
import { inputStyles } from "../lib/styles";

export function TestHydrated() {
  const hydrated = React.useSyncExternalStore(
    React.useCallback(() => () => {}, []),
    () => true,
    () => false,
  );
  return <span data-testid="hydrated">[hydrated: {hydrated ? 1 : 0}]</span>;
}

export function TestClientState() {
  return <input className={`${inputStyles} py-0`} data-testid="client-state" placeholder="client-state" />;
}
