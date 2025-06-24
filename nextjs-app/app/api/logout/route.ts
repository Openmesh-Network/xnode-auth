import { cookies as getCookies } from "next/headers";
import { NextRequest } from "next/server";
import { corsHeaders } from "../cors";

export async function OPTIONS(req: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: { Allow: "OPTIONS, POST", ...corsHeaders(req.headers) },
  });
}

export async function POST(req: NextRequest) {
  try {
    const cookies = await getCookies();
    cookies.delete("xnode_auth_user");
    cookies.delete("xnode_auth_signature");
    cookies.delete("xnode_auth_timestamp");

    return new Response(null, {
      status: 200,
      headers: corsHeaders(req.headers),
    });
  } catch (err: any) {
    return Response.json(
      { error: err?.message ?? err },
      { status: 500, headers: corsHeaders(req.headers) }
    );
  }
}
