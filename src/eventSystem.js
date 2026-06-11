import {
  EVENT_HINT_COOLDOWN_TURNS,
  EVENT_HINT_DISPLAY_MS,
  EVENT_HINT_QUEUE_MAX
} from "../data/config.js";

const DIR_LABELS = {
  left: "左侧",
  right: "右侧"
};

const HINT_TEXT_POOL = {
  sound: [
    "{dir}传来鸟鸣。",
    "{dir}响起几声鸟叫。",
    "{dir}有细碎的叫声。"
  ],
  movement: [
    "{dir}有一点动静。",
    "{dir}的草叶晃了一下。",
    "{dir}像是有什么掠过。"
  ],
  shadow: [
    "{dir}似乎有鸟影。",
    "{dir}树丛里有动静。",
    "{dir}有一道影子闪过。"
  ]
};

function normalizeHintType(value) {
  return value === "movement" || value === "shadow" ? value : "sound";
}

function pickRandomItem(list) {
  if (!Array.isArray(list) || list.length <= 0) {
    return null;
  }

  return list[Math.floor(Math.random() * list.length)] || null;
}

export function createEventSystem(options = {}) {
  const getSpeciesById = typeof options.getSpeciesById === "function"
    ? options.getSpeciesById
    : () => null;
  const onDisplayChange = typeof options.onDisplayChange === "function"
    ? options.onDisplayChange
    : null;
  const defaultText = typeof options.defaultText === "string" && options.defaultText
    ? options.defaultText
    : "暂无事件";
  const config = {
    cooldownTurns: Number(options.config && options.config.cooldownTurns) || EVENT_HINT_COOLDOWN_TURNS,
    displayMs: Number(options.config && options.config.displayMs) || EVENT_HINT_DISPLAY_MS,
    queueMax: Number(options.config && options.config.queueMax) || EVENT_HINT_QUEUE_MAX
  };

  const queue = [];
  const cooldownMap = new Map();
  let activeEntry = null;
  let hideTimerId = null;

  function clearTimers() {
    if (hideTimerId !== null) {
      window.clearTimeout(hideTimerId);
      hideTimerId = null;
    }
  }

  function notifyDisplayChange() {
    if (onDisplayChange) {
      onDisplayChange();
    }
  }

  function hideActiveHint() {
    activeEntry = null;
    showNext(true);
  }

  function showEntry(entry, shouldNotify = false) {
    if (!entry || !entry.text) {
      activeEntry = null;
      return false;
    }

    clearTimers();
    activeEntry = entry;

    hideTimerId = window.setTimeout(() => {
      hideTimerId = null;
      hideActiveHint();
    }, config.displayMs);

    if (shouldNotify) {
      notifyDisplayChange();
    }

    return true;
  }

  function getCooldownKey(spotId, dirIndex) {
    return `${spotId || "unknown"}:${dirIndex}`;
  }

  function canTrigger(spotId, dirIndex, currentTurn) {
    const key = getCooldownKey(spotId, dirIndex);
    const lastTriggerTurn = cooldownMap.get(key);

    if (!Number.isFinite(lastTriggerTurn)) {
      return true;
    }

    return currentTurn - lastTriggerTurn > config.cooldownTurns;
  }

  function markTriggered(spotId, dirIndex, currentTurn) {
    cooldownMap.set(getCooldownKey(spotId, dirIndex), currentTurn);
  }

  function dispatch(entry) {
    if (!entry || !entry.text) {
      return false;
    }

    if (!activeEntry) {
      return showEntry(entry);
    }

    if (queue.length >= config.queueMax) {
      return false;
    }

    queue.push(entry);
    return true;
  }

  function showNext(shouldNotify = false) {
    if (activeEntry || queue.length <= 0) {
      if (shouldNotify) {
        notifyDisplayChange();
      }
      return false;
    }

    const nextEntry = queue.shift();
    return showEntry(nextEntry, shouldNotify);
  }

  function scanSideEvents(state) {
    if (!state || state.mode !== "EXPLORE" || !Array.isArray(state.activeBirds) || state.activeBirds.length <= 0) {
      return false;
    }

    const leftDir = (state.facingDirection + 3) % 4;
    const rightDir = (state.facingDirection + 1) % 4;
    const leftBirds = state.activeBirds.filter((bird) => bird && bird.directionIndex === leftDir);
    const rightBirds = state.activeBirds.filter((bird) => bird && bird.directionIndex === rightDir);
    const candidates = [];

    if (leftBirds.length > 0 && canTrigger(state.currentSpotId, leftDir, state.currentTurn)) {
      candidates.push({
        dirIndex: leftDir,
        dirLabel: DIR_LABELS.left,
        birds: leftBirds
      });
    }

    if (rightBirds.length > 0 && canTrigger(state.currentSpotId, rightDir, state.currentTurn)) {
      candidates.push({
        dirIndex: rightDir,
        dirLabel: DIR_LABELS.right,
        birds: rightBirds
      });
    }

    if (candidates.length <= 0) {
      return false;
    }

    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    const species = picked.birds[0] ? getSpeciesById(picked.birds[0].speciesId) : null;
    const hintType = normalizeHintType(species && species.hintType);
    const template = pickRandomItem(HINT_TEXT_POOL[hintType]) || pickRandomItem(HINT_TEXT_POOL.sound);

    if (!template) {
      return false;
    }

    const didDispatch = dispatch({
      type: "side_bird_activity",
      text: template.replace("{dir}", picked.dirLabel || "一侧"),
      spotId: state.currentSpotId,
      dirIndex: picked.dirIndex
    });

    if (!didDispatch) {
      return false;
    }

    markTriggered(state.currentSpotId, picked.dirIndex, state.currentTurn);
    return {
      dirLabel: picked.dirLabel,
      dirIndex: picked.dirIndex,
      type: hintType
    };
  }

  function clear() {
    queue.length = 0;
    activeEntry = null;
    cooldownMap.clear();
    clearTimers();
  }

  function getDisplayText(fallbackText = defaultText) {
    return activeEntry && activeEntry.text ? activeEntry.text : fallbackText;
  }

  function isActive() {
    return Boolean(activeEntry && activeEntry.text);
  }

  return {
    dispatch,
    scanSideEvents,
    canTrigger,
    markTriggered,
    showNext,
    clear,
    getDisplayText,
    isActive
  };
}
