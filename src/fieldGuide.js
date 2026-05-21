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
    return fieldGuide;
  }

  return guide;
}

function hasSpeciesId(speciesIds, speciesId) {
  return speciesIds.includes(speciesId);
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

export function markCatalogued(fieldGuide, speciesId) {
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

  saveFieldGuide(guide);
  return !alreadyCatalogued;
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

/**
 * 获取鸟种知识状态。
 *
 * 优先级：
 * - CATALOGUED：已加新，允许显示正式名。
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
  const normalizedSnapshot = normalizeSnapshot(snapshot);
  const existingEntry = guide.collectedCards.find((entry) => entry.cardId === cardId);

  if (!existingEntry) {
    guide.collectedCards.push({
      cardId,
      snapshots: normalizedSnapshot ? [normalizedSnapshot] : [],
      isIdentified: false,
      hasNewContent: Boolean(normalizedSnapshot),
      sentToSister: false,
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
  existingEntry.sentToSister = existingEntry.sentToSister === true;
  existingEntry.sisterKnowledge = normalizeSisterKnowledge(existingEntry.sisterKnowledge);

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

  entry.sentToSister = true;
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

export function getFieldGuide(fieldGuide) {
  return ensureGuideShape(fieldGuide);
}
