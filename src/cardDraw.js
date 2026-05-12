import { cardList } from "../data/cards.js";

const rarityPoolByBehavior = {
  NORMAL: ["NORMAL"],
  INTERESTING: ["INTERESTING", "NORMAL"],
  REMARKABLE: ["REMARKABLE", "INTERESTING", "NORMAL"]
};

export function drawCard(speciesId, behaviorState) {
  const allowedRarities = rarityPoolByBehavior[behaviorState] || rarityPoolByBehavior.NORMAL;
  const cardPool = cardList.filter((card) => {
    return card.speciesId === speciesId && allowedRarities.includes(card.rarity);
  });

  if (cardPool.length === 0) {
    return null;
  }

  const index = Math.floor(Math.random() * cardPool.length);
  return { ...cardPool[index] };
}
