import { getSource } from "./source";

export async function hasAccess({
  users,
  domain,
  path,
}: {
  users: string[];
  domain: string;
  path: string;
}): Promise<string | undefined> {
  const memory = await getSource({ id: "memory" });

  if (memory[domain] !== undefined) {
    const memoryUser = users.find((user) =>
      Object.keys(memory[domain]).some(
        (userReg) =>
          // user matches this userReg
          (userReg.startsWith("regex:")
            ? new RegExp(userReg.replace("regex:", "")).test(user)
            : userReg === user) &&
          // role of user exists
          Object.hasOwn(
            memory[domain].roles,
            memory[domain].users[userReg].role,
          ) &&
          // role has access to path
          new RegExp(
            memory[domain].roles[memory[domain].users[userReg].role].paths,
          ).test(path),
      ),
    );

    if (memoryUser !== undefined) {
      return memoryUser;
    }
  }

  const env = process.env.XNODEAUTH_EXTERNALSOURCES;
  if (!env) {
    return undefined;
  }
  const externalSources = JSON.parse(env) as {
    source: string;
    restrictions: {
      domains: string;
      domainSpecific: { domains: string; users: string; paths: string }[];
    };
  }[];

  for (const externalSource of externalSources.filter((externalSource) =>
    new RegExp(externalSource.restrictions.domains).test(domain),
  )) {
    const source = await getSource({ id: `external:${externalSource.source}` });
    if (source[domain] !== undefined) {
      const externalUser = users.find((user) =>
        Object.keys(source[domain]).some(
          (userReg) =>
            // user matches this userReg
            (userReg.startsWith("regex:")
              ? new RegExp(userReg.replace("regex:", "")).test(user)
              : userReg === user) &&
            // role of user exists
            Object.hasOwn(
              memory[domain].roles,
              memory[domain].users[userReg].role,
            ) &&
            // role has access to path
            new RegExp(
              source[domain].roles[source[domain].users[userReg].role].paths,
            ).test(path) &&
            // there is no restriction applied to this domain that rejects this user or path
            !externalSource.restrictions.domainSpecific
              .filter((restriction) =>
                new RegExp(restriction.domains).test(domain),
              )
              .some(
                (restriction) =>
                  !new RegExp(restriction.users).test(user) ||
                  !new RegExp(restriction.paths).test(path),
              ),
        ),
      );

      if (externalUser !== undefined) {
        return externalUser;
      }
    }
  }

  return undefined;
}
