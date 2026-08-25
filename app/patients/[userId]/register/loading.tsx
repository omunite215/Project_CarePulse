import { AuthShell } from "@/components/layout/AuthShell";
import {
  RegisterFormSkeleton,
  RegisterStepIndicatorSkeleton,
} from "@/components/states/Skeletons";

export default function Loading() {
  return (
    <AuthShell
      image={{ src: "/assets/images/register-img.png", alt: "" }}
      asideOverlay={<RegisterStepIndicatorSkeleton />}
    >
      <RegisterFormSkeleton />
    </AuthShell>
  );
}
