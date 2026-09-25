"use client";

/**
 * Public error boundary for the catch-all route. Shown if SSR throws (e.g. the
 * origin API is unreachable for a non-404 reason). Keeps the page from white-
 * screening and offers a retry.
 */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        fontFamily: "system-ui, sans-serif",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <h1 style={{ fontSize: "2rem", margin: 0 }}>Something went wrong</h1>
      <p style={{ color: "#555", margin: 0 }}>
        We hit a temporary problem loading this page.
      </p>
      <button
        onClick={reset}
        style={{
          marginTop: "0.5rem",
          padding: "0.5rem 1.25rem",
          borderRadius: "0.5rem",
          border: "1px solid #ccc",
          background: "#fff",
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </main>
  );
}
