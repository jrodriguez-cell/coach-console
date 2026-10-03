"use client";
import { useFormState } from "react-dom";
import { signIn } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { Logo } from "@/components/logo";

export default function LoginPage() {
  const [state, action] = useFormState(signIn, { error: null });
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={action} className="w-full max-w-sm space-y-5">
        <div className="flex flex-col items-center gap-6 pb-6 text-center">
          <Logo mark="wordmark" className="h-auto w-[260px] text-fg" />
          <h1 className="display text-[13px] text-muted">Coach Console</h1>
        </div>
        <label className="block">
          <span className="label">Email</span>
          <input className="input" name="email" type="email" autoComplete="username" required />
        </label>
        <label className="block">
          <span className="label">Password</span>
          <input className="input" name="password" type="password" autoComplete="current-password" required />
        </label>
        {state.error && <p className="text-sm text-alert">{state.error}</p>}
        <SubmitButton className="btn-primary w-full justify-center py-3" pendingText="Signing in…">
          Sign in
        </SubmitButton>
      </form>
    </main>
  );
}
