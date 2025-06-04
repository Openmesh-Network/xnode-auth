import { hasAccess } from "@/lib/access";
import { getXnodeAddress } from "@/lib/xnode-address";
import { cookies as getCookies } from "next/headers";
import { NextRequest } from "next/server";
import { isHex } from "viem";

export async function GET(req: NextRequest) {
  try {
    const cookies = await getCookies();
    const signature = cookies.get("xnode_auth_signature")?.value;
    const timestamp = cookies.get("xnode_auth_timestamp")?.value;
    const domain = req.nextUrl.hostname;
    if (!isHex(signature)) {
      throw new Error();
    }
    if (!timestamp || isNaN(Number(timestamp))) {
      throw new Error();
    }

    const address = await getXnodeAddress({ domain, timestamp, signature });
    if (!hasAccess({ address, domain })) {
      throw new Error();
    }

    return Response.json({}, { status: 200 });
  } catch (err: any) {
    return Response.json({}, { status: 401 });
  }
}
