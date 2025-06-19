export function hasAccess({
  users,
  domain,
  path,
}: {
  users: string[];
  domain: string;
  path: string;
}): string | undefined {
  const accessListEnv = process.env[`XNODEAUTH_ACCESSLIST`];
  if (!accessListEnv) {
    return undefined;
  }

  const accessList: {
    [domain: string]: { [user: string]: { paths: string } };
  } = JSON.parse(accessListEnv);
  return users.find((user) =>
    Object.keys(accessList[domain]).some(
      (userReg) =>
        (userReg.startsWith("regex:")
          ? new RegExp(userReg.replace("regex:", "")).test(user)
          : userReg === user) &&
        new RegExp(accessList[domain][userReg].paths).test(path)
    )
  );
}
