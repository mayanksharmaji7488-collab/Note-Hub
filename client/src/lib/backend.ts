const ABSOLUTE_URL_PATTERN = /^(?:[a-z][a-z\d+\-.]*:)?\/\//i;

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

const configuredApiBaseUrl = (() => {
  const raw = import.meta.env.VITE_API_BASE_URL?.trim();
  return raw ? trimTrailingSlash(raw) : "";
})();

export function resolveApiUrl(path: string): string {
  if (!path) return configuredApiBaseUrl;
  if (ABSOLUTE_URL_PATTERN.test(path)) return path;

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return configuredApiBaseUrl ? `${configuredApiBaseUrl}${normalizedPath}` : normalizedPath;
}

export function resolveUploadedFileUrl(fileUrl: string): string {
  return resolveApiUrl(fileUrl);
}

export function getSocketServerUrl(): string | undefined {
  return configuredApiBaseUrl || undefined;
}
