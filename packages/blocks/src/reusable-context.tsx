"use client";

import * as React from "react";
import type { ResolvedComponent, SerializedLayout } from "@ob-cms/block-schema";

/**
 * Shared reusable-block runtime context. The ReusableBlock component is
 * environment-agnostic: it reads this context to resolve a referenced reusable
 * block's SerializedLayout by id. The RENDERER provides a live implementation
 * that fetches a same-origin proxy route (which forwards the tenant Host to the
 * host-resolved public API); the ADMIN builder provides a preview implementation
 * that fetches via the admin axios. When no provider is present (raw SSR with no
 * wiring) the context is `null` and the block renders a static placeholder —
 * SSR-safe.
 *
 * Mirrors `form-context.tsx`. Kept in a `"use client"` module (separate from
 * `lib.tsx`) so `createContext` never lands in an RSC server module — see the
 * note in form.tsx / editable-text.tsx.
 */
export interface ReusableBlockRenderContextValue {
  /** Resolve a reusable block's layout by id. Returns null when not found / on error. */
  getReusable: (id: string) => Promise<SerializedLayout | null>;
  /**
   * COMPONENTS: resolve the full component DEFINITION (layout + declared props +
   * variants) by id. Optional — providers that only implement `getReusable`
   * (plain reusable blocks) still work; the ReusableBlock instance falls back to
   * treating the layout as a propless component. Returns null when not found.
   */
  getComponent?: (id: string) => Promise<ResolvedComponent | null>;
  /** Builder-only: open the reusable-block source editor for this id. */
  editReusableBlock?: (id: string) => void;
  /**
   * Builder canvas only — nested reusable content should use editor semantics
   * (hidden nodes, sticky nav overrides, etc.). Off for draft preview and the
   * published site so output matches production.
   */
  editorCanvas?: boolean;
}

export const ReusableBlockContext =
  React.createContext<ReusableBlockRenderContextValue | null>(null);

export const useReusableBlockContext = (): ReusableBlockRenderContextValue | null =>
  React.useContext(ReusableBlockContext);
