export function matchesSearchQuery(parts: Array<string | null | undefined>, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return parts
    .map((part) => (part ?? "").toLowerCase())
    .some((part) => part.includes(normalizedQuery));
}
