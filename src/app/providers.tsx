import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type PropsWithChildren } from "react";
import { AuthProvider } from "../features/auth/AuthProvider";
export function AppProviders({ children }: PropsWithChildren) {
 const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30000, retry: 1, refetchOnWindowFocus: false }, mutations: { retry: 0 } } }));
 return <QueryClientProvider client={client}><AuthProvider>{children}</AuthProvider></QueryClientProvider>;
}