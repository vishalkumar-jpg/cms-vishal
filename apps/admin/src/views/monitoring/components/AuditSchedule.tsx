import * as React from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import { Button, Input, Label, Switch, toast } from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuditConfig, useUpdateAuditConfig } from "../hooks/useMonitoring";
import type { AuditAlerts, AuditSchedule as AuditScheduleCfg } from "../api/monitoring.api";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DEFAULT_HOUR = 3;

const num = (v: string): number | undefined => {
  if (v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/** Clamp a UTC hour to 0–23; fall back to the default when unset/invalid. */
const clampHour = (v: number | undefined): number => {
  if (typeof v !== "number" || !Number.isFinite(v)) return DEFAULT_HOUR;
  return Math.min(23, Math.max(0, Math.trunc(v)));
};

type AlertField = keyof Omit<AuditAlerts, "enabled">;

const ALERT_FIELDS: Array<{ key: AlertField; label: string; max?: number; step?: string }> = [
  { key: "performance", label: "Performance ≥", max: 100 },
  { key: "accessibility", label: "Accessibility ≥", max: 100 },
  { key: "seo", label: "SEO ≥", max: 100 },
  { key: "bestPractices", label: "Best practices ≥", max: 100 },
  { key: "lcpMs", label: "LCP ≤ (ms)" },
  { key: "cls", label: "CLS ≤", step: "0.01" },
];

/**
 * Scheduled scans + performance-alert thresholds (Phase 5). Reads/writes the
 * per-site page_audit_config via the monitoring hooks; the worker's hourly sweep
 * acts on the schedule and the dashboard reads the thresholds.
 */
export const AuditSchedule: React.FC<{ online?: boolean }> = ({ online = true }) => {
  const { data: config, isLoading, isError } = useAuditConfig();
  const update = useUpdateAuditConfig();

  const [open, setOpen] = React.useState(false);
  const [schedule, setSchedule] = React.useState<AuditScheduleCfg>({
    enabled: false,
    frequency: "weekly",
    hour: DEFAULT_HOUR,
    dayOfWeek: 1,
  });
  const [alerts, setAlerts] = React.useState<AuditAlerts>({ enabled: false });

  // Sync local form state whenever the stored config loads/changes.
  React.useEffect(() => {
    if (!config) return;
    setSchedule({
      enabled: config.schedule?.enabled ?? false,
      frequency: config.schedule?.frequency ?? "weekly",
      hour: clampHour(config.schedule?.hour),
      dayOfWeek: config.schedule?.dayOfWeek ?? 1,
    });
    setAlerts({ enabled: false, ...config.alerts });
  }, [config]);

  const onSave = (): void => {
    if (!online) {
      toast.error("You’re offline — config changes are paused");
      return;
    }
    const nextSchedule = { ...schedule, hour: clampHour(schedule.hour) };
    setSchedule(nextSchedule);
    update.mutate(
      { schedule: nextSchedule, alerts },
      {
        onSuccess: () => toast.success("PageSpeed schedule & alerts saved"),
        onError: () => toast.error("Could not save the configuration"),
      },
    );
  };

  const setAlert = (key: AlertField, value: string): void =>
    setAlerts((a) => ({ ...a, [key]: num(value) }));

  return (
    <div className="mb-5 rounded-lg border border-border">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-left"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          Scheduled scans & alerts
        </span>
        <span className="text-xs text-muted-foreground">
          {config?.schedule?.enabled ? `${config.schedule.frequency} scan on` : "scans off"}
          {config?.alerts?.enabled ? " · alerts on" : ""}
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-border p-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading configuration…</p>
          ) : isError ? (
            <p className="text-sm text-destructive">Could not load schedule &amp; alert settings.</p>
          ) : (
            <>
              {/* Schedule */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="sched-enabled" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Automatic scans
                  </Label>
                  <Switch
                    id="sched-enabled"
                    checked={schedule.enabled}
                    onCheckedChange={(v) => setSchedule((s) => ({ ...s, enabled: v }))}
                  />
                </div>
                {schedule.enabled && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <Label className="mb-1 block text-xs">Frequency</Label>
                      <Select
                        value={schedule.frequency}
                        onValueChange={(v) => setSchedule((s) => ({ ...s, frequency: v as "daily" | "weekly" }))}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs">Hour (UTC)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={23}
                        step={1}
                        value={schedule.hour ?? DEFAULT_HOUR}
                        onChange={(e) =>
                          setSchedule((s) => ({
                            ...s,
                            hour: clampHour(num(e.target.value) ?? DEFAULT_HOUR),
                          }))
                        }
                      />
                    </div>
                    {schedule.frequency === "weekly" && (
                      <div>
                        <Label className="mb-1 block text-xs">Day</Label>
                        <Select
                          value={String(schedule.dayOfWeek ?? 1)}
                          onValueChange={(v) => setSchedule((s) => ({ ...s, dayOfWeek: Number(v) }))}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {WEEKDAYS.map((d, i) => (
                              <SelectItem key={d} value={String(i)}>
                                {d}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* Alerts */}
              <section className="space-y-3 border-t border-border pt-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="alerts-enabled" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Performance alerts
                  </Label>
                  <Switch
                    id="alerts-enabled"
                    checked={alerts.enabled}
                    onCheckedChange={(v) => setAlerts((a) => ({ ...a, enabled: v }))}
                  />
                </div>
                {alerts.enabled && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {ALERT_FIELDS.map((f) => (
                      <div key={f.key}>
                        <Label className="mb-1 block text-xs">{f.label}</Label>
                        <Input
                          type="number"
                          min={0}
                          max={f.max}
                          step={f.step}
                          value={alerts[f.key] ?? ""}
                          placeholder="—"
                          onChange={(e) => setAlert(f.key, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <div className="flex justify-end">
                <Button size="sm" onClick={onSave} disabled={update.isPending || !online || isError}>
                  {update.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Save
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
