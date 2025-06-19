import { cookies as getCookies } from "next/headers";
import { NextRequest } from "next/server";
import { isHex } from "viem";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const cookies = await getCookies();
    const user = body.user;
    if (!user || typeof user !== "string") {
      throw new Error(`User ${user} is not valid.`);
    }

    cookies.set("xnode_auth_user", user);
    if (user?.startsWith("eth:")) {
      const signature = body.signature;
      const timestamp = body.timestamp;

      if (!isHex(signature)) {
        throw new Error(`Signature ${signature} is not valid.`);
      }
      if (
        !timestamp ||
        typeof timestamp !== "string" ||
        isNaN(Number(timestamp))
      ) {
        throw new Error(`Timestamp ${timestamp} is not valid.`);
      }

      cookies.set("xnode_auth_signature", signature);
      cookies.set("xnode_auth_timestamp", timestamp);
    }

    return Response.json({}, { status: 200 });
  } catch (err: any) {
    return Response.json({ error: err?.message ?? err }, { status: 500 });
  }
}
