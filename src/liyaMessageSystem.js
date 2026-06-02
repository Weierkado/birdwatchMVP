/**
 * 力娅消息文本外置化第一阶段。
 * 当前只负责加载、校验、标准化和选择；不操作 DOM、不读写存档、不管理消息队列。
 * delay / cooldown 现在只是数据字段，后续由消息队列消费。
 */

const LIYA_MESSAGES_URL = "data/liyaMessages.json";
const SUPPORTED_CONDITIONS = new Set([
  "firstTimeSpecies",
  "repeatSpecies",
  "speciesId",
  "timeOfDay",
  "quality",
  "composition"
]);

const FALLBACK_LIYA_MESSAGE_DATA = {
  version: 1,
  messages: [
    {
      id: "liya_fallback_photo_reply_generic_001",
      speaker: "liya",
      type: "photo_reply",
      stage: "early",
      trigger: { event: "photo_sent" },
      conditions: {},
      delay: { mode: "fixed", seconds: 30 },
      priority: 10,
      cooldown: 0,
      allowRepeat: true,
      lines: [
        "我看到了。",
        "这张先记下来，等我慢慢帮你看。",
        "你不要又说只是随手拍的。"
      ],
      tags: ["fallback", "照片回复"]
    },
    {
      id: "liya_fallback_photo_reply_first_species_001",
      speaker: "liya",
      type: "photo_reply",
      stage: "early",
      trigger: { event: "photo_sent" },
      conditions: { firstTimeSpecies: true },
      delay: { mode: "fixed", seconds: 30 },
      priority: 40,
      cooldown: 0,
      allowRepeat: true,
      lines: [
        "这个像是新记录。",
        "先别急，我帮你一起看。"
      ],
      tags: ["fallback", "新鸟"]
    },
    {
      id: "liya_fallback_photo_reply_repeat_species_001",
      speaker: "liya",
      type: "photo_reply",
      stage: "early",
      trigger: { event: "photo_sent" },
      conditions: { repeatSpecies: true },
      delay: { mode: "fixed", seconds: 30 },
      priority: 35,
      cooldown: 0,
      allowRepeat: true,
      lines: [
        "又遇到它了呀。",
        "重复照片也有用，别急着删。"
      ],
      tags: ["fallback", "重复"]
    },
    {
      id: "liya_fallback_photo_reply_blurry_001",
      speaker: "liya",
      type: "photo_reply",
      stage: "early",
      trigger: { event: "photo_sent" },
      conditions: { quality: "blurred" },
      delay: { mode: "fixed", seconds: 30 },
      priority: 45,
      cooldown: 0,
      allowRepeat: true,
      lines: [
        "这张有点糊。",
        "不过还可以看轮廓，我先不扣太多分。"
      ],
      tags: ["fallback", "模糊"]
    }
  ]
};

const liyaMessageState = {
  loaded: false,
  usingFallback: false,
  externalResolved: false,
  externalLoaded: false,
  errors: [],
  data: null,
  messageMap: new Map()
};

let loadPromise = null;

