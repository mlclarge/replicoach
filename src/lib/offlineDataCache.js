const USER_DATA_CACHE_NAMES = [
  "rc-supabase-data-v1",
  "rc-supabase-data-v2",
  "rc-supabase-storage-v1",
  "rc-supabase-storage-v2",
];

export async function clearOfflineDataCache() {
  if (typeof caches === "undefined") return;

  const results = await Promise.allSettled(
    USER_DATA_CACHE_NAMES.map((cacheName) => caches.delete(cacheName)),
  );
  const failures = results.filter((result) => result.status === "rejected");

  if (failures.length > 0) {
    console.error("Unable to clear offline user data caches:", failures);
  }
}
