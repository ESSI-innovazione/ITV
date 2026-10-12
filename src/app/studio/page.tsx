import Link from "next/link";
import {
  ClipboardCheck,
  LayoutTemplate,
  MessagesSquare,
  MousePointerClick,
  Presentation,
  ScrollText,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Widget } from "@/components/app/widget";

export const metadata = { title: "Nuovo" };

const courseTypes = [
  {
    icon: Presentation,
    title: "Corso a diapositive",
    subtitle: "Slide, narrazione e quiz",
    description:
      "Un corso lineare o ramificato con diapositive, note del docente, video ed elementi interattivi.",
    manual: "/studio/courses/new?type=slides",
    ai: "/studio/courses/new?type=slides&ai=1",
    accent: "bg-pink/15 text-pink",
  },
  {
    icon: ScrollText,
    title: "Corso scorrevole",
    subtitle: "Pagina responsive",
    description:
      "Un corso interattivo simile a una pagina web, ottimizzato per la visualizzazione su qualsiasi dispositivo.",
    manual: "/studio/courses/new?type=scroll",
    ai: "/studio/courses/new?type=scroll&ai=1",
    accent: "bg-primary/15 text-primary",
  },
];

const contentTypes = [
  {
    icon: ClipboardCheck,
    title: "Quiz / Sondaggio",
    subtitle: "QuizMaker",
    description: "Verifica le conoscenze e raccogli feedback.",
    href: "/studio/quizzes/new",
    accent: "bg-orange/15 text-orange",
  },
  {
    icon: MousePointerClick,
    title: "Interazione",
    subtitle: "Visuals",
    description: "Presenta le informazioni in un formato interattivo e coinvolgente.",
    href: "/studio/interactions/new",
    accent: "bg-cyan/15 text-cyan",
  },
  {
    icon: MessagesSquare,
    title: "Simulazione di dialogo",
    subtitle: "TalkMaster",
    description: "Scenari simulati per sviluppare capacità di conversazione.",
    href: "/studio/dialogues/new",
    accent: "bg-blue/15 text-blue",
  },
];

/** iSpring-style "Inizio rapido" quick-start screen. */
export default function StudioHomePage() {
  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-4 text-xl font-semibold">Creare corsi</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          {courseTypes.map((t) => (
            <Widget key={t.title} className="p-6">
              <div className="flex items-start gap-4">
                <span className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${t.accent}`}>
                  <t.icon className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold">{t.title}</h3>
                  <p className="text-sm text-muted-foreground">{t.subtitle}</p>
                  <p className="mt-3 text-sm">{t.description}</p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button variant="secondary" render={<Link href={t.manual} />}>
                      Crea manualmente
                    </Button>
                    <Button render={<Link href={t.ai} />}>
                      <Sparkles className="size-4" />
                      Crea con IA
                    </Button>
                  </div>
                </div>
              </div>
            </Widget>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Creare contenuti formativi</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {contentTypes.map((t) => (
            <Link key={t.title} href={t.href} className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Widget className="h-full p-6">
                <span className={`mb-4 flex size-12 items-center justify-center rounded-xl ${t.accent}`}>
                  <t.icon className="size-6" />
                </span>
                <h3 className="text-lg font-semibold">{t.title}</h3>
                <p className="text-sm text-muted-foreground">{t.subtitle}</p>
                <p className="mt-3 text-sm">{t.description}</p>
              </Widget>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <Widget className="p-6">
          <div className="flex items-center gap-4">
            <span className="flex size-12 items-center justify-center rounded-xl bg-green/15 text-green">
              <LayoutTemplate className="size-6" />
            </span>
            <div className="flex-1">
              <h3 className="font-semibold">Importa un pacchetto SCORM</h3>
              <p className="text-sm text-muted-foreground">
                Carica un corso esportato da iSpring o da un altro authoring tool e assegnalo ai candidati.
              </p>
            </div>
            <Button variant="outline" render={<Link href="/studio/scorm" />}>
              Vai a SCORM
            </Button>
          </div>
        </Widget>
      </section>
    </div>
  );
}
