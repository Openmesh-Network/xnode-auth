import type { APIRoute, AstroCookieSetOptions } from "astro";
import { getDomainSources } from "../../lib/access";
import { mergeSources } from "../../lib/source";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();

    const domain = request.headers.get("Host") ?? "";
    const sources = await getDomainSources({ domain });
    const data = mergeSources({ sources, domain });

    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      // share the session cookies across subdomains for SSO when configured
      ...(data.config?.cookieDomain
        ? { domain: data.config.cookieDomain }
        : {}),
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
