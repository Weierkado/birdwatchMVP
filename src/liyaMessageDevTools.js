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

export function buildLiyaTriggerPreviewContexts(options = {}) {
  const safeOptions = options && typeof options === "object" ? options : {};
  const speciesId = normalizeString(safeOptions.speciesId) || "light_vented_bulbul";
  const cardTitle = normalizeString(safeOptions.cardTitle) || "白头鹎";
  const storyStage = normalizeString(safeOptions.stage) || "early";
  const sendStates = [
    {
      key: "normal",
      label: "普通",
      firstTimeSpecies: false,
      repeatSpecies: false
    },
    {
      key: "first",
      label: "首次",
      firstTimeSpecies: true,
      repeatSpecies: false
    },
    {
      key: "repeat",
      label: "重复",
      firstTimeSpecies: false,
      repeatSpecies: true
    }
  ];
  const timeValues = [
    ["morning", "清晨"],
    ["day", "白天"],
    ["dusk", "黄昏"]
  ];
  const qualityValues = [
    ["clear", "清晰"],
    ["normal", "普通"],
    ["blurred", "模糊"]
  ];
  const compositionValues = [
    ["centered", "居中"],
    ["off_center", "偏构图"],
    ["unknown", "构图未知"]
  ];
  const contexts = [];

  sendStates.forEach((sendState) => {
    timeValues.forEach(([timeOfDay, timeLabel]) => {
      qualityValues.forEach(([quality, qualityLabel]) => {
        compositionValues.forEach(([composition, compositionLabel]) => {
          const label = `${sendState.label} / ${timeLabel} / ${qualityLabel} / ${compositionLabel}`;
          const cardId = [
            "trigger_preview",
            sendState.key,
            timeOfDay,
            quality,
            composition,
            contexts.length
          ].join("_");

          contexts.push({
            label,
            eventName: "photo_sent",
            context: {
              storyStage,
              speciesId,
              cardId,
              cardTitle,
              timeOfDay,
              quality,
              composition,
              firstTimeSpecies: sendState.firstTimeSpecies,
              repeatSpecies: sendState.repeatSpecies
            }
          });
        });
      });
    });
  });

  return contexts;
}

export function checkLiyaMessageConditionMatch(message, context = {}) {
  const safeContext = context && typeof context === "object" ? context : {};
  const conditions = normalizeConditions(message && message.conditions);
  const unknownKeys = Object.keys(conditions).filter((key) => !SUPPORTED_CONDITION_KEYS.has(key));
  const warnings = unknownKeys.map((key) => `Unknown condition key: ${key}`);

  if (unknownKeys.length > 0) {
    return {
      matches: false,
      conditions,
      unknownKeys,
      warnings
    };
  }

  const matches = Object.entries(conditions).every(([key, expected]) => {
    if (Array.isArray(expected)) {
      return expected.includes(safeContext[key]);
    }

    return expected === safeContext[key];
  });

  return {
    matches,
    conditions,
    unknownKeys,
    warnings
  };
}

