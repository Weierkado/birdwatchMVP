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

export function isSeen(fieldGuide, speciesId) {
  const guide = ensureGuideShape(fieldGuide);
  return hasSpeciesId(guide.seenSpeciesIds, speciesId) || hasSpeciesId(guide.cataloguedSpeciesIds, speciesId);
}

export function isCatalogued(fieldGuide, speciesId) {
  const guide = ensureGuideShape(fieldGuide);
  return hasSpeciesId(guide.cataloguedSpeciesIds, speciesId);
}

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
