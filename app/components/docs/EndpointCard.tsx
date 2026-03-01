import { useState } from "react";
import type { EndpointSpec } from "../../lib/api/spec";
import { badgeStyles } from "../../lib/styles";
import { CodeBlock } from "./CodeBlock";
import { MethodBadge } from "./MethodBadge";
import { ParamTable } from "./ParamTable";

export function EndpointCard({ endpoint }: { endpoint: EndpointSpec }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border rounded-lg mb-4 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-surface-elevated transition-colors text-left"
      >
        <MethodBadge method={endpoint.method} />
        <code className="text-sm font-mono text-foreground flex-1">
          {endpoint.path}
        </code>
        <span className="text-foreground-muted text-sm hidden sm:block">
          {endpoint.summary}
        </span>
        <svg
          className={`w-5 h-5 text-foreground-muted transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 py-4 border-t border-border bg-surface-elevated space-y-4">
          {endpoint.description && (
            <p className="text-foreground">{endpoint.description}</p>
          )}

          {endpoint.pathParams && endpoint.pathParams.length > 0 && (
            <ParamTable params={endpoint.pathParams} title="Path Parameters" />
          )}

          {endpoint.queryParams && endpoint.queryParams.length > 0 && (
            <ParamTable
              params={endpoint.queryParams}
              title="Query Parameters"
            />
          )}

          {endpoint.requestBody && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">
                Request Body
              </h4>
              <p className="text-sm text-foreground-muted mb-2">
                Content-Type:{" "}
                <code className="bg-surface px-1 rounded border border-border">
                  {endpoint.requestBody.contentType}
                </code>
              </p>
              <p className="text-sm text-foreground-muted mb-2">
                {endpoint.requestBody.description}
              </p>
              {endpoint.requestBody.fields && (
                <ParamTable
                  params={endpoint.requestBody.fields}
                  title="Fields"
                />
              )}
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">
              Success Response
            </h4>
            <p className="text-sm text-foreground-muted mb-2">
              Status:{" "}
              <code className={`${badgeStyles.success} px-1 rounded`}>
                {endpoint.responses.success.status}
              </code>
              {" — "}
              {endpoint.responses.success.description}
            </p>
            <p className="text-sm text-foreground-muted mb-2">
              Returns:{" "}
              <code className="bg-surface-elevated px-1 rounded">
                {endpoint.responses.success.schema}
              </code>
            </p>
            {endpoint.responses.success.example ? (
              <CodeBlock>
                {JSON.stringify(endpoint.responses.success.example, null, 2)}
              </CodeBlock>
            ) : null}
          </div>

          {endpoint.responses.errors.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">
                Error Responses
              </h4>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-foreground-muted">
                      <th className="pr-4 py-1">Status</th>
                      <th className="pr-4 py-1">Code</th>
                      <th className="py-1">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpoint.responses.errors.map((error) => (
                      <tr key={error.code}>
                        <td className="pr-4 py-1">
                          <code
                            className={`${badgeStyles.danger} px-1 rounded`}
                          >
                            {error.status}
                          </code>
                        </td>
                        <td className="pr-4 py-1">
                          <code className="bg-surface-elevated px-1 rounded">
                            {error.code}
                          </code>
                        </td>
                        <td className="py-1 text-foreground-muted">
                          {error.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
