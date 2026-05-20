/**
 * 模块职责：
 * - 维护鸟类知识状态和 v3 图鉴卡牌写入。
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

function shouldReplaceSnapshot(oldSnapshot, newSnapshot) {
  if (newSnapshot === null) {
    return false;
  }

  if (oldSnapshot === null) {
    return true;
  }

  const oldScore = typeof oldSnapshot.focusScore === "number" ? oldSnapshot.focusScore : null;
  const newScore = typeof newSnapshot.focusScore === "number" ? newSnapshot.focusScore : null;

  return oldScore !== null && newScore !== null && newScore > oldScore;
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
      snapshot: normalizedSnapshot
    });
    saveFieldGuide(guide);
    return true;
  }

  if (shouldReplaceSnapshot(existingEntry.snapshot, normalizedSnapshot)) {
    existingEntry.snapshot = normalizedSnapshot;
  }

  saveFieldGuide(guide);
  return false;
}

export function getFieldGuide(fieldGuide) {
  return ensureGuideShape(fieldGuide);
}
