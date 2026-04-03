import { getSource, type Restrictions, type Source } from "./source";

export async function* getSources() {
  yield {
    data: await getSource({ id: "memory" }),
  };

  const env = process.env.XNODEAUTH_EXTERNALSOURCES;
  if (!env) {
    return;
  }
  const externalSources = JSON.parse(env) as {
    source: string;
    restrictions: Restrictions;
  }[];

  for (const externalSource of externalSources) {
    yield {
      data: await getSource({ id: `external:${externalSource.source}` }),
      restrictions: externalSource.restrictions,
    };
  }
}

export async function hasAccess({
  users,
  domain,
  path,
  source,
}: {
  users: string[];
  domain: string;
  path: string;
  source: Source;
}): Promise<string | undefined> {
  if (source.data[domain] !== undefined) {
    const externalUser = users.find((user) =>
      Object.keys(source.data[domain]).some((userReg) => {
        // user matches this userReg
        if (userReg.startsWith("regex:")) {
          if (!new RegExp(userReg.replace("regex:", "")).test(user)) {
            return false;
          }
        } else {
          if (userReg !== user) {
            return false;
          }
        }

        // source defines roles
        let roles = source.data[domain].roles;
        if (!roles) {
          return false;
        }

        // source defines user and user has roles
        let userRoles = source.data[domain].users?.[userReg]?.roles;
        if (!userRoles) {
          return false;
        }

        return userRoles.some(
          (role) =>
            // role exists
            Object.hasOwn(roles, role) &&
            // role has access to path
            new RegExp(roles[role].paths).test(path) &&
            // there is no domainSpecific restrictions OR no restriction for this domain that rejects this user or path
            (!source.restrictions?.domainSpecific ||
              !source.restrictions.domainSpecific
                .filter((restriction) =>
                  new RegExp(restriction.domains).test(domain),
                )
                .some(
                  (restriction) =>
                    !new RegExp(restriction.users).test(user) ||
                    !new RegExp(restriction.paths).test(path),
                )),
        );
      }),
    );

    if (externalUser !== undefined) {
      return externalUser;
    }
  }

  return undefined;
}
