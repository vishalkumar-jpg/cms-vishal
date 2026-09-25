import * as React from "react";
import {
  scopeCustomCss,
  type CustomCssScopeTarget,
} from "@ob-cms/block-schema";

/**
 * Injects per-node author CSS, scoped to `[data-ob-node="<id>"]`.
 * Rendered as a sibling `<style>` tag — no global leakage.
 */
export const ScopedCustomStyle: React.FC<{
  nodeId: string;
  css: string;
  /** `node` = attribute on block root (builder); `child` = SSR wrapper. */
  target?: CustomCssScopeTarget;
}> = ({ nodeId, css, target = "node" }) => {
  const scoped = React.useMemo(() => scopeCustomCss(css, nodeId, target), [css, nodeId, target]);
  if (!scoped) return null;
  return <style data-ob-custom-style={nodeId} dangerouslySetInnerHTML={{ __html: scoped }} />;
};

/** Published-page wrapper — establishes `data-ob-node` without affecting layout. */
export const NodeScopeWrapper: React.FC<{
  nodeId: string;
  customCss?: string;
  children: React.ReactNode;
}> = ({ nodeId, customCss, children }) => {
  if (!customCss) return <>{children}</>;
  return (
    <div data-ob-node={nodeId} style={{ display: "contents" }}>
      <ScopedCustomStyle nodeId={nodeId} css={customCss} target="child" />
      {children}
    </div>
  );
};
