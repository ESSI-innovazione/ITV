import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { SlidePlayer } from "@/components/player/slide-player";
import { ScormPlayer } from "@/components/player/scorm-player";
import { ComingSoon } from "@/components/app/coming-soon";
import { requireUser } from "@/lib/auth";
import { getCourseForPlayer, getPlayerProgress } from "@/lib/learner";
import { createClient } from "@/lib/supabase/server";

export default function CoursePlayerPage({ params }: PageProps<"/learn/courses/[id]">) {
  return (
    <Suspense fallback={<PlayerSkeleton />}>
      <Player params={params} />
    </Suspense>
  );
}

async function Player({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const [course, progress] = await Promise.all([getCourseForPlayer(id), getPlayerProgress(id, user.id)]);
  if (!course) notFound();

  if (course.type === "scorm") {
    const supabase = await createClient();
    const { data: pkg } = await supabase.from("scorm_packages").select("id, version, entry_point").eq("course_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!pkg) return <ComingSoon title={course.title} spec="§8 (pacchetto mancante)" />;
    const { data: rt } = await supabase.from("scorm_runtime").select("cmi").eq("package_id", pkg.id).eq("candidate_id", user.id).maybeSingle();
    return (
      <ScormPlayer
        packageId={pkg.id}
        version={pkg.version as "1.2" | "2004"}
        entryPoint={pkg.entry_point}
        title={course.title}
        learner={{ id: user.id, name: user.name }}
        initialCmi={(rt?.cmi as Record<string, unknown> | null) ?? null}
      />
    );
  }

  if (course.type !== "slides") {
    return <ComingSoon title={course.title} spec="§5.2 (reader)" />;
  }

  return (
    <SlidePlayer
      course={course}
      initialIndex={progress.index}
      initialViewed={progress.viewed}
      serverTts={process.env.TTS_PROVIDER === "openai" || process.env.TTS_PROVIDER === "gemini"}
    />
  );
}

function PlayerSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[160px_1fr]">
      <div className="hidden space-y-2 lg:block">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="aspect-video" />
        ))}
      </div>
      <div className="space-y-4">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="aspect-video" />
        <Skeleton className="h-16" />
      </div>
    </div>
  );
}
