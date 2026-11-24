import type { AstroCookies } from "astro";
import type { DomainData } from "./source";
import { getMessage } from "./message";
import { verifyXnodeEthereumUser } from "./verify/ethereum";
import { verifyXnodePasswordUser } from "./verify/password";
import { verifyXnodePasskeyUser } from "./verify/passkey";

/// Verify the requested user + signature + timestamp (signed over the signature domain) and return the raw authenticated user.
/// Throws on failure.
export async function authenticate({
  request,
  cookies,
  data,
  signatureDomain,
}: {
  request: Request;
  cookies: AstroCookies;
  data: DomainData;
  signatureDomain: string;
}): Promise<string> {
  const ip = request.headers.get("X-Forwarded-For");
  const requestedUser =
    cookies.get("xnode_auth_user")?.value ??
    request.headers.get("Xnode-Auth-User") ??
    `ip:${ip}`;

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

  return requestedUser;
}

/// 401 response with the login redirect URL in Xnode-Auth-Redirect
/// xnode-auth decides the redirect target (login page on the signature domain)
export function loginRedirectResponse({
  request,
  data,
  domain,
  path,
  error,
}: {
  request: Request;
  data: DomainData;
  domain: string | null;
  path: string | null;
  error: string;
}): Response {
  const scheme = request.headers.get("X-Forwarded-Proto") ?? "https";
  const redirectHost = data.config?.signatureDomain || domain;
  const loginPage = data.config?.loginPage?.startsWith("/")
    ? data.config.loginPage
    : import.meta.env.BASE_URL.replace(/\/$/, "");
  try {
    if (!redirectHost) {
      throw new Error("Missing redirect host.");
    }
    const redirectUrl = new URL(`${scheme}://${redirectHost}${loginPage}/`);
    if (domain && path) {
      redirectUrl.searchParams.set("redirect", `${scheme}://${domain}${path}`);
    }
    redirectUrl.searchParams.set("rejected", error);
    return new Response(null, {
      status: 401,
      headers: {
        "Xnode-Auth-Redirect": redirectUrl.toString(),
      },
    });
  } catch (error) {
    console.warn(
      `Redirect response construction for ${scheme}://${redirectHost}${loginPage}/ failed: ${error}`,
    );
    return new Response(null, { status: 401 });
  }
}
