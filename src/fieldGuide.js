import { saveFieldGuide } from "./storage.js";

function ensureGuideShape(fieldGuide) {
  const guide = fieldGuide && typeof fieldGuide === "object" && !Array.isArray(fieldGuide) ? fieldGuide : {};

  if (!Array.isArray(guide.heardSpeciesIds)) {
    guide.heardSpeciesIds = [];
  }

  if (!Array.isArray(guide.seenSpeciesIds)) {
    guide.seenSpeciesIds = [];
  }

  if (!Array.isArray(guide.cataloguedSpeciesIds)) {
    guide.cataloguedSpeciesIds = [];
  }

  if (!Array.isArray(guide.collectedCards)) {
    guide.collectedCards = [];
  }

  guide.heardSpeciesIds = [...new Set(guide.heardSpeciesIds)];
  guide.seenSpeciesIds = [...new Set(guide.seenSpeciesIds)];
  guide.cataloguedSpeciesIds = [...new Set(guide.cataloguedSpeciesIds)];
  guide.collectedCards = uniqueCards(guide.collectedCards);

  return guide;
}

function uniqueCards(cards) {
  const seenCardIds = new Set();

  return cards.filter((card) => {
    if (!card || typeof card !== "object" || seenCardIds.has(card.id)) {
      return false;
    }

    seenCardIds.add(card.id);
    return true;
  });
}

function hasSpeciesId(speciesIds, speciesId) {
  return speciesIds.includes(speciesId);
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

  if (guide.seenSpeciesIds.includes(speciesId)) {
    return false;
  }

  guide.seenSpeciesIds.push(speciesId);
  saveFieldGuide(guide);
  return true;
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

  if (alreadyCatalogued) {
    saveFieldGuide(guide);
    return false;
  }

  guide.cataloguedSpeciesIds.push(speciesId);
  saveFieldGuide(guide);
  return true;
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

export function addCard(fieldGuide, cardData) {
  const guide = ensureGuideShape(fieldGuide);

  if (!cardData || !cardData.id) {
    return false;
  }

  const alreadyCollected = guide.collectedCards.some((card) => card.id === cardData.id);

  if (!alreadyCollected) {
    guide.collectedCards.push(cardData);
    saveFieldGuide(guide);
    return true;
  }

  saveFieldGuide(guide);
  return false;
}

export function getFieldGuide(fieldGuide) {
  return ensureGuideShape(fieldGuide);
}
