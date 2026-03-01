import type { ComponentPropsWithoutRef } from "react";
import { Link } from "react-router";
import { CodeBlock } from "@app/components/docs";

/**
 * Custom component overrides for MDX rendering.
 * Maps standard HTML elements to styled versions that match the docs theme.
 */
export const mdxComponents = {
  h1: (props: ComponentPropsWithoutRef<"h1">) => (
    <h1
      className="text-3xl font-bold text-foreground mb-2 scroll-mt-20"
      {...props}
    />
  ),
  h2: (props: ComponentPropsWithoutRef<"h2">) => (
    <h2
      className="text-xl font-semibold text-foreground mb-3 mt-10 scroll-mt-20"
      {...props}
    />
  ),
  h3: (props: ComponentPropsWithoutRef<"h3">) => (
    <h3
      className="text-lg font-medium text-foreground mb-2 mt-6 scroll-mt-20"
      {...props}
    />
  ),
  p: (props: ComponentPropsWithoutRef<"p">) => (
    <p className="text-foreground mb-3 leading-relaxed" {...props} />
  ),
  a: ({
    href,
    ...props
  }: ComponentPropsWithoutRef<"a">) => {
    if (href?.startsWith("/")) {
      return (
        <Link
          to={href}
          className="text-primary hover:underline"
          {...props}
        />
      );
    }
    return (
      <a
        href={href}
        className="text-primary hover:underline"
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      />
    );
  },
  ul: (props: ComponentPropsWithoutRef<"ul">) => (
    <ul
      className="list-disc list-inside space-y-2 text-foreground mb-4"
      {...props}
    />
  ),
  ol: (props: ComponentPropsWithoutRef<"ol">) => (
    <ol
      className="list-decimal list-inside space-y-2 text-foreground mb-4"
      {...props}
    />
  ),
  li: (props: ComponentPropsWithoutRef<"li">) => (
    <li className="text-foreground" {...props} />
  ),
  strong: (props: ComponentPropsWithoutRef<"strong">) => (
    <strong className="font-semibold text-foreground" {...props} />
  ),
  code: (props: ComponentPropsWithoutRef<"code">) => (
    <code
      className="bg-surface-elevated px-1.5 py-0.5 rounded text-sm border border-border font-mono"
      {...props}
    />
  ),
  pre: ({
    children,
    ...props
  }: ComponentPropsWithoutRef<"pre">) => {
    // Extract language and code text from the <code> child
    const codeElement = children as React.ReactElement<{
      className?: string;
      children?: string;
    }>;
    const className = codeElement?.props?.className ?? "";
    const lang = className.replace("language-", "");
    const code = codeElement?.props?.children ?? "";

    return <CodeBlock language={lang || undefined}>{code}</CodeBlock>;
  },
  table: (props: ComponentPropsWithoutRef<"table">) => (
    <div className="overflow-x-auto mb-4">
      <table className="min-w-full text-sm" {...props} />
    </div>
  ),
  thead: (props: ComponentPropsWithoutRef<"thead">) => (
    <thead {...props} />
  ),
  th: (props: ComponentPropsWithoutRef<"th">) => (
    <th
      className="text-left text-foreground-muted border-b border-border pr-6 py-2"
      {...props}
    />
  ),
  tbody: (props: ComponentPropsWithoutRef<"tbody">) => (
    <tbody className="text-foreground" {...props} />
  ),
  td: (props: ComponentPropsWithoutRef<"td">) => (
    <td className="pr-6 py-2 border-b border-border/50" {...props} />
  ),
  hr: (props: ComponentPropsWithoutRef<"hr">) => (
    <hr className="border-border my-8" {...props} />
  ),
  blockquote: (props: ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote
      className="border-l-4 border-primary pl-4 my-4 text-foreground-muted italic"
      {...props}
    />
  ),
};
