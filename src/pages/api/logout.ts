import type { APIRoute, AstroCookieSetOptions } from "astro";
import { getDomainSources } from "../../lib/access";
import { mergeSources } from "../../lib/source";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
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
    } as Omit<AstroCookieSetOptions, "expires" | "maxAge" | "encode">;

    cookies.delete("xnode_auth_user", cookieOptions);
    cookies.delete("xnode_auth_signature", cookieOptions);
    cookies.delete("xnode_auth_timestamp", cookieOptions);

    return new Response(null, {
      status: 200,
    });
  } catch (error: any) {
    return Response.json({ error: error?.message ?? error }, { status: 500 });
  }
};
