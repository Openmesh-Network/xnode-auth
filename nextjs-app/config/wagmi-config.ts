import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { mainnet } from "viem/chains";
import { createStorage, cookieStorage } from "wagmi";
import { siteConfig } from "./site";
import farcasterMiniApp from "@farcaster/miniapp-wagmi-connector";

// Get projectId from https://cloud.reown.com
export const projectId = "6afdeb3a0496b33061a69538819a9a7e";

if (!projectId) {
  throw new Error("Project ID is not defined");
}

export const networks = [mainnet] as const;

//Set up the Wagmi Adapter (Config)
export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: cookieStorage,
  }) as any,
  ssr: true,
  projectId,
  networks: [...networks],
  connectors: [farcasterMiniApp()],
});

// Set up metadata
export const metadata = {
  name: siteConfig.name,
  description: siteConfig.description,
  url: siteConfig.url,
  icons: [`${siteConfig.url}/icon.svg`],
};
