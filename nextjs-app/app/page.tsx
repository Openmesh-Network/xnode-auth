import { Login } from "@/components/login";
import { cookies as getCookies } from "next/headers";
import React from "react";

export default async function IndexPage() {
  const cookies = await getCookies();

  return (
    <div className="w-screen h-screen flex place-content-center place-items-center px-2 bg-gray-600">
      <Login deniedForUser={cookies.get("xnode_auth_user")?.value} />
    </div>
  );
}
