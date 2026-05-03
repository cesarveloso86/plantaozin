import { useState } from "react";
import { Navigate } from "react-router-dom";

import { Shield, Mail, Lock, User, Eye, EyeOff, Loader2, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ALLOWED_EMAIL_DOMAIN, isValidInstitutionalEmail } from "@/lib/constants";
import { maskNF } from "@/lib/masks";

type AuthMode = "login" | "signup" | "forgot";

const Auth = () => {
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [nf, setNf] = useState("");
  const [cargo, setCargo] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const hasRecoveryParams =
    typeof window !== "undefined" &&
    (window.location.hash.includes("type=recovery") ||
      window.location.hash.includes("access_token=") ||
      /[?&]code=/.test(window.location.search));

  if (hasRecoveryParams) {
    return (
      <Navigate
        to={{ pathname: "/reset-password", search: window.location.search, hash: window.location.hash }}
        replace
      />
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(
        error.message === "Invalid login credentials"
          ? "Email ou senha incorretos."
          : error.message,
      );
    }
    setSubmitting(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Mínimo de 8 caracteres.");
      return;
    }
    if (!isValidInstitutionalEmail(email)) {
      toast.error(`Apenas e-mails institucionais (${ALLOWED_EMAIL_DOMAIN}) são permitidos para cadastro.`);
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("signup", {
      body: { email, password, full_name: fullName, nf, cargo },
    });
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Erro desconhecido");
    } else {
      toast.success("Verifique seu email para confirmar o cadastro.");
      setMode("login");
    }
    setSubmitting(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Verifique sua caixa de entrada para redefinir a senha.");
      setMode("login");
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div
          className="w-full max-w-sm space-y-8"
        >
          {/* Branding */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
              <Shield className="w-7 h-7 text-primary-foreground" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Plantão Digital
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {mode === "login" && "Entre na sua conta"}
                {mode === "signup" && "Crie sua conta"}
                {mode === "forgot" && "Recupere sua senha"}
              </p>
            </div>
          </div>

          {/* Form */}
          <form
            onSubmit={
              mode === "login" ? handleLogin
                : mode === "signup" ? handleSignup
                  : handleForgotPassword
            }
            className="space-y-4"
          >
            {mode === "signup" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      placeholder="Seu nome"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nf">Número Funcional (NF)</Label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="nf"
                      placeholder="123456"
                      inputMode="numeric"
                      value={nf}
                      onChange={(e) => setNf(maskNF(e.target.value))}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cargo">Cargo</Label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <select
                      id="cargo"
                      value={cargo}
                      onChange={(e) => setCargo(e.target.value)}
                      className="w-full h-10 pl-10 pr-3 rounded-md border border-input bg-background text-sm text-foreground"
                      required
                    >
                      <option value="">Selecione...</option>
                      <option value="Autoridade Policial">Autoridade Policial</option>
                      <option value="OIP">OIP — Oficial Investigador</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder={`usuario${ALLOWED_EMAIL_DOMAIN}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {mode !== "forgot" && (
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === "login" && (
              <button
                type="button"
                onClick={() => setMode("forgot")}
                className="text-xs text-primary hover:underline"
              >
                Esqueceu a senha?
              </button>
            )}

            <Button
              type="submit"
              className="w-full min-h-[44px]"
              disabled={submitting}
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "login" && "Entrar"}
              {mode === "signup" && "Criar conta"}
              {mode === "forgot" && "Enviar email de recuperação"}
            </Button>
          </form>

          {/* Toggle */}
          <p className="text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                Não tem conta?{" "}
                <button onClick={() => setMode("signup")} className="text-primary font-medium hover:underline">
                  Cadastre-se
                </button>
              </>
            ) : (
              <>
                Já tem conta?{" "}
                <button onClick={() => setMode("login")} className="text-primary font-medium hover:underline">
                  Entrar
                </button>
              </>
            )}
          </p>
        </div>
      </div>

      <footer className="border-t border-border py-3">
        <p className="text-center text-xs text-muted-foreground">
          Sistema de uso restrito — Dados protegidos conforme LGPD
        </p>
      </footer>
    </div>
  );
};

export default Auth;
