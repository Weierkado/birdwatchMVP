import { cardList } from "../data/cards.js";

function normalizeBehaviorRarity(behaviorState) {
  if (behaviorState === "NORMAL" || behaviorState === "INTERESTING" || behaviorState === "REMARKABLE") {
    return behaviorState;
  }

  return "NORMAL";
}

function getCardsByRarity(speciesId, rarity) {
  return cardList.filter((card) => {
    return card.speciesId === speciesId && card.rarity === rarity;
  });
}

function getCardsBySpecies(speciesId) {
  return cardList.filter((card) => card.speciesId === speciesId);
}

function pickRandomCard(cards) {
  if (cards.length === 0) {
    return null;
  }

  const index = Math.floor(Math.random() * cards.length);
  return cards[index];
}

export function drawCard(speciesId, behaviorState) {
  const selectedRarity = normalizeBehaviorRarity(behaviorState);
  const card = pickRandomCard(getCardsByRarity(speciesId, selectedRarity))
    || pickRandomCard(getCardsBySpecies(speciesId))
    || pickRandomCard(cardList);

  if (!card) {
    return null;
  }

  return { ...card };
}
