const RARITY_DISPLAY_BY_KEY = {
  NORMAL: {
    label: "寻常",
    className: "rarity-normal",
    description: "普通记录"
  },
  INTERESTING: {
    label: "有趣",
    className: "rarity-interesting",
    description: "有趣记录"
  },
  REMARKABLE: {
    label: "精彩",
    className: "rarity-remarkable",
    description: "精彩记录"
  }
};

function getRarityKey(raritySource) {
  if (raritySource && typeof raritySource === "object" && raritySource.rarity) {
    return getRarityKey(raritySource.rarity);
  }

  if (typeof raritySource === "string") {
    return raritySource;
  }

  if (raritySource >= 3) {
    return "REMARKABLE";
  }

  if (raritySource === 2) {
    return "INTERESTING";
  }

  return "NORMAL";
}

export function getRarityDisplay(raritySource) {
  const rarityKey = getRarityKey(raritySource);
  return RARITY_DISPLAY_BY_KEY[rarityKey] || RARITY_DISPLAY_BY_KEY.NORMAL;
}

export function createRarityBadgeHtml(raritySource) {
  const display = getRarityDisplay(raritySource);
  return `<span class="rarity-badge ${display.className}">${display.label}</span>`;
}
