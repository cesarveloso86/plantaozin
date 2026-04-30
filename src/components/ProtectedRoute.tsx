import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const isRecoveryUrl = () => {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash || "";
  const search = window.location.search || "";
  return (
    hash.includes("type=recovery") ||
    hash.includes("access_token=") ||
    /[?&]code=/.test(search)
  );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Se o link de recuperação caiu numa rota protegida, redireciona preservando hash/query
  if (isRecoveryUrl() && location.pathname !== "/reset-password") {
    return (
      <Navigate
        to={{ pathname: "/reset-password", search: location.search, hash: location.hash }}
        replace
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return <>{children}</>;
};

export default ProtectedRoute;
