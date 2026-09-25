import * as React from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Loader2 } from "lucide-react";
import { Button, Card, CardHeader, CardTitle, CardContent, Input, Label } from "@/components/ui";
import { toast } from "@/components/ui/toaster";
import {
  acceptInvitationRequest,
  previewInvitationRequest,
  type InvitationPreview,
} from "@/views/members/api/invitations.api";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super admin",
  site_admin: "Site admin",
  editor: "Editor",
  contributor: "Contributor",
};

/**
 * Public invite-acceptance page (rendered OUTSIDE ProtectedRoute). Reads
 * `?token`, previews the invite, collects a name + password, accepts, then
 * routes to /login.
 */
export const AcceptInvite: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";

  const [loading, setLoading] = React.useState(true);
  const [preview, setPreview] = React.useState<InvitationPreview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    if (!token) {
      setError("This invitation link is missing its token.");
      setLoading(false);
      return;
    }
    previewInvitationRequest(token)
      .then((p) => {
        if (active) setPreview(p);
      })
      .catch(() => {
        if (active) setError("This invitation could not be found or is no longer valid.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const onAccept = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await acceptInvitationRequest(token, {
        name: name.trim() || undefined,
        password: password || undefined,
      });
      toast.success("Invitation accepted. Please sign in.");
      navigate("/login");
    } catch {
      toast.error("Could not accept invitation. It may be expired or revoked.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center">
            <span className="text-xl font-bold">
              OB<span className="text-primary">CMS</span>
            </span>
            <p className="mt-1 text-sm font-normal text-muted-foreground">Accept your invitation</p>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col gap-4 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" onClick={() => navigate("/login")}>
                Go to sign in
              </Button>
            </div>
          )}

          {!loading && preview && (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                You&apos;ve been invited to <span className="font-medium">{preview.siteName}</span>{" "}
                as <span className="font-medium">{ROLE_LABELS[preview.role] ?? preview.role}</span>.
              </p>
              {preview.expired ? (
                <div className="flex flex-col gap-4 text-center">
                  <p className="text-sm text-destructive">This invitation has expired.</p>
                  <Button variant="outline" onClick={() => navigate("/login")}>
                    Go to sign in
                  </Button>
                </div>
              ) : (
                <form onSubmit={onAccept} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="accept-email">Email</Label>
                    <Input id="accept-email" value={preview.email} disabled />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="accept-name">Your name</Label>
                    <Input
                      id="accept-name"
                      value={name}
                      placeholder="Jane Doe"
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="accept-password">Set a password</Label>
                    <Input
                      id="accept-password"
                      type="password"
                      value={password}
                      placeholder="••••••••"
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <span className="text-xs text-muted-foreground">
                      Required if you don&apos;t already have an account (min 8 characters).
                    </span>
                  </div>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Accepting…" : "Accept invitation"}
                  </Button>
                </form>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
