import type { APIRoute } from "astro";
import { getDomainSources } from "../../lib/access";
import { mergeSources } from "../../lib/source";

export const prerender = false;

const DEFAULT_LOGIN_METHODS = ["passkey", "ethereum", "password"];

export const GET: APIRoute = async ({ request }) => {
  const domain = request.headers.get("Host");
  if (!domain) {
    return Response.json(
      {
        error: "Could not determine domain.",
      },
      { status: 400 },
    );
  }

  const sources = await getDomainSources({ domain });
  const data = mergeSources({ sources, domain });

  return Response.json({
    methods: data.config?.loginMethods ?? DEFAULT_LOGIN_METHODS,
  });
};
