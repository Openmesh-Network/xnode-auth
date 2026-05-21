import { mainnet } from "@reown/appkit/networks";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";

export const projectId = await fetch("/xnode-auth/api/ethereum/projectid")
  .then((res) => res.json())
  .then((data) => data.projectid);

export const networks = [mainnet];

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
});
