"use client";
import { useFormState } from "react-dom";
import { signIn } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";

export default function LoginPage() {
  const [state, action] = useFormState(signIn, { error: null });
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={action} className="card w-full max-w-sm space-y-3">
        <h1>Coach Console</h1>
        <p className="muted">Trainer sign-in. There is no public sign-up.</p>
        <label className="block">
          <span className="label">Email</span>
          <input className="input" name="email" type="email" autoComplete="username" required />
        </label>
        <label className="block">
          <span className="label">Password</span>
          <input className="input" name="password" type="password" autoComplete="current-password" required />
        </label>
        {state.error && <p className="text-sm text-red-700">{state.error}</p>}
        <SubmitButton className="btn-primary w-full justify-center" pendingText="Signing in…">
          Sign in
        </SubmitButton>
      </form>
    </main>
  );
}
