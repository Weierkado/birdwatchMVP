/**
 * 模块职责：
 * - 维护鸟类知识状态和 v4 图鉴卡牌写入。
 * - UNKNOWN / HEARD / SEEN / CATALOGUED 是逐级知识状态。
 *
 * 维护边界：
 * - heard 不能等同 seen。
 * - seen 不能等同 catalogued。
 * - collectedCards 不能反推 seen；正式鸟名必须在 markCatalogued 后才能显示。
 */
import { normalizeFieldGuide, saveFieldGuide } from "./storage.js";

function ensureGuideShape(fieldGuide) {
  const guide = normalizeFieldGuide(fieldGuide);

  if (fieldGuide && typeof fieldGuide === "object" && !Array.isArray(fieldGuide)) {
    fieldGuide.heardSpeciesIds = guide.heardSpeciesIds;
    fieldGuide.seenSpeciesIds = guide.seenSpeciesIds;
    fieldGuide.cataloguedSpeciesIds = guide.cataloguedSpeciesIds;
    fieldGuide.collectedCards = guide.collectedCards;
    fieldGuide.discoveryOrder = guide.discoveryOrder;
    fieldGuide.speciesRecords = guide.speciesRecords;
    fieldGuide.seenCounts = guide.seenCounts;
    fieldGuide.photoCountBySpecies = guide.photoCountBySpecies;
    fieldGuide.captureCountByCardId = guide.captureCountByCardId;
    return fieldGuide;
  }

  return guide;
}

function hasSpeciesId(speciesIds, speciesId) {
  return speciesIds.includes(speciesId);
}

function getSpeciesRecord(guide, speciesId) {
  return guide.speciesRecords.find((record) => record.speciesId === speciesId) || null;
}

function getOrCreateSpeciesRecord(guide, speciesId) {
  let record = getSpeciesRecord(guide, speciesId);

  if (!record) {
    record = {
      speciesId,
      encounterCount: 0,
      cataloguedAtTimeLabel: "",
      cataloguedRealTimestamp: null
    };
    guide.speciesRecords.push(record);
  }

  return record;
}

function normalizeTimeLabel(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
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

function getCountFromMap(countMap, key) {
  if (!countMap || typeof countMap !== "object" || !Object.prototype.hasOwnProperty.call(countMap, key)) {
    return null;
  }

  const count = Number(countMap[key]);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : null;
}

function incrementCountMap(countMap, key) {
  const currentCount = getCountFromMap(countMap, key) || 0;
  countMap[key] = currentCount + 1;
  return countMap[key];
}

function normalizeSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }

  return snapshot;
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

function normalizeReplyTimestamp(value) {
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

  return {
    id: normalizeString(value.id, `liya_queue_${messageId}`),
    source: normalizeString(value.source, "photo_reply"),
    threadId: normalizeString(value.threadId, "liya"),
    speaker: normalizeString(value.speaker, "liya"),
    messageId,
    status,
    createdAt: normalizeReplyTimestamp(value.createdAt),
    dueAt: normalizeReplyTimestamp(value.dueAt),
    deliveredAt: normalizeReplyTimestamp(value.deliveredAt),
    readAt: normalizeReplyTimestamp(value.readAt),
    cardId: normalizeString(value.cardId),
    speciesId: normalizeString(value.speciesId),
    context: normalizeQueueContext(value.context),
    effects: {
      unlockSisterKnowledge: value.effects && value.effects.unlockSisterKnowledge === true,
      triggerAutoCatalogue: value.effects && value.effects.triggerAutoCatalogue === true
    }
  };
}

