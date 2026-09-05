import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import App from './App';
import { createGateway, type GatewayAuth } from './lib/gateway';
import { GatewayContext } from './lib/gateway-context';
import './styles.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 }, mutations: { retry: false } } });
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const client = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey, { auth: { flowType: 'pkce', detectSessionInUrl: true } }) : null;
const auth: GatewayAuth | undefined = client ? {
  getSession: async () => { const { data, error } = await client.auth.getSession(); if (error) throw error; return data.session; },
  signIn: async provider => { const { error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/auth/callback` } }); if (error) throw error; },
  signOut: async () => { const { error } = await client.auth.signOut(); if (error) throw error; },
} : undefined;
let storage: Storage | undefined;
try { storage = window.localStorage; } catch { /* The editor can still be used when browser storage is unavailable. */ }
const gateway = createGateway({ auth, apiUrl: import.meta.env.VITE_API_URL || (supabaseUrl ? `${supabaseUrl}/functions/v1/api` : undefined), apiKey: supabaseKey, storage, onSignOut: () => queryClient.clear() });

function Application() {
  const [identity, setIdentity] = useState('initial');
  useEffect(() => {
    if (!client) return;
    let previousUser: string | undefined;
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user.id ?? 'guest';
      if (nextUser === previousUser) return;
      previousUser = nextUser;
      queryClient.clear();
      // Remount page state as well as clearing cached queries on a cross-tab account change.
      // No Supabase operation is awaited inside its auth callback.
      setIdentity(nextUser);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return <QueryClientProvider client={queryClient}><GatewayContext.Provider value={gateway}><BrowserRouter><App key={identity} /></BrowserRouter></GatewayContext.Provider></QueryClientProvider>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Application /></React.StrictMode>);
