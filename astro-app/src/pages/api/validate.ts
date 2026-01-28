import type { APIRoute } from "astro";
import { hasAccess } from "../../lib/access";
import { verifyXnodeUserEthAddress } from "../../lib/xnode-address";
import { isHex } from "viem";
import { corsHeaders } from "../../lib/cors";

export const prerender = false;

export const OPTIONS: APIRoute = async ({ request }) => {
  return new Response(null, {
    status: 204,
    headers: { Allow: "OPTIONS, GET", ...corsHeaders(request.headers) },
  });
};

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const domain = request.headers.get("Host");
    if (!domain) {
      throw new Error("Could not determine domain.");
    }

    const path = request.headers.get("Path");
    if (!path) {
      throw new Error("Could not determine domain.");
    }

    const ip = request.headers.get("X-Forwarded-For");

    let requestedUser = cookies.get("xnode_auth_user")?.value;
    if (requestedUser?.startsWith("eth:")) {
      const signature = cookies.get("xnode_auth_signature")?.value;
      const timestamp = cookies.get("xnode_auth_timestamp")?.value;

      if (!isHex(signature)) {
        throw new Error(`Signature ${signature} is not valid hex.`);
      }
      if (!timestamp || isNaN(Number(timestamp))) {
        // add checks if timestamp in the future or too far in the past
        throw new Error(`Timestamp ${timestamp} is not a valid number.`);
      }

      const validSignature = await verifyXnodeUserEthAddress({
        user: requestedUser,
        domain,
        timestamp,
        signature,
      });
      if (!validSignature) {
        throw new Error(
          `Invalid signature ${signature} (domain ${domain}, timestamp ${timestamp}) for ${requestedUser}`
        );
      }
    } else {
      requestedUser = undefined;
    }

    const users = ([] as string[])
      .concat(ip ? [`ip:${ip}`] : [])
      .concat(requestedUser ? [requestedUser] : []);
    const user = await hasAccess({
      users,
      domain,
      path,
    });

    if (user === undefined) {
      // No requested user means that no login attempt has been made
      throw new Error(
        requestedUser === undefined ? "" : `Access denied for ${requestedUser}`
      );
    }

    return new Response(null, {
      status: 200,
      headers: { "Xnode-Auth-User": user, ...corsHeaders(request.headers) },
    });
  } catch (err: any) {
    return new Response(null, {
      status: 401,
      headers: {
        "Xnode-Auth-Deny-Reason": err.message,
        ...corsHeaders(request.headers),
      },
    });
  }
};