export function analyzeLiyaMessageTriggerPreview(messages, options = {}) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const safeOptions = options && typeof options === "object" ? options : {};
  const contexts = Array.isArray(safeOptions.contexts)
    ? safeOptions.contexts
    : buildLiyaTriggerPreviewContexts(safeOptions);
  const maxExamples = Number.isInteger(safeOptions.maxExamplesPerMessage) && safeOptions.maxExamplesPerMessage > 0
    ? safeOptions.maxExamplesPerMessage
    : 6;
  const byMessageId = {};

  safeMessages.forEach((message, index) => {
    const id = getMessageAnalysisId(message, index);
    const conditionResult = checkLiyaMessageConditionMatch(message, {});

    byMessageId[id] = {
      id,
      messageId: message && message.id ? message.id : "",
      index,
      conditionMatchedContexts: [],
      actualSelectedContexts: [],
      coveredContexts: [],
      conditionMatchCount: 0,
      actualSelectedCount: 0,
      coveredCount: 0,
      status: conditionResult.unknownKeys.length > 0 ? "unknown_condition" : "not_matched",
      unknownKeys: conditionResult.unknownKeys,
      warnings: [...conditionResult.warnings]
    };
  });

  contexts.forEach((testCase) => {
    const eventName = testCase.eventName || "photo_sent";
    const context = testCase.context && typeof testCase.context === "object" ? testCase.context : {};
    const selected = selectLiyaMessagesFromList(safeMessages, eventName, context, {
      stage: context.storyStage || safeOptions.stage || "early",
      maxResults: 1,
      sentMessageIds: [],
      seed: testCase.label || ""
    });
    const selectedMessage = Array.isArray(selected) && selected.length > 0 ? selected[0] : null;
    const selectedMessageId = selectedMessage && selectedMessage.id ? selectedMessage.id : "";

    safeMessages.forEach((message, index) => {
      const id = getMessageAnalysisId(message, index);
      const item = byMessageId[id];
      const conditionResult = checkLiyaMessageConditionMatch(message, context);

      if (conditionResult.unknownKeys.length > 0) {
        item.status = "unknown_condition";
        item.unknownKeys = [...new Set([...item.unknownKeys, ...conditionResult.unknownKeys])];
        item.warnings = [...new Set([...item.warnings, ...conditionResult.warnings])];
        return;
      }

      if (!conditionResult.matches) {
        return;
      }

      item.conditionMatchCount += 1;
      pushLimitedExample(item.conditionMatchedContexts, createTriggerPreviewExample(testCase), maxExamples);

      if (message && message.id && message.id === selectedMessageId) {
        item.actualSelectedCount += 1;
        pushLimitedExample(item.actualSelectedContexts, createTriggerPreviewExample(testCase), maxExamples);
      } else {
        item.coveredCount += 1;
        pushLimitedExample(item.coveredContexts, {
          ...createTriggerPreviewExample(testCase),
          selectedMessageId
        }, maxExamples);
      }
    });
  });

  Object.values(byMessageId).forEach((item) => {
    if (item.status === "unknown_condition") {
      return;
    }

    if (item.actualSelectedCount > 0) {
      item.status = "actual_selected";
    } else if (item.coveredCount > 0) {
      item.status = "covered";
    } else if (item.conditionMatchCount > 0) {
      item.status = "condition_only";
    } else {
      item.status = "not_matched";
    }
  });

  const items = Object.values(byMessageId);
  const summary = {
    messageCount: safeMessages.length,
    contextCount: contexts.length,
    conditionMatchedCount: items.filter((item) => item.conditionMatchCount > 0).length,
    actualSelectedCount: items.filter((item) => item.actualSelectedCount > 0).length,
    coveredOnlyCount: items.filter((item) => item.status === "covered").length,
    noConditionMatchCount: items.filter((item) => item.status === "not_matched").length,
    unknownConditionCount: items.filter((item) => item.status === "unknown_condition").length
  };

  return {
    summary,
    byMessageId,
    contexts
  };
}

