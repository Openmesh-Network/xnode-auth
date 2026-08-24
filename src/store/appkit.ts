import type { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import type { AppKitNetwork } from "@reown/appkit/networks";
import { atom, type WritableAtom } from "nanostores";
import { type Address } from "viem";

export interface AppkitStore {
  projectid: WritableAtom<string | undefined>;
  networks: WritableAtom<[AppKitNetwork, ...AppKitNetwork[]] | undefined>;
  wagmiAdapter: WritableAtom<WagmiAdapter | undefined>;

  account: WritableAtom<Address | undefined>;
}

export const appkitStore: AppkitStore = {
  projectid: atom(undefined),
  networks: atom(undefined),
  wagmiAdapter: atom(undefined),
  account: atom(undefined),
};
