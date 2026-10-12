import { Suspense } from "react";
import { GenerateForm } from "./generate-form";

export const metadata = { title: "Crea corso con IA" };
export const maxDuration = 300;

export default function NewCoursePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Crea corso con IA</h2>
        <p className="text-sm text-muted-foreground">
          Descrivi l&apos;argomento: l&apos;IA cerca le fonti, progetta la struttura, scrive le diapositive con la narrazione e il quiz finale — una versione per ogni livello ADA scelto.
        </p>
      </div>
      <Suspense>
        <GenerateForm />
      </Suspense>
    </div>
  );
}
