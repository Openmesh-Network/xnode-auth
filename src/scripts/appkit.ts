import { type AppKitNetwork } from "@reown/appkit/networks";
import * as appkitNetworks from "@reown/appkit/networks";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { appkitStore } from "../store/appkit";

export async function projectId() {
  const projectId = appkitStore.projectid.get();
  if (projectId) {
    return projectId;
  }

  const _projectId = await fetch("/xnode-auth/api/appkit/projectid")
    .then((res) => res.json())
    .then((data) => data.projectid as string);

  appkitStore.projectid.set(_projectId);
  return _projectId;
}

export async function networks() {
  const networks = appkitStore.networks.get();
  if (networks) {
    return networks;
  }

  const allNetworks = Object.values(appkitNetworks).filter(
    (value) =>
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      (("caipNetworkId" in value && typeof value.caipNetworkId === "string") ||
        ("id" in value && typeof value.id === "number")),
  ) as unknown as AppKitNetwork[];
  const _networks = await fetch("/xnode-auth/api/appkit/networks")
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

  appkitStore.networks.set(_networks);
  return _networks;
}

export async function wagmiAdapter() {
  const wagmiAdapter = appkitStore.wagmiAdapter.get();
  if (wagmiAdapter) {
    return wagmiAdapter;
  }

  const _projectId = await projectId();
  const _networks = await networks();
  const _wagmiAdapter = new WagmiAdapter({
    projectId: _projectId,
    networks: _networks,
  });

  appkitStore.wagmiAdapter.set(_wagmiAdapter);
  return _wagmiAdapter;
}
