"use client";

import { Eye, EyeOff, TerminalSquare } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { MatrixRain } from "@/components/matrix-rain";
import { useAuth } from "@/contexts/auth-context";

export function LoginForm({
  nextPath,
  isResetRecovery,
}: {
  nextPath: string;
  isResetRecovery: boolean;
}) {
  const router = useRouter();
  const { accessState, authStatus, isConfigured, signIn, signUp, requestPasswordReset } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "reset">(isResetRecovery ? "reset" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const currentMode = isResetRecovery ? "reset" : mode;

  useEffect(() => {
    if (authStatus === "signed_in") {
      router.replace(accessState === "pending_approval" ? "/approval-pending" : nextPath);
    }
  }, [accessState, authStatus, nextPath, router]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setMessage(null);

    if (currentMode === "forgot") {
      const result = await requestPasswordReset(email);
      setBusy(false);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      setMessage("Password reset email sent.");
      setMode("signin");
      return;
    }

    if (currentMode === "reset") {
      setBusy(false);
      setMessage("Password reset completion will be wired once full recovery handling is connected.");
      return;
    }

    if (currentMode === "signup") {
      if (password !== confirmPassword) {
        setBusy(false);
        setMessage("Passwords do not match.");
        return;
      }

      const result = await signUp(email, password);
      setBusy(false);
      if (result.error) {
        setMessage(result.error);
        return;
      }

      if (result.requiresEmailConfirmation) {
        setMessage("Account created. Check your email to confirm your address, then sign in for approval.");
        setMode("signin");
        setPassword("");
        setConfirmPassword("");
        return;
      }

      setMessage("Account created. Your access is pending approval.");
      router.replace("/approval-pending");
      return;
    }

    const result = await signIn(email, password);
    setBusy(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }

    router.replace(nextPath);
  };

  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <MatrixRain interactive className="opacity-95" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.1),transparent_24%)]" />

      <div className="relative w-full max-w-xl">
        <section className="scanlines relative overflow-hidden rounded-[2rem] border border-primary/20 bg-background p-6 shadow-[var(--shadow-strong)] sm:p-8">
          <div className="absolute inset-x-0 top-0 h-px bg-primary/24" />
          <div className="mb-6 text-center">
            <Image src="/icon-512.png" alt="Assets" width={64} height={64} className="mx-auto mb-1 size-16 object-contain" priority />
            <h1 className="font-display text-4xl font-semibold uppercase tracking-[0.24em] text-primary glow">Assets</h1>
            <div className="app-kicker mt-3">Welcome back</div>
            <h2 className="mt-1 font-display text-2xl text-foreground/90 glow-soft">
              {currentMode === "signin"
                ? "Login"
                : currentMode === "signup"
                  ? "Request a new account"
                  : currentMode === "forgot"
                    ? "Forgot Password"
                    : "Choose a new password"}
            </h2>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {currentMode !== "reset" && (
              <div className="space-y-2">
                <label htmlFor="email" className="font-mono text-xs uppercase tracking-[0.14em] text-primary/72">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="matrix-field flex h-12 w-full rounded-[1.15rem] px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
            )}

            {currentMode !== "forgot" && (
              <div className="space-y-2">
                <label htmlFor="password" className="font-mono text-xs uppercase tracking-[0.14em] text-primary/72">
                  {currentMode === "reset" ? "New password" : "Password"}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={currentMode === "reset" ? "Enter your new password" : "Enter your password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="matrix-field flex h-12 w-full rounded-[1.15rem] px-4 pr-12 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-primary"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {(currentMode === "reset" || currentMode === "signup") && (
              <div className="space-y-2">
                <label htmlFor="confirm-password" className="font-mono text-xs uppercase tracking-[0.14em] text-primary/72">
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  placeholder={currentMode === "signup" ? "Confirm your password" : "Confirm your new password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="matrix-field flex h-12 w-full rounded-[1.15rem] px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
            )}

            {!isConfigured && (
              <div className="rounded-[1rem] border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                Supabase env vars are not configured yet. Real login is disabled until `.env.local` is added.
              </div>
            )}

            {message && (
              <div className="rounded-[1rem] border border-primary/18 bg-primary/8 px-4 py-3 text-sm text-primary/90">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || !isConfigured}
              className="matrix-button mt-1 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[1.15rem] px-5 font-display text-sm font-semibold uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <TerminalSquare size={16} />
              {busy
                ? "Working..."
                : currentMode === "signin"
                  ? "Sign In"
                  : currentMode === "signup"
                    ? "Create Account"
                    : currentMode === "forgot"
                      ? "Send Reset Email"
                      : "Update Password"}
            </button>

            {currentMode === "signin" && (
              <>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="block w-full text-center text-sm font-medium text-primary transition-colors hover:text-primary/80"
                >
                  Create Operator Access
                </button>
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="block w-full text-center text-sm font-medium text-primary/82 transition-colors hover:text-primary"
                >
                  Forgot Password
                </button>
              </>
            )}

            {currentMode !== "signin" && !isResetRecovery && (
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setMessage(null);
                }}
                className="block w-full text-center text-sm font-medium text-primary transition-colors hover:text-primary/80"
              >
                Login Operator Access
              </button>
            )}

            <div className="pt-2 text-center">
              <Link href="/approval-pending" className="text-xs font-medium uppercase tracking-[0.14em] text-primary/65 transition-colors hover:text-primary">
                Preview approval pending
              </Link>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
