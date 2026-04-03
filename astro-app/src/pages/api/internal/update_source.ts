import type { APIRoute } from "astro";
import { updateSource } from "../../../lib/source";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const data = await request.json();
  if (!data.id) {
    return Response.json(
      {
        error: "Id is required.",
      },
      { status: 400 },
    );
  }

  await updateSource({ id: `external:${data.id}` });
  return new Response(null, {
    status: 200,
  });
};
