import * as React from "react";
import { useEditorUiStore } from "../store/editorUiStore";
import { Button } from "@/components/ui";

interface TourStep {
  id: string;
  title: string;
  body: string;
  target?: string;
}

const STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to the page builder",
    body: "Design pages visually — drag blocks, edit content, and publish when ready. This quick tour highlights the main areas.",
  },
  {
    id: "sidebar-left",
    title: "Left sidebar — Blocks & assets",
    body: "Insert blocks, browse sections, manage layers, assets, and templates.",
    target: "[data-tour='left-sidebar']",
  },
  {
    id: "canvas",
    title: "Canvas",
    body: "Your page lives here. Click to select, drag to reorder (Structure mode), double-click text to edit.",
    target: "[data-builder-canvas]",
  },
  {
    id: "toolbar",
    title: "Toolbar",
    body: "Switch devices, toggle grid/rulers, preview, save, and publish.",
    target: "[data-tour='builder-toolbar']",
  },
  {
    id: "properties",
    title: "Properties panel",
    body: "Style and configure the selected block — colors, spacing, animations, and responsive overrides.",
    target: "[data-tour='property-panel']",
  },
  {
    id: "cmd",
    title: "Command palette",
    body: "Press ⌘K (Ctrl+K) to search actions, jump to settings, diagnostics, and more.",
  },
  {
    id: "done",
    title: "You're ready!",
    body: "Turn on Help mode in the property panel anytime for extra guidance. Restart this tour from Help → Guided tour.",
  },
];

/** First-run spotlight onboarding. */
export const OnboardingTour: React.FC = () => {
  const completed = useEditorUiStore((s) => s.onboardingCompleted);
  const setCompleted = useEditorUiStore((s) => s.setOnboardingCompleted);
  const [step, setStep] = React.useState(0);
  const [spot, setSpot] = React.useState<DOMRect | null>(null);

  const current = STEPS[step];

  React.useEffect(() => {
    if (completed) return;
    const sel = current?.target;
    if (!sel) {
      setSpot(null);
      return;
    }
    const el = document.querySelector(sel);
    if (!el) {
      setSpot(null);
      return;
    }
    const update = (): void => setSpot(el.getBoundingClientRect());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [completed, current?.target, step]);

  if (completed) return null;

  const finish = (): void => setCompleted(true);
  const next = (): void => {
    if (step >= STEPS.length - 1) finish();
    else setStep((s) => s + 1);
  };

  return (
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal aria-labelledby="onboarding-title">
      <div className="absolute inset-0 bg-black/50" onClick={finish} aria-hidden />
      {spot ? (
        <div
          className="pointer-events-none absolute rounded-md ring-2 ring-primary ring-offset-2 ring-offset-transparent"
          style={{
            left: spot.left - 4,
            top: spot.top - 4,
            width: spot.width + 8,
            height: spot.height + 8,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
          }}
        />
      ) : null}
      <div className="absolute bottom-8 left-1/2 w-[min(420px,calc(100%-2rem))] -translate-x-1/2 rounded-lg border border-border bg-card p-4 shadow-xl">
        <p className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">
          Step {step + 1} of {STEPS.length}
        </p>
        <h2 id="onboarding-title" className="mb-2 text-sm font-semibold">
          {current.title}
        </h2>
        <p className="mb-4 text-xs leading-relaxed text-muted-foreground">{current.body}</p>
        <div className="flex justify-between gap-2">
          <Button size="sm" variant="ghost" onClick={finish}>
            Skip tour
          </Button>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
              Previous
            </Button>
            <Button size="sm" onClick={next}>
              {step >= STEPS.length - 1 ? "Finish" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

/** Restart hook for Help menu. */
export const restartOnboarding = (): void => {
  useEditorUiStore.getState().setOnboardingCompleted(false);
};
