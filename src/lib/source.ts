import { readFile } from "fs/promises";

export interface Source {
  data: Data;
  restrictions?: Restrictions;
}

export interface Data {
  [domain: string]: DomainData;
}

export interface DomainData {
  /// User -> Roles/Alias. Clash: roles merge, alias first.
  /// If alias is set, roles on the same entry are ignored: roles are matched against the alias.
  users?: { [user: string]: { roles: string[]; alias?: string | null } };
  /// Patterns -> Roles, Clash: merge
  /// Grants roles on demand to users matching the pattern
  userPatterns?: { patterns: string[]; roles: string[] }[];
  /// Role -> Path patterns, Clash: merge
  /// All patterns of some group must match to allow the path.
  roles?: { [role: string]: { pathPatterns: string[][] } };
  config?: {
    /// Subpath of the login page. Clash: first
    loginPage?: string | null;
    /// Domain the signed message is computed over (the login page domain). Clash: first
    signatureDomain?: string | null;
    /// Domain attribute of the session cookies. Clash: first
    cookieDomain?: string | null;
    // Validity of a signature in seconds; signatures with a timestamp older than this are rejected.
    // Clash: first
    signatureExpiry?: number | null;
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
  users?: { key?: string; value?: { roles?: string; alias?: string } };
  userPatterns?: { key?: string; value?: { roles?: string } };
  roles?: { key?: string; value?: { pathPatterns?: string } };
  config?: {
    loginPage?: string;
    signatureDomain?: string;
    cookieDomain?: string;
    signatureExpiry?: string;
    ethereum?: { rpc?: string };
    appkit?: { projectid?: string; networks?: string };
    password?: { user?: string };
  };
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

    for (const [user, userDef] of Object.entries(data.users ?? {})) {
      if (
        !restrictions.every((restriction) =>
          new RegExp(restriction.users?.key ?? "^$").test(user),
        )
      ) {
        continue;
      }
      const users = (merged.users ??= {});
      const existing = (users[user] ??= { roles: [] });
      for (const role of userDef.roles) {
        if (
          restrictions.every((restriction) =>
            new RegExp(restriction.users?.value?.roles ?? "^$").test(role),
          )
        ) {
          existing.roles.push(role);
        }
      }

      if (
        existing.alias === undefined &&
        userDef.alias != null &&
        restrictions.every((restriction) =>
          new RegExp(restriction.users?.value?.alias ?? "^$").test(
            userDef.alias!,
          ),
        )
      ) {
        existing.alias = userDef.alias;
      }
    }

    for (const rule of data.userPatterns ?? []) {
      const roles: string[] = [];
      for (const role of rule.roles) {
        if (
          restrictions.every((restriction) =>
            new RegExp(restriction.userPatterns?.value?.roles ?? "^$").test(
              role,
            ),
          )
        ) {
          roles.push(role);
        }
      }

      (merged.userPatterns ??= []).push({
        patterns: [
          ...rule.patterns,
          ...restrictions.map(
            (restriction) => restriction.userPatterns?.key ?? "^$",
          ),
        ],
        roles,
      });
    }

    for (const [role, roleDef] of Object.entries(data.roles ?? {})) {
      if (
        !restrictions.every((restriction) =>
          new RegExp(restriction.roles?.key ?? "^$").test(role),
        )
      ) {
        continue;
      }
      const pathRestrictions = restrictions.map(
        (restriction) => restriction.roles?.value?.pathPatterns ?? "^$",
      );
      const roles = (merged.roles ??= {});
      const existing = (roles[role] ??= { pathPatterns: [] });
      for (const pathPatternGroup of roleDef.pathPatterns) {
        existing.pathPatterns.push([...pathPatternGroup, ...pathRestrictions]);
      }
    }

    const configAllowed = (
      getRegex: (restriction: DomainSpecificRestriction) => string | undefined,
      value: string,
    ) =>
      restrictions.every((restriction) =>
        new RegExp(getRegex(restriction) ?? "^$").test(value),
      );

    const config = data.config;
    if (config) {
      const mergedConfig = (merged.config ??= {});

      // scalar config values per category: first source wins, if allowed
      const mergeScalars = <K extends string>(
        target: { [key in K]?: unknown },
        source: { [key in K]?: unknown },
        keys: readonly K[],
        getRestriction: (
          restriction: DomainSpecificRestriction,
          key: K,
        ) => string | undefined,
      ) => {
        for (const key of keys) {
          const value = source[key];
          if (
            target[key] === undefined &&
            value != null &&
            configAllowed(
              (restriction) => getRestriction(restriction, key),
              String(value),
            )
          ) {
            target[key] = value;
          }
        }
      };

      // list config values per category: merged as a union, every element
      // must be allowed by the restrictions
      const mergeList = <K extends string>(
        target: { [key in K]?: string[] },
        key: K,
        source: string[] | undefined,
        getRestriction: (
          restriction: DomainSpecificRestriction,
        ) => string | undefined,
      ) => {
        if (!source) {
          return;
        }
        const list = (target[key] ??= []);
        for (const item of source) {
          if (!list.includes(item) && configAllowed(getRestriction, item)) {
            list.push(item);
          }
        }
      };

      // object set config values per category: first source wins per key,
      // every key must be allowed by the restrictions
      const mergeObjectSet = <V>(
        target: Record<string, V>,
        source: Record<string, V> | undefined,
        getRestriction: (
          restriction: DomainSpecificRestriction,
        ) => string | undefined,
      ) => {
        if (!source) {
          return;
        }
        for (const [key, value] of Object.entries(source)) {
          if (target[key] === undefined && configAllowed(getRestriction, key)) {
            target[key] = value;
          }
        }
      };

      mergeScalars<
        "loginPage" | "signatureDomain" | "cookieDomain" | "signatureExpiry"
      >(
        mergedConfig,
        config,
        ["loginPage", "signatureDomain", "cookieDomain", "signatureExpiry"],
        (restriction, key) => restriction.config?.[key],
      );
      if (config.ethereum?.rpc) {
        mergeList(
          (mergedConfig.ethereum ??= {}),
          "rpc",
          config.ethereum.rpc,
          (restriction) => restriction.config?.ethereum?.rpc,
        );
      }
      if (config.appkit) {
        const appkit = (mergedConfig.appkit ??= {});
        mergeScalars<"projectid">(
          appkit,
          config.appkit,
          ["projectid"],
          (restriction, key) => restriction.config?.appkit?.[key],
        );
        mergeList(
          appkit,
          "networks",
          config.appkit.networks,
          (restriction) => restriction.config?.appkit?.networks,
        );
      }
      if (config.password?.user) {
        mergeObjectSet(
          ((mergedConfig.password ??= {}).user ??= {}),
          config.password.user,
          (restriction) => restriction.config?.password?.user,
        );
      }
    }
  }

  return merged;
}

const cache = {} as {
  [id: string]: { data: Data; cachedAt: Date } | undefined;
};

// in-flight fetches, so concurrent requests for the same source share one fetch
const pending = {} as { [id: string]: Promise<Data> | undefined };

async function fetchSource({
  id,
}: {
  id: "memory" | `external:${string}`;
}): Promise<Data> {
  const source = await _getSource({ id });
  if (source.cache) {
    cache[id] = { data: source.data, cachedAt: new Date() };
  }
  return source.data;
}

export async function getSource({
  id,
  cacheDuration = 60,
}: {
  id: "memory" | `external:${string}`;
  cacheDuration?: number;
}): Promise<Data> {
  const cached = cache[id];
  if (cached && Date.now() - cached.cachedAt.getTime() < cacheDuration * 1000) {
    return cached.data;
  }

  // coalesce concurrent fetches for the same source into one request
  return (pending[id] ??= fetchSource({ id }).finally(() => {
    delete pending[id];
  }));
}

export async function updateSource({
  id,
}: {
  id: "memory" | `external:${string}`;
}) {
  // force a refetch
  await pending[id]?.catch(() => {});
  delete cache[id];
  await getSource({ id });
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
