import { cookies as getCookies } from "next/headers";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const cookies = await getCookies();
    cookies.delete("xnode_auth_signature");
    cookies.delete("xnode_auth_timestamp");

    return Response.json({}, { status: 200 });
  } catch (err: any) {
    return Response.json({ error: err?.message ?? err }, { status: 500 });
  }
}
