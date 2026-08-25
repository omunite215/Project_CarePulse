// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuthShell } from "@/components/layout/AuthShell";

/**
 * Mock next/image to avoid canvas/fill rendering complexity in jsdom.
 * Use a div with aria-label to preserve accessibility for testing.
 */
vi.mock("next/image", () => ({
  default: ({
    alt,
    ...props
  }: {
    alt: string;
    [key: string]: unknown;
  }) => (
    // eslint-disable-next-line jsx-a11y/prefer-tag-over-role
    <div role="img" aria-label={alt} {...props} />
  ),
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

    // The aside should contain only the image, no overlay wrapper.
    // We verify this by checking that the aside has exactly one child
    // (the mocked image element), not two (image + overlay div).
    const heroImage = screen.getByRole("img", { name: /Test hero/i });
    const aside = heroImage.closest("aside");
    expect(aside?.children.length).toBe(1);
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

    // The aside should now have two children: the mocked image and the overlay wrapper div
    const heroImage = screen.getByRole("img", { name: /Test hero/i });
    const aside = heroImage.closest("aside");
    expect(aside?.children.length).toBe(2);

    // Verify the overlay content is within the aside
    const overlayContent = screen.getByText("Overlay test content");
    expect(aside).toContainElement(overlayContent);
  });

  it("allows complex overlay content with nested elements", () => {
    const OverlayComponent = (
      <div>
        <h2>Step Indicator</h2>
        <p>Step 1 of 3</p>
      </div>
    );

    render(
      <AuthShell
        image={{ src: "/test-image.jpg", alt: "Test hero" }}
        footerSlot={null}
        asideOverlay={OverlayComponent}
      >
        <div>Test content</div>
      </AuthShell>,
    );

    expect(screen.getByText("Step Indicator")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();

    const heroImage = screen.getByRole("img", { name: /Test hero/i });
    const aside = heroImage.closest("aside");
    expect(aside).toContainElement(screen.getByText("Step Indicator"));
  });
});
