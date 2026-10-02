import { Component, lazy, Suspense, useEffect } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import Shell from "./components/Shell";
import { EmptyState, LoadingState } from "./components/ui";
import DashboardPage from "./pages/DashboardPage";
import CatalogPage from "./pages/CatalogPage";
import TracksPage from "./pages/TracksPage";

const ChallengePage = lazy(() => import("./pages/ChallengePage"));
const RankingPage = lazy(() => import("./pages/RankingPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const FeedbackPage = lazy(() => import("./pages/FeedbackPage"));

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
  useEffect(() => {
    // The server owns the OAuth exchange. Never process codes or error details in the SPA.
    window.history.replaceState(null, "", "/auth/callback");
  }, []);
  return (
    <EmptyState
      title="Acesso ao beta"
      description="O beta está aberto sem login obrigatório. Continue pelo catálogo de desafios."
    >
      <Link className="button button-primary" to="/desafios">
        Explorar desafios
      </Link>
    </EmptyState>
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
            <Route path="tutor" element={<Navigate to="/desafios" replace />} />
            <Route path="ranking" element={<RankingPage />} />
            <Route path="perfil" element={<ProfilePage />} />
            <Route path="feedback" element={<FeedbackPage />} />
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
