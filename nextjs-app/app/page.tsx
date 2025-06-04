import { Login } from "@/components/login";
import React from "react";

export default async function IndexPage() {
  return (
    <div className="w-screen h-screen flex place-content-center place-items-center px-2 bg-gray-600">
      <Login />
    </div>
  );
}
