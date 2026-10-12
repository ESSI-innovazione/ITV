import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { SlidePlayer } from "@/components/player/slide-player";
import { ComingSoon } from "@/components/app/coming-soon";
import { requireUser } from "@/lib/auth";
import { getCourseForPlayer, getPlayerProgress } from "@/lib/learner";

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

  if (course.type !== "slides") {
    return <ComingSoon title={course.title} spec={course.type === "scroll" ? "§5.2 (reader)" : "§8 (SCORM)"} />;
  }

  return (
    <SlidePlayer
      course={course}
      initialIndex={progress.index}
      initialViewed={progress.viewed}
      serverTts={process.env.TTS_PROVIDER === "openai"}
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
