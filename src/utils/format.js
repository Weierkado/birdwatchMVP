export function getTimeOfDayLabel(state) {
  const maxTurns = Number.isFinite(state && state.maxTurns) ? state.maxTurns : 30;
  const currentTurn = Number.isFinite(state && state.currentTurn) ? state.currentTurn : 0;
  const remainingTurns = Math.max(0, maxTurns - currentTurn);

  if (remainingTurns >= 25) {
    return "清晨";
  }

  if (remainingTurns >= 19) {
    return "上午";
  }

  if (remainingTurns >= 13) {
    return "中午";
  }

  if (remainingTurns >= 7) {
    return "下午";
  }

  return "黄昏";
}

export function getTimeOfDayClassName(label) {
  const classNameByLabel = {
    清晨: "time-of-day-dawn",
    上午: "time-of-day-morning",
    中午: "time-of-day-noon",
    下午: "time-of-day-afternoon",
    黄昏: "time-of-day-dusk"
  };

  return classNameByLabel[label] || classNameByLabel.清晨;
}

export function getModeDisplay(mode) {
  const modeDisplay = {
    START: "准备开始",
    START_SPOT_SELECT: "选择鸟点",
    EXPLORE: "探索中",
    DISTANT_LISTEN: "远听中",
    FIRST_ENCOUNTER: "初次发现",
    PHOTO: "拍摄中",
    SETTLEMENT: "观察记录",
    FIELD_GUIDE: "笔记查看",
    SPOT_SELECT: "选择鸟点"
  };

  return modeDisplay[mode] || "未知阶段";
}

export function getCardDisplayTitle(card) {
  return card.title;
}

export function getCardDisplayDescription(card) {
  return card.description;
}

export function formatPolaroidDate(timestamp) {
  const date = new Date(Number.isFinite(timestamp) ? timestamp : Date.now());
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}.${month}.${day}`;
}

export function formatGuideAddedRealTime(timestamp) {
  if (!Number.isFinite(timestamp)) {
    return "—";
  }

  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) {
    return "—";
  }

  const now = new Date();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const isSameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();

  if (isSameDay) {
    return `${hours}:${minutes}`;
  }

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day} ${hours}:${minutes}`;
}

export function formatMessageTime(timestamp) {
  const fallbackTime = Date.now();
  const time = Number.isFinite(timestamp) ? timestamp : fallbackTime;
  const date = new Date(time);

  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function formatGuideAddedDayIndex(dayIndex) {
  const safeDayIndex = Number.isFinite(dayIndex) && dayIndex >= 1 ? Math.floor(dayIndex) : 1;
  return `第\u2009${safeDayIndex}\u2009天`;
}
