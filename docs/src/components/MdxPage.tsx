import type { ComponentType } from "react";
import { mdxComponents } from "./MdxComponents";

interface MdxPageProps {
  Component: ComponentType<{ components: Record<string, unknown> }>;
}

export function MdxPage({ Component }: MdxPageProps) {
  return (
    <div className="space-y-0">
      <Component components={mdxComponents} />
    </div>
  );
}
