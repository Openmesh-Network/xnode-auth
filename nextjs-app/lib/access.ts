export function hasAccess({
  address,
  domain,
}: {
  address: string;
  domain: string;
}): boolean {
  const accessList = process.env[domain];
  if (!accessList) {
    return false;
  }

  return (JSON.parse(accessList) as string[]).includes(address);
}
