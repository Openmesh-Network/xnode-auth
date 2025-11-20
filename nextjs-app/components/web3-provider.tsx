"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import React, { type ReactNode } from "react";
import { cookieToInitialState, WagmiProvider } from "wagmi";
import {
  metadata,
  networks,
  projectId,
  wagmiAdapter,
} from "@/config/wagmi-config";

// Set up queryClient
const queryClient = new QueryClient();

if (!projectId) {
  throw new Error("Project ID is not defined");
}

// Create the modal
createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks: [...networks],
  defaultNetwork: networks[0],
  metadata: metadata,
  defaultAccountTypes: {
    eip155: "eoa",
  },
  // social features only work with projects that have whitelisted domains, which cannot be done for the default project id, as it would prevent it to be used on all websites
  features:
    projectId === "6afdeb3a0496b33061a69538819a9a7e"
      ? { email: false, socials: false }
      : undefined,
});

function Web3Provider({
  children,
  cookies,
}: {
  children: ReactNode;
  cookies: string | null;
}) {
  const initialState = cookieToInitialState(wagmiAdapter.wagmiConfig, cookies);

  return (
    <WagmiProvider
      config={wagmiAdapter.wagmiConfig}
      initialState={initialState}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

export default Web3Provider;
