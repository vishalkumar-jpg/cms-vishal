"use client";

import * as React from "react";
import { sanitizeText, useMounted, resolveSurfaceStyles, styleModelHasVisualOverrides } from "../lib";
import {
  FormRenderContext,
  type FormDef,
  type FormFieldDef,
} from "../form-context";

/**
 * Droppable Form block. Renders one of the site's forms (chosen via `formId` in
 * the builder) and submits it on the published site.
 *
 * Environment-agnostic: it reads `FormRenderContext` for `getForm`/`submit`.
 *  - Renderer provides a live context (same-origin proxy → host-resolved API).
 *  - Builder provides a preview context (no real submit).
 *  - No context (raw SSR) → static skeleton.
 *
 * SSR-safe: the server output is a stable skeleton; the form definition is
 * fetched only after mount (`useMounted`), so there is no `window` access at
 * module load and no hydration mismatch.
 */

interface FormBlockProps {
  formId?: string;
  submitLabel?: string;
  styles?: unknown;
}

const settingString = (
  settings: Record<string, unknown> | undefined,
  key: string,
): string | undefined => {
  const v = settings?.[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
};

const FieldControl: React.FC<{ field: FormFieldDef }> = ({ field }) => {
  const id = `ob-form-field-${field.name}`;
  const common = {
    id,
    name: field.name,
    required: field.required,
    placeholder: field.placeholder,
  };
  const baseStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.5rem 0.625rem",
    border: "1px solid #d1d5db",
    borderRadius: "0.375rem",
    font: "inherit",
    boxSizing: "border-box",
  };

  switch (field.type) {
    case "textarea":
      return <textarea {...common} rows={4} style={baseStyle} />;
    case "select":
    case "multiselect":
      return (
        <select {...common} multiple={field.type === "multiselect"} style={baseStyle}>
          {!field.required && field.type === "select" ? <option value="" /> : null}
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {sanitizeText(o.label)}
            </option>
          ))}
        </select>
      );
    case "checkbox":
    case "consent":
      return (
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input type="checkbox" name={field.name} required={field.required} />
          <span>{sanitizeText(field.label)}</span>
        </label>
      );
    case "radio":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          {(field.options ?? []).map((o) => (
            <label
              key={o.value}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <input
                type="radio"
                name={field.name}
                value={o.value}
                required={field.required}
              />
              <span>{sanitizeText(o.label)}</span>
            </label>
          ))}
        </div>
      );
    default: {
      // text / email / phone / number / date / hidden / unknown → input
      const inputType =
        field.type === "phone"
          ? "tel"
          : ["email", "number", "date", "hidden"].includes(field.type)
            ? field.type
            : "text";
      return <input {...common} type={inputType} style={baseStyle} />;
    }
  }
};