export async function loadLiyaMessages() {
  if (liyaMessageState.externalResolved) {
    return liyaMessageState.data;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = fetch(LIYA_MESSAGES_URL)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load Liya messages: ${response.status}`);
      }

      return response.json();
    })
    .then((data) => applyMessageData(data, false, [], { externalResolved: true, externalLoaded: true }))
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      return applyMessageData(FALLBACK_LIYA_MESSAGE_DATA, true, [message], { externalResolved: true, externalLoaded: false });
    })
    .finally(() => {
      loadPromise = null;
    });

  return loadPromise;
}

export function getLiyaMessageState() {
  return {
    loaded: liyaMessageState.loaded,
    usingFallback: liyaMessageState.usingFallback,
    externalResolved: liyaMessageState.externalResolved,
    externalLoaded: liyaMessageState.externalLoaded,
    errors: [...liyaMessageState.errors],
    messageCount: liyaMessageState.data?.messages.length ?? 0
  };
}

export function getLiyaMessageById(id) {
  ensureMessageData();
  return liyaMessageState.messageMap.get(id) ?? null;
}

export function selectLiyaMessages(eventName, context = {}, options = {}) {
  ensureMessageData();

  const maxResults = getPositiveInteger(options.maxResults, 1);
  const stage = options.stage ?? context.storyStage ?? null;
  const sentMessageIds = Array.isArray(options.sentMessageIds)
    ? new Set(options.sentMessageIds)
    : new Set();

  const baseMatches = liyaMessageState.data.messages
    .map((message, index) => ({ message, index }))
    .filter(({ message }) => message.trigger.event === eventName)
    .filter(({ message }) => !message.stage || !stage || message.stage === stage)
    .filter(({ message }) => matchesConditions(message.conditions, context));

  if (baseMatches.length > 0) {
    const allowRepeatMatches = baseMatches.filter(({ message }) => message.allowRepeat !== false || !sentMessageIds.has(message.id));
    const repeatFilteredMatches = allowRepeatMatches.filter(({ message }) => !sentMessageIds.has(message.id));
    const selectionPool = repeatFilteredMatches.length > 0
      ? repeatFilteredMatches
      : (allowRepeatMatches.length > 0 ? allowRepeatMatches : baseMatches);

    return selectStableCandidates(selectionPool, eventName, context, options, maxResults);
  }

  const fallback = getGenericFallbackMessage(eventName);
  return fallback ? [fallback] : [];
}

export function createLiyaSelectionSeed(eventName, context = {}, options = {}) {
  const source = context && typeof context === "object" ? context : {};
  const optionSource = options && typeof options === "object" ? options : {};

  return [
    eventName,
    optionSource.seed,
    source.cardId,
    source.speciesId,
    source.cardTitle,
    source.timeOfDay,
    source.quality,
    source.composition,
    source.firstTimeSpecies ? "first" : "not_first",
    source.repeatSpecies ? "repeat" : "not_repeat",
    source.sentToSisterAt,
    source.snapshotId,
    source.realTimestamp,
    source.cardCreatedAt,
    source.cardIndex,
    source.locationId
  ].map(normalizeSeedPart).join("|");
}

export function hashStringToUint32(input) {
  let hash = 2166136261;
  const text = String(input ?? "");

  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function validateLiyaMessageData(data) {
  const errors = [];

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return ["Message data must be an object."];
  }

  if (typeof data.version !== "number") {
    errors.push("Message data version must be a number.");
  }

  if (!Array.isArray(data.messages)) {
    errors.push("Message data messages must be an array.");
    return errors;
  }

  const ids = new Set();

  data.messages.forEach((message, index) => {
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      errors.push(`Message at index ${index} must be an object.`);
      return;
    }

    if (typeof message.id !== "string" || message.id.trim() === "") {
      errors.push(`Message at index ${index} must have a non-empty id.`);
    } else if (ids.has(message.id)) {
      errors.push(`Duplicate message id: ${message.id}.`);
    } else {
      ids.add(message.id);
    }

    if (!Array.isArray(message.lines) || message.lines.filter((line) => typeof line === "string" && line.trim() !== "").length === 0) {
      errors.push(`Message ${message.id || index} must have non-empty lines.`);
    }
  });

  return errors;
}

export function normalizeLiyaMessage(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const trigger = source.trigger && typeof source.trigger === "object" ? source.trigger : {};
  const delay = source.delay && typeof source.delay === "object" ? source.delay : {};
  const conditions = source.conditions && typeof source.conditions === "object" && !Array.isArray(source.conditions)
    ? { ...source.conditions }
    : {};

  return {
    id: normalizeString(source.id, ""),
    speaker: normalizeString(source.speaker, "liya"),
    type: normalizeString(source.type, "photo_reply"),
    stage: normalizeString(source.stage, "early"),
    trigger: {
      event: normalizeString(trigger.event, "")
    },
    conditions,
    delay: {
      mode: normalizeString(delay.mode, "fixed"),
      seconds: Number.isFinite(delay.seconds) ? Math.max(0, delay.seconds) : 30
    },
    priority: Number.isFinite(source.priority) ? source.priority : 0,
    cooldown: Number.isFinite(source.cooldown) ? Math.max(0, source.cooldown) : 0,
    allowRepeat: source.allowRepeat !== false,
    lines: normalizeStringArray(source.lines),
    tags: normalizeStringArray(source.tags)
  };
}

function applyMessageData(data, usingFallback, extraErrors = [], options = {}) {
  const validationErrors = validateLiyaMessageData(data);
  const sourceData = validationErrors.length > 0 && !usingFallback
    ? FALLBACK_LIYA_MESSAGE_DATA
    : data;
  const sourceValidationErrors = sourceData === data ? validationErrors : validateLiyaMessageData(sourceData);
  const normalizedMessages = Array.isArray(sourceData.messages)
    ? sourceData.messages.map(normalizeLiyaMessage).filter((message) => message.id && message.lines.length > 0)
    : [];

  liyaMessageState.loaded = true;
  liyaMessageState.usingFallback = usingFallback || sourceData !== data;
  liyaMessageState.externalResolved = options.externalResolved === true;
  liyaMessageState.externalLoaded = options.externalLoaded === true && sourceData === data && liyaMessageState.usingFallback === false;
  liyaMessageState.errors = [...extraErrors, ...validationErrors, ...sourceValidationErrors];
  liyaMessageState.data = {
    version: Number.isFinite(sourceData.version) ? sourceData.version : 1,
    messages: normalizedMessages
  };
  liyaMessageState.messageMap = new Map(normalizedMessages.map((message) => [message.id, message]));

  return liyaMessageState.data;
}

function ensureMessageData() {
  if (!liyaMessageState.loaded) {
    applyMessageData(FALLBACK_LIYA_MESSAGE_DATA, true);
  }
}

function matchesConditions(conditions, context) {
  const entries = Object.entries(conditions ?? {});

  for (const [key, expected] of entries) {
    if (!SUPPORTED_CONDITIONS.has(key)) {
      // Unknown conditions are treated as not matching to avoid accidental story triggers.
      return false;
    }

    if (!matchesConditionValue(expected, context[key])) {
      return false;
    }
  }

  return true;
}

function matchesConditionValue(expected, actual) {
  if (Array.isArray(expected)) {
    return expected.includes(actual);
  }

  return expected === actual;
}

function getConditionSpecificity(message) {
  return Object.keys(message.conditions ?? {}).length;
}

function getGenericFallbackMessage(eventName) {
  return liyaMessageState.data.messages.find((message) => (
    message.trigger.event === eventName
    && Object.keys(message.conditions).length === 0
  )) ?? liyaMessageState.data.messages.find((message) => message.id === "liya_fallback_photo_reply_generic_001") ?? null;
}

function selectStableCandidates(candidates, eventName, context, options, maxResults) {
  const highestPriority = candidates.reduce((current, { message }) => Math.max(current, message.priority), -Infinity);
  const priorityPool = candidates.filter(({ message }) => message.priority === highestPriority);
  const highestSpecificity = priorityPool.reduce((current, { message }) => Math.max(current, getConditionSpecificity(message)), -Infinity);
  const finalPool = priorityPool
    .filter(({ message }) => getConditionSpecificity(message) === highestSpecificity)
    .sort((a, b) => a.index - b.index);

  if (finalPool.length <= 1) {
    return finalPool.map(({ message }) => message);
  }

  const seed = createLiyaSelectionSeed(eventName, context, options);
  const startIndex = hashStringToUint32(seed) % finalPool.length;
  const resultCount = Math.min(maxResults, finalPool.length);
  const results = [];

  for (let offset = 0; offset < resultCount; offset += 1) {
    const poolIndex = (startIndex + offset) % finalPool.length;
    results.push(finalPool[poolIndex].message);
  }

  return results;
}

function normalizeSeedPart(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return String(value);
}

function normalizeString(value, fallback) {
  return typeof value === "string" ? value : fallback;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item) => typeof item === "string" && item.trim() !== "");
}

function getPositiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}
