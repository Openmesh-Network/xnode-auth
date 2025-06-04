import "@/app/global.css";

import { Metadata, Viewport } from "next";

import { siteConfig } from "@/config/site";
import Web3Provider from "@/components/web3-provider";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  description: siteConfig.description,
  icons: {
    icon: "/xnode-auth/icon.png",
    shortcut: "/xnode-auth/icon.png",
    apple: "/xnode-auth/icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProps) {
  const cookies = (await headers()).get("cookie");

  return (
    <>
      <html>
        <head />
        <body>
          <Web3Provider cookies={cookies}>{children}</Web3Provider>
        </body>
      </html>
    </>
  );
}
