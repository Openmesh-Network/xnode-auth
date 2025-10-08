import { Address, createPublicClient, Hex, http, verifyMessage } from "viem";
import { getMessage } from "./message";
import { config } from "./config";

export function toXnodeAddress({ address }: { address: Address }): string {
  return `eth:${address.replace("0x", "").toLowerCase()}`;
}

export async function verifyXnodeUserEthAddress({
  user,
  domain,
  timestamp,
  signature,
}: {
  user: string;
  domain: string;
  timestamp: string;
  signature: Hex;
}): Promise<boolean> {
  if (config.eth.rpc) {
    const publicClient = createPublicClient({
      transport: http(config.eth.rpc),
    });
    return await publicClient.verifyMessage({
      address: `0x${user.replace("eth:", "")}`,
      message: getMessage({ domain, timestamp: Number(timestamp) }),
      signature,
    });
  }

  return verifyMessage({
    address: `0x${user.replace("eth:", "")}`,
    message: getMessage({ domain, timestamp: Number(timestamp) }),
    signature,
  });
}
