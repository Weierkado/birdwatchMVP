/**
 * 模块职责：
 * - 执行所见即所得抽卡规则。
 * - drawCard(speciesId, behaviorState) 只从对应 rarity 卡池抽卡。
 *
 * 维护边界：
 * - NORMAL -> NORMAL，INTERESTING -> INTERESTING，REMARKABLE -> REMARKABLE。
 * - 不要恢复跨稀有度混池权重；fallback 只用于防止空卡池崩溃。
 */
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
  // 所见即所得：点击瞬间看到的状态直接决定 rarity 卡池。
  const card = pickRandomCard(getCardsByRarity(speciesId, selectedRarity))
    || pickRandomCard(getCardsBySpecies(speciesId))
    || pickRandomCard(cardList);

  if (!card) {
    return null;
  }

  return { ...card };
}
