import { hasAccess } from "@/lib/access";
import { getXnodeAddress } from "@/lib/xnode-address";
import { cookies as getCookies } from "next/headers";
import { NextRequest } from "next/server";
import { isHex } from "viem";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const signature = body.signature;
    const timestamp = body.timestamp;
    const domain = req.headers.get("Host");

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
    if (!domain) {
      throw new Error();
    }

    const address = await getXnodeAddress({ domain, timestamp, signature });
    if (!hasAccess({ address, domain })) {
      throw new Error(`Access denied to ${domain} denied for ${address}`);
    }

    const cookies = await getCookies();
    cookies.set("xnode_auth_signature", signature);
    cookies.set("xnode_auth_timestamp", timestamp);

    return Response.json({}, { status: 200 });
  } catch (err: any) {
    return Response.json({ error: err?.message ?? err }, { status: 500 });
  }
}
