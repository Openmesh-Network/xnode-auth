import type { APIRoute, AstroCookieSetOptions } from "astro";

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  try {
    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
    } as Omit<AstroCookieSetOptions, "expires" | "maxAge" | "encode">;

    cookies.delete("xnode_auth_user", cookieOptions);
    cookies.delete("xnode_auth_signature", cookieOptions);
    cookies.delete("xnode_auth_timestamp", cookieOptions);

    return new Response(null, {
      status: 200,
    });
  } catch (err: any) {
    return Response.json({ error: err?.message ?? err }, { status: 500 });
  }
};
