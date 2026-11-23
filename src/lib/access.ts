import {
  getSource,
  type DomainData,
  type Restrictions,
  type Source,
} from "./source";

export async function getSources(): Promise<Source[]> {
  const env = process.env.XNODEAUTH_EXTERNALSOURCES;
  const externalSources = env
    ? (JSON.parse(env) as {
        source: string;
        restrictions: Restrictions;
        cacheDuration?: number;
      }[])
    : [];

  return Promise.all([
    getSource({ id: "memory" }).then((data) => ({ data })),
    ...externalSources.map(async (externalSource) => ({
      data: await getSource({
        id: `external:${externalSource.source}`,
        cacheDuration: externalSource.cacheDuration,
      }),
      restrictions: externalSource.restrictions,
    })),
  ]);
}

export async function getDomainSources({
  domain,
}: {
  domain: string;
}): Promise<Source[]> {
  return (await getSources()).filter((source) => {
    // This source has no restrictions or is allowed for this domain
    if (!source.restrictions) {
      return true;
    }
    return new RegExp(source.restrictions.domains ?? "^$").test(domain);
  });
}

export function getAlias({ data, user }: { data: DomainData; user: string }): {
  alias: string;
  raw: string;
} {
  const aliasName = data.aliases?.[user];
  return {
    alias: aliasName !== undefined ? `alias:${aliasName}` : user,
    raw: user,
  };
}

export async function hasAccess({
  users,
  path,
  data,
}: {
  users: string[];
  path: string;
  data: DomainData;
}): Promise<{ alias: string; raw: string } | undefined> {
  for (const user of users) {
    const { alias, raw } = getAlias({ data, user });

    const hasRoleWithAccess = (roles: string[]) => {
      for (const role of roles) {
        const pathPatternGroups = data.roles?.[role]?.pathPatterns;
        // access granted if any group fully matches the requested path
        if (
          pathPatternGroups?.some((group) =>
            group.every((pattern) => new RegExp(pattern).test(path)),
          )
        ) {
          return true;
        }
      }
      return false;
    };

    // exact user keys
    for (const [userKey, userDef] of Object.entries(data.users ?? {})) {
      if (userKey === alias && hasRoleWithAccess(userDef.roles)) {
        return { alias, raw };
      }
    }

    // pattern-based user rules
    for (const rule of data.userPatterns ?? []) {
      if (
        rule.patterns.every((pattern) => new RegExp(pattern).test(alias)) &&
        hasRoleWithAccess(rule.roles)
      ) {
        return { alias, raw };
      }
    }
  }

  return undefined;
}
