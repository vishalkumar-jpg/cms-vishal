/**
 * Public 404. Rendered for unknown hosts and unpublished paths (the catch-all
 * route calls `notFound()`). Intentionally minimal and brand-neutral.
 */
export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.75rem",
        fontFamily: "system-ui, sans-serif",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <h1 style={{ fontSize: "3rem", margin: 0 }}>404</h1>
      <p style={{ fontSize: "1.125rem", color: "#555", margin: 0 }}>
        This page could not be found.
      </p>
    </main>
  );
}
