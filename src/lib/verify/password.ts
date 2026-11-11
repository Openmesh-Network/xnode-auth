import { createHmac, timingSafeEqual } from "crypto";
import type { Data } from "../source";

export async function verifyXnodePasswordUser({
  user,
  message,
  signature,
  data,
}: {
  user: string; // password:<user>
  message: string;
  signature: string; // Hex of sha256 hmac
  data: Data[0];
}): Promise<boolean> {
  const userConfig =
    data.config?.password?.user?.[user.replace("password:", "")];
  if (!userConfig || !userConfig.password) {
    return false;
  }

  const hmac = createHmac("sha256", userConfig.password)
    .update(message)
    .digest("hex");

  return (
    signature.length === hmac.length &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(hmac))
  );
}
