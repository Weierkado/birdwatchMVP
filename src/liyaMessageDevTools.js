import {
  createLiyaSelectionSeed,
  getLiyaMessageState,
  hashStringToUint32,
  loadLiyaMessages,
  selectLiyaMessages,
  validateLiyaMessageData
} from "./liyaMessageSystem.js";

const SUPPORTED_CONDITION_KEYS = new Set([
  "firstTimeSpecies",
  "repeatSpecies",
  "speciesId",
  "timeOfDay",
  "quality",
  "composition"
]);

export function buildLiyaMessageTestContexts() {
  const baseContext = {
    storyStage: "early",
    speciesId: "light_vented_bulbul",
    cardId: "test_card_normal",
    cardTitle: "白头鹎",
    timeOfDay: "day",
    quality: "normal",
    composition: "centered",
    locationId: "test_spot",
    firstTimeSpecies: false,
    repeatSpecies: false
  };

  return [
    {
      label: "普通日间照片",
      eventName: "photo_sent",
      context: { ...baseContext }
    },
    {
      label: "首次新鸟",
      eventName: "photo_sent",
      expectSpecific: true,
      context: {
        ...baseContext,
        firstTimeSpecies: true,
        repeatSpecies: false
      }
    },
    {
      label: "重复同一种鸟",
      eventName: "photo_sent",
      expectSpecific: true,
      context: {
        ...baseContext,
        cardId: "test_card_repeat",
        firstTimeSpecies: false,
        repeatSpecies: true
      }
    },
    {
      label: "模糊照片",
      eventName: "photo_sent",
      expectSpecific: true,
      context: {
        ...baseContext,
        cardId: "test_card_blurred",
        quality: "blurred",
        firstTimeSpecies: true,
        repeatSpecies: false
      }
    },
    {
      label: "清晰照片",
      eventName: "photo_sent",
      expectSpecific: true,
      context: {
        ...baseContext,
        cardId: "test_card_clear",
        quality: "clear"
      }
    },
    {
      label: "清晨照片",
      eventName: "photo_sent",
      expectSpecific: true,
      context: {
        ...baseContext,
        cardId: "test_card_morning",
        timeOfDay: "morning",
        firstTimeSpecies: true,
        repeatSpecies: false
      }
    },
    {
      label: "黄昏照片",
      eventName: "photo_sent",
      expectSpecific: true,
      context: {
        ...baseContext,
        cardId: "test_card_dusk",
        timeOfDay: "dusk",
        firstTimeSpecies: false,
        repeatSpecies: true
      }
    },
    {
      label: "偏离中心构图",
      eventName: "photo_sent",
      expectSpecific: true,
      context: {
        ...baseContext,
        cardId: "test_card_off_center",
        composition: "off_center",
        firstTimeSpecies: false,
        repeatSpecies: true
      }
    },
    {
      label: "首次清晰居中",
      eventName: "photo_sent",
      expectSpecific: true,
      context: {
        ...baseContext,
        cardId: "test_card_first_clear",
        quality: "clear",
        composition: "centered",
        firstTimeSpecies: true,
        repeatSpecies: false
      }
    },
    {
      label: "未知 fallback 场景",
      eventName: "photo_sent",
      context: {
        ...baseContext,
        speciesId: "",
        cardId: "",
        cardTitle: "这只鸟",
        timeOfDay: "unknown",
        quality: "unknown",
        composition: "unknown",
        locationId: "",
        firstTimeSpecies: false,
        repeatSpecies: false
      }
    }
  ];
}

export async function runLiyaMessageDevCheck() {
  const data = await loadLiyaMessages();
  const messages = Array.isArray(data.messages) ? data.messages : [];
  const testContexts = buildLiyaMessageTestContexts();
  const reachability = analyzeLiyaMessageReachability(messages, testContexts, selectLiyaMessages);
  const unknownConditions = findUnknownConditions(messages);
  const validationErrors = validateLiyaMessageData(data);

  return {
    state: getLiyaMessageState(),
    validationErrors,
    duplicateIds: findDuplicateMessageIds(messages),
    emptyLineMessages: findEmptyLineMessages(messages),
    unknownConditions,
    testContexts,
    matches: reachability.matches,
    warnings: reachability.warnings,
    uncoveredByDevContexts: reachability.uncoveredByDevContexts
  };
}

