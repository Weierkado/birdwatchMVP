const STORAGE_KEY = "birdwatch_text_sim_field_guide_v2";

function createDefaultFieldGuide() {
  return {
    heardSpeciesIds: [],
    seenSpeciesIds: [],
    cataloguedSpeciesIds: [],
    collectedCards: []
  };
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

function ensureStoredGuideShape(fieldGuide) {
  if (!fieldGuide || typeof fieldGuide !== "object" || Array.isArray(fieldGuide)) {
    return createDefaultFieldGuide();
  }

  return {
    heardSpeciesIds: Array.isArray(fieldGuide.heardSpeciesIds) ? [...new Set(fieldGuide.heardSpeciesIds)] : [],
    seenSpeciesIds: Array.isArray(fieldGuide.seenSpeciesIds) ? [...new Set(fieldGuide.seenSpeciesIds)] : [],
    cataloguedSpeciesIds: Array.isArray(fieldGuide.cataloguedSpeciesIds)
      ? [...new Set(fieldGuide.cataloguedSpeciesIds)]
      : [],
    collectedCards: Array.isArray(fieldGuide.collectedCards) ? uniqueCards(fieldGuide.collectedCards) : []
  };
}

export function loadFieldGuide() {
  const savedText = localStorage.getItem(STORAGE_KEY);

  if (!savedText) {
    return createDefaultFieldGuide();
  }

  try {
    return ensureStoredGuideShape(JSON.parse(savedText));
  } catch (error) {
    console.warn("图鉴存档读取失败，将使用空图鉴。", error);
    return createDefaultFieldGuide();
  }
}

export function saveFieldGuide(fieldGuide) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ensureStoredGuideShape(fieldGuide)));
}

export function clearFieldGuide() {
  localStorage.removeItem(STORAGE_KEY);
}
