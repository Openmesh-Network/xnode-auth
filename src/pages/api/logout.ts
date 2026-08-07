import type { APIRoute } from "astro";

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  try {
    cookies.delete("xnode_auth_user");
    cookies.delete("xnode_auth_signature");
    cookies.delete("xnode_auth_timestamp");

    return new Response(null, {
      status: 200,
    });
  } catch (err: any) {
    return Response.json({ error: err?.message ?? err }, { status: 500 });
  }
};
