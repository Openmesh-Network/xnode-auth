import {
  getSource,
  type DomainData,
  type Restrictions,
  type Source,
} from "./source";

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

export async function getDomainSources({
  domain,
}: {
  domain: string;
}): Promise<Source[]> {
  return (await Array.fromAsync(getSources())).filter((source) => {
    // This source has no restrictions or is allowed for this domain
    if (!source.restrictions) {
      return true;
    }
    return new RegExp(source.restrictions.domains ?? "^$").test(domain);
  });
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
    const aliasName = data.aliases?.[user];
    const alias = aliasName !== undefined ? `alias:${aliasName}` : user;

    for (const [userReg, userDef] of Object.entries(data.users ?? {})) {
      // alias matches this userReg
      const matches = userReg.startsWith("regex:")
        ? new RegExp(userReg.replace("regex:", "")).test(alias)
        : userReg === alias;
      if (!matches) {
        continue;
      }

      for (const role of userDef.roles) {
        const paths = data.roles?.[role]?.paths;
        // role exists and any of its paths regexes allows this path
        if (paths?.some((pathRegex) => new RegExp(pathRegex).test(path))) {
          return { alias, raw: user };
        }
      }
    }
  }

  return undefined;
}
