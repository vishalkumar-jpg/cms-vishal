"use client";

import * as React from "react";

/**
 * Shared form runtime context. The FormBlock is environment-agnostic: it reads
 * this context to load a form definition and to submit. The RENDERER provides a
 * `mode:"live"` implementation that calls same-origin proxy routes (which
 * forward the tenant Host to the API); the ADMIN builder provides a
 * `mode:"preview"` implementation that fetches via the admin axios and no-ops on
 * submit. When no provider is present (e.g. raw SSR with no host wiring), the
 * context is `null` and the block renders a static skeleton — SSR-safe.
 */

/** A single form field as returned by the public form definition endpoint. */
export interface FormFieldDef {
  type: string;
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  validation?: Record<string, unknown>;
}

/** A resolved form definition (the shape the public API returns under `data`). */
export interface FormDef {
  id: string;
  name: string;
  fields: FormFieldDef[];
  settings?: Record<string, unknown>;
}

export interface FormRenderContextValue {
  /** Load a form definition by id. Returns null when not found / on error. */
  getForm: (formId: string) => Promise<FormDef | null>;
  /** Submit the collected field values for a form. */
  submit: (
    formId: string,
    data: Record<string, unknown>,
  ) => Promise<{ ok: boolean; message?: string }>;
  /** "live" = published site (real submit); "preview" = builder canvas. */
  mode: "preview" | "live";
}

export const FormRenderContext =
  React.createContext<FormRenderContextValue | null>(null);

export const useFormRenderContext = (): FormRenderContextValue | null =>
  React.useContext(FormRenderContext);
