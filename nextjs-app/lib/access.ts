export function hasAccess({
  address,
  domain,
}: {
  address: string;
  domain: string;
}): boolean {
  const accessList = process.env[`XNODEAUTH_ACCESSLIST`];
  if (!accessList) {
    return false;
  }

  return (JSON.parse(accessList) as { [domain: string]: string[] })[
    domain
  ].includes(address);
}
