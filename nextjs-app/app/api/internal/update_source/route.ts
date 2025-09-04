import { updateSource } from "@/lib/source";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  console.log({ req });
  const data = await req.json();
  if (!data.id) {
    return new Response(null, {
      status: 400,
    });
  }

  await updateSource({ id: `external:${data.id}` });
  return new Response(null, {
    status: 200,
  });
}