export const Form = React.forwardRef<HTMLDivElement, FormBlockProps>(
  ({ formId, submitLabel, styles }, ref) => {
    const ctx = React.useContext(FormRenderContext);
    const mounted = useMounted();
    const [form, setForm] = React.useState<FormDef | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [status, setStatus] = React.useState<
      { kind: "idle" | "submitting" }
      | { kind: "success"; message: string }
      | { kind: "error"; message: string }
    >({ kind: "idle" });

    React.useEffect(() => {
      if (!mounted || !ctx || !formId) return;
      let cancelled = false;
      setLoading(true);
      ctx
        .getForm(formId)
        .then((def) => {
          if (!cancelled) setForm(def);
        })
        .catch(() => {
          if (!cancelled) setForm(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [mounted, ctx, formId]);

    const submitDefaults: React.CSSProperties = {
      alignSelf: "flex-start",
      padding: "0.625rem 1.25rem",
      borderRadius: "0.375rem",
      border: "none",
      backgroundColor: "#147eff",
      color: "#fff",
      font: "inherit",
      fontWeight: 600,
      cursor: "pointer",
    };
    const { wrapper, surface: submitSurface } = resolveSurfaceStyles(
      styles,
      styleModelHasVisualOverrides(styles) ? {} : submitDefaults,
    );

    const rootStyle: React.CSSProperties = {
      display: "block",
      boxSizing: "border-box",
      ...wrapper,
    };

    // No form chosen → friendly placeholder (also the SSR skeleton).
    if (!formId) {
      return (
        <div ref={ref} style={rootStyle}>
          <div
            style={{
              border: "1px dashed #cbd5e1",
              borderRadius: "0.5rem",
              padding: "1.5rem",
              textAlign: "center",
              color: "#64748b",
            }}
          >
            Select a form in the panel
          </div>
        </div>
      );
    }

    // Server / pre-mount / no-context → static skeleton with a button.
    if (!mounted || !ctx || loading || !form) {
      return (
        <div ref={ref} style={rootStyle}>
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: "0.5rem",
              padding: "1.25rem",
              color: "#94a3b8",
            }}
          >
            {!mounted || loading ? "Loading form…" : "Form unavailable"}
          </div>
        </div>
      );
    }

    const resolvedSubmitLabel =
      submitLabel || settingString(form.settings, "submitText") || "Submit";

    const onSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
      e.preventDefault();
      if (ctx.mode === "preview") return; // builder: never submits.
      const formEl = e.currentTarget;
      const fd = new FormData(formEl);
      const data: Record<string, unknown> = {};
      for (const field of form.fields) {
        if (field.type === "checkbox" || field.type === "consent") {
          data[field.name] = fd.get(field.name) != null;
        } else if (field.type === "multiselect") {
          data[field.name] = fd.getAll(field.name).map(String);
        } else {
          const v = fd.get(field.name);
          data[field.name] = v == null ? "" : String(v);
        }
      }
      setStatus({ kind: "submitting" });
      try {
        const res = await ctx.submit(formId, data);
        if (res.ok) {
          const msg =
            res.message ||
            settingString(form.settings, "successMessage") ||
            "Thanks! Your submission was received.";
          setStatus({ kind: "success", message: msg });
          formEl.reset();
        } else {
          setStatus({
            kind: "error",
            message: res.message || "Something went wrong. Please try again.",
          });
        }
      } catch {
        setStatus({ kind: "error", message: "Network error. Please try again." });
      }
    };

    if (status.kind === "success") {
      return (
        <div ref={ref} style={rootStyle}>
          <div
            style={{
              border: "1px solid #bbf7d0",
              background: "#f0fdf4",
              color: "#166534",
              borderRadius: "0.5rem",
              padding: "1.25rem",
            }}
          >
            {sanitizeText(status.message)}
          </div>
        </div>
      );
    }

    const submitting = status.kind === "submitting";

    return (
      <div ref={ref} style={rootStyle}>
        <form
          onSubmit={(e) => void onSubmit(e)}
          noValidate
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          {form.fields
            .filter((f) => f.type !== "hidden")
            .map((field) => {
              const standalone = field.type === "checkbox" || field.type === "consent";
              return (
                <div
                  key={field.name}
                  style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}
                >
                  {!standalone ? (
                    <label
                      htmlFor={`ob-form-field-${field.name}`}
                      style={{ fontWeight: 500 }}
                    >
                      {sanitizeText(field.label)}
                      {field.required ? (
                        <span style={{ color: "#dc2626" }}> *</span>
                      ) : null}
                    </label>
                  ) : null}
                  <FieldControl field={field} />
                </div>
              );
            })}

          {/* Hidden fields still post their values. */}
          {form.fields
            .filter((f) => f.type === "hidden")
            .map((field) => (
              <input key={field.name} type="hidden" name={field.name} />
            ))}

          {status.kind === "error" ? (
            <div style={{ color: "#dc2626", fontSize: "0.875rem" }}>
              {sanitizeText(status.message)}
            </div>
          ) : null}

          {ctx.mode === "preview" ? (
            <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
              Preview — this form won&apos;t submit in the builder.
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting || ctx.mode === "preview"}
            className="ob-btn cms-fluid-btn"
            style={{
              ...submitSurface,
              cursor: submitting ? "default" : "pointer",
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? "Submitting…" : sanitizeText(resolvedSubmitLabel)}
          </button>
        </form>
      </div>
    );
  },
);
Form.displayName = "Form";
