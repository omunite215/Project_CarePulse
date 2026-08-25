// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuthShell } from "@/components/layout/AuthShell";

/**
 * Mock next/image to avoid canvas/fill rendering complexity in jsdom.
 * Render a native img element, excluding next/image-specific props.
 */
vi.mock("next/image", () => ({
  default: ({ alt, fill: _fill, sizes: _sizes, priority: _priority, ...props }: {
    alt: string;
    fill?: boolean;
    sizes?: string;
    priority?: boolean;
    [key: string]: unknown;
  }) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt} {...props} />;
  },
}));

/**
 * Mock next/link to avoid Next.js routing in tests.
 * Let children render directly since the test doesn't exercise navigation.
 */
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <a {...props}>{children}</a>
  ),
}));

describe("AuthShell overlay slot", () => {
  it("renders no overlay container when asideOverlay is not provided", () => {
    render(
      <AuthShell
        image={{ src: "/test-image.jpg", alt: "Test hero" }}
        footerSlot={null}
      >
        <div>Test content</div>
      </AuthShell>,
    );

    // The test content from children should be present
    expect(screen.getByText("Test content")).toBeInTheDocument();

    const heroImage = screen.getByRole("img", { name: /Test hero/i });
    const aside = heroImage.closest("aside");

    // Scoped to the overlay, not to the whole <aside>. A text- or child-count
    // assertion cannot see the regression this guards: with the guard removed
    // and no overlay passed, the wrapper renders EMPTY — no text, no queryable
    // content — so only its own identity gives it away.
    expect(aside?.querySelector('[data-slot="aside-overlay"]')).toBeNull();
  });

  it("renders the overlay container with content when asideOverlay is provided", () => {
    render(
      <AuthShell
        image={{ src: "/test-image.jpg", alt: "Test hero" }}
        footerSlot={null}
        asideOverlay={<div>Overlay test content</div>}
      >
        <div>Test content</div>
      </AuthShell>,
    );

    // Both the main content and overlay content should be present
    expect(screen.getByText("Test content")).toBeInTheDocument();
    expect(screen.getByText("Overlay test content")).toBeInTheDocument();

    // Verify the overlay content is within the aside
    const heroImage = screen.getByRole("img", { name: /Test hero/i });
    const aside = heroImage.closest("aside");
    const overlayContent = screen.getByText("Overlay test content");
    expect(aside).toContainElement(overlayContent);
    expect(aside?.querySelector('[data-slot="aside-overlay"]')).not.toBeNull();
  });

});
