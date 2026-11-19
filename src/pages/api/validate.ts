import type { APIRoute } from "astro";
import { getDomainSources, hasAccess } from "../../lib/access";
import { mergeSources } from "../../lib/source";
import { getMessage } from "../../lib/message";
import { verifyXnodeEthereumUser } from "../../lib/verify/ethereum";
import { verifyXnodePasswordUser } from "../../lib/verify/password";
import { verifyXnodePasskeyUser } from "../../lib/verify/passkey";

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
    let authenticated = undefined;

    const getSignatureAndTimestamp = () => {
      const signature =
        cookies.get("xnode_auth_signature")?.value ??
        request.headers.get("Xnode-Auth-Signature");
      if (!signature) {
        throw new Error(`Signature is missing.`);
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

    const sources = await getDomainSources({ domain });
    const data = mergeSources({ sources, domain });

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
        throw new Error(`Invalid signature for ${requestedUser}`);
      }
    } else if (requestedUser?.startsWith("passkey:")) {
      const { signature, timestamp } = getSignatureAndTimestamp();
      const message = getMessage({ domain, timestamp });

      const validSignature = await verifyXnodePasskeyUser({
        user: requestedUser,
        message,
        signature,
      });
      if (!validSignature) {
        throw new Error(`Invalid signature for ${requestedUser}`);
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
        throw new Error(`Invalid password for ${requestedUser}`);
      }
    } else if (requestedUser?.startsWith("ip:")) {
      if (requestedUser !== `ip:${ip}`) {
        throw new Error(`Invalid ip for ${requestedUser}`);
      }
    } else {
      throw new Error(`Invalid user ${requestedUser}`);
    }

    authenticated = await hasAccess({
      users: [requestedUser],
      path,
      data,
    });

    if (authenticated === undefined) {
      // No requested user means that no login attempt has been made
      throw new Error(
        requestedUser === undefined ? "" : `Access denied for ${requestedUser}`,
      );
    }

    return new Response(null, {
      status: 200,
      headers: {
        // If an alias exists for the user, pass the alias instead of the raw user
        "Xnode-Auth-User": authenticated.alias,
        // Always pass the raw user, so the app can verify user+signature+timestamp itself for zero-trust operation
        "Xnode-Auth-User-Raw": authenticated.raw,
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
