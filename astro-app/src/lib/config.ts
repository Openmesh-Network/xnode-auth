export const config = JSON.parse(
  process.env.XNODEAUTH_CONFIG ??
    JSON.stringify({
      eth: { rpc: "", projectid: "6afdeb3a0496b33061a69538819a9a7e" },
    })
) as {
  eth: {
    rpc: string;
    projectid: string;
  };
};
