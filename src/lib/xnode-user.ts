import { type Address } from "viem";

export function toXnodeEthereumUser({ address }: { address: Address }): string {
  return `ethereum:${address.replace("0x", "").toLowerCase()}`;
}
