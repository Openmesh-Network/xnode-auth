import {
  createPublicClient,
  http,
  isAddress,
  isHex,
  verifyMessage,
} from "viem";
import type { Data } from "../source";

export async function verifyXnodeEthereumUser({
  user,
  message,
  signature,
  data,
}: {
  user: string; // ethereum:<address>
  message: string;
  signature: string; // Hex wallet signature
  data: Data[0];
}): Promise<boolean> {
  let address = user.replace("ethereum:", "");
  if (!isHex(signature) || !isAddress(address)) {
    return false;
  }

  const rpcs = data.config?.ethereum?.rpc ?? [];
  for (const rpc of rpcs) {
    const publicClient = createPublicClient({
      transport: http(rpc),
    });
    if (
      await publicClient.verifyMessage({
        address,
        message,
        signature,
      })
    ) {
      return true;
    }
  }

  return await verifyMessage({
    address,
    message,
    signature,
  });
}
