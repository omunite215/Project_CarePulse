import { AuthShell } from "@/components/layout/AuthShell";
import { RegisterFormSkeleton } from "@/components/states/Skeletons";

export default function Loading() {
  return (
    <AuthShell
      image={{ src: "/assets/images/register-img.png", alt: "" }}
      imageClassName="max-w-[390px]"
      containerClassName="flex-1"
    >
      <RegisterFormSkeleton />
    </AuthShell>
  );
}
