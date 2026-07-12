const ignoredRevisionFields = new Set(['created_at', 'updated_at', 'created_by', 'updated_by']);

export function revisionChanges(previous: Record<string, unknown> | null, current: Record<string, unknown>) {
  return Object.keys(current)
    .filter((key) => !ignoredRevisionFields.has(key) && JSON.stringify(previous?.[key]) !== JSON.stringify(current[key]))
    .map((key) => ({ field: key, before: previous?.[key], after: current[key] }));
}
