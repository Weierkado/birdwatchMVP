const FIELD_GUIDE_KEY_V2 = "birdwatch_text_sim_field_guide_v2";
const FIELD_GUIDE_KEY_V3 = "birdwatch_text_sim_field_guide_v3";

const V2_TO_V3_CARD_ID_MAP = {
  kingfisher_interesting_01: "kingfisher_normal_03",
  sparrow_interesting_01: "sparrow_normal_02",
  red_billed_magpie_interesting_01: "red_billed_magpie_normal_02",
  mandarin_duck_interesting_01: "mandarin_duck_normal_02",
  blackbird_interesting_01: "blackbird_normal_02",
  night_heron_interesting_01: "night_heron_remarkable_01",
  night_heron_remarkable_01: "night_heron_interesting_02"
};

export function createDefaultFieldGuide() {
  return {
    heardSpeciesIds: [],
    seenSpeciesIds: [],
    cataloguedSpeciesIds: [],
    collectedCards: [],
    discoveryOrder: [],
    speciesRecords: [],
    seenCounts: {},
    photoCountBySpecies: {},
    captureCountByCardId: {}
  };
}

function uniqueStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set();
  const result = [];

  value.forEach((item) => {
    if (typeof item !== "string" || seen.has(item)) {
      return;
    }

    seen.add(item);
    result.push(item);
  });

  return result;
}

function normalizeSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }

  return snapshot;
}

function getSnapshotSortScore(snapshot) {
  if (snapshot && Number.isFinite(snapshot.focusScore)) {
    return snapshot.focusScore;
  }

  if (snapshot && snapshot.focusAffix === "IN_FOCUS") {
    return 1;
  }

  if (snapshot && snapshot.focusAffix === "BLUR") {
    return 0;
  }

  return -1;
}

function getSnapshotSortTime(snapshot) {
  if (!snapshot) {
    return 0;
  }

  if (Number.isFinite(snapshot.realTimestamp)) {
    return snapshot.realTimestamp;
  }

  const parsedTime = Date.parse(snapshot.realTimestamp || "");
  return Number.isFinite(parsedTime) ? parsedTime : 0;
}

function sortSnapshotsForDisplay(snapshots) {
  return snapshots
    .map((snapshot, index) => ({ snapshot, index }))
    .sort((left, right) => {
      const scoreDiff = getSnapshotSortScore(right.snapshot) - getSnapshotSortScore(left.snapshot);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      const timeDiff = getSnapshotSortTime(right.snapshot) - getSnapshotSortTime(left.snapshot);
      if (timeDiff !== 0) {
        return timeDiff;
      }

      return left.index - right.index;
    })
    .map((item) => item.snapshot);
}

function normalizeSnapshotArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((snapshot) => normalizeSnapshot(snapshot))
    .filter(Boolean);
}

function normalizeSisterKnowledge(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function normalizeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeQueueContext(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};

  return {
    eventName: normalizeString(source.eventName, "photo_sent"),
    speciesId: normalizeString(source.speciesId),
    cardId: normalizeString(source.cardId),
    cardTitle: normalizeString(source.cardTitle, "这只鸟"),
    timeOfDay: normalizeString(source.timeOfDay, "unknown"),
    quality: normalizeString(source.quality, "unknown"),
    composition: normalizeString(source.composition, "unknown"),
    firstTimeSpecies: source.firstTimeSpecies === true,
    repeatSpecies: source.repeatSpecies === true
  };
}

function normalizeLiyaMessageQueueItem(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const messageId = normalizeString(value.messageId);
  if (!messageId) {
    return null;
  }

  const status = ["pending", "delivered", "read"].includes(value.status)
    ? value.status
    : "pending";
  const id = normalizeString(value.id, `liya_queue_${messageId}`);
  const cardId = normalizeString(value.cardId);
  const speciesId = normalizeString(value.speciesId);

  return {
    id,
    source: normalizeString(value.source, "photo_reply"),
    threadId: normalizeString(value.threadId, "liya"),
    speaker: normalizeString(value.speaker, "liya"),
    messageId,
    status,
    createdAt: normalizeRealTimestamp(value.createdAt),
    dueAt: normalizeRealTimestamp(value.dueAt),
    deliveredAt: normalizeRealTimestamp(value.deliveredAt),
    readAt: normalizeRealTimestamp(value.readAt),
    cardId,
    speciesId,
    context: normalizeQueueContext(value.context),
    effects: {
      unlockSisterKnowledge: value.effects && value.effects.unlockSisterKnowledge === true,
      triggerAutoCatalogue: value.effects && value.effects.triggerAutoCatalogue === true
    }
  };
}

