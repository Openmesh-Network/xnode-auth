import type { APIRoute } from "astro";
import { getDomainSources } from "../../../lib/access";
import { mergeSources } from "../../../lib/source";

export const prerender = false;

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
  const projectid =
    data.config?.appkit?.projectid ?? "6afdeb3a0496b33061a69538819a9a7e";
  return Response.json({ projectid });
};
