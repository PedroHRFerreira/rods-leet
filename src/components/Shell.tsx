import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  BookOpen,
  ChevronRight,
  Code2,
  Command,
  Coins,
  Compass,
  Flame,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Moon,
  Search,
  Sun,
  Store,
  Trophy,
  X,
} from "lucide-react";
import WelcomeGuide from "./WelcomeGuide";
import { CosmeticAvatar, cosmeticNameColor } from "./CosmeticAvatar";
import { useGateway } from "../lib/gateway-context";

const navigation = [
  { to: "/", label: "Visão geral", icon: LayoutDashboard },
  { to: "/desafios", label: "Desafios", icon: Code2 },
  {
    to: "/trilhas",
    label: "Trilhas de aprendizado",
    mobileLabel: "Trilhas",
    icon: BookOpen,
  },
  { to: "/ranking", label: "Ranking", icon: Trophy },
  { to: "/loja", label: "Loja", icon: Store },
  { to: "/feedback", label: "Feedback", icon: MessageSquare },
];

export default function Shell({ children }: { children?: ReactNode }) {
  const gateway = useGateway();
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => gateway.getDashboard(),
    retry: false,
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(() => {
    try {
      return localStorage.getItem("rods-leet-welcome-v1") !== "seen";
    } catch {
      return true;
    }
  });
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("rods-leet-theme") === "light"
        ? "light"
        : "dark";
    } catch {
      return "dark";
    }
  });
  const navigate = useNavigate();
  const location = useLocation();
  const compactTracksNavigation = location.pathname === "/trilhas";
  const searchRef = useRef<HTMLInputElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const activeLabel =
    location.pathname === "/perfil"
      ? "Meu perfil"
      : location.pathname.startsWith("/conta")
        ? "Minha conta"
        : location.pathname.startsWith("/desafios/")
          ? "Desafio"
          : (navigation.find((item) => item.to === location.pathname)?.label ??
            "Rods Leet");
  const profile = dashboard.data?.profile;
  const name = profile?.displayName || "Visitante";
  const registered = Boolean(profile?.authenticated && !profile?.anonymous);
  const equippedTheme = profile?.themeId;

  useEffect(() => {
    const cosmeticTheme =
      equippedTheme === "theme-ocean"
        ? "ocean"
        : equippedTheme === "theme-sunset"
          ? "sunset"
          : null;
    if (cosmeticTheme)
      document.documentElement.dataset.cosmeticTheme = cosmeticTheme;
    else delete document.documentElement.dataset.cosmeticTheme;
    return () => {
      delete document.documentElement.dataset.cosmeticTheme;
    };
  }, [equippedTheme]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("rods-leet-theme", theme);
    } catch {
      /* The chosen theme still works without persistent storage. */
    }
  }, [theme]);
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape" && mobileOpen) {
        setMobileOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);
  useEffect(() => {
    if (!mobileOpen) return;
    sidebarRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  function searchChallenges(event: FormEvent) {
    event.preventDefault();
    navigate(
      `/desafios${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ""}`,
    );
  }

  return (
    <div className="app-shell">
      {guideOpen && (
        <WelcomeGuide
          onClose={() => {
            try {
              localStorage.setItem("rods-leet-welcome-v1", "seen");
            } catch {
              /* The guide can still be dismissed without storage. */
            }
            setGuideOpen(false);
          }}
        />
      )}
      <a className="skip-link" href="#main-content">
        Pular para o conteúdo
      </a>
      {mobileOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Fechar navegação"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        id="main-navigation"
        className={`sidebar ${compactTracksNavigation ? "tracks-compact" : ""} ${mobileOpen ? "is-open" : ""}`}
        ref={sidebarRef}
        aria-label="Navegação principal"
        onKeyDown={(event) => {
          if (!mobileOpen || event.key !== "Tab") return;
          const elements =
            sidebarRef.current?.querySelectorAll<HTMLElement>(
              "a[href], button",
            );
          if (!elements?.length) return;
          const first = elements[0];
          const last = elements[elements.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          }
          if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <div className="sidebar-brand-row">
          <Link to="/" className="brand" aria-label="Rods Leet, início">
            <span className="brand-mark">
              <Code2 size={23} strokeWidth={2} />
            </span>
            <span>
              Rods Leet<small>PRÁTICA DE PROGRAMAÇÃO</small>
            </span>
          </Link>
          <button
            type="button"
            className="icon-button sidebar-close"
            aria-label="Fechar navegação"
            onClick={() => {
              setMobileOpen(false);
              menuButtonRef.current?.focus();
            }}
          >
            <X size={20} />
          </button>
        </div>
        <div className="sidebar-section-label">APRENDER</div>
        <nav className="sidebar-nav">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              aria-label={compactTracksNavigation ? label : undefined}
              title={compactTracksNavigation ? label : undefined}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          className="nav-item welcome-reopen"
          aria-label={compactTracksNavigation ? "Como funciona" : undefined}
          title={compactTracksNavigation ? "Como funciona" : undefined}
          onClick={() => {
            setMobileOpen(false);
            setGuideOpen(true);
          }}
        >
          <Compass size={18} />
          <span>Como funciona</span>
        </button>
        <div className="sidebar-bottom">
          <div className="beta-indicator">
            <span />
            BETA ABERTO
          </div>
          <NavLink to="/perfil" className="sidebar-profile">
            <CosmeticAvatar avatarId={profile?.avatarId} displayName={name} />
            <span>
              <strong
                style={{ color: cosmeticNameColor(profile?.nameColorId) }}
              >
                {name}
              </strong>
              <small>Nível {dashboard.data?.level ?? 0}</small>
            </span>
            <ChevronRight size={16} />
          </NavLink>
        </div>
      </aside>
      <div
        className={`app-main ${compactTracksNavigation ? "tracks-compact" : ""}`}
      >
        <header className="topbar">
          <div className="topbar-breadcrumb">
            <button
              ref={menuButtonRef}
              type="button"
              className="icon-button mobile-menu"
              aria-label="Abrir navegação"
              aria-expanded={mobileOpen}
              aria-controls="main-navigation"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb-home">Meu espaço</span>
            <ChevronRight className="breadcrumb-chevron" size={14} />
            <strong>{activeLabel}</strong>
          </div>
          <form
            className="global-search"
            role="search"
            onSubmit={searchChallenges}
          >
            <Search size={17} />
            <input
              ref={searchRef}
              aria-label="Buscar desafios"
              placeholder="Buscar desafios…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <kbd>
              <Command size={11} /> K
            </kbd>
          </form>
          <div className="topbar-actions">
            <Link
              to="/loja"
              className="topbar-coins"
              aria-label={`${dashboard.data?.coins ?? 0} moedas. Abrir loja`}
            >
              <Coins size={17} />
              <span>{dashboard.data?.coins ?? 0}</span>
            </Link>
            {dashboard.data && !registered && (
              <Link className="text-link topbar-login" to="/conta">
                Entrar
              </Link>
            )}
            <span
              className="topbar-streak"
              title={`${dashboard.data?.streakDays ?? 0} dias de sequência`}
            >
              <Flame size={18} />
              {dashboard.data?.streakDays ?? 0}
            </span>
            <span className="topbar-divider" />
            <button
              type="button"
              className="icon-button theme-toggle"
              aria-label={
                theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"
              }
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <Link
              to="/perfil"
              className="topbar-avatar"
              aria-label="Abrir meu perfil"
            >
              <CosmeticAvatar avatarId={profile?.avatarId} displayName={name} />
            </Link>
          </div>
        </header>
        <main
          id="main-content"
          className={`page-content ${location.pathname.startsWith("/desafios/") ? "page-content-arena" : ""} ${compactTracksNavigation ? "page-content-tracks" : ""}`}
          tabIndex={-1}
        >
          {children ?? <Outlet />}
        </main>
        <footer className="app-footer">
          <span>
            <Code2 size={13} /> Rods Leet
          </span>
          <span>Programação se aprende praticando.</span>
          <span>Beta · 2026</span>
        </footer>
      </div>
      <nav className="mobile-bottom-nav" aria-label="Atalhos de navegação">
        {navigation.map(({ to, label, mobileLabel, icon: Icon }) => (
          <NavLink
            to={to}
            end={to === "/"}
            key={to}
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <Icon size={20} />
            <span>{mobileLabel ?? label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