function normalizeRealTimestamp(value) {
  if (Number.isFinite(value)) {
    return value;
  }

  const numericValue = typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (Number.isFinite(numericValue)) {
    return numericValue;
  }

  const parsedTime = Date.parse(value || "");
  return Number.isFinite(parsedTime) ? parsedTime : null;
}

function normalizeCollectedCards(collectedCards) {
  if (!Array.isArray(collectedCards)) {
    return [];
  }

  const entryByCardId = new Map();

  collectedCards.forEach((entry) => {
    const cardId = typeof entry === "string"
      ? entry
      : entry && typeof entry.cardId === "string"
        ? entry.cardId
        : entry && typeof entry.id === "string"
          ? entry.id
          : null;

    if (!cardId) {
      return;
    }

    const snapshots = entry && typeof entry === "object" && Array.isArray(entry.snapshots)
      ? normalizeSnapshotArray(entry.snapshots)
      : [normalizeSnapshot(entry && typeof entry === "object" ? entry.snapshot : null)].filter(Boolean);
    const isIdentified = Boolean(entry && typeof entry === "object" && entry.isIdentified === true);
    const hasNewContent = entry && typeof entry === "object" && entry.hasNewContent === true;
    const hasNewCard = entry && typeof entry === "object" && entry.hasNewCard === true;
    const sentToSister = entry && typeof entry === "object" && entry.sentToSister === true;
    const sisterKnowledge = normalizeSisterKnowledge(entry && typeof entry === "object" ? entry.sisterKnowledge : null);
    const sentToSisterAt = entry && typeof entry === "object" ? normalizeRealTimestamp(entry.sentToSisterAt) : null;
    const sisterReplyDueAt = entry && typeof entry === "object" ? normalizeRealTimestamp(entry.sisterReplyDueAt) : null;
    const sisterReplyReadAt = entry && typeof entry === "object" ? normalizeRealTimestamp(entry.sisterReplyReadAt) : null;
    const sisterKnowledgeUnlocked = entry && typeof entry === "object" && entry.sisterKnowledgeUnlocked === true;
    const pendingAutoCatalogue = entry && typeof entry === "object" && entry.pendingAutoCatalogue === true;
    const autoCatalogueReadyAt = entry && typeof entry === "object" ? normalizeRealTimestamp(entry.autoCatalogueReadyAt) : null;
    const autoCataloguedAt = entry && typeof entry === "object" ? normalizeRealTimestamp(entry.autoCataloguedAt) : null;
    const liyaMessageQueueItem = entry && typeof entry === "object" ? normalizeLiyaMessageQueueItem(entry.liyaMessageQueueItem) : null;
    const existing = entryByCardId.get(cardId);

    if (!existing) {
      entryByCardId.set(cardId, {
        cardId,
        snapshots,
        isIdentified,
        hasNewContent,
        hasNewCard,
        sentToSister,
        sentToSisterAt,
        sisterReplyDueAt,
        sisterReplyReadAt,
        sisterKnowledgeUnlocked,
        pendingAutoCatalogue,
        autoCatalogueReadyAt,
        autoCataloguedAt,
        liyaMessageQueueItem,
        sisterKnowledge
      });
      return;
    }

    existing.snapshots = existing.snapshots.concat(snapshots);
    existing.isIdentified = existing.isIdentified || isIdentified;
    existing.hasNewContent = existing.hasNewContent || hasNewContent;
    existing.hasNewCard = existing.hasNewCard || hasNewCard;
    existing.sentToSister = existing.sentToSister || sentToSister;
    existing.sentToSisterAt = Number.isFinite(existing.sentToSisterAt) ? existing.sentToSisterAt : sentToSisterAt;
    existing.sisterReplyDueAt = Number.isFinite(existing.sisterReplyDueAt) ? existing.sisterReplyDueAt : sisterReplyDueAt;
    existing.sisterReplyReadAt = Number.isFinite(existing.sisterReplyReadAt) ? existing.sisterReplyReadAt : sisterReplyReadAt;
    existing.sisterKnowledgeUnlocked = existing.sisterKnowledgeUnlocked || sisterKnowledgeUnlocked;
    existing.pendingAutoCatalogue = existing.pendingAutoCatalogue || pendingAutoCatalogue;
    existing.autoCatalogueReadyAt = Number.isFinite(existing.autoCatalogueReadyAt) ? existing.autoCatalogueReadyAt : autoCatalogueReadyAt;
    existing.autoCataloguedAt = Number.isFinite(existing.autoCataloguedAt) ? existing.autoCataloguedAt : autoCataloguedAt;
    existing.liyaMessageQueueItem = existing.liyaMessageQueueItem || liyaMessageQueueItem;
    existing.sisterKnowledge = existing.sisterKnowledge.concat(sisterKnowledge);
  });

  return [...entryByCardId.values()].map((entry) => ({
    cardId: entry.cardId,
    snapshots: sortSnapshotsForDisplay(entry.snapshots),
    isIdentified: entry.isIdentified === true,
    hasNewContent: entry.hasNewContent === true,
    hasNewCard: entry.hasNewCard === true,
    sentToSister: entry.sentToSister === true,
    sentToSisterAt: Number.isFinite(entry.sentToSisterAt) ? entry.sentToSisterAt : null,
    sisterReplyDueAt: Number.isFinite(entry.sisterReplyDueAt) ? entry.sisterReplyDueAt : null,
    sisterReplyReadAt: Number.isFinite(entry.sisterReplyReadAt) ? entry.sisterReplyReadAt : null,
    sisterKnowledgeUnlocked: entry.sisterKnowledgeUnlocked === true,
    pendingAutoCatalogue: entry.pendingAutoCatalogue === true,
    autoCatalogueReadyAt: Number.isFinite(entry.autoCatalogueReadyAt) ? entry.autoCatalogueReadyAt : null,
    autoCataloguedAt: Number.isFinite(entry.autoCataloguedAt) ? entry.autoCataloguedAt : null,
    liyaMessageQueueItem: normalizeLiyaMessageQueueItem(entry.liyaMessageQueueItem),
    sisterKnowledge: normalizeSisterKnowledge(entry.sisterKnowledge)
  }));
}

