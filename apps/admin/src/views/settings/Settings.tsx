import * as React from "react";
import { Trash2, Plus, AlertTriangle } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { toast } from "@/components/ui/toaster";
import { useConfirm } from "@/components/ui/confirm-provider";
import { PURGE_CACHE_CONFIRM_LABEL } from "@/components/ui/confirm-labels";
import { useSiteStore } from "@/store/siteStore";
import {
  useCdn,
  useConsentConfig,
  useIntegrations,
  useLocales,
  usePurgeCache,
  useRetentionConfig,
  useUpdateCdn,
  useUpdateConsentConfig,
  useUpdateIntegrations,
  useUpdateLocales,
  useUpdateRetentionConfig,
} from "./hooks/useSettings";
import type {
  CachePurgeScope,
  CdnRule,
  ConsentConfig,
  RetentionConfig,
  SiteIntegrations,
} from "./types";

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

const Field: React.FC<{ label: string; htmlFor: string; hint?: string; children: React.ReactNode }> = ({
  label,
  htmlFor,
  hint,
  children,
}) => (
  <div className="space-y-1.5">
    <Label htmlFor={htmlFor}>{label}</Label>
    {children}
    {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
  </div>
);

const PageHeader: React.FC = () => (
  <>
    <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
    <p className="mt-1 text-sm text-muted-foreground">
      Per-site integrations and CDN cache controls.
    </p>
  </>
);

/* ------------------------------------------------------------------ */
/* Integrations tab                                                    */
/* ------------------------------------------------------------------ */

const IntegrationsTab: React.FC = () => {
  const { data, isLoading } = useIntegrations();
  const update = useUpdateIntegrations();

  const [form, setForm] = React.useState<SiteIntegrations>({});

  React.useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const set = (key: keyof SiteIntegrations, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const onSave = () => {
    // Drop empty strings so the API stores undefined / clears the column.
    const payload: SiteIntegrations = {};
    (Object.keys(form) as (keyof SiteIntegrations)[]).forEach((k) => {
      const v = form[k];
      if (typeof v === "string" && v.trim() !== "") payload[k] = v.trim();
    });
    update.mutate(payload, {
      onSuccess: () => toast.success("Integrations saved"),
      onError: () => toast.error("Failed to save integrations"),
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          Loading integrations…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Analytics & chat</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="GA4 Measurement ID" htmlFor="ga4" hint="e.g. G-XXXXXXXXXX">
              <Input
                id="ga4"
                value={form.ga4MeasurementId ?? ""}
                placeholder="G-XXXXXXXXXX"
                onChange={(e) => set("ga4MeasurementId", e.target.value)}
              />
            </Field>
            <Field label="GTM Container ID" htmlFor="gtm" hint="e.g. GTM-XXXXXXX">
              <Input
                id="gtm"
                value={form.gtmId ?? ""}
                placeholder="GTM-XXXXXXX"
                onChange={(e) => set("gtmId", e.target.value)}
              />
            </Field>
            <Field
              label="Live chat widget ID"
              htmlFor="chat"
              hint="Tawk.to property/widget id"
            >
              <Input
                id="chat"
                value={form.liveChatId ?? ""}
                placeholder="5f…/default"
                onChange={(e) => set("liveChatId", e.target.value)}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Custom scripts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              These scripts run on <strong>every page</strong> of your public site. Only paste
              code you trust — broken markup can break page rendering.
            </span>
          </div>
          <Field label="Head scripts" htmlFor="head" hint="Injected into <head> on every page.">
            <Textarea
              id="head"
              spellCheck={false}
              rows={6}
              className="font-mono text-xs"
              value={form.headScripts ?? ""}
              placeholder={'<meta name="..." />'}
              onChange={(e) => set("headScripts", e.target.value)}
            />
          </Field>
          <Field
            label="Body scripts"
            htmlFor="body"
            hint="Injected at the end of <body> on every page."
          >
            <Textarea
              id="body"
              spellCheck={false}
              rows={6}
              className="font-mono text-xs"
              value={form.bodyScripts ?? ""}
              placeholder={"<script>/* … */</script>"}
              onChange={(e) => set("bodyScripts", e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="button" onClick={onSave} disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save integrations"}
        </Button>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* CDN tab                                                             */
/* ------------------------------------------------------------------ */

const CdnTab: React.FC = () => {
  const { data, isLoading } = useCdn();
  const update = useUpdateCdn();
  const purge = usePurgeCache();
  const confirm = useConfirm();

  const [defaultTtl, setDefaultTtl] = React.useState<string>("");
  const [rules, setRules] = React.useState<CdnRule[]>([]);
  const [scope, setScope] = React.useState<CachePurgeScope>("all");
  const [purgePath, setPurgePath] = React.useState<string>("");

  React.useEffect(() => {
    if (!data) return;
    setDefaultTtl(data.defaultTtlSeconds != null ? String(data.defaultTtlSeconds) : "");
    setRules(data.rules ?? []);
  }, [data]);

  const setRule = (i: number, patch: Partial<CdnRule>) =>
    setRules((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRule = () => setRules((prev) => [...prev, { pattern: "", ttl: 3600 }]);
  const removeRule = (i: number) => setRules((prev) => prev.filter((_, idx) => idx !== i));

  const onSave = () => {
    update.mutate(
      {
        defaultTtlSeconds: defaultTtl.trim() === "" ? undefined : Number(defaultTtl),
        rules: rules
          .filter((r) => r.pattern.trim() !== "")
          .map((r) => ({ pattern: r.pattern.trim(), ttl: Number(r.ttl) || 0 })),
      },
      {
        onSuccess: () => toast.success("CDN config saved"),
        onError: () => toast.error("Failed to save CDN config"),
      },
    );
  };

  const onPurge = (): void => {
    void (async () => {
      const isFullPurge = scope === "all";
      const ok = await confirm({
        title: isFullPurge ? "Purge entire CDN cache?" : `Purge cache for "${purgePath.trim() || "/"}"?`,
        description: isFullPurge
          ? "All cached pages and assets will be refreshed from origin. Traffic may briefly hit your servers more heavily."
          : "Cached content for this path will be refreshed from origin.",
        confirmLabel: PURGE_CACHE_CONFIRM_LABEL,
        destructive: true,
      });
      if (!ok) return;
      purge.mutate(
        { scope, path: scope === "path" ? purgePath.trim() || "/" : undefined },
        {
          onSuccess: (r) =>
            toast.success(
              r.scope === "path" ? `Purge queued for ${r.path}` : "Full cache purge queued",
            ),
          onError: () => toast.error("Failed to queue purge"),
        },
      );
    })();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          Loading CDN config…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cache rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            label="Default TTL (seconds)"
            htmlFor="default-ttl"
            hint="Edge cache lifetime when no rule matches."
          >
            <Input
              id="default-ttl"
              type="number"
              min={0}
              value={defaultTtl}
              placeholder="300"
              onChange={(e) => setDefaultTtl(e.target.value)}
              className="max-w-[200px]"
            />
          </Field>

          <div className="space-y-2">
            <Label>Path rules</Label>
            {rules.length === 0 ? (
              <p className="text-xs text-muted-foreground">No rules — the default TTL applies.</p>
            ) : (
              <div className="space-y-2">
                {rules.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      aria-label="Path pattern"
                      value={r.pattern}
                      placeholder="/blog/*"
                      onChange={(e) => setRule(i, { pattern: e.target.value })}
                    />
                    <Input
                      aria-label="TTL seconds"
                      type="number"
                      min={0}
                      value={r.ttl}
                      placeholder="3600"
                      className="max-w-[140px]"
                      onChange={(e) => setRule(i, { ttl: Number(e.target.value) })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove rule"
                      onClick={() => removeRule(i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button type="button" variant="outline" size="sm" onClick={addRule}>
              <Plus className="h-4 w-4" /> Add rule
            </Button>
          </div>

          <div className="flex justify-end">
            <Button type="button" onClick={onSave} disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save CDN config"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Purge cache</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Clear the rendered-page cache so changes go live immediately.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Scope" htmlFor="purge-scope">
              <Select value={scope} onValueChange={(v) => setScope(v as CachePurgeScope)}>
                <SelectTrigger id="purge-scope" className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Entire site</SelectItem>
                  <SelectItem value="path">Single path</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {scope === "path" ? (
              <Field label="Path" htmlFor="purge-path">
                <Input
                  id="purge-path"
                  value={purgePath}
                  placeholder="/pricing"
                  onChange={(e) => setPurgePath(e.target.value)}
                  className="w-[240px]"
                />
              </Field>
            ) : null}
            <Button type="button" variant="outline" onClick={onPurge} disabled={purge.isPending}>
              {purge.isPending ? "Queuing…" : PURGE_CACHE_CONFIRM_LABEL}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Locales tab (i18n / B13)                                            */
/* ------------------------------------------------------------------ */

const LOCALE_RE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/;

const LocalesTab: React.FC = () => {
  const { data, isLoading } = useLocales();
  const update = useUpdateLocales();

  const [defaultLocale, setDefaultLocale] = React.useState("en");
  const [locales, setLocales] = React.useState<string[]>(["en"]);
  const [newLocale, setNewLocale] = React.useState("");

  React.useEffect(() => {
    if (!data) return;
    setDefaultLocale(data.defaultLocale);
    setLocales(data.locales);
  }, [data]);

  const addLocale = () => {
    const code = newLocale.trim().toLowerCase();
    if (!LOCALE_RE.test(code)) {
      toast.error("Enter a locale code like 'es' or 'pt-br'");
      return;
    }
    if (locales.includes(code)) {
      toast.error("That locale is already added");
      return;
    }
    setLocales((prev) => [...prev, code]);
    setNewLocale("");
  };

  const removeLocale = (code: string) => {
    if (code === defaultLocale) {
      toast.error("Cannot remove the default locale");
      return;
    }
    setLocales((prev) => prev.filter((l) => l !== code));
  };

  const onSave = () => {
    // The default locale is always part of the set; the API enforces this too.
    const set = [...new Set([defaultLocale, ...locales])];
    update.mutate(
      { defaultLocale, locales: set },
      {
        onSuccess: (saved) => {
          setDefaultLocale(saved.defaultLocale);
          setLocales(saved.locales);
          toast.success("Locales saved");
        },
        onError: () => toast.error("Failed to save locales"),
      },
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          Loading locales…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Languages & locales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The <strong>default locale</strong> is served at your normal URLs (no prefix). Every
            other locale is served under a path prefix — e.g. <code>/es/about</code>.
          </p>
          <Field label="Default locale" htmlFor="default-locale" hint="Served without a URL prefix.">
            <Select value={defaultLocale} onValueChange={setDefaultLocale}>
              <SelectTrigger id="default-locale" className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {locales.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="space-y-2">
            <Label>Enabled locales</Label>
            <div className="flex flex-wrap gap-2">
              {locales.map((l) => (
                <span
                  key={l}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium"
                >
                  {l}
                  {l === defaultLocale ? (
                    <span className="text-[10px] text-muted-foreground">(default)</span>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Remove ${l}`}
                      onClick={() => removeLocale(l)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Input
                aria-label="New locale code"
                value={newLocale}
                placeholder="e.g. es, fr, pt-br"
                className="max-w-[200px]"
                onChange={(e) => setNewLocale(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addLocale();
                  }
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={addLocale}>
                <Plus className="h-4 w-4" /> Add locale
              </Button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="button" onClick={onSave} disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save locales"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Privacy & Consent tab                                               */
/* ------------------------------------------------------------------ */

const PrivacyConsentTab: React.FC = () => {
  const { data: consentData, isLoading: consentLoading } = useConsentConfig();
  const { data: retentionData } = useRetentionConfig();
  const updateConsent = useUpdateConsentConfig();
  const updateRetention = useUpdateRetentionConfig();

  const [consent, setConsent] = React.useState<ConsentConfig>({});
  const [retention, setRetention] = React.useState<RetentionConfig>({});

  React.useEffect(() => {
    if (consentData) setConsent(consentData);
  }, [consentData]);
  React.useEffect(() => {
    if (retentionData) setRetention(retentionData);
  }, [retentionData]);

  const setC = <K extends keyof ConsentConfig>(key: K, value: ConsentConfig[K]): void =>
    setConsent((prev) => ({ ...prev, [key]: value }));
  const setR = <K extends keyof RetentionConfig>(key: K, value: RetentionConfig[K]): void =>
    setRetention((prev) => ({ ...prev, [key]: value }));

  const saveConsent = (): void => {
    updateConsent.mutate(consent, {
      onSuccess: () => toast.success("Consent settings saved"),
      onError: () => toast.error("Failed to save consent settings"),
    });
  };
  const saveRetention = (): void => {
    updateRetention.mutate(
      {
        rawEventRetentionDays: retention.rawEventRetentionDays
          ? Number(retention.rawEventRetentionDays)
          : undefined,
        piiRetentionDays:
          retention.piiRetentionDays !== undefined && retention.piiRetentionDays !== null
            ? Number(retention.piiRetentionDays)
            : undefined,
      },
      {
        onSuccess: () => toast.success("Retention windows saved"),
        onError: () => toast.error("Failed to save retention windows"),
      },
    );
  };

  if (consentLoading) {
    return (
      <Card>
        <CardContent className="py-10 text-sm text-muted-foreground">Loading…</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cookie consent banner</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label>Enable the consent banner</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                When on, trackers (analytics, experiments, attribution, identity)
                only fire AFTER the visitor consents. When off, tracking behaves
                as before.
              </p>
            </div>
            <Switch
              checked={consent.enabled ?? false}
              onCheckedChange={(v: boolean) => setC("enabled", v)}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Mode" htmlFor="consent-mode" hint="EU-only is an IP-geo seam; renders like 'all' until an edge geo header is wired.">
              <Select
                value={consent.mode ?? "all"}
                onValueChange={(v: string) => setC("mode", v as ConsentConfig["mode"])}
              >
                <SelectTrigger id="consent-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Show to everyone</SelectItem>
                  <SelectItem value="eu">EU only (seam)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Position" htmlFor="consent-position">
              <Select
                value={consent.position ?? "bottom"}
                onValueChange={(v: string) => setC("position", v as ConsentConfig["position"])}
              >
                <SelectTrigger id="consent-position">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom">Bottom (full width)</SelectItem>
                  <SelectItem value="top">Top (full width)</SelectItem>
                  <SelectItem value="bottom-left">Bottom left</SelectItem>
                  <SelectItem value="bottom-right">Bottom right</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Policy version" htmlFor="consent-version" hint="Bump this to re-prompt every visitor.">
              <Input
                id="consent-version"
                value={consent.policyVersion ?? ""}
                onChange={(e) => setC("policyVersion", e.target.value)}
                placeholder="1"
              />
            </Field>
            <Field label="Privacy policy URL" htmlFor="consent-url">
              <Input
                id="consent-url"
                value={consent.policyUrl ?? ""}
                onChange={(e) => setC("policyUrl", e.target.value)}
                placeholder="/privacy"
              />
            </Field>
            <Field label="Accent color" htmlFor="consent-accent">
              <Input
                id="consent-accent"
                value={consent.accentColor ?? ""}
                onChange={(e) => setC("accentColor", e.target.value)}
                placeholder="#111827"
              />
            </Field>
          </div>

          <Field label="Banner title" htmlFor="consent-title">
            <Input
              id="consent-title"
              value={consent.title ?? ""}
              onChange={(e) => setC("title", e.target.value)}
              placeholder="We value your privacy"
            />
          </Field>
          <Field label="Banner message" htmlFor="consent-message">
            <Textarea
              id="consent-message"
              rows={2}
              value={consent.message ?? ""}
              onChange={(e) => setC("message", e.target.value)}
            />
          </Field>
          <Field label="Analytics category description" htmlFor="consent-analytics-desc">
            <Textarea
              id="consent-analytics-desc"
              rows={2}
              value={consent.analyticsDescription ?? ""}
              onChange={(e) => setC("analyticsDescription", e.target.value)}
            />
          </Field>
          <Field label="Marketing category description" htmlFor="consent-marketing-desc">
            <Textarea
              id="consent-marketing-desc"
              rows={2}
              value={consent.marketingDescription ?? ""}
              onChange={(e) => setC("marketingDescription", e.target.value)}
            />
          </Field>

          <div className="flex justify-end">
            <Button type="button" onClick={saveConsent} disabled={updateConsent.isPending}>
              {updateConsent.isPending ? "Saving…" : "Save consent settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data retention</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Raw event retention (days)"
              htmlFor="retention-events"
              hint="Analytics events older than this are purged daily by the worker (default 400). Dashboards use the daily rollup, so they're unaffected."
            >
              <Input
                id="retention-events"
                type="number"
                min={1}
                value={retention.rawEventRetentionDays ?? ""}
                onChange={(e) =>
                  setR("rawEventRetentionDays", e.target.value ? Number(e.target.value) : undefined)
                }
                placeholder="400"
              />
            </Field>
            <Field
              label="PII retention (days)"
              htmlFor="retention-pii"
              hint="Anonymize identities not seen for this many days. 0 = never."
            >
              <Input
                id="retention-pii"
                type="number"
                min={0}
                value={retention.piiRetentionDays ?? ""}
                onChange={(e) =>
                  setR("piiRetentionDays", e.target.value ? Number(e.target.value) : 0)
                }
                placeholder="0"
              />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={saveRetention} disabled={updateRetention.isPending}>
              {updateRetention.isPending ? "Saving…" : "Save retention windows"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Settings (tabs shell)                                               */
/* ------------------------------------------------------------------ */

export const Settings: React.FC = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);

  if (!siteId) {
    return (
      <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
        <PageHeader />
        <Card className="mt-8">
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Select a site to edit its settings.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
      <PageHeader />
      <Tabs defaultValue="integrations" className="mt-8">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="w-max min-w-full sm:min-w-0">
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="privacy">Privacy &amp; Consent</TabsTrigger>
          <TabsTrigger value="locales">Locales</TabsTrigger>
          <TabsTrigger value="cdn">CDN</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="integrations" className="mt-6">
          <IntegrationsTab />
        </TabsContent>
        <TabsContent value="privacy" className="mt-6">
          <PrivacyConsentTab />
        </TabsContent>
        <TabsContent value="locales" className="mt-6">
          <LocalesTab />
        </TabsContent>
        <TabsContent value="cdn" className="mt-6">
          <CdnTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};
