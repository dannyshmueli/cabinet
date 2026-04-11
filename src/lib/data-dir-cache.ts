let cached: string | null = null;

export async function getDataDir(): Promise<string> {
  if (cached) return cached;
  const res = await fetch("/api/health", { cache: "no-store" });
  const data = await res.json();
  cached = data.dataDir as string;
  return cached;
}
