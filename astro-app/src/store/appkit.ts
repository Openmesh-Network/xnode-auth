import { atom, type WritableAtom } from "nanostores";
import { type Address } from "viem";

export interface AppkitStore {
  account: WritableAtom<Address | undefined>;
}

export const appkitStore: AppkitStore = { account: atom(undefined) };
