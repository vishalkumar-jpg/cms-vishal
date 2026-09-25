import { useState } from "react";
import { ShieldCheck, ShieldOff, Copy, Check, Download, KeyRound } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@/components/ui";
import { toast } from "@/components/ui/toaster";
import {
  useCurrentUser,
  useDisable2fa,
  useEnable2fa,
  useRegenerateBackupCodes,
  useSetup2fa,
} from "@/views/auth/hooks/useAuth";
import type { TwoFactorSetup } from "@/views/auth/api/auth.api";

/**
 * Account security (C21). Scoped to the logged-in user:
 *  - enable/disable 2FA (TOTP): setup shows a scannable QR (+ manual secret) to
 *    add to an authenticator app, then verify a code to turn it on,
 *  - on enable/regenerate, single-use BACKUP RECOVERY CODES are shown exactly
 *    once (copy/download + "save these" warning),
 *  - a note about active sessions (access cookie 15m + rotating refresh).
 */
export const Security = () => {
  // `useCurrentUser` keeps the auth store + `totpEnabled` flag fresh.
  const meQuery = useCurrentUser();
  const totpEnabled = Boolean(meQuery.data?.totpEnabled);

  const setup = useSetup2fa();
  const enable = useEnable2fa();
  const disable = useDisable2fa();
  const regenerate = useRegenerateBackupCodes();

  const [pending, setPending] = useState<TwoFactorSetup | null>(null);
  const [code, setCode] = useState("");
  const [disableValue, setDisableValue] = useState("");
  const [copied, setCopied] = useState(false);
  // Backup codes are held in state ONLY to show them once; never refetched.
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [regenValue, setRegenValue] = useState("");
  const [showRegen, setShowRegen] = useState(false);

  const onStartSetup = async (): Promise<void> => {
    try {
      const data = await setup.mutateAsync();
      setPending(data);
    } catch {
      toast.error("Could not start 2FA setup");
    }
  };

  const onEnable = async (): Promise<void> => {
    try {
      const { backupCodes: codes } = await enable.mutateAsync(code.trim());
      toast.success("Two-factor authentication enabled");
      setPending(null);
      setCode("");
      setBackupCodes(codes);
    } catch {
      toast.error("Invalid code — try the current code from your app");
    }
  };

  const onDisable = async (): Promise<void> => {
    const value = disableValue.trim();
    // A 6-digit value is treated as a TOTP code; anything else as a password.
    const args = /^\d{6}$/.test(value) ? { code: value } : { password: value };
    try {
      await disable.mutateAsync(args);
      toast.success("Two-factor authentication disabled");
      setDisableValue("");
      setBackupCodes(null);
    } catch {
      toast.error("Could not disable 2FA — check your code or password");
    }
  };

  const onRegenerate = async (): Promise<void> => {
    const value = regenValue.trim();
    const args = /^\d{6}$/.test(value) ? { code: value } : { password: value };
    try {
      const { backupCodes: codes } = await regenerate.mutateAsync(args);
      toast.success("New backup codes generated — old codes no longer work");
      setBackupCodes(codes);
      setRegenValue("");
      setShowRegen(false);
    } catch {
      toast.error("Could not regenerate — check your code or password");
    }
  };

  const copy = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed");
    }
  };

  const downloadCodes = (codes: string[]): void => {
    const body =
      "OB-CMS two-factor backup recovery codes\n" +
      "Each code works once. Keep them somewhere safe.\n\n" +
      codes.join("\n") +
      "\n";
    const blob = new Blob([body], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ob-cms-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold">Security</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage two-factor authentication and review your active sessions.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {totpEnabled ? (
              <ShieldCheck className="h-5 w-5 text-primary" />
            ) : (
              <ShieldOff className="h-5 w-5 text-muted-foreground" />
            )}
            Two-factor authentication (TOTP)
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {totpEnabled
              ? "2FA is ON. You'll be asked for a 6-digit code from your authenticator app at sign-in."
              : "Add an extra step at sign-in using an authenticator app (Google Authenticator, 1Password, Authy)."}
          </p>

          {!totpEnabled && !pending && (
            <Button onClick={onStartSetup} disabled={setup.isPending} className="w-fit">
              {setup.isPending ? "Preparing…" : "Set up 2FA"}
            </Button>
          )}

          {!totpEnabled && pending && (
            <div className="flex flex-col gap-3 rounded-md border border-border p-4">
              <p className="text-sm">
                Scan this QR with your authenticator app, then enter the current code to confirm.
              </p>
              <div className="flex justify-center">
                <img
                  src={pending.qrDataUri}
                  alt="Scan this QR code with your authenticator app"
                  width={200}
                  height={200}
                  className="rounded border border-border bg-white p-2"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Or enter this secret key manually</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all rounded bg-muted px-2 py-1 text-xs">
                    {pending.secret}
                  </code>
                  <Button variant="ghost" size="icon" onClick={() => copy(pending.secret)}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="totp-enable">Verification code</Label>
                <Input
                  id="totp-enable"
                  placeholder="123456"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={onEnable} disabled={enable.isPending || code.trim().length < 6}>
                  {enable.isPending ? "Verifying…" : "Verify & enable"}
                </Button>
                <Button variant="ghost" onClick={() => setPending(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {backupCodes && (
            <div className="flex flex-col gap-3 rounded-md border border-amber-500/60 bg-amber-50/50 p-4 dark:bg-amber-950/20">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-amber-600" />
                <p className="text-sm font-medium">Save your backup recovery codes</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Each code works <strong>once</strong> and lets you sign in if you lose your
                authenticator. They are shown only this once — store them somewhere safe.
              </p>
              <div className="grid grid-cols-2 gap-2 rounded bg-muted p-3 font-mono text-sm">
                {backupCodes.map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => copy(backupCodes.join("\n"))}>
                  {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
                  Copy
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadCodes(backupCodes)}>
                  <Download className="mr-1 h-4 w-4" />
                  Download
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setBackupCodes(null)}>
                  I've saved them
                </Button>
              </div>
            </div>
          )}

          {totpEnabled && (
            <div className="flex flex-col gap-3 rounded-md border border-border p-4">
              <div className="flex flex-col gap-2">
                <Label>Backup recovery codes</Label>
                <p className="text-xs text-muted-foreground">
                  Regenerating creates a new set and invalidates any old codes. Verify with a
                  current 6-digit code or your password.
                </p>
                {!showRegen ? (
                  <Button
                    variant="outline"
                    className="w-fit"
                    onClick={() => setShowRegen(true)}
                  >
                    Regenerate backup codes
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Code or password"
                      type="text"
                      value={regenValue}
                      onChange={(e) => setRegenValue(e.target.value)}
                    />
                    <Button
                      onClick={onRegenerate}
                      disabled={regenerate.isPending || regenValue.trim().length === 0}
                    >
                      {regenerate.isPending ? "Working…" : "Regenerate"}
                    </Button>
                    <Button variant="ghost" onClick={() => setShowRegen(false)}>
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <Label htmlFor="totp-disable">Disable 2FA</Label>
                <p className="text-xs text-muted-foreground">
                  Enter a current 6-digit code or your account password to turn 2FA off.
                </p>
                <div className="flex gap-2">
                  <Input
                    id="totp-disable"
                    placeholder="Code or password"
                    type="text"
                    value={disableValue}
                    onChange={(e) => setDisableValue(e.target.value)}
                  />
                  <Button
                    variant="destructive"
                    onClick={onDisable}
                    disabled={disable.isPending || disableValue.trim().length === 0}
                  >
                    {disable.isPending ? "Disabling…" : "Disable"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active sessions</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Your session uses a short-lived access cookie (15 minutes) plus a rotating refresh
            cookie (7 days). The admin transparently refreshes the access cookie as you work.
          </p>
          <p className="mt-2">
            Signing out revokes your refresh token immediately, so it can no longer be used to mint
            new sessions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
