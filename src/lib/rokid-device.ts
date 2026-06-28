export type RokidRuntimeMode = "web" | "rokid";

type QueryValue = string | string[] | undefined;

export type RokidSearchParams = {
  device?: QueryValue;
};

export type BuildRokidLaunchUrlOptions = {
  autostart?: boolean;
  path?: string;
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

export function buildRokidLaunchUrl(rawUrl: string, options: BuildRokidLaunchUrlOptions = {}): string {
  const url = new URL(rawUrl);
  if (options.path) {
    url.pathname = options.path;
  }
  url.searchParams.set("device", "rokid");
  if (options.autostart) {
    url.searchParams.set("autostart", "1");
  } else {
    url.searchParams.delete("autostart");
  }
  return url.toString();
}