export function buildLiyaMessageDevReportFromData(data) {
  const safeData = data && typeof data === "object" && !Array.isArray(data)
    ? data
    : { version: 1, messages: [] };
  const messages = Array.isArray(safeData.messages) ? safeData.messages : [];
  const testContexts = buildLiyaMessageTestContexts();
  const reachability = analyzeLiyaMessageReachability(messages, testContexts, (eventName, context, options) => (
    selectLiyaMessagesFromList(messages, eventName, context, options)
  ));
  const unknownConditions = findUnknownConditions(messages);
  const validationErrors = validateLiyaMessageData(safeData);

  return {
    state: {
      loaded: true,
      usingFallback: false,
      errors: [],
      messageCount: messages.length
    },
    validationErrors,
    duplicateIds: findDuplicateMessageIds(messages),
    emptyLineMessages: findEmptyLineMessages(messages),
    unknownConditions,
    testContexts,
    matches: reachability.matches,
    warnings: reachability.warnings,
    uncoveredByDevContexts: reachability.uncoveredByDevContexts
  };
}

export function selectLiyaMessagesFromList(messages, eventName, context = {}, options = {}) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const maxResults = Number.isInteger(options.maxResults) && options.maxResults > 0 ? options.maxResults : 1;
  const stage = options.stage ?? context.storyStage ?? null;
  const sentMessageIds = Array.isArray(options.sentMessageIds)
    ? new Set(options.sentMessageIds)
    : new Set();

  const matches = safeMessages
    .map((message, index) => ({ message, index }))
    .filter(({ message }) => message && message.trigger && message.trigger.event === eventName)
    .filter(({ message }) => !message.stage || !stage || message.stage === stage)
    .filter(({ message }) => message.allowRepeat !== false || !sentMessageIds.has(message.id))
    .filter(({ message }) => matchesConditions(message.conditions, context));

  if (matches.length > 0) {
    return selectStableCandidates(matches, eventName, context, options, maxResults);
  }

  const fallback = safeMessages.find((message) => (
    message
    && message.trigger
    && message.trigger.event === eventName
    && Object.keys(normalizeConditions(message.conditions)).length === 0
  ));

  return fallback ? [fallback] : [];
}

export function analyzeLiyaMessageReachability(messages, testContexts, selectFn) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const safeTestContexts = Array.isArray(testContexts) ? testContexts : [];
  const matchedIds = new Set();
  const warnings = [];

  const matches = safeTestContexts.map((testCase) => {
    const eventName = testCase.eventName || "photo_sent";
    const context = testCase.context && typeof testCase.context === "object" ? testCase.context : {};
    const selected = selectFn(eventName, context, {
      stage: context.storyStage || "early",
      maxResults: 1,
      sentMessageIds: [],
      seed: testCase.label || ""
    });
    const message = Array.isArray(selected) && selected.length > 0 ? selected[0] : null;
    const conditions = normalizeConditions(message && message.conditions);

    if (message && message.id) {
      matchedIds.add(message.id);
    }

    if (testCase.expectSpecific === true && Object.keys(conditions).length === 0) {
      warnings.push({
        label: testCase.label || "",
        message: "特殊场景命中了通用消息，可能是 conditions 或 priority 配置不匹配。"
      });
    }

    return {
      label: testCase.label || "",
      eventName,
      context,
      matchedMessageId: message ? message.id : null,
      matchedType: message ? message.type : null,
      matchedPriority: message ? message.priority : null,
      matchedConditions: conditions,
      matchedFirstLine: getFirstLine(message)
    };
  });

  const uncoveredByDevContexts = safeMessages
    .filter((message) => message && message.id && !matchedIds.has(message.id))
    .map((message) => ({
      id: message.id,
      type: message.type || "",
      priority: Number.isFinite(message.priority) ? message.priority : 0,
      conditions: normalizeConditions(message.conditions),
      firstLine: getFirstLine(message)
    }));

  return {
    matchedIds: [...matchedIds],
    matches,
    warnings,
    uncoveredByDevContexts
  };
}

export function findUnknownConditions(messages) {
  const safeMessages = Array.isArray(messages) ? messages : [];

  return safeMessages
    .map((message) => {
      const conditions = normalizeConditions(message && message.conditions);
      const unknownKeys = Object.keys(conditions).filter((key) => !SUPPORTED_CONDITION_KEYS.has(key));

      return {
        id: message && message.id ? message.id : "",
        unknownKeys
      };
    })
    .filter((item) => item.id && item.unknownKeys.length > 0);
}

