export function rowToMemory(row) {
    return {
        ...row,
        category: row.category,
        source: row.source,
        lifecycle_state: row.lifecycle_state,
        tags: JSON.parse(row.tags),
        triggers: JSON.parse(row.triggers),
    };
}
//# sourceMappingURL=types.js.map