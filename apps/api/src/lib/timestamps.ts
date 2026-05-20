export function nowIsoTimestamp() {
  return new Date().toISOString();
}

export function toIsoTimestamp(value: Date | number | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
      return new Date(Number(trimmed)).toISOString();
    }

    return new Date(trimmed).toISOString();
  }

  return new Date(value).toISOString();
}
