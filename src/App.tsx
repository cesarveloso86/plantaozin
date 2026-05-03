import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";

const Index = lazy(() => import("@/pages/Index"));
const Plantao = lazy(() => import("@/pages/Plantao"));
const Historico = lazy(() => import("@/pages/Historico"));
const HistoricoPlantoes = lazy(() => import("@/pages/HistoricoPlantoes"));
const MeuHistorico = lazy(() => import("@/pages/MeuHistorico"));
const Auth = lazy(() => import("@/pages/Auth"));
const Perfil = lazy(() => import("@/pages/Perfil"));
const AdminUsuarios = lazy(() => import("@/pages/AdminUsuarios"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Index />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/plantao"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Plantao />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/historico"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Historico />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/historico-plantoes"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <HistoricoPlantoes />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/meu-historico"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <MeuHistorico />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/perfil"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Perfil />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/usuarios"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <AdminUsuarios />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
