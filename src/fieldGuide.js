import { saveFieldGuide } from "./storage.js";

function ensureGuideShape(fieldGuide) {
  if (!fieldGuide.heardSpeciesIds) {
    fieldGuide.heardSpeciesIds = [];
  }

  if (!fieldGuide.collectedCards) {
    fieldGuide.collectedCards = [];
  }
}

export function markHeard(fieldGuide, speciesId) {
  ensureGuideShape(fieldGuide);

  if (!fieldGuide.heardSpeciesIds.includes(speciesId)) {
    fieldGuide.heardSpeciesIds.push(speciesId);
    saveFieldGuide(fieldGuide);
    return true;
  }

  return false;
}

export function addCard(fieldGuide, cardData) {
  ensureGuideShape(fieldGuide);

  const alreadyCollected = fieldGuide.collectedCards.some((card) => card.id === cardData.id);

  if (!alreadyCollected) {
    fieldGuide.collectedCards.push(cardData);
    saveFieldGuide(fieldGuide);
    return true;
  }

  saveFieldGuide(fieldGuide);
  return false;
}

export function getFieldGuide(fieldGuide) {
  ensureGuideShape(fieldGuide);
  return fieldGuide;
}