export function formatLiyaTriggerPreviewSummary(preview) {
  const safePreview = preview && typeof preview === "object" ? preview : {};
  const summary = safePreview.summary || {};
  const byMessageId = safePreview.byMessageId && typeof safePreview.byMessageId === "object"
    ? safePreview.byMessageId
    : {};
  const items = Object.values(byMessageId);
  const coveredItems = items.filter((item) => item.status === "covered");
  const notMatchedItems = items.filter((item) => item.status === "not_matched");
  const unknownItems = items.filter((item) => item.status === "unknown_condition");
  const lines = [
    "力娅消息触发反查报告",
    "",
    "摘要：",
    `- messages: ${formatCount(summary.messageCount)}`,
    `- contexts: ${formatCount(summary.contextCount)}`,
    `- 条件可匹配: ${formatCount(summary.conditionMatchedCount)}`,
    `- 实际可命中: ${formatCount(summary.actualSelectedCount)}`,
    `- 仅条件匹配但被覆盖: ${formatCount(summary.coveredOnlyCount)}`,
    `- 当前矩阵未匹配: ${formatCount(summary.noConditionMatchCount)}`,
    `- unknown condition: ${formatCount(summary.unknownConditionCount)}`,
    "",
    "可能不可见："
  ];

  const invisibleItems = [...coveredItems, ...notMatchedItems, ...unknownItems];
  if (invisibleItems.length === 0) {
    lines.push("- 无");
  } else {
    invisibleItems.forEach((item) => {
      lines.push(`- ${item.messageId || item.id}`);
      if (item.status === "covered") {
        const commonCover = getMostCommonSelectedMessageId(item.coveredContexts);
        lines.push(`  条件可匹配 ${item.conditionMatchCount} 次，实际命中 0 次，常被 ${commonCover || "其他消息"} 覆盖。`);
      } else if (item.status === "unknown_condition") {
        lines.push(`  unknown condition: ${JSON.stringify(item.unknownKeys || [])}`);
      } else {
        lines.push("  当前触发矩阵中没有条件匹配。");
      }
    });
  }

  lines.push("", "当前矩阵未匹配：");
  if (notMatchedItems.length === 0) {
    lines.push("- 无");
  } else {
    notMatchedItems.forEach((item) => {
      lines.push(`- ${item.messageId || item.id}`);
    });
  }

  return lines.join("\n");
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

export function analyzeLiyaQueueItems(collectedCards, options = {}) {
  const entries = normalizeCollectedCardInput(collectedCards);
  const safeOptions = options && typeof options === "object" ? options : {};
  const messages = Array.isArray(safeOptions.messages) ? safeOptions.messages : null;
  const getMessageById = typeof safeOptions.getMessageById === "function" ? safeOptions.getMessageById : null;
  const canCheckMessageId = Boolean(messages || getMessageById);
  const messageIds = messages ? new Set(messages.map((message) => message && message.id).filter(Boolean)) : null;
  const issues = [];
  const summary = {
    totalCards: entries.length,
    sentToSisterCount: 0,
    queueItemCount: 0,
    missingQueueItemCount: 0,
    orphanQueueItemCount: 0,
    invalidMessageIdCount: 0,
    dueAtMismatchCount: 0,
    statusMismatchCount: 0,
    readAtMismatchCount: 0,
    contextIssueCount: 0
  };

  entries.forEach((entry) => {
    const cardId = normalizeString(entry && entry.cardId);
    const speciesId = normalizeString(entry && entry.speciesId);
    const isSent = Boolean(entry && entry.sentToSister === true);
    const queueItem = normalizeQueueItem(entry && entry.liyaMessageQueueItem);

    if (isSent) {
      summary.sentToSisterCount += 1;
    }

    if (queueItem) {
      summary.queueItemCount += 1;
    }

    if (isSent && !queueItem) {
      summary.missingQueueItemCount += 1;
      issues.push(createQueueIssue("warning", "missing_queue_item", cardId, speciesId, "已发给妹妹但没有 liyaMessageQueueItem。旧存档可能正常出现该情况。"));
      return;
    }

    if (!queueItem) {
      return;
    }

    if (!isSent) {
      summary.orphanQueueItemCount += 1;
      issues.push(createQueueIssue("warning", "orphan_queue_item", cardId, speciesId, "存在 liyaMessageQueueItem，但 entry.sentToSister 不是 true。"));
    }

    if (!queueItem.messageId) {
      summary.invalidMessageIdCount += 1;
      issues.push(createQueueIssue("error", "invalid_message_id", cardId, speciesId, "queue item 缺少 messageId。"));
    } else if (canCheckMessageId && !hasLiyaMessage(queueItem.messageId, messageIds, getMessageById)) {
      summary.invalidMessageIdCount += 1;
      issues.push(createQueueIssue("error", "invalid_message_id", cardId, speciesId, `queue item messageId 找不到对应消息：${queueItem.messageId}`));
    }

    const entryDueAt = normalizeTimestamp(entry && entry.sisterReplyDueAt);
    const queueDueAt = normalizeTimestamp(queueItem.dueAt);
    if (Number.isFinite(entryDueAt) && Number.isFinite(queueDueAt) && Math.abs(entryDueAt - queueDueAt) > 1000) {
      summary.dueAtMismatchCount += 1;
      issues.push(createQueueIssue("warning", "due_at_mismatch", cardId, speciesId, "queue item dueAt 与 entry.sisterReplyDueAt 不一致。"));
    }
    const entryReadAt = normalizeTimestamp(entry && entry.sisterReplyReadAt);
    const queueReadAt = normalizeTimestamp(queueItem.readAt);
    if (Number.isFinite(entryReadAt) && queueItem.status !== "read") {
      summary.statusMismatchCount += 1;
      issues.push(createQueueIssue("warning", "read_status_mismatch", cardId, speciesId, "entry 已有 sisterReplyReadAt，但 queue item status 不是 read。"));
    }
    if (!Number.isFinite(entryReadAt) && queueItem.status === "read") {
      summary.statusMismatchCount += 1;
      issues.push(createQueueIssue("warning", "read_status_mismatch", cardId, speciesId, "queue item status 是 read，但 entry.sisterReplyReadAt 缺失。"));
    }
    if (Number.isFinite(entryReadAt) && Number.isFinite(queueReadAt) && Math.abs(entryReadAt - queueReadAt) > 1000) {
      summary.readAtMismatchCount += 1;
      issues.push(createQueueIssue("warning", "read_at_mismatch", cardId, speciesId, "queue item readAt 与 entry.sisterReplyReadAt 不一致。"));
    }

    const shapeIssues = getQueueShapeIssues(entry, queueItem);
    summary.contextIssueCount += shapeIssues.length;
    shapeIssues.forEach((issue) => issues.push(issue));
  });

  return {
    summary,
    issues
  };
}

export function formatLiyaQueueAnalysisReport(report) {
  const safeReport = report && typeof report === "object" ? report : {};
  const summary = safeReport.summary || {};
  const issues = Array.isArray(safeReport.issues) ? safeReport.issues : [];
  const lines = [
    "力娅 photo_reply queue 检查报告",
    "",
    "摘要：",
    `- collected cards: ${formatCount(summary.totalCards)}`,
    `- sent to sister: ${formatCount(summary.sentToSisterCount)}`,
    `- queue items: ${formatCount(summary.queueItemCount)}`,
    `- missing queue item: ${formatCount(summary.missingQueueItemCount)}`,
    `- orphan queue item: ${formatCount(summary.orphanQueueItemCount)}`,
    `- invalid message id: ${formatCount(summary.invalidMessageIdCount)}`,
    `- dueAt mismatch: ${formatCount(summary.dueAtMismatchCount)}`,
    `- status mismatch: ${formatCount(summary.statusMismatchCount)}`,
    `- readAt mismatch: ${formatCount(summary.readAtMismatchCount)}`,
    `- context/basic shape issues: ${formatCount(summary.contextIssueCount)}`,
    "",
    "问题："
  ];

  if (issues.length === 0) {
    lines.push("- 无");
  } else {
    issues.forEach((issue, index) => {
      lines.push(`${index + 1}. [${issue.severity || "warning"}] ${issue.type || "unknown"} ${issue.cardId || ""}`);
      lines.push(`   ${issue.message || ""}`);
    });
  }

  lines.push(
    "",
    "说明：",
    "- deliveredAt 当前不写回，不作为异常。",
    "- 红点仍由旧 sisterReplyDueAt / sisterReplyReadAt / sisterKnowledgeUnlocked 字段判断。",
    "- 手册妹妹补充仍由旧 sisterKnowledge 字段提供。"
  );

  return lines.join("\n");
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

function normalizeCollectedCardInput(value) {
  if (Array.isArray(value)) {
    return value.filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry));
  }

  if (value && typeof value === "object" && Array.isArray(value.collectedCards)) {
    return value.collectedCards.filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry));
  }

  if (value && typeof value === "object") {
    return Object.values(value).filter((entry) => (
      entry
      && typeof entry === "object"
      && !Array.isArray(entry)
      && (
        "cardId" in entry
        || "sentToSister" in entry
        || "liyaMessageQueueItem" in entry
      )
    ));
  }

  return [];
}

