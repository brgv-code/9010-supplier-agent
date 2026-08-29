import { useAuthActions } from "@convex-dev/auth/react";
import { type FormEvent, useState } from "react";

// Email + password sign in / sign up (Convex Auth Password provider).
export default function SignIn() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn("password", { email, password, flow });
    } catch {
      setError(
        flow === "signIn"
          ? "Could not sign in. Check your email and password."
          : "Could not sign up. The email may already be registered, or the password is too weak.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="signin">
      <h1>Tender viewer</h1>
      <p className="sub">{flow === "signIn" ? "Sign in to continue." : "Create an account."}</p>
      <form onSubmit={onSubmit}>
        <input
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          autoComplete={flow === "signIn" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" className="btn" disabled={busy}>
          {busy ? "..." : flow === "signIn" ? "Sign in" : "Sign up"}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      <button
        type="button"
        className="linkbtn"
        onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
      >
        {flow === "signIn" ? "Need an account? Sign up" : "Have an account? Sign in"}
      </button>
    </div>
  );
}
