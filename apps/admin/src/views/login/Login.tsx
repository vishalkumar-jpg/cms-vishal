import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router";
import { Button, Card, CardHeader, CardTitle, CardContent, Input, Label } from "@/components/ui";
import { toast } from "@/components/ui/toaster";
import { useAdminLogin } from "@/views/auth/hooks/useAuth";

/** Forms = react-hook-form + zod (per _CONVENTIONS.md). */
const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  totp: z.string().optional(),
  backupCode: z.string().optional(),
});
type LoginForm = z.infer<typeof loginSchema>;

export const Login = () => {
  const navigate = useNavigate();
  const login = useAdminLogin();
  // When the account has 2FA on, the first attempt 401s with a "code required"
  // message; we then reveal the TOTP field and re-submit with the code.
  const [needsTotp, setNeedsTotp] = useState(false);
  // Toggle between an authenticator code and a single-use backup recovery code.
  const [useBackup, setUseBackup] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginForm): Promise<void> => {
    try {
      await login.mutateAsync({
        email: values.email,
        password: values.password,
        totp: useBackup ? undefined : values.totp?.trim() || undefined,
        backupCode: useBackup ? values.backupCode?.trim() || undefined : undefined,
      });
      navigate("/dashboard");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "";
      if (/two-factor|totp|2fa|backup|recovery/i.test(message)) {
        setNeedsTotp(true);
        toast.error(
          needsTotp
            ? "Invalid code — check your authenticator or backup code"
            : "Enter your authenticator code to continue",
        );
        return;
      }
      toast.error("Invalid email or password");
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
            <p className="mt-1 text-sm font-normal text-muted-foreground">Sign in to your account</p>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" placeholder="you@company.com" type="email" {...register("email")} />
              {errors.email && <span className="text-xs text-destructive">{errors.email.message}</span>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" placeholder="••••••••" type="password" {...register("password")} />
              {errors.password && (
                <span className="text-xs text-destructive">{errors.password.message}</span>
              )}
            </div>
            {needsTotp && !useBackup && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="totp">Authentication code</Label>
                <Input
                  id="totp"
                  placeholder="123456"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  {...register("totp")}
                />
                <span className="text-xs text-muted-foreground">
                  Enter the 6-digit code from your authenticator app.
                </span>
                <button
                  type="button"
                  className="w-fit text-xs text-primary underline"
                  onClick={() => setUseBackup(true)}
                >
                  Use a backup recovery code instead
                </button>
              </div>
            )}
            {needsTotp && useBackup && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="backupCode">Backup recovery code</Label>
                <Input
                  id="backupCode"
                  placeholder="A1B2-C3D4-E5F6"
                  autoComplete="one-time-code"
                  autoFocus
                  {...register("backupCode")}
                />
                <span className="text-xs text-muted-foreground">
                  Enter one of your single-use backup codes.
                </span>
                <button
                  type="button"
                  className="w-fit text-xs text-primary underline"
                  onClick={() => setUseBackup(false)}
                >
                  Use my authenticator app instead
                </button>
              </div>
            )}
            <Button type="submit" disabled={isSubmitting || login.isPending}>
              {isSubmitting || login.isPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
