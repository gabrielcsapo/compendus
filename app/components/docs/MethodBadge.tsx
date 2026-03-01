import { badgeStyles } from "../../lib/styles";

export function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: badgeStyles.success,
    POST: badgeStyles.primary,
    PUT: badgeStyles.warning,
    DELETE: badgeStyles.danger,
    OPTIONS: badgeStyles.neutral,
  };

  return (
    <span
      className={`px-2 py-1 text-xs font-mono font-semibold rounded ${colors[method] || colors.GET}`}
    >
      {method}
    </span>
  );
}
