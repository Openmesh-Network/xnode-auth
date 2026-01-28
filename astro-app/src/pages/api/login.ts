import type { APIRoute } from "astro";
import { isHex } from "viem";
import { corsHeaders } from "../../lib/cors";

export const prerender = false;

export const OPTIONS: APIRoute = async ({ request }) => {
  return new Response(null, {
    status: 204,
    headers: { Allow: "OPTIONS, POST", ...corsHeaders(request.headers) },
  });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const user = body.user;
    if (!user || typeof user !== "string") {
      throw new Error(`User ${user} is not valid.`);
    }

    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    } as const;
    cookies.set("xnode_auth_user", user, cookieOptions);
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

      cookies.set("xnode_auth_signature", signature, cookieOptions);
      cookies.set("xnode_auth_timestamp", timestamp, cookieOptions);
    }

    return new Response(null, {
      status: 200,
      headers: corsHeaders(request.headers),
    });
  } catch (err: any) {
    return Response.json(
      { error: err?.message ?? err },
      { status: 500, headers: corsHeaders(request.headers) }
    );
  }
};
