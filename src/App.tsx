import { Component, lazy, Suspense, useEffect, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Link, Route, Routes, useNavigate } from "react-router-dom";
import Shell from "./components/Shell";
import { EmptyState, LoadingState } from "./components/ui";
import DashboardPage from "./pages/DashboardPage";
import CatalogPage from "./pages/CatalogPage";
import TracksPage from "./pages/TracksPage";
import { useGateway } from "./lib/gateway-context";

const ChallengePage = lazy(() => import("./pages/ChallengePage"));
const TutorPage = lazy(() => import("./pages/TutorPage"));
const RankingPage = lazy(() => import("./pages/RankingPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));

class PageBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    /* Avoid logging personal editor content. */
  }
  render() {
    if (this.state.failed)
      return (
        <EmptyState
          title="A página precisa de uma nova tentativa"
          description="Seu rascunho salvo permanece neste navegador."
        >
          <button
            className="button button-primary"
            onClick={() => window.location.reload()}
          >
            Recarregar página
          </button>
        </EmptyState>
      );
    return this.props.children;
  }
}

function AuthCallback() {
  const gateway = useGateway();
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    const parameters = new URLSearchParams(window.location.hash.slice(1));
    const oauthError =
      parameters.get("error_description") ??
      new URLSearchParams(window.location.search).get("error_description");
    if (oauthError) {
      setError(
        "Não foi possível concluir o login. Volte ao perfil e tente novamente.",
      );
      return;
    }
    gateway
      .getDashboard()
      .then(() => {
        if (active) navigate("/perfil", { replace: true });
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : "Não foi possível entrar.");
      });
    return () => {
      active = false;
    };
  }, [gateway, navigate]);
  return error ? (
    <EmptyState title="Acesso ao beta" description={error}>
      <Link className="button button-primary" to="/perfil">
        Voltar ao perfil
      </Link>
    </EmptyState>
  ) : (
    <LoadingState label="Concluindo seu acesso…" />
  );
}

export default function App() {
  return (
    <PageBoundary>
      <Suspense fallback={<LoadingState />}>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<DashboardPage />} />
            <Route path="desafios" element={<CatalogPage />} />
            <Route path="trilhas" element={<TracksPage />} />
            <Route path="desafios/:slug" element={<ChallengePage />} />
            <Route path="tutor" element={<TutorPage />} />
            <Route path="ranking" element={<RankingPage />} />
            <Route path="perfil" element={<ProfilePage />} />
            <Route path="auth/callback" element={<AuthCallback />} />
            <Route
              path="*"
              element={
                <EmptyState
                  title="Este caminho ainda não existe"
                  description="Continue sua jornada pelo catálogo de desafios."
                >
                  <Link className="button button-primary" to="/desafios">
                    Explorar desafios
                  </Link>
                </EmptyState>
              }
            />
          </Route>
        </Routes>
      </Suspense>
    </PageBoundary>
  );
}
