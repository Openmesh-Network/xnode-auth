import type { APIRoute, AstroCookieSetOptions } from "astro";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();

    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
    } as AstroCookieSetOptions;
    cookies.set("xnode_auth_user", body.user ?? "", cookieOptions);
    cookies.set("xnode_auth_signature", body.signature ?? "", cookieOptions);
    cookies.set("xnode_auth_timestamp", body.timestamp ?? "", cookieOptions);

    return new Response(null, {
      status: 200,
    });
  } catch (err: any) {
    return Response.json({ error: err?.message ?? err }, { status: 500 });
  }
};
