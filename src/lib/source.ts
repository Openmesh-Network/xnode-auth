import { readFile } from "fs/promises";

export interface Source {
  data: Data;
  restrictions?: Restrictions;
}

export interface Data {
  [domain: string]: DomainData;
}

export interface DomainData {
  /// User -> Role, Clash: merge
  /// If an alias exists for the user, role should be defined on the alias.
  users?: { [user: string]: { roles: string[] } };
  /// Role -> Paths, Clash: merge
  roles?: { [role: string]: { paths: string[] } };
  /// User -> Alias, Clash: first
  aliases?: { [user: string]: string };
  config?: {
    ethereum?: {
      /// RPCs used to validate smart account signatures. Clash: merge
      rpc?: string[];
    };
    appkit?: {
      /// Project ID for the wallet connector. Clash: first
      projectid?: string;
      /// Networks for the wallet connector. Clash: merge
      networks?: string[];
    };
    password?: {
      /// User -> Password. Clash: first
      user?: { [name: string]: { password: string } };
    };
  };
}

export interface Restrictions {
  domains?: string;
  domainSpecific?: DomainSpecificRestriction[];
}

export interface DomainSpecificRestriction {
  domains: string;
  users?: { key?: string; value?: { roles?: string } };
  roles?: { key?: string; value?: { paths?: string } };
  aliases?: { key?: string; value?: string };
}

export function mergeSources({
  sources,
  domain,
}: {
  sources: Source[];
  domain: string;
}): DomainData {
  const merged: DomainData = {};

  for (const source of sources) {
    const data = source.data[domain];
    if (!data) {
      continue;
    }

    // domainSpecific restrictions that apply to this domain
    const restrictions = (source.restrictions?.domainSpecific ?? []).filter(
      (restriction) => new RegExp(restriction.domains).test(domain),
    );

    // Check if all restrictions are met
    const allowed = (
      keyAllowed: (restriction: DomainSpecificRestriction) => boolean,
      valueAllowed: (restriction: DomainSpecificRestriction) => boolean,
    ) => restrictions.every((r) => keyAllowed(r) && valueAllowed(r));

    for (const [user, alias] of Object.entries(data.aliases ?? {})) {
      if (
        allowed(
          (r) => new RegExp(r.aliases?.key ?? "^.*$").test(user),
          (r) => new RegExp(r.aliases?.value ?? "^.*$").test(alias),
        ) &&
        merged.aliases?.[user] === undefined
      ) {
        (merged.aliases ??= {})[user] = alias;
      }
    }

    for (const [userReg, userDef] of Object.entries(data.users ?? {})) {
      const roles = userDef.roles.filter((role) =>
        allowed(
          (r) => new RegExp(r.users?.key ?? "^.*$").test(userReg),
          (r) => new RegExp(r.users?.value?.roles ?? "^.*$").test(role),
        ),
      );
      if (roles.length === 0) {
        continue;
      }
      const users = (merged.users ??= {});
      const existing = (users[userReg] ??= { roles: [] });
      for (const role of roles) {
        if (!existing.roles.includes(role)) {
          existing.roles.push(role);
        }
      }
    }

    for (const [role, roleDef] of Object.entries(data.roles ?? {})) {
      const paths = roleDef.paths.filter((pathRegex) =>
        allowed(
          (r) => new RegExp(r.roles?.key ?? "^.*$").test(role),
          (r) => new RegExp(r.roles?.value?.paths ?? "^.*$").test(pathRegex),
        ),
      );
      if (paths.length === 0) {
        continue;
      }
      const roles = (merged.roles ??= {});
      const existing = (roles[role] ??= { paths: [] });
      for (const pathRegex of paths) {
        if (!existing.paths.includes(pathRegex)) {
          existing.paths.push(pathRegex);
        }
      }
    }

    const config = data.config;
    if (config) {
      const mergedConfig = (merged.config ??= {});
      if (config.ethereum?.rpc) {
        const rpc = ((mergedConfig.ethereum ??= {}).rpc ??= []);
        for (const r of config.ethereum.rpc) {
          if (!rpc.includes(r)) {
            rpc.push(r);
          }
        }
      }
      if (config.appkit) {
        const appkit = (mergedConfig.appkit ??= {});
        if (
          appkit.projectid === undefined &&
          config.appkit.projectid !== undefined
        ) {
          appkit.projectid = config.appkit.projectid;
        }
        if (config.appkit.networks) {
          const networks = (appkit.networks ??= []);
          for (const network of config.appkit.networks) {
            if (!networks.includes(network)) {
              networks.push(network);
            }
          }
        }
      }
      if (config.password?.user) {
        const user = ((mergedConfig.password ??= {}).user ??= {});
        for (const [name, passwordUser] of Object.entries(
          config.password.user,
        )) {
          if (user[name] === undefined) {
            user[name] = passwordUser;
          }
        }
      }
    }
  }

  return merged;
}

const cache = {} as {
  [id: string]: { data: Data; cachedAt: Date } | undefined;
};

export async function getSource({
  id,
}: {
  id: "memory" | `external:${string}`;
}): Promise<Data> {
  if (!cache[id]) {
    // optionally check cachedAt if we need to refresh data
    const source = await _getSource({ id });
    if (!source.cache) {
      return source.data;
    }

    cache[id] = { data: source.data, cachedAt: new Date() };
  }

  return cache[id].data;
}

export async function updateSource({
  id,
}: {
  id: "memory" | `external:${string}`;
}) {
  const source = await _getSource({ id });
  if (!source.cache) {
    return;
  }

  cache[id] = { data: source.data, cachedAt: new Date() };
}

async function _getSource({
  id,
}: {
  id: "memory" | `external:${string}`;
}): Promise<{ data: Data; cache: boolean }> {
  if (id === "memory") {
    const env = process.env.XNODEAUTH_MEMORY;
    if (!env) {
      return { data: {}, cache: true };
    } else {
      return { data: JSON.parse(env), cache: true };
    }
  } else {
    const source = id.replace("external:", "");
    if (source.startsWith("path:")) {
      const path = source.replace("path:", "");
      try {
        const fileContent = await readFile(path, { encoding: "utf-8" });
        return { data: JSON.parse(fileContent), cache: true };
      } catch (err) {
        console.error(`Error accessing ${id}: ${err}`);
        return { data: {}, cache: false };
      }
    }
    if (source.startsWith("http:")) {
      const url = `http://${source.replace("http:", "")}`;
      try {
        const response = await fetch(url);
        const data = await response.json();
        return { data, cache: true };
      } catch (err) {
        console.error(`Error accessing ${id}: ${err}`);
        return { data: {}, cache: false };
      }
    }
    if (source.startsWith("https:")) {
      const url = `https://${source.replace("https:", "")}`;
      try {
        const response = await fetch(url);
        const data = await response.json();
        return { data, cache: true };
      } catch (err) {
        console.error(`Error accessing ${id}: ${err}`);
        return { data: {}, cache: false };
      }
    }

    return { data: {}, cache: true };
  }
}
