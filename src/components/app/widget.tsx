import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type WidgetProps = {
  title?: ReactNode;
  /** Right-aligned content next to the title (dropdowns, buttons). */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Remove body padding, e.g. for tables or full-bleed images. */
  flush?: boolean;
};

/**
 * Sofia "Widget": the basic dashboard card. White, 8px radius, no border,
 * soft violet shadow on hover. Title row uses the Sofia headline-3 look.
 */
export function Widget({ title, actions, children, className, flush }: WidgetProps) {
  return (
    <section className={cn("widget flex h-full flex-col", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-4 px-6 pt-5 pb-2">
          {title && <h3 className="text-base font-semibold">{title}</h3>}
          {actions}
        </header>
      )}
      <div className={cn("flex-1", flush ? "" : "px-6 pt-2 pb-6")}>{children}</div>
    </section>
  );
}