export function formatLiyaMessageDevReport(report) {
  const safeReport = report && typeof report === "object" ? report : {};
  const state = safeReport.state || {};
  const validationErrors = Array.isArray(safeReport.validationErrors) ? safeReport.validationErrors : [];
  const unknownConditions = Array.isArray(safeReport.unknownConditions) ? safeReport.unknownConditions : [];
  const warnings = Array.isArray(safeReport.warnings) ? safeReport.warnings : [];
  const matches = Array.isArray(safeReport.matches) ? safeReport.matches : [];
  const uncoveredByDevContexts = Array.isArray(safeReport.uncoveredByDevContexts)
    ? safeReport.uncoveredByDevContexts
    : [];

  const lines = [
    "力娅消息命中自检报告",
    "",
    "基础信息：",
    `- loaded: ${Boolean(state.loaded)}`,
    `- usingFallback: ${Boolean(state.usingFallback)}`,
    `- messages: ${Number.isFinite(state.messageCount) ? state.messageCount : 0}`,
    `- errors: ${Array.isArray(state.errors) ? state.errors.length : 0}`,
    `- validationErrors: ${validationErrors.length}`,
    "",
    "命中预览："
  ];

  if (matches.length === 0) {
    lines.push("- 无命中记录");
  } else {
    matches.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.label || "未命名场景"} -> ${item.matchedMessageId || "无匹配"}`);
      lines.push(`   条件：${JSON.stringify(item.matchedConditions || {})}`);
      lines.push(`   首行：${item.matchedFirstLine || ""}`);
    });
  }

  lines.push("", "Warnings：");
  if (warnings.length === 0) {
    lines.push("- 无");
  } else {
    warnings.forEach((warning) => {
      lines.push(`- ${warning.label}: ${warning.message}`);
    });
  }

  lines.push("", "未知 conditions：");
  if (unknownConditions.length === 0) {
    lines.push("- 无");
  } else {
    unknownConditions.forEach((item) => {
      lines.push(`- ${item.id}: ${JSON.stringify(item.unknownKeys)}`);
    });
  }

  lines.push("", "未被测试 context 覆盖的消息：");
  if (uncoveredByDevContexts.length === 0) {
    lines.push("- 无");
  } else {
    uncoveredByDevContexts.forEach((item) => {
      lines.push(`- ${item.id}`);
    });
  }

  if (validationErrors.length > 0) {
    lines.push("", "校验错误：");
    validationErrors.forEach((error) => {
      lines.push(`- ${error}`);
    });
  }

  return lines.join("\n");
}

function findDuplicateMessageIds(messages) {
  const seen = new Set();
  const duplicates = new Set();

  (Array.isArray(messages) ? messages : []).forEach((message) => {
    if (!message || !message.id) {
      return;
    }

    if (seen.has(message.id)) {
      duplicates.add(message.id);
    } else {
      seen.add(message.id);
    }
  });

  return [...duplicates];
}

function selectStableCandidates(candidates, eventName, context, options, maxResults) {
  const highestPriority = candidates.reduce((current, { message }) => Math.max(current, getMessagePriority(message)), -Infinity);
  const priorityPool = candidates.filter(({ message }) => getMessagePriority(message) === highestPriority);
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

function getMessagePriority(message) {
  return message && Number.isFinite(message.priority) ? message.priority : 0;
}

function findEmptyLineMessages(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter((message) => !message || normalizeStringArray(message.lines).length === 0)
    .map((message) => (message && message.id ? message.id : ""));
}

function normalizeConditions(conditions) {
  return conditions && typeof conditions === "object" && !Array.isArray(conditions)
    ? { ...conditions }
    : {};
}

function matchesConditions(conditions, context) {
  return Object.entries(normalizeConditions(conditions)).every(([key, expected]) => {
    if (!SUPPORTED_CONDITION_KEYS.has(key)) {
      return false;
    }

    if (Array.isArray(expected)) {
      return expected.includes(context[key]);
    }

    return expected === context[key];
  });
}

function getConditionSpecificity(message) {
  return Object.keys(normalizeConditions(message && message.conditions)).length;
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string" && item.trim() !== "")
    : [];
}

function getFirstLine(message) {
  const lines = normalizeStringArray(message && message.lines);
  return lines[0] || "";
}