function normalizeSisterReplyState(entry) {
  entry.sentToSisterAt = normalizeReplyTimestamp(entry.sentToSisterAt);
  entry.sisterReplyDueAt = normalizeReplyTimestamp(entry.sisterReplyDueAt);
  entry.sisterReplyReadAt = normalizeReplyTimestamp(entry.sisterReplyReadAt);
  entry.sisterKnowledgeUnlocked = entry.sisterKnowledgeUnlocked === true;
  entry.pendingAutoCatalogue = entry.pendingAutoCatalogue === true;
  entry.autoCatalogueReadyAt = normalizeReplyTimestamp(entry.autoCatalogueReadyAt);
  entry.autoCataloguedAt = normalizeReplyTimestamp(entry.autoCataloguedAt);
  entry.liyaMessageQueueItem = normalizeLiyaMessageQueueItem(entry.liyaMessageQueueItem);
  return entry;
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

export function markHeard(fieldGuide, speciesId) {
  const guide = ensureGuideShape(fieldGuide);

  // heardSpeciesIds 只代表“听到过”。未知鸟的听声 UI 后续不应直接展示正式鸟名。
  if (!speciesId) {
    return false;
  }

  if (!guide.heardSpeciesIds.includes(speciesId)) {
    guide.heardSpeciesIds.push(speciesId);
    saveFieldGuide(guide);
    return true;
  }

  return false;
}

/**
 * 标记近距离见过。
 *
 * 注意：
 * - 这里会维护 discoveryOrder，让图鉴按发现顺序生长。
 * - 不会自动加新，也不会显示正式鸟名。
 */
export function markSeen(fieldGuide, speciesId) {
  const guide = ensureGuideShape(fieldGuide);

  if (!speciesId) {
    return false;
  }

  const wasSeen = guide.seenSpeciesIds.includes(speciesId);

  if (!wasSeen) {
    guide.seenSpeciesIds.push(speciesId);
  }

  if (!guide.discoveryOrder.includes(speciesId)) {
    guide.discoveryOrder.push(speciesId);
  }

  saveFieldGuide(guide);
  return !wasSeen;
}

export function markCatalogued(fieldGuide, speciesId, timeLabel = "") {
  const guide = ensureGuideShape(fieldGuide);

  if (!speciesId) {
    return false;
  }

  const alreadyCatalogued = guide.cataloguedSpeciesIds.includes(speciesId);

  if (!guide.seenSpeciesIds.includes(speciesId)) {
    guide.seenSpeciesIds.push(speciesId);
  }

  if (!guide.discoveryOrder.includes(speciesId)) {
    guide.discoveryOrder.push(speciesId);
  }

  if (!alreadyCatalogued) {
    guide.cataloguedSpeciesIds.push(speciesId);
  }

  const record = getOrCreateSpeciesRecord(guide, speciesId);
  if (!record.cataloguedAtTimeLabel) {
    record.cataloguedAtTimeLabel = normalizeTimeLabel(timeLabel) || "旧记录";
  }
  if (!alreadyCatalogued && !Number.isFinite(record.cataloguedRealTimestamp)) {
    record.cataloguedRealTimestamp = Date.now();
  }

  saveFieldGuide(guide);
  return !alreadyCatalogued;
}

export function incrementSpeciesEncounterCount(fieldGuide, speciesId) {
  const guide = ensureGuideShape(fieldGuide);

  if (!speciesId) {
    return 0;
  }

  const record = getOrCreateSpeciesRecord(guide, speciesId);
  record.encounterCount = Math.max(0, Number(record.encounterCount) || 0) + 1;
  saveFieldGuide(guide);
  return record.encounterCount;
}

export function incrementSpeciesSeenCount(fieldGuide, speciesId) {
  const guide = ensureGuideShape(fieldGuide);

  if (!speciesId) {
    return 0;
  }

  const nextCount = incrementCountMap(guide.seenCounts, speciesId);
  saveFieldGuide(guide);
  return nextCount;
}

export function incrementSpeciesPhotoCount(fieldGuide, speciesId) {
  const guide = ensureGuideShape(fieldGuide);

  if (!speciesId) {
    return 0;
  }

  const nextCount = incrementCountMap(guide.photoCountBySpecies, speciesId);
  saveFieldGuide(guide);
  return nextCount;
}

/**
 * 是否已经近距离见过。
 *
 * 注意：
 * - 只看 seenSpeciesIds / cataloguedSpeciesIds。
 * - 不看 heardSpeciesIds，也不看 collectedCards。
 */
export function isSeen(fieldGuide, speciesId) {
  const guide = ensureGuideShape(fieldGuide);
  return hasSpeciesId(guide.seenSpeciesIds, speciesId) || hasSpeciesId(guide.cataloguedSpeciesIds, speciesId);
}

export function isCatalogued(fieldGuide, speciesId) {
  const guide = ensureGuideShape(fieldGuide);
  return hasSpeciesId(guide.cataloguedSpeciesIds, speciesId);
}

export function getSpeciesEncounterCount(fieldGuide, speciesId) {
  const guide = ensureGuideShape(fieldGuide);
  const record = getSpeciesRecord(guide, speciesId);

  if (record && Number.isFinite(Number(record.encounterCount))) {
    return Math.max(0, Math.floor(Number(record.encounterCount)));
  }

  return isSeen(guide, speciesId) ? 1 : 0;
}

export function getSpeciesSeenCount(fieldGuide, speciesId) {
  const guide = ensureGuideShape(fieldGuide);
  return getCountFromMap(guide.seenCounts, speciesId) || 0;
}

export function getSpeciesPhotoCount(fieldGuide, speciesId) {
  const guide = ensureGuideShape(fieldGuide);
  return getCountFromMap(guide.photoCountBySpecies, speciesId) || 0;
}

export function getCardCaptureCount(fieldGuide, cardId) {
  const guide = ensureGuideShape(fieldGuide);
  return getCountFromMap(guide.captureCountByCardId, cardId);
}

export function getSpeciesCataloguedAtTimeLabel(fieldGuide, speciesId) {
  const guide = ensureGuideShape(fieldGuide);
  const record = getSpeciesRecord(guide, speciesId);

  if (record && normalizeTimeLabel(record.cataloguedAtTimeLabel)) {
    return normalizeTimeLabel(record.cataloguedAtTimeLabel);
  }

  return isCatalogued(guide, speciesId) ? "旧记录" : "";
}

export function getSpeciesCataloguedRealTimestamp(fieldGuide, speciesId) {
  const guide = ensureGuideShape(fieldGuide);
  const record = getSpeciesRecord(guide, speciesId);

  return record ? normalizeRealTimestamp(record.cataloguedRealTimestamp) : null;
}

/**
 * 获取鸟种知识状态。
 *
 * 优先级：
 * - CATALOGUED：已记录，允许显示正式名。
 * - SEEN：见过但未加新。
 * - HEARD：听过但没见过。
 * - UNKNOWN：完全未知。
 */
export function getSpeciesKnowledgeState(fieldGuide, speciesId) {
  const guide = ensureGuideShape(fieldGuide);

  if (isCatalogued(guide, speciesId)) {
    return "CATALOGUED";
  }

  if (isSeen(guide, speciesId)) {
    return "SEEN";
  }

  if (hasSpeciesId(guide.heardSpeciesIds, speciesId)) {
    return "HEARD";
  }

  return "UNKNOWN";
}

export function getCollectedCardIds(fieldGuide) {
  return ensureGuideShape(fieldGuide).collectedCards.map((entry) => entry.cardId);
}

export function hasCollectedCard(fieldGuide, cardId) {
  return getCollectedCardIds(fieldGuide).includes(cardId);
}

export function getCollectedCardEntry(fieldGuide, cardId) {
  return ensureGuideShape(fieldGuide).collectedCards.find((entry) => entry.cardId === cardId) || null;
}

export function getCollectedCardSnapshots(fieldGuide, cardId) {
  const entry = getCollectedCardEntry(fieldGuide, cardId);
  return entry && Array.isArray(entry.snapshots) ? [...entry.snapshots] : [];
}

export function getBestCollectedCardSnapshot(fieldGuide, cardId) {
  const snapshots = getCollectedCardSnapshots(fieldGuide, cardId);
  return snapshots[0] || null;
}

export function addCard(fieldGuide, cardData, snapshot = null) {
  const guide = ensureGuideShape(fieldGuide);

  if (!cardData || !cardData.id) {
    return false;
  }

  const cardId = cardData.id;
  incrementCountMap(guide.captureCountByCardId, cardId);
  const normalizedSnapshot = normalizeSnapshot(snapshot);
  const existingEntry = guide.collectedCards.find((entry) => entry.cardId === cardId);

  if (!existingEntry) {
    guide.collectedCards.push({
      cardId,
      snapshots: normalizedSnapshot ? [normalizedSnapshot] : [],
      isIdentified: false,
      hasNewContent: Boolean(normalizedSnapshot),
      hasNewCard: true,
      sentToSister: false,
      sentToSisterAt: null,
      sisterReplyDueAt: null,
      sisterReplyReadAt: null,
      sisterKnowledgeUnlocked: false,
      pendingAutoCatalogue: false,
      autoCatalogueReadyAt: null,
      autoCataloguedAt: null,
      liyaMessageQueueItem: null,
      sisterKnowledge: []
    });
    saveFieldGuide(guide);
    return true;
  }

  if (!Array.isArray(existingEntry.snapshots)) {
    existingEntry.snapshots = [];
  }

  existingEntry.isIdentified = existingEntry.isIdentified === true;
  existingEntry.hasNewContent = existingEntry.hasNewContent === true;
  existingEntry.hasNewCard = existingEntry.hasNewCard === true;
  existingEntry.sentToSister = existingEntry.sentToSister === true;
  existingEntry.sisterKnowledge = normalizeSisterKnowledge(existingEntry.sisterKnowledge);
  normalizeSisterReplyState(existingEntry);

  if (normalizedSnapshot) {
    existingEntry.snapshots = sortSnapshotsForDisplay([normalizedSnapshot, ...existingEntry.snapshots]);
    existingEntry.hasNewContent = true;
  }

  saveFieldGuide(guide);
  return false;
}

export function identifyCollectedCard(fieldGuide, cardId) {
  const guide = ensureGuideShape(fieldGuide);
  const entry = guide.collectedCards.find((item) => item.cardId === cardId);

  if (!entry) {
    return guide;
  }

  entry.isIdentified = true;
  saveFieldGuide(guide);
  return guide;
}

export function isCollectedCardIdentified(fieldGuide, cardId) {
  const entry = getCollectedCardEntry(fieldGuide, cardId);
  return Boolean(entry && entry.isIdentified === true);
}

export function markCollectedCardViewed(fieldGuide, cardId) {
  const guide = ensureGuideShape(fieldGuide);
  const entry = guide.collectedCards.find((item) => item.cardId === cardId);

  if (!entry) {
    return guide;
  }

  entry.hasNewContent = false;
  entry.hasNewCard = false;
  saveFieldGuide(guide);
  return guide;
}

export function hasCollectedCardNewContent(fieldGuide, cardId) {
  const entry = getCollectedCardEntry(fieldGuide, cardId);
  return Boolean(entry && entry.hasNewContent === true);
}

export function sendCollectedCardToSister(fieldGuide, cardId, knowledgeLines) {
  const guide = ensureGuideShape(fieldGuide);
  const entry = guide.collectedCards.find((item) => item.cardId === cardId);

  if (!entry) {
    return guide;
  }

  const normalizedKnowledge = normalizeSisterKnowledge(knowledgeLines);
  const existingKnowledge = normalizeSisterKnowledge(entry.sisterKnowledge);

  if (entry.sentToSister === true) {
    entry.sisterKnowledge = existingKnowledge.length > 0 ? existingKnowledge : normalizedKnowledge;
    saveFieldGuide(guide);
    return guide;
  }

  const sentAt = normalizeReplyTimestamp(entry.sentToSisterAt) || Date.now();

  entry.sentToSister = true;
  entry.sentToSisterAt = sentAt;
  entry.sisterReplyDueAt = normalizeReplyTimestamp(entry.sisterReplyDueAt) || sentAt + 30000;
  entry.sisterReplyReadAt = normalizeReplyTimestamp(entry.sisterReplyReadAt);
  entry.sisterKnowledgeUnlocked = entry.sisterKnowledgeUnlocked === true;
  entry.sisterKnowledge = existingKnowledge.length > 0 ? existingKnowledge : normalizedKnowledge;
  saveFieldGuide(guide);
  return guide;
}

export function isCollectedCardSentToSister(fieldGuide, cardId) {
  const entry = getCollectedCardEntry(fieldGuide, cardId);
  return Boolean(entry && entry.sentToSister === true);
}

export function getCollectedCardSisterKnowledge(fieldGuide, cardId) {
  const entry = getCollectedCardEntry(fieldGuide, cardId);
  return entry ? normalizeSisterKnowledge(entry.sisterKnowledge) : [];
}

export function setCollectedCardLiyaMessageQueueItem(fieldGuide, cardId, queueItem) {
  const guide = ensureGuideShape(fieldGuide);
  const entry = guide.collectedCards.find((item) => item.cardId === cardId);

  if (!entry) {
    return guide;
  }

  const existingQueueItem = normalizeLiyaMessageQueueItem(entry.liyaMessageQueueItem);
  if (existingQueueItem && existingQueueItem.messageId) {
    entry.liyaMessageQueueItem = existingQueueItem;
    saveFieldGuide(guide);
    return guide;
  }

  const normalizedQueueItem = normalizeLiyaMessageQueueItem(queueItem);
  if (!normalizedQueueItem) {
    return guide;
  }

  entry.liyaMessageQueueItem = normalizedQueueItem;
  saveFieldGuide(guide);
  return guide;
}

export function isCollectedCardSisterKnowledgeUnlocked(fieldGuide, cardId) {
  const entry = getCollectedCardEntry(fieldGuide, cardId);
  return Boolean(entry && entry.sisterKnowledgeUnlocked === true);
}

export function getPendingAutoCatalogueCardId(fieldGuide, cardIds) {
  const guide = ensureGuideShape(fieldGuide);
  const candidateIds = Array.isArray(cardIds) ? cardIds : [];

  const entry = guide.collectedCards.find((item) => candidateIds.includes(item.cardId)
    && item.pendingAutoCatalogue === true
    && !Number.isFinite(normalizeReplyTimestamp(item.autoCataloguedAt)));

  return entry ? entry.cardId : null;
}

export function markAutoCatalogueCompleted(fieldGuide, cardIds, now = Date.now()) {
  const guide = ensureGuideShape(fieldGuide);
  const candidateIds = Array.isArray(cardIds) ? cardIds : [];
  let hasChanged = false;

  guide.collectedCards.forEach((entry) => {
    if (!candidateIds.includes(entry.cardId)) {
      return;
    }

    if (entry.pendingAutoCatalogue !== true) {
      return;
    }

    if (entry.pendingAutoCatalogue !== false) {
      entry.pendingAutoCatalogue = false;
      hasChanged = true;
    }

    if (!Number.isFinite(normalizeReplyTimestamp(entry.autoCataloguedAt))) {
      entry.autoCataloguedAt = now;
      hasChanged = true;
    }
  });

  if (hasChanged) {
    saveFieldGuide(guide);
  }

  return guide;
}

export function hasUnreadSisterReplies(fieldGuide, now = Date.now()) {
  return hasUnreadLiyaMessages(fieldGuide, now);
}

export function hasUnreadLiyaPhotoReply(entry, now = Date.now()) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return false;
  }

  const queueUnread = getUnreadLiyaQueueState(entry, now);
  if (queueUnread !== null) {
    return queueUnread;
  }

  return hasUnreadSisterReplyLegacy(entry, now);
}

