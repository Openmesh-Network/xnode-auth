import type { APIRoute } from "astro";
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
    cookies.delete("xnode_auth_user");
    cookies.delete("xnode_auth_signature");
    cookies.delete("xnode_auth_timestamp");

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
