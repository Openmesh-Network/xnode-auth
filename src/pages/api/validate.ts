import type { APIRoute } from "astro";
import { getDomainSources, hasAccess } from "../../lib/access";
import { authenticate, loginRedirectResponse } from "../../lib/authenticate";
import { normalizeRequestUri } from "../../lib/path";
import { mergeSources, type DomainData } from "../../lib/source";

export const prerender = false;

export const GET: APIRoute = async ({ request, cookies }) => {
  const domain = request.headers.get("Host");
  const path = request.headers.get("Path");
  let data: DomainData = {};
  try {
    if (!domain) {
      throw new Error("Could not determine domain.");
    }

    if (!path) {
      throw new Error("Could not determine path.");
    }
    const { path: normalizedPath } = normalizeRequestUri(path);

    const sources = await getDomainSources({ domain });
    data = mergeSources({ sources, domain });

    const signatureDomain = data.config?.signatureDomain || domain;

    const requestedUser = await authenticate({
      request,
      cookies,
      data,
      signatureDomain,
    });

    const authenticated = await hasAccess({
      users: [requestedUser],
      path: normalizedPath,
      data,
    });

    if (authenticated === undefined) {
      throw new Error(`Access denied for ${requestedUser}`);
    }

    return new Response(null, {
      status: 200,
      headers: {
        // If an alias exists for the user, pass the alias instead of the raw user
        "Xnode-Auth-User": authenticated.alias,
        // Always pass the raw user, so the app can verify user+signature+timestamp itself for zero-trust operation
        "Xnode-Auth-User-Raw": authenticated.raw,
      },
    });
  } catch (error: any) {
    return loginRedirectResponse({
      request,
      data,
      domain,
      path,
      error: error.message,
    });
  }
};
