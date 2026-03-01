import type { ReactNode } from "react";

export function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active
          ? "bg-primary-light text-primary"
          : "text-foreground-muted hover:text-foreground hover:bg-surface-elevated"
      }`}
    >
      {children}
    </button>
  );
}
