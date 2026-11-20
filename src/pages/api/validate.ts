import type { APIRoute } from "astro";
import { getDomainSources, hasAccess } from "../../lib/access";
import { mergeSources, type DomainData } from "../../lib/source";
import { getMessage } from "../../lib/message";
import { verifyXnodeEthereumUser } from "../../lib/verify/ethereum";
import { verifyXnodePasswordUser } from "../../lib/verify/password";
import { verifyXnodePasskeyUser } from "../../lib/verify/passkey";

export const prerender = false;

export const GET: APIRoute = async ({ request, cookies }) => {
  const domain = request.headers.get("Host");
  const path = request.headers.get("Path");
  let data: DomainData = {};
  try {
    if (!domain) {
      throw new Error("Could not determine domain.");
    }

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
        throw new Error(`Timestamp ${timestamp} is not a valid number.`);
      }

      const timestampNumber = Number(timestamp);
      const now = Math.round(Date.now() / 1000);
      if (timestampNumber > now) {
        throw new Error(`Timestamp ${timestamp} is in the future.`);
      }

      const signatureExpiry = data.config?.signatureExpiry ?? 7 * 24 * 60 * 60;
      if (now - timestampNumber > signatureExpiry) {
        // More than signatureExpiry seconds have passed since this signature was created.
        throw new Error(`Login expired.`);
      }

      return { signature, timestamp: timestampNumber };
    };

    const sources = await getDomainSources({ domain });
    data = mergeSources({ sources, domain });

    const signatureDomain = data.config?.signatureDomain || domain;

    if (requestedUser?.startsWith("ethereum:")) {
      const { signature, timestamp } = getSignatureAndTimestamp();
      const message = getMessage({ domain: signatureDomain, timestamp });

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
      const message = getMessage({ domain: signatureDomain, timestamp });

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
      const message = getMessage({ domain: signatureDomain, timestamp });

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
    const scheme = request.headers.get("X-Forwarded-Proto") ?? "https";
    const redirectHost = data.config?.signatureDomain || domain;
    const loginPage = data.loginPage?.startsWith("/")
      ? data.loginPage
      : import.meta.env.BASE_URL.replace(/\/$/, "");
    const redirectUrl = new URL(`${scheme}://${redirectHost}${loginPage}/`);
    if (domain && path) {
      redirectUrl.searchParams.set("redirect", `${scheme}://${domain}${path}`);
    }
    redirectUrl.searchParams.set("rejected", err.message);
    return new Response(null, {
      status: 401,
      headers: {
        "Xnode-Auth-Redirect": redirectUrl.toString(),
      },
    });
  }
};
