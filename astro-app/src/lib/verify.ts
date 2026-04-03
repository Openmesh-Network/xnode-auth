import { createPublicClient, type Hex, http, verifyMessage } from "viem";
import { createHmac, timingSafeEqual } from "crypto";
import type { Data } from "./source";

export async function verifyXnodeEthereumUser({
  user,
  message,
  signature,
  data,
}: {
  user: string;
  message: string;
  signature: Hex;
  data: Data[0];
}): Promise<boolean> {
  if (data.config?.ethereum?.rpc) {
    const publicClient = createPublicClient({
      transport: http(data.config.ethereum.rpc),
    });
    return await publicClient.verifyMessage({
      address: `0x${user.replace("ethereum:", "")}`,
      message,
      signature,
    });
  }

  return await verifyMessage({
    address: `0x${user.replace("ethereum:", "")}`,
    message,
    signature,
  });
}

export async function verifyXnodePasswordUser({
  user,
  message,
  signature,
  data,
}: {
  user: string;
  message: string;
  signature: Hex;
  data: Data[0];
}): Promise<boolean> {
  const userConfig =
    data.config?.password?.user?.[user.replace("password:", "")];
  if (!userConfig || !userConfig.password) {
    return false;
  }

  const hmac = `0x${createHmac("sha256", userConfig.password)
    .update(message)
    .digest("hex")}`;

  return timingSafeEqual(Buffer.from(signature), Buffer.from(hmac));
}