function normalizeQueueItem(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function createQueueIssue(severity, type, cardId, speciesId, message) {
  return {
    severity,
    type,
    cardId: cardId || "",
    speciesId: speciesId || "",
    message
  };
}

function hasLiyaMessage(messageId, messageIds, getMessageById) {
  if (!messageId) {
    return false;
  }

  if (messageIds) {
    return messageIds.has(messageId);
  }

  try {
    return Boolean(getMessageById && getMessageById(messageId));
  } catch {
    return false;
  }
}

function normalizeTimestamp(value) {
  if (Number.isFinite(value)) {
    return value;
  }

  const numericValue = typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (Number.isFinite(numericValue)) {
    return numericValue;
  }

  const parsedTime = Date.parse(value || "");
  return Number.isFinite(parsedTime) ? parsedTime : null;
}

function normalizeString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function getQueueShapeIssues(entry, queueItem) {
  const issues = [];
  const entryCardId = normalizeString(entry && entry.cardId);
  const entrySpeciesId = normalizeString(entry && entry.speciesId);
  const queueCardId = normalizeString(queueItem && queueItem.cardId);
  const queueSpeciesId = normalizeString(queueItem && queueItem.speciesId);
  const context = queueItem && queueItem.context && typeof queueItem.context === "object" && !Array.isArray(queueItem.context)
    ? queueItem.context
    : {};

  if (queueItem.source !== "photo_reply") {
    issues.push(createQueueIssue("warning", "basic_shape_issue", entryCardId, entrySpeciesId, "queue item source 应为 photo_reply。"));
  }
  if (queueItem.threadId !== "liya") {
    issues.push(createQueueIssue("warning", "basic_shape_issue", entryCardId, entrySpeciesId, "queue item threadId 应为 liya。"));
  }
  if (queueItem.speaker !== "liya") {
    issues.push(createQueueIssue("warning", "basic_shape_issue", entryCardId, entrySpeciesId, "queue item speaker 应为 liya。"));
  }
  if (!normalizeString(queueItem.messageId)) {
    issues.push(createQueueIssue("error", "basic_shape_issue", entryCardId, entrySpeciesId, "queue item messageId 不能为空。"));
  }
  if (!["pending", "read"].includes(queueItem.status)) {
    issues.push(createQueueIssue("warning", "basic_shape_issue", entryCardId, entrySpeciesId, "queue item status 应为 pending / read。"));
  }
  if (entryCardId && queueCardId && entryCardId !== queueCardId) {
    issues.push(createQueueIssue("warning", "basic_shape_issue", entryCardId, entrySpeciesId, "queue item cardId 与 entry.cardId 不一致。"));
  }
  if (entrySpeciesId && queueSpeciesId && entrySpeciesId !== queueSpeciesId) {
    issues.push(createQueueIssue("warning", "basic_shape_issue", entryCardId, entrySpeciesId, "queue item speciesId 与 entry.speciesId 不一致。"));
  }
  if (context.eventName !== "photo_sent") {
    issues.push(createQueueIssue("warning", "basic_shape_issue", entryCardId, entrySpeciesId, "queue item context.eventName 应为 photo_sent。"));
  }

  ["speciesId", "cardId", "cardTitle", "timeOfDay", "quality", "composition"].forEach((key) => {
    if (!normalizeString(context[key])) {
      issues.push(createQueueIssue("warning", "basic_shape_issue", entryCardId, entrySpeciesId, `queue item context.${key} 缺失。`));
    }
  });
  ["firstTimeSpecies", "repeatSpecies"].forEach((key) => {
    if (typeof context[key] !== "boolean") {
      issues.push(createQueueIssue("warning", "basic_shape_issue", entryCardId, entrySpeciesId, `queue item context.${key} 应为 boolean。`));
    }
  });

  return issues;
}

function getMessageAnalysisId(message, index) {
  return message && message.id ? message.id : `__index_${index}`;
}

function createTriggerPreviewExample(testCase) {
  const context = testCase.context && typeof testCase.context === "object" ? testCase.context : {};

  return {
    label: testCase.label || "",
    eventName: testCase.eventName || "photo_sent",
    context: { ...context }
  };
}

function pushLimitedExample(list, value, maxExamples) {
  if (list.length < maxExamples) {
    list.push(value);
  }
}

function getMostCommonSelectedMessageId(coveredContexts) {
  const counts = new Map();

  (Array.isArray(coveredContexts) ? coveredContexts : []).forEach((item) => {
    const id = item && item.selectedMessageId ? item.selectedMessageId : "";
    if (!id) {
      return;
    }
    counts.set(id, (counts.get(id) || 0) + 1);
  });

  let result = "";
  let maxCount = 0;
  counts.forEach((count, id) => {
    if (count > maxCount) {
      result = id;
      maxCount = count;
    }
  });

  return result;
}

function formatCount(value) {
  return Number.isFinite(value) ? String(value) : "0";
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
