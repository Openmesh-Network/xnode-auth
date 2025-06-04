export function getMessage({
  domain,
  timestamp,
}: {
  domain: string;
  timestamp: number;
}): string {
  return `Xnode Auth authenticate ${domain} at ${timestamp}`;
}
