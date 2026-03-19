const DEFAULT_PROFILE = { name: "", affiliation: "", bio: "" };
const DEFAULT_CREDS = { orcidId: "", zenodoToken: "", githubUsername: "" };
const SOURCE_KEYS = ["orcid", "zenodo", "github", "crossref"];

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toIsoString(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function nowIso() {
  return new Date().toISOString();
}

function getSectionUpdatedAt(section) {
  if (!isObject(section)) return null;
  return toIsoString(section.__meta?.updatedAt || section.updatedAt);
}

function withSectionMeta(section, defaults = {}, fallbackTimestamp = nowIso()) {
  const next = { ...defaults, ...(isObject(section) ? section : {}) };
  const updatedAt = getSectionUpdatedAt(section) || fallbackTimestamp;
  return {
    ...next,
    __meta: {
      ...(isObject(next.__meta) ? next.__meta : {}),
      updatedAt,
    },
  };
}

function normalizeIntegrationState(state) {
  const status = state?.status === "loading" ? "idle" : (state?.status || "idle");
  return {
    status,
    count: Number.isFinite(Number(state?.count)) ? Number(state.count) : 0,
    error: status === "loading" ? null : (state?.error ?? null),
  };
}

export function sanitizeIntegrations(integrations) {
  const normalized = {};
  for (const key of SOURCE_KEYS) {
    normalized[key] = normalizeIntegrationState(integrations?.[key]);
  }

  return {
    ...normalized,
    __meta: {
      updatedAt: getSectionUpdatedAt(integrations) || nowIso(),
    },
  };
}

function itemTimestamp(item, fallback = nowIso()) {
  return (
    toIsoString(item?.deletedAt) ||
    toIsoString(item?.updatedAt) ||
    toIsoString(item?.createdAt) ||
    fallback
  );
}

function normalizeItem(item, fallbackTimestamp = nowIso()) {
  const createdAt = toIsoString(item?.createdAt) || itemTimestamp(item, fallbackTimestamp);
  const updatedAt = toIsoString(item?.updatedAt) || itemTimestamp(item, fallbackTimestamp);
  const deletedAt = toIsoString(item?.deletedAt);

  return {
    ...item,
    createdAt,
    updatedAt,
    ...(deletedAt ? { deletedAt } : {}),
  };
}

function normalizeCollection(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item.id === "string")
    .map((item) => normalizeItem(item));
}

export function getVisibleItems(items) {
  return normalizeCollection(items).filter((item) => !item.deletedAt);
}

export function markItemUpdated(item, changes) {
  const timestamp = nowIso();
  const next = normalizeItem({ ...item, ...changes, updatedAt: timestamp }, timestamp);

  if (next.deletedAt && changes && !Object.prototype.hasOwnProperty.call(changes, "deletedAt")) {
    delete next.deletedAt;
  }

  return next;
}

export function markItemDeleted(item) {
  const timestamp = nowIso();
  return normalizeItem(
    {
      ...item,
      deletedAt: timestamp,
      updatedAt: timestamp,
    },
    timestamp,
  );
}

export function stampSection(section, changes = {}, defaults = {}) {
  const timestamp = nowIso();
  return withSectionMeta(
    {
      ...(isObject(section) ? section : defaults),
      ...changes,
      __meta: {
        ...(isObject(section?.__meta) ? section.__meta : {}),
        updatedAt: timestamp,
      },
    },
    defaults,
    timestamp,
  );
}

function mergeCollections(baseItems, incomingItems) {
  const merged = new Map();

  for (const item of normalizeCollection(baseItems)) {
    merged.set(item.id, item);
  }

  for (const item of normalizeCollection(incomingItems)) {
    const current = merged.get(item.id);
    if (!current) {
      merged.set(item.id, item);
      continue;
    }

    if (itemTimestamp(item) >= itemTimestamp(current)) {
      merged.set(item.id, item);
    }
  }

  return Array.from(merged.values());
}

function mergeSections(baseSection, incomingSection, defaults = {}) {
  const base = withSectionMeta(baseSection, defaults);
  const incoming = withSectionMeta(incomingSection, defaults);
  return getSectionUpdatedAt(incoming) >= getSectionUpdatedAt(base) ? incoming : base;
}

export function normalizeUserData(data) {
  const timestamp = nowIso();

  return {
    profile: withSectionMeta(data?.profile, DEFAULT_PROFILE, timestamp),
    outputs: normalizeCollection(data?.outputs),
    todos: normalizeCollection(data?.todos),
    integrations: sanitizeIntegrations(data?.integrations),
    creds: withSectionMeta(data?.creds, DEFAULT_CREDS, timestamp),
    lastSync: toIsoString(data?.lastSync),
    rowUpdatedAt: toIsoString(data?.rowUpdatedAt ?? data?.updated_at),
  };
}

export function mergeUserData(baseData, incomingData) {
  const base = normalizeUserData(baseData);
  const incoming = normalizeUserData(incomingData);

  const lastSync = [base.lastSync, incoming.lastSync]
    .filter(Boolean)
    .sort()
    .at(-1) || null;

  return {
    profile: mergeSections(base.profile, incoming.profile, DEFAULT_PROFILE),
    outputs: mergeCollections(base.outputs, incoming.outputs),
    todos: mergeCollections(base.todos, incoming.todos),
    integrations: mergeSections(
      sanitizeIntegrations(base.integrations),
      sanitizeIntegrations(incoming.integrations),
      sanitizeIntegrations(),
    ),
    creds: mergeSections(base.creds, incoming.creds, DEFAULT_CREDS),
    lastSync,
    rowUpdatedAt: incoming.rowUpdatedAt || base.rowUpdatedAt || null,
  };
}
