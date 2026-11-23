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

  // cheap local EOA check first
  try {
    if (await verifyMessage({ address, message, signature })) {
      return true;
    }
  } catch {
    // not a valid EOA signature, try smart account validation via rpc below
  }

  // try all rpc clients concurrently
  const rpcs = data.config?.ethereum?.rpc ?? [];
  const results = await Promise.all(
    rpcs.map(async (rpc) => {
      try {
        const publicClient = createPublicClient({
          transport: http(rpc),
        });
        return await publicClient.verifyMessage({
          address,
          message,
          signature,
        });
      } catch {
        return false;
      }
    }),
  );
  if (results.some((valid) => valid)) {
    // at least one rpc returned the signature is valid
    return true;
  }

  return false;
}