export function hasUnreadLiyaMessages(fieldGuide, now = Date.now()) {
  const guide = ensureGuideShape(fieldGuide);

  return guide.collectedCards.some((entry) => hasUnreadLiyaPhotoReply(entry, now));
}

export function markDueSisterRepliesRead(fieldGuide, now = Date.now()) {
  const guide = ensureGuideShape(fieldGuide);
  let hasChanged = false;

  guide.collectedCards.forEach((entry) => {
    const dueAt = normalizeReplyTimestamp(entry.sisterReplyDueAt);
    const isDue = entry.sentToSister === true && Number.isFinite(dueAt) && now >= dueAt;
    const needsRead = !Number.isFinite(normalizeReplyTimestamp(entry.sisterReplyReadAt)) || entry.sisterKnowledgeUnlocked !== true;

    if (!isDue || !needsRead) {
      return;
    }

    entry.sisterReplyReadAt = now;
    entry.sisterKnowledgeUnlocked = true;
    const queueItem = normalizeLiyaMessageQueueItem(entry.liyaMessageQueueItem);
    if (queueItem && (queueItem.status !== "read" || !Number.isFinite(normalizeReplyTimestamp(queueItem.readAt)))) {
      queueItem.status = "read";
      queueItem.readAt = now;
      entry.liyaMessageQueueItem = queueItem;
    }
    if (entry.pendingAutoCatalogue !== true && !Number.isFinite(normalizeReplyTimestamp(entry.autoCataloguedAt))) {
      entry.pendingAutoCatalogue = true;
      entry.autoCatalogueReadyAt = now;
    }
    hasChanged = true;
  });

  if (hasChanged) {
    saveFieldGuide(guide);
  }

  return guide;
}

export function getFieldGuide(fieldGuide) {
  return ensureGuideShape(fieldGuide);
}

function getUnreadLiyaQueueState(entry, now) {
  const queueItem = normalizeLiyaMessageQueueItem(entry && entry.liyaMessageQueueItem);

  if (!queueItem) {
    return null;
  }

  if (queueItem.source !== "photo_reply" || queueItem.threadId !== "liya") {
    return null;
  }

  const dueAt = normalizeReplyTimestamp(queueItem.dueAt);
  if (!Number.isFinite(dueAt)) {
    return null;
  }

  const readAt = normalizeReplyTimestamp(queueItem.readAt);
  const isRead = queueItem.status === "read" || Number.isFinite(readAt);

  if (isRead) {
    return false;
  }

  return now >= dueAt;
}

function hasUnreadSisterReplyLegacy(entry, now) {
  const dueAt = normalizeReplyTimestamp(entry && entry.sisterReplyDueAt);
  return entry && entry.sentToSister === true
    && Number.isFinite(dueAt)
    && now >= dueAt
    && (!Number.isFinite(normalizeReplyTimestamp(entry.sisterReplyReadAt)) || entry.sisterKnowledgeUnlocked !== true);
}
