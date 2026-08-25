import type { APIRoute } from "astro";
import { getSources, hasAccess } from "../../lib/access";
import {
  verifyXnodeEthereumUser,
  verifyXnodePasswordUser,
} from "../../lib/verify";
import { isHex } from "viem";
import { getMessage } from "../../lib/message";

export const prerender = false;

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

    let requestedUser =
      cookies.get("xnode_auth_user")?.value ??
      request.headers.get("Xnode-Auth-User") ??
      `ip:${ip}`;
    let authenticatedUser = undefined;

    const getSignatureAndTimestamp = () => {
      const signature =
        cookies.get("xnode_auth_signature")?.value ??
        request.headers.get("Xnode-Auth-Signature");
      if (!isHex(signature)) {
        throw new Error(`Signature ${signature} is not valid hex.`);
      }

      const timestamp =
        cookies.get("xnode_auth_timestamp")?.value ??
        request.headers.get("Xnode-Auth-Timestamp");
      if (!timestamp || isNaN(Number(timestamp))) {
        // add checks if timestamp in the future or too far in the past
        throw new Error(`Timestamp ${timestamp} is not a valid number.`);
      }

      return { signature, timestamp: Number(timestamp) };
    };

    for await (let source of getSources()) {
      // If restrictions apply to this domain and this domain is restricted
      if (
        source.restrictions?.domains &&
        !new RegExp(source.restrictions.domains).test(domain)
      ) {
        continue;
      }

      let data = source.data[domain];
      if (!data) {
        // No data for this domain defined
        continue;
      }

      if (requestedUser?.startsWith("ethereum:")) {
        const { signature, timestamp } = getSignatureAndTimestamp();
        const message = getMessage({ domain, timestamp });

        const validSignature = await verifyXnodeEthereumUser({
          user: requestedUser,
          message,
          signature,
          data,
        });
        if (!validSignature) {
          throw new Error(
            `Invalid signature ${signature} (domain ${domain}, timestamp ${timestamp}) for ${requestedUser}`,
          );
        }
      } else if (requestedUser?.startsWith("password:")) {
        const { signature, timestamp } = getSignatureAndTimestamp();
        const message = getMessage({ domain, timestamp });

        const validSignature = await verifyXnodePasswordUser({
          user: requestedUser,
          message,
          signature,
          data,
        });
        if (!validSignature) {
          throw new Error(
            `Invalid signature ${signature} (domain ${domain}, timestamp ${timestamp}) for ${requestedUser}`,
          );
        }
      } else if (requestedUser?.startsWith("ip:")) {
        if (requestedUser !== `ip:${ip}`) {
          throw new Error(`Invalid ip ${ip} for ${requestedUser}`);
        }
      } else {
        throw new Error(`Invalid user ${requestedUser}`);
      }

      const user = await hasAccess({
        users: [requestedUser],
        domain,
        path,
        source,
      });
      if (user) {
        authenticatedUser = user;
        break;
      }
    }

    if (authenticatedUser === undefined) {
      // No requested user means that no login attempt has been made
      throw new Error(
        requestedUser === undefined ? "" : `Access denied for ${requestedUser}`,
      );
    }

    return new Response(null, {
      status: 200,
      headers: {
        "Xnode-Auth-User": authenticatedUser,
      },
    });
  } catch (err: any) {
    return new Response(null, {
      status: 401,
      headers: {
        "Xnode-Auth-Deny-Reason": err.message,
      },
    });
  }
};
