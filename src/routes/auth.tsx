import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Coins } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acceder · TokenBet" },
      { name: "description", content: "Inicia sesión para apostar tokens virtuales con tus amigos." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: username || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Cuenta creada", { description: "¡Bienvenido al juego!" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/", replace: true });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error(result.error.message);
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5">
      <Link to="/" className="mb-8 text-center">
        <div className="font-mono text-3xl font-bold tracking-tight">
          token<span className="text-neon">bet</span>
        </div>
        <div className="mt-1 flex items-center justify-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground">
          <Coins className="h-3 w-3 text-neon" /> 10,000 tokens al registrarte
        </div>
      </Link>

      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6" style={{ backgroundImage: "var(--gradient-card)" }}>
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-background/60 p-1">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                mode === m ? "bg-neon text-neon-foreground shadow-[var(--shadow-glow)]" : "text-muted-foreground"
              }`}
            >
              {m === "signin" ? "Entrar" : "Crear cuenta"}
            </button>
          ))}
        </div>

        <button
          onClick={handleGoogle}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background/60 py-2.5 text-sm font-medium transition-all hover:border-neon/40 hover:bg-background disabled:opacity-50"
        >
          <GoogleIcon /> Continuar con Google
        </button>

        <div className="my-4 flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> o con email <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          {mode === "signup" && (
            <input
              type="text"
              placeholder="Nombre de usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-neon"
            />
          )}
          <input
            type="email"
            required
            placeholder="email@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-neon"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-neon"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-neon py-2.5 text-sm font-bold text-neon-foreground shadow-[var(--shadow-glow)] transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
          >
            {busy ? "..." : mode === "signin" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>
      </div>

      <p className="mt-6 max-w-sm text-center text-[11px] leading-relaxed text-muted-foreground">
        100% diversión, 0% dinero real. Todas las apuestas son con tokens virtuales sin valor monetario.
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#EA4335" d="M5.27 9.76A7.08 7.08 0 0 1 16.4 6.66l3.2-3.2A11.94 11.94 0 0 0 12 0a12 12 0 0 0-10.7 6.6l3.97 3.16Z" />
      <path fill="#34A853" d="M16.04 18.01A7.27 7.27 0 0 1 12 19.09a7.08 7.08 0 0 1-6.7-4.82L1.31 17.4A12 12 0 0 0 12 24a11.45 11.45 0 0 0 7.92-3l-3.88-2.99Z" />
      <path fill="#4A90E2" d="M19.92 21A11.65 11.65 0 0 0 23.5 12.2c0-.83-.13-1.7-.33-2.5H12v4.74h6.45A5.5 5.5 0 0 1 16.04 18l3.88 2.99Z" />
      <path fill="#FBBC05" d="M5.3 14.27a7.18 7.18 0 0 1-.04-4.51L1.3 6.6a12 12 0 0 0 0 10.8l4-3.13Z" />
    </svg>
  );
}
