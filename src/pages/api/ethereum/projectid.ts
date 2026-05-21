import type { APIRoute } from "astro";
import { getSources } from "../../../lib/access";

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

  let projectid = "6afdeb3a0496b33061a69538819a9a7e"; // default in case not set by any source
  for await (let source of getSources()) {
    if (
      source.restrictions?.domains &&
      !new RegExp(source.restrictions.domains).test(domain)
    ) {
      continue;
    }

    let data = source.data[domain];
    if (!data) {
      continue;
    }

    if (data.config?.ethereum?.projectid) {
      projectid = data.config.ethereum.projectid;
      break;
    }
  }

  return Response.json({ projectid });
};
