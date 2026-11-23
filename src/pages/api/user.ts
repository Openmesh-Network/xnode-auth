import type { APIRoute } from "astro";
import { getAlias, getDomainSources } from "../../lib/access";
import { authenticate, loginRedirectResponse } from "../../lib/authenticate";
import { mergeSources, type DomainData } from "../../lib/source";

export const prerender = false;

export const GET: APIRoute = async ({ request, cookies }) => {
  const domain = request.headers.get("Host");
  let data: DomainData = {};
  try {
    if (!domain) {
      throw new Error("Could not determine domain.");
    }

    const sources = await getDomainSources({ domain });
    data = mergeSources({ sources, domain });

    const signatureDomain = data.config?.signatureDomain || domain;

    const requestedUser = await authenticate({
      request,
      cookies,
      data,
      signatureDomain,
    });

    const { alias, raw } = getAlias({ data, user: requestedUser });

    return Response.json({ user: alias, raw });
  } catch (err: any) {
    return loginRedirectResponse({
      request,
      data,
      domain,
      path: null,
      error: err.message,
    });
  }
};
