import type { ParamSpec } from "../../lib/api/spec";

export function ParamTable({ params, title }: { params: ParamSpec[]; title: string }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-foreground mb-2">{title}</h4>
      <div className="space-y-2">
        {params.map((param) => (
          <div key={param.name} className="flex items-start gap-2 text-sm flex-wrap">
            <code className="bg-surface-elevated px-1.5 py-0.5 rounded text-foreground">
              {param.name}
            </code>
            <span className="text-foreground-muted">({param.type})</span>
            {param.required && <span className="text-danger text-xs font-medium">required</span>}
            {param.default !== undefined && (
              <span className="text-foreground-muted/70 text-xs">
                default: {String(param.default)}
              </span>
            )}
            {param.constraints && (
              <span className="text-foreground-muted/70 text-xs">
                {param.constraints.min !== undefined && `min: ${param.constraints.min}`}
                {param.constraints.max !== undefined && ` max: ${param.constraints.max}`}
                {param.constraints.minLength !== undefined &&
                  `minLength: ${param.constraints.minLength}`}
              </span>
            )}
            <span className="text-foreground-muted w-full">— {param.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
