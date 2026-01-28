import { readFile } from "fs/promises";

export interface Data {
  [domain: string]: { [user: string]: { paths: string } };
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
