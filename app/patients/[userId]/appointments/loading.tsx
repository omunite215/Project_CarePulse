import { AuthShell } from "@/components/layout/AuthShell";
import { AppointmentListSkeleton } from "@/components/states/Skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <AuthShell image={{ src: "/assets/images/appointment-img.png", alt: "" }}>
      <div className="space-y-10">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-72" />
        </div>
        <AppointmentListSkeleton rows={3} />
      </div>
    </AuthShell>
  );
}
