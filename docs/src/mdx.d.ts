declare module "*.mdx" {
  import type { ComponentType } from "react";
  const Component: ComponentType<{ components?: Record<string, unknown> }>;
  export default Component;
  export const frontmatter: Record<string, unknown>;
}
