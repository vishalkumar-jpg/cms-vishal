"use client";

import * as React from "react";
import { HighlightedText, sanitizeText } from "./lib";

/* ---- Inline editing (builder-only) ------------------------------- *
 * Lives in a "use client" module because it uses React context/hooks. The
 * renderer renders <EditableText> as a CLIENT component (SSR'd to the same
 * static HTML, then hydrated) — it never provides the context, so the static
 * sanitized branch runs and output is byte-identical to before. The admin
 * builder (createCraftBlock) provides a context whose `editing` flag is the
 * node's `selected` state and whose `commit` writes back to the block's props
 * (Craft `setProp` → autosave). Keeping this OUT of lib.tsx avoids calling
 * React.createContext during the renderer's react-server (RSC) module eval. */
export interface BlockEditingContextValue {
  editing: boolean;
  commit: (propKey: string, value: string) => void;
}

export const BlockEditingContext = React.createContext<BlockEditingContextValue | null>(null);

export interface EditableTextProps {
  value?: string;
  propKey: string;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  style?: React.CSSProperties;
  highlightText?: string;
  highlightColor?: string;
  /**
   * Extra DOM attributes (e.g. `data-subpart` tags) spread onto the rendered
   * element. Inert in the renderer; used by the builder to hit-test/select the
   * text as an editable sub-part. Ignored when rendered as a Fragment.
   */
  dataAttrs?: Record<string, string | undefined>;
  /**
   * Builder-only hint shown (faded) when the value is empty, so a fresh block
   * with no text yet is still visible and clickable on the canvas (an empty
   * inline Link/Button would otherwise be zero-width and unselectable). Never
   * rendered by the site renderer (no editing context) or committed to props.
   */
  placeholder?: string;
}

/** Friendly empty-state hint for a text prop (builder canvas only). */
const placeholderFor = (propKey: string, explicit?: string): string => {
  if (explicit) return explicit;
  switch (propKey) {
    case "label":
      return "Button text";
    case "title":
      return "Title";
    case "subtitle":
      return "Subtitle";
    default:
      return "Text";
  }
};

const isBlank = (v?: string): boolean => !v || v.trim() === "";

/** Static (renderer / not-editing) rendering: sanitized text, optionally with a
 *  highlighted phrase — byte-for-byte identical to the previous output. */
const StaticText: React.FC<
  EditableTextProps & { Tag: React.ElementType; showPlaceholder?: boolean }
> = ({
  value,
  propKey,
  Tag,
  className,
  style,
  highlightText,
  highlightColor,
  dataAttrs,
  placeholder,
  showPlaceholder,
}) => {
  // Builder-only: when a text block has no value yet, render a faded hint so the
  // element is visible + clickable (an empty inline Link would be zero-width and
  // impossible to select). The renderer never sets `showPlaceholder`.
  if (showPlaceholder && isBlank(value)) {
    const hint = placeholderFor(propKey, placeholder);
    const hintStyle: React.CSSProperties = { opacity: 0.4, fontStyle: "italic", ...style };
    if (Tag === React.Fragment) return <>{hint}</>;
    return (
      <Tag className={className} style={hintStyle} {...dataAttrs}>
        {hint}
      </Tag>
    );
  }
  const content =
    highlightText || highlightColor ? (
      <HighlightedText text={value} highlightText={highlightText} highlightColor={highlightColor} />
    ) : (
      sanitizeText(value)
    );
  if (Tag === React.Fragment) return <>{content}</>;
  return (
    <Tag className={className} style={style} {...dataAttrs}>
      {content}
    </Tag>
  );
};

/** Editing rendering: an uncontrolled contentEditable that shows the RAW value
 *  and commits the plain text on blur. Uncontrolled (text set via ref) so React
 *  never re-renders the element mid-typing → no cursor jumps. */
const EditingText: React.FC<
  EditableTextProps & { Tag: React.ElementType; commit: (k: string, v: string) => void }
> = ({ value, propKey, Tag, className, style, commit, dataAttrs }) => {
  const ref = React.useRef<HTMLElement | null>(null);
  const raw = value ?? "";

  React.useEffect(() => {
    const el = ref.current;
    if (el && el.textContent !== raw) el.textContent = raw;
  }, [raw]);

  const onBlur = React.useCallback(
    (e: React.FocusEvent<HTMLElement>) => {
      const text = e.currentTarget.textContent ?? "";
      if (text !== raw) commit(propKey, text);
    },
    [commit, propKey, raw],
  );

  const stop = React.useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  // Keep an empty editable clickable/selectable — a zero-width caret is easy to
  // miss, especially for an inline Link/Button with no text yet.
  const editStyle: React.CSSProperties = {
    cursor: "text",
    outline: "none",
    minWidth: raw === "" ? "2ch" : undefined,
    ...style,
  };

  return React.createElement(Tag, {
    ref,
    className,
    style: editStyle,
    contentEditable: true,
    suppressContentEditableWarning: true,
    spellCheck: false,
    onBlur,
    onKeyDown: stop,
    onKeyUp: stop,
    onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
    ...dataAttrs,
  });
};

/**
 * Inline-editable text. In the builder (context present & `editing` true) it
 * renders a contentEditable element committing on blur; everywhere else it
 * renders sanitized static text (highlight-aware).
 */
export const EditableText: React.FC<EditableTextProps> = (props) => {
  const ctx = React.useContext(BlockEditingContext);
  const Tag = (props.as ?? React.Fragment) as React.ElementType;
  if (ctx?.editing) {
    return <EditingText {...props} Tag={Tag} commit={ctx.commit} />;
  }
  // `ctx` present but not editing → builder canvas (block not selected): show a
  // placeholder for empty text. `ctx` absent → site renderer: never placeholder.
  return <StaticText {...props} Tag={Tag} showPlaceholder={ctx != null} />;
};
