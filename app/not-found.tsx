import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main
      id="main"
      className="page-shell flex min-h-dvh flex-col items-center justify-center gap-6 text-center"
    >
      <Image
        src="/assets/icons/logo-full.svg"
        height={1000}
        width={1000}
        alt="CarePulse"
        className="h-10 w-fit"
      />
      <div className="space-y-2">
        <p className="text-32-bold text-green-500">404</p>
        <h1 className="sub-header text-foreground">Page not found</h1>
        <p className="text-14-regular max-w-sm text-muted-foreground">
          That page does not exist. It may have moved, or the link may be
          incomplete.
        </p>
      </div>
      <Button asChild className="shad-primary-btn">
        <Link href="/">Back to start</Link>
      </Button>
    </main>
  );
}
