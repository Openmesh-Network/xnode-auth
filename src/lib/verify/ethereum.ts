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

  if (data.config?.ethereum?.rpc) {
    const publicClient = createPublicClient({
      transport: http(data.config.ethereum.rpc),
    });
    return await publicClient.verifyMessage({
      address,
      message,
      signature,
    });
  }

  return await verifyMessage({
    address,
    message,
    signature,
  });
}
