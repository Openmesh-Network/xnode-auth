import { Address, Hex, recoverMessageAddress } from "viem";
import { getMessage } from "./message";

export function toXnodeAddress({ address }: { address: Address }): string {
  return `eth:${address.replace("0x", "").toLowerCase()}`;
}

export function getXnodeAddress({
  domain,
  timestamp,
  signature,
}: {
  domain: string;
  timestamp: string;
  signature: Hex;
}): Promise<string> {
  return recoverMessageAddress({
    message: getMessage({ domain, timestamp: Number(timestamp) }),
    signature,
  }).then((address) => toXnodeAddress({ address }));
}
