import { FormSkeleton } from "@/components/states/Skeletons";
import { AuthShell } from "@/components/layout/AuthShell";

/**
 * Renders the page's real chrome — two columns, logo, hero image — and
 * skeletonises only the form. A bare centred spinner would shift the entire
 * layout the moment content arrived.
 */
export default function Loading() {
  return (
    <AuthShell image={{ src: "/assets/images/onboarding-img.png", alt: "" }}>
      <FormSkeleton fields={3} />
    </AuthShell>
  );
}
