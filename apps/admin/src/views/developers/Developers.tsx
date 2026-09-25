import * as React from "react";
import { KeyRound, MoreHorizontal, Plus, Send, ScrollText, Trash2, Webhook as WebhookIcon } from "lucide-react";
import { Button } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toaster";
import { useConfirm } from "@/components/ui/confirm-provider";
import { DELETE_CONFIRM_LABEL, REVOKE_CONFIRM_LABEL } from "@/components/ui/confirm-labels";
import { useSiteStore } from "@/store/siteStore";
import { ApiKeyDialog } from "./components/ApiKeyDialog";
import { WebhookDialog } from "./components/WebhookDialog";
import { DeliveryLogDialog } from "./components/DeliveryLogDialog";
import {
  useApiKeys,
  useDeleteWebhook,
  useRevokeApiKey,
  useSendTestWebhook,
  useWebhooks,
} from "./hooks/useDevelopers";
import type { ApiKey, Webhook } from "./types";

export const Developers: React.FC = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  const [keyDialogOpen, setKeyDialogOpen] = React.useState(false);
  const [webhookDialogOpen, setWebhookDialogOpen] = React.useState(false);
  const [editingWebhook, setEditingWebhook] = React.useState<Webhook | null>(null);
  const [logWebhook, setLogWebhook] = React.useState<Webhook | null>(null);
  const [logOpen, setLogOpen] = React.useState(false);

  const { data: apiKeys = [], isLoading: keysLoading, isError: keysError } = useApiKeys();
  const { data: webhooks = [], isLoading: hooksLoading, isError: hooksError } = useWebhooks();
  const revokeKey = useRevokeApiKey();
  const deleteWebhook = useDeleteWebhook();
  const sendTest = useSendTestWebhook();
  const confirm = useConfirm();

  const doRevokeKey = (apiKey: ApiKey): void => {
    void (async () => {
      const ok = await confirm({
        title: `Revoke "${apiKey.name}"?`,
        description: "This API key will stop working immediately. This action cannot be undone.",
        confirmLabel: REVOKE_CONFIRM_LABEL,
        destructive: true,
      });
      if (!ok) return;
      revokeKey.mutate(apiKey.id, {
        onSuccess: () => toast.success("API key revoked"),
        onError: () => toast.error("Revoke failed"),
      });
    })();
  };

  const doDeleteWebhook = (webhook: Webhook): void => {
    void (async () => {
      const ok = await confirm({
        title: "Delete this webhook?",
        description: "The webhook endpoint and its delivery history will be permanently removed.",
        confirmLabel: DELETE_CONFIRM_LABEL,
        destructive: true,
      });
      if (!ok) return;
      deleteWebhook.mutate(webhook.id, {
        onSuccess: () => toast.success("Webhook deleted"),
        onError: () => toast.error("Delete failed"),
      });
    })();
  };

  const openCreateWebhook = (): void => {
    setEditingWebhook(null);
    setWebhookDialogOpen(true);
  };
  const openEditWebhook = (w: Webhook): void => {
    setEditingWebhook(w);
    setWebhookDialogOpen(true);
  };
  const openLog = (w: Webhook): void => {
    setLogWebhook(w);
    setLogOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">API &amp; Webhooks</h1>
        <p className="text-sm text-muted-foreground">
          Read-only Content API keys and outbound webhooks for this site.
        </p>
      </div>

      <Tabs defaultValue="keys">
        <TabsList>
          <TabsTrigger value="keys">
            <KeyRound className="mr-1.5 h-4 w-4" /> API keys
          </TabsTrigger>
          <TabsTrigger value="webhooks">
            <WebhookIcon className="mr-1.5 h-4 w-4" /> Webhooks
          </TabsTrigger>
        </TabsList>

        {/* --- API KEYS --- */}
        <TabsContent value="keys" className="mt-4">
          <div className="mb-4 flex items-center justify-end">
            <Button onClick={() => setKeyDialogOpen(true)} disabled={!siteId}>
              <Plus className="mr-1.5 h-4 w-4" /> New API key
            </Button>
          </div>
          <div className="-mx-4 overflow-x-auto rounded-lg border border-border px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Key</th>
                  <th className="px-4 py-3 font-medium">Last used</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {!siteId && <EmptyRow cols={5} icon="key" text="Select a site to view its keys." />}
                {siteId && keysLoading && <EmptyRow cols={5} icon="key" text="Loading keys…" />}
                {siteId && keysError && <EmptyRow cols={5} icon="key" text="Could not load keys." />}
                {siteId && !keysLoading && !keysError && apiKeys.length === 0 && (
                  <EmptyRow cols={5} icon="key" text="No API keys yet. Create your first key." />
                )}
                {apiKeys.map((k) => (
                  <ApiKeyRow
                    key={k.id}
                    apiKey={k}
                    onRevoke={() => doRevokeKey(k)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* --- WEBHOOKS --- */}
        <TabsContent value="webhooks" className="mt-4">
          <div className="mb-4 flex items-center justify-end">
            <Button onClick={openCreateWebhook} disabled={!siteId}>
              <Plus className="mr-1.5 h-4 w-4" /> New webhook
            </Button>
          </div>
          <div className="-mx-4 overflow-x-auto rounded-lg border border-border px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">URL</th>
                  <th className="px-4 py-3 font-medium">Events</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {!siteId && <EmptyRow cols={4} icon="hook" text="Select a site to view its webhooks." />}
                {siteId && hooksLoading && <EmptyRow cols={4} icon="hook" text="Loading webhooks…" />}
                {siteId && hooksError && <EmptyRow cols={4} icon="hook" text="Could not load webhooks." />}
                {siteId && !hooksLoading && !hooksError && webhooks.length === 0 && (
                  <EmptyRow cols={4} icon="hook" text="No webhooks yet. Add your first endpoint." />
                )}
                {webhooks.map((w) => (
                  <WebhookRow
                    key={w.id}
                    webhook={w}
                    onEdit={() => openEditWebhook(w)}
                    onLog={() => openLog(w)}
                    onTest={() =>
                      sendTest.mutate(w.id, {
                        onSuccess: () => toast.success("Test event sent"),
                        onError: () => toast.error("Could not send test event"),
                      })
                    }
                    onDelete={() => doDeleteWebhook(w)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <ApiKeyDialog open={keyDialogOpen} onOpenChange={setKeyDialogOpen} />
      <WebhookDialog
        webhook={editingWebhook}
        open={webhookDialogOpen}
        onOpenChange={setWebhookDialogOpen}
      />
      <DeliveryLogDialog webhook={logWebhook} open={logOpen} onOpenChange={setLogOpen} />
    </div>
  );
};

const EmptyRow: React.FC<{ cols: number; text: string; icon: "key" | "hook" }> = ({
  cols,
  text,
  icon,
}) => (
  <tr>
    <td colSpan={cols} className="px-4 py-10 text-center text-sm text-muted-foreground">
      {icon === "key" ? (
        <KeyRound className="mx-auto mb-2 h-6 w-6 opacity-40" />
      ) : (
        <WebhookIcon className="mx-auto mb-2 h-6 w-6 opacity-40" />
      )}
      {text}
    </td>
  </tr>
);

const ApiKeyRow: React.FC<{ apiKey: ApiKey; onRevoke: () => void }> = ({ apiKey, onRevoke }) => {
  const revoked = !!apiKey.revokedAt;
  return (
    <tr className="hover:bg-muted/30">
      <td className="px-4 py-3 font-medium">{apiKey.name}</td>
      <td className="px-4 py-3">
        <code className="text-xs text-muted-foreground">{apiKey.keyPrefix}…</code>
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {apiKey.lastUsedAt ? new Date(apiKey.lastUsedAt).toLocaleDateString() : "Never"}
      </td>
      <td className="px-4 py-3">
        <Badge variant={revoked ? "destructive" : "success"}>{revoked ? "Revoked" : "Active"}</Badge>
      </td>
      <td className="px-4 py-3 text-right">
        {!revoked && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onRevoke} className="text-destructive">
                <Trash2 className="h-4 w-4" /> {REVOKE_CONFIRM_LABEL}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </td>
    </tr>
  );
};

const WebhookRow: React.FC<{
  webhook: Webhook;
  onEdit: () => void;
  onLog: () => void;
  onTest: () => void;
  onDelete: () => void;
}> = ({ webhook, onEdit, onLog, onTest, onDelete }) => (
  <tr className="hover:bg-muted/30">
    <td className="max-w-xs truncate px-4 py-3 font-medium">{webhook.url}</td>
    <td className="px-4 py-3">
      <div className="flex flex-wrap gap-1">
        {webhook.events.map((e) => (
          <Badge key={e} variant="muted">
            {e}
          </Badge>
        ))}
      </div>
    </td>
    <td className="px-4 py-3">
      <Badge variant={webhook.active ? "success" : "muted"}>
        {webhook.active ? "Active" : "Paused"}
      </Badge>
    </td>
    <td className="px-4 py-3 text-right">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onTest}>
            <Send className="h-4 w-4" /> Send test event
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onLog}>
            <ScrollText className="h-4 w-4" /> Delivery log
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
          <DropdownMenuItem onClick={onDelete} className="text-destructive">
            <Trash2 className="h-4 w-4" /> {DELETE_CONFIRM_LABEL}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </td>
  </tr>
);
