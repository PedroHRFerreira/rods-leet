import { createContext, useContext } from 'react';
import type { AppGateway } from './contracts';

export const GatewayContext = createContext<AppGateway | null>(null);
export function useGateway(): AppGateway {
  const gateway = useContext(GatewayContext);
  if (!gateway) throw new Error('O acesso ao Rods Leet não foi inicializado.');
  return gateway;
}
