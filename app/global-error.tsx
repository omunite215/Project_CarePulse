"use client";

/**
 * Last-resort boundary: this replaces the root layout, so `globals.css`, the
 * theme provider and every component are unavailable or unreliable here.
 * Everything is therefore inline and dependency-free, and it renders its own
 * <html>/<body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#131619",
          color: "#e8e9e9",
          fontFamily: "system-ui, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: "32rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "24px", margin: "0 0 12px" }}>
            CarePulse could not start
          </h1>
          <p style={{ color: "#8a97a2", margin: "0 0 24px", lineHeight: 1.5 }}>
            Something failed before the app could render. Reloading usually
            clears it.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              backgroundColor: "#24ae7c",
              color: "#fff",
              border: 0,
              borderRadius: "8px",
              padding: "10px 20px",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest ? (
            <p style={{ color: "#5b6670", fontSize: "12px", marginTop: "24px" }}>
              Reference: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
