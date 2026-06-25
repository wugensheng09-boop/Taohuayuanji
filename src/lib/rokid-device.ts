export type RokidRuntimeMode = "web" | "rokid";

type QueryValue = string | string[] | undefined;

export type RokidSearchParams = {
  device?: QueryValue;
};

function queryValues(value: QueryValue): string[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

export function getRokidRuntimeMode(searchParams: RokidSearchParams): RokidRuntimeMode {
  const hasRokidDevice = queryValues(searchParams.device).some((value) => value.trim().toLowerCase() === "rokid");
  return hasRokidDevice ? "rokid" : "web";
}

export function isRokidRuntime(searchParams: RokidSearchParams): boolean {
  return getRokidRuntimeMode(searchParams) === "rokid";
}

export function buildRokidLaunchUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.searchParams.set("device", "rokid");
  url.searchParams.set("autostart", "1");
  return url.toString();
}
