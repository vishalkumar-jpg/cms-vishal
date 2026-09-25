# Responsive Editing & Device Visibility — Changes

## Summary

Fixed device-specific visibility in the builder preview and strengthened per-breakpoint style isolation so edits on one device do not leak to others.

## Problems Fixed

### 1. Device visibility (“Hide on Mobile/Tablet/…”)

**Symptom:** Enabling “Hide on Mobile” in the Style panel did not hide the block when switching the canvas to Mobile preview.

**Root causes:**
- Hide flags are applied via CSS custom properties (`--ob-r-<bp>-display: none`) and container-query rules on `.ob-site` width. The builder also needed rules tied to the **active preview breakpoint** (`data-ob-breakpoint`), not only container width.
- Some blocks (Heading, Paragraph) put responsive CSS vars on an inner element while the Craft.js root wrapper stayed `display: block`, leaving a visible empty shell.
- `responsiveCssVars()` could overwrite `display: none` when the same breakpoint layer also had a layout `display` override.

**Fixes:**
- Added `data-ob-breakpoint` on `OBSiteRoot` (Canvas, Preview, Responsive Compare strip).
- Generated builder-scoped CSS rules: `.ob-site[data-ob-builder-canvas][data-ob-breakpoint="mobile"] …`
- `createCraftBlock` now applies `display: none` when the active canvas breakpoint matches a `styles.responsive.<bp>.hidden` flag.
- Moved `applyRootBlockStyles()` output to the outer Craft root for Heading/Paragraph.
- `hidden` flag is applied after property diffing and always wins over layout `display` at that breakpoint.

### 2. Independent responsive editing

**How it works (unchanged architecture, verified):**
- Desktop edits → `styles.<section>.<key>` (base layer).
- Override breakpoints → `styles.responsive.<bp>.<section>.<key>` (sparse overrides only).
- Inheritance: `largeDesktop`/`laptop` ← desktop; `tablet` ← laptop; `mobile` ← tablet.
- `mergeStyleModelAtBreakpoint()` merges for display; writes go only to the active layer (`StyleControls`, `styleWrites.ts` overlay).

**Strengthened:**
- Builder breakpoint CSS applies **all** `--ob-r-<bp>-*` vars for the selected device, so padding/margin/gap/typography/etc. preview correctly on that breakpoint even when container-query thresholds alone would not match.

## Files Changed

| Area | File | Change |
|------|------|--------|
| Style engine | `packages/block-schema/src/styles.ts` | Export `isHiddenAtBreakpoint`; fix hidden/display precedence |
| CSS generator | `packages/block-schema/src/responsive-breakpoint-css.ts` | Add `renderBuilderBreakpointCss()` |
| Generated CSS | `packages/blocks/src/blocks-responsive-overrides.css` | Regenerated (container + builder rules) |
| Site wrapper | `packages/blocks/src/site-root.tsx` | `breakpoint` prop → `data-ob-breakpoint` |
| Canvas | `apps/admin/.../Canvas.tsx` | Pass `breakpoint` to `OBSiteRoot` |
| Preview | `apps/admin/.../Preview.tsx`, `DeviceFrame.tsx` | Map device preset → breakpoint |
| Compare strip | `apps/admin/.../ResponsiveCompareStrip.tsx` | Pass `breakpoint` per panel |
| Craft wrapper | `apps/admin/.../createCraftBlock.tsx` | Hide nodes when `hidden` on active breakpoint |
| Blocks | `packages/blocks/src/blocks/content.tsx` | Heading/Paragraph: styles on Craft root |
| Tests | `packages/block-schema/src/__tests__/responsive-*.test.ts` | Coverage for hide + CSS generation |

## How to Test

### Device visibility

1. Open a page in the builder.
2. Select a Section (or any block).
3. Switch Style panel device to **Mobile**.
4. Enable **Hide on Mobile**.
5. Confirm the section **disappears** on the Mobile canvas.
6. Switch to **Desktop** — section is visible again.
7. Repeat for Tablet / Laptop / Large Desktop.
8. Publish or open draft preview on a phone-width frame — hidden blocks should not appear.

### Independent breakpoint editing

1. Select a block on **Desktop** — set padding-top to 48px.
2. Switch to **Mobile** — set padding-top to 8px (panel shows “Mobile” override).
3. Switch back to **Desktop** — padding should still be 48px.
4. Switch to **Mobile** — padding should be 8px.
5. Use Responsive Compare strip — tablet and mobile panels should reflect their overrides.

### Automated tests

```bash
bun test packages/block-schema/src/__tests__/responsive-styles.test.ts
bun test packages/block-schema/src/__tests__/responsive-breakpoint-css.test.ts
```

Regenerate responsive CSS after changing breakpoint rules:

```bash
bun run --cwd packages/block-schema generate-responsive-css
```

## Storage Format Reference

```json
{
  "styles": {
    "spacing": { "paddingTop": 48 },
    "responsive": {
      "mobile": {
        "hidden": true,
        "spacing": { "paddingTop": 8 }
      }
    }
  }
}
```

- `responsive.mobile.hidden` — hide on mobile only.
- `responsive.mobile.spacing.paddingTop` — mobile-only padding override; desktop base unchanged.
