import { AuthShell } from "@/components/layout/AuthShell";
import { FormSkeleton } from "@/components/states/Skeletons";

export default function Loading() {
  return (
    <AuthShell
      image={{ src: "/assets/images/appointment-img.png", alt: "" }}
      imageClassName="max-w-[390px] bg-bottom"
    >
      <FormSkeleton fields={4} />
    </AuthShell>
  );
}
