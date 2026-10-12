import { Construction } from "lucide-react";
import { Widget } from "@/components/app/widget";

/** Placeholder for routes planned in docs/SPEC.md but not yet built. */
export function ComingSoon({ title, spec }: { title: string; spec: string }) {
  return (
    <Widget className="p-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-yellow/20 text-orange">
          <Construction className="size-6" />
        </span>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Questa sezione è in costruzione. Vedi <code className="font-mono">docs/SPEC.md {spec}</code>.
        </p>
      </div>
    </Widget>
  );
}
