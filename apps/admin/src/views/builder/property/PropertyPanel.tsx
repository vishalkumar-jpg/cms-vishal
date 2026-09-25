import * as React from "react";
import { useEditor } from "@craftjs/core";
import {
  Copy,
  Trash2,
  Save,
  Lock,
  ShieldCheck,
  Accessibility,
  HelpCircle,
  Smartphone,
} from "lucide-react";
import { blockRegistry } from "@ob-cms/blocks";
import type { z } from "zod";
import { Button } from "@/components/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEditorUiStore } from "../store/editorUiStore";
import { duplicateNode } from "../craft/nodeOps";
import { ContentControls } from "./ContentControls";
import { NavbarNavPanel } from "./NavbarNavPanel";
import { SiteChromePanel } from "./SiteChromePanel";
import { StyleControls } from "./StyleControls";
import { LayoutControls } from "./LayoutControls";
import { InteractionsControls } from "./InteractionsControls";
import { LinkStyleControls } from "./LinkStyleControls";
import { AdvancedControls } from "./AdvancedControls";
import { ComponentInstancePanel } from "./ComponentInstancePanel";
import { ExperimentControls } from "./ExperimentControls";
import { SaveReusableBlockDialog } from "../components/SaveReusableBlockDialog";
import { GuardrailsControls } from "../guardrails/GuardrailsControls";
import { useNodeGuardrails, useCanDesign } from "../guardrails/useGuardrails";
import { A11yPanel } from "../a11y/A11yPanel";
import { ResponsiveAuditPanel } from "../responsive/ResponsiveAuditPanel";
import { introspectSchema } from "./introspect";
import { SubPartPanel } from "./SubPartPanel";
import { BuilderTip } from "../components/BuilderTip";
import { SelectionBreadcrumb } from "../components/SelectionBreadcrumb";
import { styleBreakpointKey } from "../store/editorUiStore";

/**
 * Property panel for the selected node. Tabs:
 *  - Content: auto-generated from the block's zod propSchema.
 *  - Layout: spacing, flex/grid arrangement, sizing, positioning.
 *  - Visual: colors, typography, borders, and visual effects.
 */
