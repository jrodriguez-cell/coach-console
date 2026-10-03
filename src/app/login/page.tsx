"use client";
import { useFormState } from "react-dom";
import { signIn } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";

export default function LoginPage() {
  const [state, action] = useFormState(signIn, { error: null });
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={action} className="w-full max-w-sm space-y-5">
        <div className="space-y-3 pb-4 text-center">
          <h1 className="text-lg sm:text-xl">Coach Console</h1>
          <p className="display text-[9px] text-stone">Strength · Mobility · Mindset</p>
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
