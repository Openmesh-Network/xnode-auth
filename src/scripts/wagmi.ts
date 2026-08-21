import { type AppKitNetwork } from "@reown/appkit/networks";
import * as appkitNetworks from "@reown/appkit/networks";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";

export const projectId = await fetch("/xnode-auth/api/appkit/projectid")
  .then((res) => res.json())
  .then((data) => data.projectid as string);

const allNetworks = Object.values(appkitNetworks).filter(
  (value) =>
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (("caipNetworkId" in value && typeof value.caipNetworkId === "string") ||
      ("id" in value && typeof value.id === "number")),
) as unknown as AppKitNetwork[];
export const networks = await fetch("/xnode-auth/api/appkit/networks")
  .then((res) => res.json())
  .then((data) => data.networks as string[])
  .then(
    (networks) =>
      allNetworks.filter((network) => {
        let caipNetworkId =
          "caipNetworkId" in network &&
          typeof network.caipNetworkId === "string"
            ? network.caipNetworkId
            : `eip155:${(network as { id: number }).id}`;
        return networks.includes(caipNetworkId);
      }) as [AppKitNetwork, ...AppKitNetwork[]],
  );
if (networks.length === 0) {
  throw new Error(`No valid appkit networks for ${networks} found.`);
}

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
  syncConnectedChain: false,
});
