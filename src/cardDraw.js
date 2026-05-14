import { cardList } from "../data/cards.js";

const RARITY_WEIGHTS_BY_BEHAVIOR = {
  NORMAL: [
    { rarity: "NORMAL", weight: 90 },
    { rarity: "INTERESTING", weight: 10 }
  ],
  INTERESTING: [
    { rarity: "NORMAL", weight: 20 },
    { rarity: "INTERESTING", weight: 70 },
    { rarity: "REMARKABLE", weight: 10 }
  ],
  REMARKABLE: [
    { rarity: "INTERESTING", weight: 70 },
    { rarity: "REMARKABLE", weight: 30 }
  ],
  PRECIOUS: [
    { rarity: "PRECIOUS", weight: 100 }
  ]
};

function pickWeightedRarity(weightTable) {
  const totalWeight = weightTable.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const item of weightTable) {
    roll -= item.weight;
    if (roll <= 0) {
      return item.rarity;
    }
  }

  return weightTable[0].rarity;
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

function findFallbackCard(speciesId, weightTable) {
  const fallbackRarities = [...weightTable].sort((a, b) => b.weight - a.weight);

  for (const item of fallbackRarities) {
    const cards = getCardsByRarity(speciesId, item.rarity);
    const card = pickRandomCard(cards);

    if (card) {
      return card;
    }
  }

  return pickRandomCard(getCardsBySpecies(speciesId));
}

export function drawCard(speciesId, behaviorState) {
  const weightTable = RARITY_WEIGHTS_BY_BEHAVIOR[behaviorState] || RARITY_WEIGHTS_BY_BEHAVIOR.NORMAL;
  const selectedRarity = pickWeightedRarity(weightTable);
  const card = pickRandomCard(getCardsByRarity(speciesId, selectedRarity))
    || findFallbackCard(speciesId, weightTable);

  if (!card) {
    return null;
  }

  return { ...card };
}
