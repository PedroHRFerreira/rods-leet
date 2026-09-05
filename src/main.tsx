import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { createGateway } from "./lib/gateway";
import { createBffAuth } from "./lib/bff-auth";
import { GatewayContext } from "./lib/gateway-context";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
    mutations: { retry: false },
  },
});
const liveEnabled = import.meta.env.PROD
  ? import.meta.env.VITE_BFF_ENABLED !== "false"
  : import.meta.env.VITE_BFF_ENABLED === "true";
const identityListeners = new Set<(identity: string) => void>();
let currentIdentity = "initial";
const auth = liveEnabled
  ? createBffAuth({
      onSessionChange: (userId) => {
        const identity = userId ?? "guest";
        // A session request can finish during another component's update.
        queueMicrotask(() => {
          if (currentIdentity === identity) return;
          currentIdentity = identity;
          queryClient.clear();
          identityListeners.forEach((listener) => listener(identity));
        });
      },
    })
  : undefined;
let storage: Storage | undefined;
try {
  storage = window.localStorage;
  // Remove only credentials left by the old browser-auth implementation.
  storage.removeItem("sb-bsjcuygtpiqyomnulpsw-auth-token");
  storage.removeItem("sb-bsjcuygtpiqyomnulpsw-auth-token-code-verifier");
} catch {
  /* The editor can still be used when browser storage is unavailable. */
}
const gateway = createGateway({
  auth,
  storage,
  onSignOut: () => queryClient.clear(),
});

function Application() {
  const [identity, setIdentity] = useState(currentIdentity);
  useEffect(() => {
    if (!auth) return;
    identityListeners.add(setIdentity);
    setIdentity(currentIdentity);
    const checkSession = () => {
      // The next app request still reports unavailable authentication explicitly.
      void auth.getSession().catch(() => undefined);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") checkSession();
    };
    checkSession();
    window.addEventListener("focus", checkSession);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      identityListeners.delete(setIdentity);
      window.removeEventListener("focus", checkSession);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <GatewayContext.Provider value={gateway}>
        <BrowserRouter>
          <App key={identity} />
        </BrowserRouter>
      </GatewayContext.Provider>
    </QueryClientProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Application />
  </React.StrictMode>,
);
