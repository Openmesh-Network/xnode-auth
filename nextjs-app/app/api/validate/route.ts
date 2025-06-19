import { hasAccess } from "@/lib/access";
import { getXnodeAddress } from "@/lib/xnode-address";
import { cookies as getCookies } from "next/headers";
import { NextRequest } from "next/server";
import { isHex } from "viem";

export async function GET(req: NextRequest) {
  try {
    const cookies = await getCookies();

    const domain = req.headers.get("Host");
    if (!domain) {
      throw new Error();
    }

    const path = req.headers.get("Path");
    if (!path) {
      throw new Error();
    }

    const ip = req.headers.get("X-Forwarded-For");

    let requestedUser = cookies.get("xnode_auth_user")?.value;
    if (requestedUser?.startsWith("eth:")) {
      const signature = cookies.get("xnode_auth_signature")?.value;
      const timestamp = cookies.get("xnode_auth_timestamp")?.value;

      if (!isHex(signature)) {
        throw new Error();
      }
      if (!timestamp || isNaN(Number(timestamp))) {
        // add checks if timestamp in the future or too far in the past
        throw new Error();
      }

      const address = await getXnodeAddress({ domain, timestamp, signature });
      if (requestedUser !== address) {
        requestedUser = undefined;
      }
    }

    const user = hasAccess({
      users: ([] as string[])
        .concat(ip ? [`ip:${ip}`] : [])
        .concat(requestedUser ? [requestedUser] : []),
      domain,
      path,
    });

    if (user === undefined) {
      throw new Error();
    }

    return Response.json(
      {},
      { status: 200, headers: [["Xnode-Auth-User", user]] }
    );
  } catch (err: any) {
    return Response.json({}, { status: 401 });
  }
}
