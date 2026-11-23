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
  users?: { [user: string]: { roles: Set<string> } };
  /// Patterns -> Roles, Clash: merge
  /// Grants roles on demand to users matching the pattern
  userPatterns?: { patterns: string[]; roles: Set<string> }[];
  /// Role -> Path patterns, Clash: merge
  /// All patterns of some group must match to allow the path.
  roles?: { [role: string]: { pathPatterns: string[][] } };
  /// User -> Alias, Clash: first
  aliases?: { [user: string]: string };
  /// Subpath of the login page. Clash: first
  loginPage?: string | null;
  config?: {
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
  users?: { key?: string; value?: { roles?: string } };
  roles?: { key?: string; value?: { pathPatterns?: string } };
  aliases?: { key?: string; value?: string };
  config?: {
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

    const allowed = (
      keyAllowed: (restriction: DomainSpecificRestriction) => boolean,
      valueAllowed: (restriction: DomainSpecificRestriction) => boolean,
    ) =>
      restrictions.every(
        (restriction) => keyAllowed(restriction) && valueAllowed(restriction),
      );

    for (const [user, alias] of Object.entries(data.aliases ?? {})) {
      if (
        allowed(
          (restriction) =>
            new RegExp(restriction.aliases?.key ?? "^$").test(user),
          (restriction) =>
            new RegExp(restriction.aliases?.value ?? "^$").test(alias),
        ) &&
        merged.aliases?.[user] === undefined
      ) {
        (merged.aliases ??= {})[user] = alias;
      }
    }

    for (const [user, userDef] of Object.entries(data.users ?? {})) {
      if (
        !restrictions.every((restriction) =>
          new RegExp(restriction.users?.key ?? "^$").test(user),
        )
      ) {
        continue;
      }
      const users = (merged.users ??= {});
      const existing = (users[user] ??= { roles: new Set<string>() });
      for (const role of userDef.roles) {
        if (
          restrictions.every((restriction) =>
            new RegExp(restriction.users?.value?.roles ?? "^$").test(role),
          )
        ) {
          existing.roles.add(role);
        }
      }
    }

    for (const rule of data.userPatterns ?? []) {
      const roles = new Set<string>();
      for (const role of rule.roles) {
        if (
          restrictions.every((restriction) =>
            new RegExp(restriction.users?.value?.roles ?? "^$").test(role),
          )
        ) {
          roles.add(role);
        }
      }

      (merged.userPatterns ??= []).push({
        patterns: [
          ...rule.patterns,
          ...restrictions.map((restriction) => restriction.users?.key ?? "^$"),
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

    if (merged.loginPage === undefined && data.loginPage != null) {
      merged.loginPage = data.loginPage;
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

      mergeScalars<"signatureDomain" | "cookieDomain" | "signatureExpiry">(
        mergedConfig,
        config,
        ["signatureDomain", "cookieDomain", "signatureExpiry"],
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
