import { mainnet } from "@reown/appkit/networks";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { config } from "../lib/config";
import farcasterMiniApp from "@farcaster/miniapp-wagmi-connector";

export const projectId = config.eth.projectid;

export const networks = [mainnet];

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
  connectors: [farcasterMiniApp()],
});