export const PropertyPanel: React.FC = () => {
  const breakpoint = useEditorUiStore((s) => s.breakpoint);
  const uiLevel = useEditorUiStore((s) => s.uiLevel);
  const setUiLevel = useEditorUiStore((s) => s.setUiLevel);
  const helpMode = useEditorUiStore((s) => s.helpMode);
  const toggleHelpMode = useEditorUiStore((s) => s.toggleHelpMode);
  const [saveReusableOpen, setSaveReusableOpen] = React.useState(false);
  const reusableTargetIdRef = React.useRef<string | null>(null);

  const openSaveReusableDialog = React.useCallback((nodeId: string) => {
    reusableTargetIdRef.current = nodeId;
    setSaveReusableOpen(true);
  }, []);

  const onSaveReusableOpenChange = React.useCallback((open: boolean) => {
    setSaveReusableOpen(open);
    if (!open) reusableTargetIdRef.current = null;
  }, []);
  const { actions, query, selectedId, name, props, isDeletable } = useEditor((state, q) => {
    const selected = state.events.selected;
    const id = selected && selected.size > 0 ? Array.from(selected)[0] : null;
    const node = id ? state.nodes[id] : null;
    return {
      selectedId: id,
      name: node ? node.data.displayName || node.data.name : null,
      props: (node?.data.props ?? {}) as Record<string, unknown>,
      isDeletable: id ? q.node(id).isDeletable() : false,
    };
  });
  const guardrails = useNodeGuardrails(selectedId);
  const canDesign = useCanDesign();
  // Lock is ENFORCED only for non-designers; designers manage the page freely.
  const lockedForUser = !canDesign && guardrails.locked === true;

  // SUB-PART EDITING — a selected internal region scopes the panel contextually.
  const subPart = useEditorUiStore((s) => s.subPart);
  const clearSubPart = useEditorUiStore((s) => s.clearSubPart);
  // Drop the sub-part selection whenever the primary node selection changes.
  React.useEffect(() => {
    if (subPart && subPart.nodeId !== selectedId) clearSubPart();
  }, [selectedId, subPart, clearSubPart]);
  const activeSubPart = subPart && subPart.nodeId === selectedId ? subPart : null;

  if (!selectedId || !name) {
    return (
      <>
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Select a block on the canvas to edit its content and appearance.
        </div>
        <SaveReusableBlockDialog
          selectedId={reusableTargetIdRef.current}
          open={saveReusableOpen}
          onOpenChange={onSaveReusableOpenChange}
        />
      </>
    );
  }

  const entry = blockRegistry[name];
  const styles = (props["styles"] ?? {}) as Record<string, unknown>;
  const isGuarded =
    !!guardrails.locked ||
    !!guardrails.colorsTokenOnly ||
    (guardrails.lockedProps?.length ?? 0) > 0 ||
    (guardrails.editableProps?.length ?? 0) > 0;
  const propNames = introspectSchema(entry?.propSchema as z.ZodTypeAny | undefined).map(
    (f) => f.name,
  );

  return (
    <>
    <div className="flex h-full flex-col">
      <SelectionBreadcrumb selectedId={selectedId} />
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1 truncate text-sm font-semibold">
            {guardrails.locked && <Lock className="h-3.5 w-3.5 shrink-0 text-amber-600" />}
            {isGuarded && !guardrails.locked && (
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-amber-600" />
            )}
            {name}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Editing:{" "}
            {breakpoint === "desktop"
              ? "Base / Desktop"
              : breakpoint === "laptop"
                ? "Laptop preview"
                : breakpoint === "largeDesktop"
                  ? "Large desktop preview"
                  : styleBreakpointKey(breakpoint)}
          </p>
        </div>
        <div className="flex gap-1">
          <BuilderTip content="Save this block to reuse on other pages">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => openSaveReusableDialog(selectedId)}
            >
              <Save className="h-4 w-4" />
            </Button>
          </BuilderTip>
          <BuilderTip
            content={
              lockedForUser
                ? "This block is locked by brand guidelines"
                : "Make a copy of this block"
            }
          >
            <Button
              size="icon"
              variant="ghost"
              disabled={lockedForUser}
              onClick={() => !lockedForUser && duplicateNode(query, actions, selectedId)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </BuilderTip>
          <BuilderTip
            content={
              lockedForUser
                ? "This block is locked by brand guidelines"
                : "Remove this block from the page"
            }
          >
            <Button
              size="icon"
              variant="ghost"
              disabled={!isDeletable || lockedForUser}
              onClick={() => isDeletable && !lockedForUser && actions.delete(selectedId)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </BuilderTip>
        </div>
      </div>

      {/* Learnability bar: complexity level + Help mode (reduce cognitive load). */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
        <BuilderTip content="Guided shows fewer options. Full unlocks every control.">
          <div className="flex items-center gap-0.5 rounded-md bg-muted p-0.5">
            {(
              [
                { key: "simple" as const, label: "Guided" },
                { key: "advanced" as const, label: "Full" },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setUiLevel(key)}
                aria-pressed={uiLevel === key}
                className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  uiLevel === key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </BuilderTip>
        <BuilderTip content="Show a short explanation under every control — great when you're learning the builder">
          <button
            type="button"
            onClick={toggleHelpMode}
            aria-pressed={helpMode}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
              helpMode
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            <HelpCircle className="h-3.5 w-3.5" /> Help
          </button>
        </BuilderTip>
      </div>

      {activeSubPart ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <SubPartPanel part={activeSubPart} breakpoint={breakpoint} />
        </div>
      ) : (
      <Tabs defaultValue="content" className="flex min-h-0 flex-1 flex-col">
        <div className="px-4 pt-3">
          <TabsList className="w-full">
            <TabsTrigger value="content" className="flex-1 px-1 text-xs">
              Content
            </TabsTrigger>
            <TabsTrigger value="layout" className="flex-1 px-1 text-xs">
              Layout
            </TabsTrigger>
            <TabsTrigger value="style" className="flex-1 px-1 text-xs">
              Visual
            </TabsTrigger>
            <TabsTrigger value="motion" className="flex-1 px-1 text-xs">
              Motion
            </TabsTrigger>
            <TabsTrigger value="advanced" className="flex-1 px-1 text-xs">
              Advanced
            </TabsTrigger>
            <BuilderTip content="Check how this block looks on phone and tablet">
              <TabsTrigger value="responsive" className="flex-1 px-1">
                <Smartphone className="h-4 w-4" />
              </TabsTrigger>
            </BuilderTip>
            <BuilderTip content="Accessibility checks — headings, contrast, and more">
              <TabsTrigger value="a11y" className="flex-1 px-1">
                <Accessibility className="h-4 w-4" />
              </TabsTrigger>
            </BuilderTip>
          </TabsList>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <TabsContent value="content" className="flex flex-col gap-4">
            <SiteChromePanel nodeId={selectedId} blockName={name} props={props} />
            {/* COMPONENTS: a Reusable Block node is a component instance — show
                its declared props / variant / slots as override fields. */}
            {name === "Reusable Block" ? (
              <ComponentInstancePanel nodeId={selectedId} />
            ) : name === "Experiment" ? (
              <ExperimentControls nodeId={selectedId} />
            ) : (
              <>
                {name === "Navbar" ? <NavbarNavPanel nodeId={selectedId} props={props} /> : null}
                {name === "Link" ? <LinkStyleControls nodeId={selectedId} props={props} /> : null}
                <ContentControls nodeId={selectedId} blockName={name} schema={entry?.propSchema} props={props} />
              </>
            )}
            {/* GUARDRAILS: define (designer) / surface (contributor) brand locks. */}
            <GuardrailsControls nodeId={selectedId} propNames={propNames} />
          </TabsContent>
          <TabsContent value="layout">
            <LayoutControls nodeId={selectedId} styles={styles} breakpoint={breakpoint} />
          </TabsContent>
          <TabsContent value="style">
            <StyleControls
              nodeId={selectedId}
              styles={styles}
              breakpoint={breakpoint}
              sections="visual"
            />
          </TabsContent>
          <TabsContent value="motion">
            <InteractionsControls nodeId={selectedId} styles={styles} />
          </TabsContent>
          <TabsContent value="advanced">
            <AdvancedControls nodeId={selectedId} styles={styles} blockName={name} />
          </TabsContent>
          <TabsContent value="responsive">
            <ResponsiveAuditPanel />
          </TabsContent>
          <TabsContent value="a11y">
            <A11yPanel />
          </TabsContent>
        </div>
      </Tabs>
      )}
    </div>
    <SaveReusableBlockDialog
      selectedId={reusableTargetIdRef.current ?? selectedId}
      open={saveReusableOpen}
      onOpenChange={onSaveReusableOpenChange}
    />
    </>
  );
};