function normalizeSpeciesRecords(speciesRecords) {
  if (!Array.isArray(speciesRecords)) {
    return [];
  }

  const recordBySpeciesId = new Map();

  speciesRecords.forEach((record) => {
    if (!record || typeof record !== "object" || typeof record.speciesId !== "string") {
      return;
    }

    const existing = recordBySpeciesId.get(record.speciesId) || {
      speciesId: record.speciesId,
      encounterCount: 0,
      cataloguedAtTimeLabel: "",
      cataloguedRealTimestamp: null
    };
    const encounterCount = Number(record.encounterCount);
    const cataloguedAtTimeLabel = typeof record.cataloguedAtTimeLabel === "string"
      ? record.cataloguedAtTimeLabel.trim()
      : "";
    const cataloguedRealTimestamp = normalizeRealTimestamp(record.cataloguedRealTimestamp);

    if (Number.isFinite(encounterCount)) {
      existing.encounterCount = Math.max(existing.encounterCount, Math.max(0, Math.floor(encounterCount)));
    }

    if (!existing.cataloguedAtTimeLabel && cataloguedAtTimeLabel) {
      existing.cataloguedAtTimeLabel = cataloguedAtTimeLabel;
    }

    if (!Number.isFinite(existing.cataloguedRealTimestamp) && Number.isFinite(cataloguedRealTimestamp)) {
      existing.cataloguedRealTimestamp = cataloguedRealTimestamp;
    }

    recordBySpeciesId.set(record.speciesId, existing);
  });

  return [...recordBySpeciesId.values()];
}

function normalizeCountMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce((result, [key, count]) => {
    if (typeof key !== "string") {
      return result;
    }

    const numericCount = Number(count);
    if (Number.isFinite(numericCount) && numericCount >= 0) {
      result[key] = Math.floor(numericCount);
    }

    return result;
  }, {});
}

