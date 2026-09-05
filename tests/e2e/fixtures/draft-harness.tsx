/** Browser-only test fixture. This module is never imported by the application entrypoint. */
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "../../../src/App";
import { GatewayContext } from "../../../src/lib/gateway-context";
import { createGateway, guestDashboard } from "../../../src/lib/gateway";
import { challenges } from "../../../src/content/catalog";
import type { DraftInput } from "../../../src/lib/contracts";
import "../../../src/styles.css";

const challenge = challenges.find((c) => c.id === "find-max")!;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const gateway = createGateway({
  auth: {
    getSession: async () => ({
      csrf: "test-csrf",
      user: { id: "test-user" },
    }),
    signIn: async () => undefined,
    signOut: async () => undefined,
  },
  storage: localStorage,
  fetch: async (url, init) => {
    const path = new URL(String(url), window.location.origin).pathname.replace(
      /^\/api/,
      "",
    );
    if (path === "/challenges/find-max") return json(challenge);
    if (path === "/dashboard")
      return json({
        ...guestDashboard(),
        profile: { id: "test-user", displayName: "Teste", invited: true },
      });
    if (path === "/attempts")
      return json({
        id: "test-attempt",
        challengeId: challenge.id,
        challengeVersionId: challenge.versionId,
        mode: "normal",
        startedAt: new Date().toISOString(),
        deadlineAt: null,
        status: "active",
        rejectedCount: 0,
        pendingCount: 0,
        hintsUsed: 0,
        practiceOnly: false,
        solutionAvailable: false,
      });
    if (path === "/drafts") {
      const remote = JSON.parse(
        localStorage.getItem("test:remote-draft") ?? "null",
      ) as DraftInput | null;
      if (init?.method === "PUT") {
        const input = JSON.parse(init.body as string) as DraftInput;
        if ((input.revision ?? 0) !== (remote?.revision ?? 0))
          return json(
            {
              error: {
                code: "draft_conflict",
                message: "Outra versão existe.",
              },
            },
            409,
          );
        const saved = {
          ...input,
          revision: (remote?.revision ?? 0) + 1,
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem("test:remote-draft", JSON.stringify(saved));
        return json({
          saved: true,
          revision: saved.revision,
          updatedAt: saved.updatedAt,
        });
      }
      return json(remote);
    }
    return json(
      {
        error: { code: "not_found", message: "Test fixture route unavailable" },
      },
      404,
    );
  },
});
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <GatewayContext.Provider value={gateway}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </GatewayContext.Provider>
    </QueryClientProvider>
  </React.StrictMode>,
);
