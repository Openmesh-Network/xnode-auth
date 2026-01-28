import { createAppKit } from "@reown/appkit";
import { mainnet } from "@reown/appkit/networks";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { config } from "../lib/config";
import { appkitStore } from "../store/appkit";
import { isAddress } from "viem";
import farcasterMiniApp from "@farcaster/miniapp-wagmi-connector";

const projectId = config.eth.projectid;

export const networks = [mainnet];

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
  connectors: [farcasterMiniApp()],
});

const metadata = {
  name: "Xnode Auth",
  description: "Web3 authenticator and login dashboard.",
  url: "https://auth.xnode.openmesh.network",
  icons: ["https://auth.xnode.openmesh.network/favicon.svg"],
};

const modal = createAppKit({
  adapters: [wagmiAdapter],
  networks: [mainnet],
  metadata,
  projectId,
  defaultAccountTypes: {
    eip155: "eoa",
  },
  // social features only work with projects that have whitelisted domains, which cannot be done for the default project id, as it would prevent it to be used on all websites
  features: {
    ...(projectId === "6afdeb3a0496b33061a69538819a9a7e"
      ? { email: false, socials: false }
      : {}),
    analytics: false,
    swaps: false,
    onramp: false,
  },
});

modal.subscribeAccount((state) => {
  const address = state.address;
  if (address === undefined || isAddress(address)) {
    appkitStore.account.set(address);
  } else {
    console.warn(`Invalid appkit address ${address}`);
  }
});