export function normalizeFieldGuide(fieldGuide) {
  if (!fieldGuide || typeof fieldGuide !== "object" || Array.isArray(fieldGuide)) {
    return createDefaultFieldGuide();
  }

  return {
    heardSpeciesIds: uniqueStringArray(fieldGuide.heardSpeciesIds),
    seenSpeciesIds: uniqueStringArray(fieldGuide.seenSpeciesIds),
    cataloguedSpeciesIds: uniqueStringArray(fieldGuide.cataloguedSpeciesIds),
    collectedCards: normalizeCollectedCards(fieldGuide.collectedCards),
    discoveryOrder: uniqueStringArray(fieldGuide.discoveryOrder),
    speciesRecords: normalizeSpeciesRecords(fieldGuide.speciesRecords),
    seenCounts: normalizeCountMap(fieldGuide.seenCounts),
    photoCountBySpecies: normalizeCountMap(fieldGuide.photoCountBySpecies),
    captureCountByCardId: normalizeCountMap(fieldGuide.captureCountByCardId)
  };
}

function migrateCardIdToV3(cardId) {
  return V2_TO_V3_CARD_ID_MAP[cardId] || cardId;
}

function migrateCollectedCardsToV3(collectedCards) {
  if (!Array.isArray(collectedCards)) {
    return [];
  }

  const seen = new Set();
  const result = [];

  collectedCards.forEach((entry) => {
    const oldCardId = typeof entry === "string"
      ? entry
      : entry && typeof entry.cardId === "string"
        ? entry.cardId
        : entry && typeof entry.id === "string"
          ? entry.id
          : null;

    if (!oldCardId) {
      return;
    }

    const newCardId = migrateCardIdToV3(oldCardId);

    if (seen.has(newCardId)) {
      return;
    }

    seen.add(newCardId);
    result.push({
      cardId: newCardId,
      snapshots: [],
      isIdentified: false,
      hasNewContent: false,
      hasNewCard: false,
      sentToSister: false,
      sentToSisterAt: null,
      sisterReplyDueAt: null,
      sisterReplyReadAt: null,
      sisterKnowledgeUnlocked: false,
      pendingAutoCatalogue: false,
      autoCatalogueReadyAt: null,
      autoCataloguedAt: null,
      sisterKnowledge: []
    });
  });

  return result;
}

function migrateFieldGuideV2ToV3(fieldGuideV2) {
  const seenSpeciesIds = uniqueStringArray(fieldGuideV2 && fieldGuideV2.seenSpeciesIds);
  const discoveryOrder = uniqueStringArray(fieldGuideV2 && fieldGuideV2.discoveryOrder);

  return normalizeFieldGuide({
    heardSpeciesIds: uniqueStringArray(fieldGuideV2 && fieldGuideV2.heardSpeciesIds),
    seenSpeciesIds,
    cataloguedSpeciesIds: uniqueStringArray(fieldGuideV2 && fieldGuideV2.cataloguedSpeciesIds),
    collectedCards: migrateCollectedCardsToV3(fieldGuideV2 && fieldGuideV2.collectedCards),
    discoveryOrder: discoveryOrder.length > 0 ? discoveryOrder : seenSpeciesIds,
    speciesRecords: [],
    seenCounts: {},
    photoCountBySpecies: {},
    captureCountByCardId: {}
  });
}

function readStoredGuide(storageKey) {
  const savedText = localStorage.getItem(storageKey);

  if (!savedText) {
    return null;
  }

  try {
    return JSON.parse(savedText);
  } catch (error) {
    console.warn("图鉴存档读取失败，将使用空图鉴。", error);
    return null;
  }
}

export function loadFieldGuide() {
  const savedV3 = readStoredGuide(FIELD_GUIDE_KEY_V3);

  if (savedV3) {
    const normalizedGuide = normalizeFieldGuide(savedV3);
    saveFieldGuide(normalizedGuide);
    return normalizedGuide;
  }

  const savedV2 = readStoredGuide(FIELD_GUIDE_KEY_V2);

  if (savedV2) {
    const migratedGuide = migrateFieldGuideV2ToV3(savedV2);
    saveFieldGuide(migratedGuide);
    return migratedGuide;
  }

  return createDefaultFieldGuide();
}

export function saveFieldGuide(fieldGuide) {
  localStorage.setItem(FIELD_GUIDE_KEY_V3, JSON.stringify(normalizeFieldGuide(fieldGuide)));
}

export function clearFieldGuide() {
  saveFieldGuide(createDefaultFieldGuide());
}
