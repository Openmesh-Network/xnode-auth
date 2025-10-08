export const config = JSON.parse(
  process.env.XNODEAUTH_CONFIG ?? JSON.stringify({ eth: { rpc: "" } })
) as {
  eth: {
    rpc: string;
  };
};
