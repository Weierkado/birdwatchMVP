export const LIYA_MSG_BASE_DELAY = 500;
export const LIYA_MSG_CHAR_MULTIPLIER = 70;
export const LIYA_MSG_MAX_CHAR_DELAY = 1900;

let liyaLineAnimationTimers = [];
const animatingLiyaMessageIds = new Set();
const liyaAnimatedLineCounts = new Map();

export function clearLiyaLineAnimationTimers() {
  liyaLineAnimationTimers.forEach((timerId) => {
    window.clearTimeout(timerId);
  });
  liyaLineAnimationTimers = [];
  animatingLiyaMessageIds.clear();
  liyaAnimatedLineCounts.clear();
}

export function isElementFullyVisibleInContainer(element, container) {
  if (!element || !container || typeof element.getBoundingClientRect !== "function" || typeof container.getBoundingClientRect !== "function") {
    return false;
  }

  const elementRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const tolerance = 1;

  if (elementRect.width <= 0 || elementRect.height <= 0 || containerRect.width <= 0 || containerRect.height <= 0) {
    return false;
  }

  if (elementRect.height > containerRect.height + tolerance) {
    return false;
  }

  return elementRect.top >= containerRect.top - tolerance
    && elementRect.bottom <= containerRect.bottom + tolerance;
}

export function getVisibleLiyaReplyCardIds(container) {
  if (!container || typeof container.querySelectorAll !== "function") {
    return [];
  }

  const visibleCardIds = [];
  const seenCardIds = new Set();
  const replyNodes = container.querySelectorAll('[data-message-source="photo_reply"][data-message-speaker="liya"][data-card-id]');

  replyNodes.forEach((node) => {
    if (node.dataset.deferReadUntilLinesComplete === "true") {
      return;
    }

    const cardId = typeof node.dataset.cardId === "string" ? node.dataset.cardId.trim() : "";
    if (!cardId || seenCardIds.has(cardId)) {
      return;
    }

    if (!isElementFullyVisibleInContainer(node, container)) {
      return;
    }

    seenCardIds.add(cardId);
    visibleCardIds.push(cardId);
  });

  return visibleCardIds;
}

export function isNearBottom(container, threshold = 40) {
  if (!container) {
    return false;
  }
  return container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
}

function getTopmostVisibleScrollAnchor(historyEl) {
  if (!historyEl || typeof historyEl.querySelectorAll !== "function") {
    return null;
  }

  const historyRect = historyEl.getBoundingClientRect();
  const candidates = Array.from(historyEl.querySelectorAll("[data-scroll-anchor]"));
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    if (!candidate || typeof candidate.getBoundingClientRect !== "function") {
      continue;
    }

    const rect = candidate.getBoundingClientRect();
    if (rect.height <= 0 || rect.width <= 0) {
      continue;
    }
    if (rect.bottom <= historyRect.top || rect.top >= historyRect.bottom) {
      continue;
    }

    const anchorId = typeof candidate.dataset.scrollAnchor === "string"
      ? candidate.dataset.scrollAnchor.trim()
      : "";
    if (!anchorId) {
      continue;
    }

    return {
      anchorId,
      anchorOffset: rect.top - historyRect.top
    };
  }

  return null;
}

export function captureChatScrollState(detailPanelEl) {
  const overlayViewEl = detailPanelEl && detailPanelEl.querySelector(".message-overlay-view");
  if (overlayViewEl && overlayViewEl.classList.contains("is-list")) {
    return null;
  }

  const historyEl = detailPanelEl
    && (
      detailPanelEl.querySelector('.message-chat-history[data-chat-history-active="true"]')
      || detailPanelEl.querySelector(".message-chat-history")
    );
  if (!historyEl) {
    return null;
  }

  const distanceFromBottom = historyEl.scrollHeight - historyEl.scrollTop - historyEl.clientHeight;
  const nearBottom = isNearBottom(historyEl);
  const anchor = nearBottom ? null : getTopmostVisibleScrollAnchor(historyEl);
  return {
    threadId: typeof historyEl.dataset.threadId === "string" ? historyEl.dataset.threadId.trim() : "",
    scrollTop: historyEl.scrollTop,
    scrollHeight: historyEl.scrollHeight,
    clientHeight: historyEl.clientHeight,
    distanceFromBottom,
    nearBottom,
    anchorId: anchor ? anchor.anchorId : "",
    anchorOffset: anchor ? anchor.anchorOffset : null
  };
}

export function restoreChatScrollState(historyEl, previousState) {
  if (!historyEl || !previousState) {
    return;
  }

  if (previousState.nearBottom) {
    historyEl.scrollTop = historyEl.scrollHeight;
    return;
  }

  if (typeof previousState.anchorId === "string" && previousState.anchorId) {
    const escapedAnchorId = typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(previousState.anchorId)
      : previousState.anchorId.replace(/["\\]/g, "\\$&");
    const anchorEl = historyEl.querySelector(`[data-scroll-anchor="${escapedAnchorId}"]`);
    if (anchorEl && typeof anchorEl.getBoundingClientRect === "function" && Number.isFinite(previousState.anchorOffset)) {
      const historyRect = historyEl.getBoundingClientRect();
      const anchorRect = anchorEl.getBoundingClientRect();
      const nextScrollTop = historyEl.scrollTop + (anchorRect.top - historyRect.top - previousState.anchorOffset);
      const maxScrollTop = Math.max(0, historyEl.scrollHeight - historyEl.clientHeight);
      historyEl.scrollTop = Math.min(maxScrollTop, Math.max(0, nextScrollTop));
      return;
    }
  }

  const maxScrollTop = Math.max(0, historyEl.scrollHeight - historyEl.clientHeight);
  const hadNonZeroScroll = Number.isFinite(previousState.scrollTop) && previousState.scrollTop > 0;
  const targetByDistance = Number.isFinite(previousState.distanceFromBottom)
    ? historyEl.scrollHeight - previousState.clientHeight - previousState.distanceFromBottom
    : NaN;
  const fallbackTop = Number.isFinite(previousState.scrollTop) ? previousState.scrollTop : 0;
  const rawTarget = Number.isFinite(targetByDistance) ? targetByDistance : fallbackTop;
  let nextScrollTop = Math.min(maxScrollTop, Math.max(0, rawTarget));

  if (hadNonZeroScroll && maxScrollTop > 0 && nextScrollTop <= 0) {
    nextScrollTop = Math.min(maxScrollTop, Math.max(1, Math.floor(fallbackTop)));
  }

  historyEl.scrollTop = nextScrollTop;
}

function getLiyaLineDelay(previousLine) {
  const text = String(previousLine || "");
  const charDelay = Math.min(text.length * LIYA_MSG_CHAR_MULTIPLIER, LIYA_MSG_MAX_CHAR_DELAY);
  return LIYA_MSG_BASE_DELAY + charDelay;
}

function getRenderableMessageLines(message) {
  if (!message || message.type === "polaroid") {
    return [];
  }
  if (Array.isArray(message.lines)) {
    const lines = message.lines.map((line) => String(line || "").trim()).filter((line) => line.length > 0);
    if (lines.length > 0) {
      return lines;
    }
  }
  const text = typeof message.text === "string" ? message.text.trim() : "";
  return text ? [text] : [];
}

export function getDeliveredUnreadLineCount(message) {
  if (!message || message.type === "polaroid" || message.sender === "player" || message.isRead === true) {
    return 0;
  }

  const lines = getRenderableMessageLines(message);
  if (lines.length <= 0) {
    return 0;
  }

  if (message.isUnread !== true) {
    return lines.length;
  }

  const isUnreadLiyaPhotoReply = message.source === "photo_reply"
    && (message.speaker === "liya" || message.speaker === "sister");

  if (!isUnreadLiyaPhotoReply || lines.length <= 1) {
    return lines.length;
  }

  const deliveredLineCount = liyaAnimatedLineCounts.get(message.id);
  if (Number.isFinite(deliveredLineCount)) {
    return Math.max(0, Math.min(lines.length, deliveredLineCount));
  }

  if (animatingLiyaMessageIds.has(message.id)) {
    return 1;
  }

  return 0;
}

function shouldAnimateLiyaMessageLines(message, context) {
  if (!context.isLiyaThreadOpen() || !message || message.sender === "player") {
    return false;
  }
  if (message.source !== "photo_reply" || message.isRead !== false) {
    return false;
  }
  if (message.speaker !== "liya" && message.speaker !== "sister") {
    return false;
  }
  if (!Array.isArray(message.lines) || message.lines.length <= 1) {
    return false;
  }
  if (!message.id || animatingLiyaMessageIds.has(message.id)) {
    return false;
  }
  const totalLineCount = getRenderableMessageLines(message).length;
  if (totalLineCount > 1) {
    const visibleLineCount = liyaAnimatedLineCounts.get(message.id);
    if (Number.isFinite(visibleLineCount) && visibleLineCount >= totalLineCount) {
      return false;
    }
  }
  return !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

function renderLineBubbleHtml(message, lineText, lineIndex, deps, isLineEntering = false) {
  const bubbleClassName = [
    "message-bubble",
    message.sender === "player" ? "message-bubble-player" : "message-bubble-sister",
    isLineEntering ? "is-line-entering" : ""
  ].filter(Boolean).join(" ");
  const replyRefTitle = typeof message.replyToCardTitle === "string" && message.replyToCardTitle.trim()
    ? message.replyToCardTitle.trim()
    : "这张照片";
  const showReplyRef = lineIndex === 0 && message.sender !== "player" && message.source === "photo_reply";
  const replyRefHtml = showReplyRef ? `<div class="message-reply-ref">↪ 回复你的照片：《${deps.escapeHtml(replyRefTitle)}》</div>` : "";
  return `<div class="${bubbleClassName}">${replyRefHtml}${deps.escapeHtml(lineText)}</div>`;
}

export function startLiyaMessageLineAnimation(message, options = {}) {
  const safeMessage = message && typeof message === "object" ? message : null;
  const lines = Array.isArray(options.lines) ? options.lines : getRenderableMessageLines(safeMessage);
  if (!safeMessage || !safeMessage.id || !safeMessage.cardId || lines.length <= 1 || animatingLiyaMessageIds.has(safeMessage.id)) {
    return false;
  }

  const completedLineCount = liyaAnimatedLineCounts.get(safeMessage.id);
  if (Number.isFinite(completedLineCount) && completedLineCount >= lines.length) {
    return false;
  }

  const prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) {
    liyaAnimatedLineCounts.set(safeMessage.id, lines.length);
    if (typeof options.onProgress === "function") {
      options.onProgress({ message: safeMessage, visibleCount: lines.length, lineIndex: lines.length - 1 });
    }
    if (typeof options.onComplete === "function") {
      options.onComplete({ message: safeMessage });
    }
    return true;
  }

  const initialVisibleCount = Number.isFinite(completedLineCount)
    ? Math.max(1, Math.min(lines.length, completedLineCount))
    : 1;
  animatingLiyaMessageIds.add(safeMessage.id);
  let totalDelay = 0;
  for (let lineIndex = initialVisibleCount; lineIndex < lines.length; lineIndex += 1) {
    totalDelay += getLiyaLineDelay(lines[lineIndex - 1]);
    const timerId = window.setTimeout(() => {
      liyaAnimatedLineCounts.set(safeMessage.id, lineIndex + 1);
      if (typeof options.onProgress === "function") {
        options.onProgress({ message: safeMessage, visibleCount: lineIndex + 1, lineIndex });
      }
      if (lineIndex === lines.length - 1) {
        animatingLiyaMessageIds.delete(safeMessage.id);
        if (typeof options.onComplete === "function") {
          options.onComplete({ message: safeMessage });
        }
      }
    }, totalDelay);
    liyaLineAnimationTimers.push(timerId);
  }
  return true;
}

function scheduleLiyaMessageLineAnimation(message, lines, context) {
  if (typeof context.canStartLiyaMessageLineAnimation === "function" && !context.canStartLiyaMessageLineAnimation({ message, lines })) {
    return;
  }

  let lastBeforeRenderScrollState = null;
  let completionHandledInProgress = false;
  const started = startLiyaMessageLineAnimation(message, {
    lines,
    onProgress: ({ lineIndex }) => {
      if (!context.isLiyaThreadOpen()) {
        return;
      }
      lastBeforeRenderScrollState = captureChatScrollState(context.detailPanelEl);
      if (lineIndex === lines.length - 1 && typeof context.onLiyaMessageFinalProgress === "function") {
        completionHandledInProgress = true;
        context.onLiyaMessageFinalProgress({ message, beforeRenderScrollState: lastBeforeRenderScrollState });
        return;
      }
      context.onRequestRender(lastBeforeRenderScrollState);
    },
    onComplete: () => {
      if (!context.isLiyaThreadOpen()) {
        return;
      }
      const beforeRenderScrollState = lastBeforeRenderScrollState || captureChatScrollState(context.detailPanelEl);
      context.onLiyaMessageLinesComplete({ message, beforeRenderScrollState, completionHandledInProgress });
    }
  });

  if (started && typeof context.onLiyaMessageLineAnimationStarted === "function") {
    context.onLiyaMessageLineAnimationStarted({ message, lines });
  }
}

function renderMessageAvatar(label, escapeHtml) {
  return `<span class="message-avatar" aria-hidden="true">${escapeHtml(label)}</span>`;
}

function getSisterThreadPreview(messages) {
  const latestPreviewableMessage = [...messages].reverse().find((message) => {
    if (!message || message.type === "polaroid") {
      return false;
    }

    const lines = getRenderableMessageLines(message);
    return lines.length > 0;
  });

  if (latestPreviewableMessage) {
    const lines = getRenderableMessageLines(latestPreviewableMessage);
    const text = String(lines[lines.length - 1] || "");
    return text.length > 18 ? `${text.slice(0, 18)}…` : text;
  }

  const latestPolaroid = [...messages].reverse().find((message) => message && message.type === "polaroid");

  if (latestPolaroid) {
    return `[照片] ${latestPolaroid.title || "观鸟照片"}`;
  }

  const latest = messages[messages.length - 1];
  const text = latest && latest.text ? String(latest.text) : "暂无新消息";
  return text.length > 18 ? `${text.slice(0, 18)}…` : text;
}

function renderMessageCloseButton() {
  return `<button class="button-ghost message-close-button" type="button" data-action="closeMessages">关闭消息</button>`;
}

function renderMessageListPaneHtml(threadOrder, threadStateById, escapeHtml) {
  const threadListHtml = threadOrder.map((threadId) => {
    const thread = threadStateById[threadId];
    if (!thread) {
      return "";
    }

    const previewText = getSisterThreadPreview(thread.messages);
    const unreadDotHtml = thread.unread
      ? '<span class="message-thread-unread-dot" aria-hidden="true"></span>'
      : "";
    const avatarHtml = thread.unread
      ? `
        <span class="message-thread-avatar-wrap">
          ${renderMessageAvatar(thread.avatarText, escapeHtml)}
          ${unreadDotHtml}
        </span>
      `
      : renderMessageAvatar(thread.avatarText, escapeHtml);

    return `
      <button class="message-thread-item" type="button" data-action="${thread.action}">
        ${avatarHtml}
        <span class="message-thread-main">
          <span class="message-thread-name">${escapeHtml(thread.displayName)}</span>
          <span class="message-thread-preview">${escapeHtml(previewText)}</span>
        </span>
      </button>
    `;
  }).join("");

  return `
    <section class="message-panel message-panel-shell message-list-view" aria-label="消息">
      <div class="message-panel-inner">
        <header class="message-header message-list-header">
          <h3 class="message-panel-title message-title">消息列表</h3>
        </header>
        <div class="message-list-scroll" aria-label="消息线程列表">
          ${threadListHtml}
          <div class="message-list-empty-space" aria-hidden="true"></div>
        </div>
        <div class="message-panel-actions message-panel-bottom">
          ${renderMessageCloseButton()}
        </div>
      </div>
    </section>
  `;
}

function renderMessageChatPaneHtml(activeThread, options) {
  if (!activeThread) {
    return `
      <section class="message-panel message-panel-shell message-chat-view is-chat-placeholder" aria-hidden="true">
        <div class="message-panel-inner">
          <div class="message-chat-placeholder"></div>
        </div>
      </section>
    `;
  }

  const unreadDividerMessageId = options && options.isActive ? options.unreadDividerMessageId : "";
  const chatHistoryAttrs = options && options.isActive
    ? ' data-chat-history-active="true"'
    : ' data-chat-history-active="false"';

  return `
    <section class="message-panel message-panel-shell message-chat-view" aria-label="和${activeThread.displayName}的聊天">
      <div class="message-panel-inner">
        <header class="message-chat-header">
          <button class="message-chat-back" type="button" data-action="backToMessageList" aria-label="返回消息列表">←</button>
          <h2 class="message-chat-title">${options.escapeHtml(activeThread.displayName)}</h2>
          <span class="message-chat-header-spacer" aria-hidden="true"></span>
        </header>
        <div class="message-thread message-chat-history" aria-label="聊天记录" data-thread-id="${options.escapeHtml(String(activeThread.threadId || ""))}"${chatHistoryAttrs}>
          ${renderChatHistoryV2(activeThread.messages, activeThread.avatarText, { escapeHtml: options.escapeHtml, formatMessageTime: options.formatMessageTime, renderFieldGuideDetailPolaroid: options.renderFieldGuideDetailPolaroid }, { detailPanelEl: options.detailPanelEl, threadId: activeThread.threadId, isLiyaThreadOpen: options.isLiyaThreadOpen, onRequestRender: options.onRequestRender, onLiyaMessageFinalProgress: options.onLiyaMessageFinalProgress, canStartLiyaMessageLineAnimation: options.canStartLiyaMessageLineAnimation, onLiyaMessageLineAnimationStarted: options.onLiyaMessageLineAnimationStarted, onLiyaMessageLinesComplete: options.onLiyaMessageLinesComplete, unreadDividerMessageId })}
        </div>
      </div>
    </section>
  `;
}

function renderUnreadDividerHtml() {
  return `
    <div class="chat-unread-divider" role="separator" aria-label="以下为新消息">
      <span>以下为新消息</span>
    </div>
  `;
}

function renderChatHistoryV2(messages, avatarLabel, deps, context) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const unreadDividerMessageId = typeof context.unreadDividerMessageId === "string"
    ? context.unreadDividerMessageId.trim()
    : "";
  return safeMessages.map((message, index) => {
    const isPlayer = message.sender === "player";
    const isPolaroid = message.type === "polaroid";
    const rowClassName = isPlayer ? "message-row message-row-player" : "message-row message-row-sister";
    const avatarHtml = isPlayer ? "" : renderMessageAvatar(avatarLabel, deps.escapeHtml);
    const lines = getRenderableMessageLines(message);
    const shouldAnimate = shouldAnimateLiyaMessageLines(message, context);
    const isAnimating = Boolean(message && message.id && animatingLiyaMessageIds.has(message.id));
    const canStartAnimationNow = shouldAnimate
      ? !(typeof context.canStartLiyaMessageLineAnimation === "function" && !context.canStartLiyaMessageLineAnimation({ message, lines }))
      : false;
    const visibleCount = isAnimating
      ? Math.max(1, Math.min(lines.length, liyaAnimatedLineCounts.get(message.id) || 1))
      : shouldAnimate
        ? (canStartAnimationNow ? 1 : 0)
        : lines.length;
    if (shouldAnimate && canStartAnimationNow) {
      scheduleLiyaMessageLineAnimation(message, lines, context);
    }
    if (!isPolaroid && shouldAnimate && !isAnimating && !canStartAnimationNow && visibleCount <= 0) {
      return "";
    }

    const stableMessageAnchor = typeof message.id === "string" && message.id.trim()
      ? `message:${context.threadId}:${message.id.trim()}`
      : typeof message._stableKey === "string" && message._stableKey.trim()
        ? `stable:${context.threadId}:${message._stableKey.trim()}`
        : typeof message.cardId === "string" && message.cardId.trim()
          ? `card:${context.threadId}:${message.cardId.trim()}:${Number.isFinite(message.time) ? message.time : index}`
          : `fallback:${context.threadId}:${message.sender || "unknown"}:${message.type || "text"}:${Number.isFinite(message.time) ? message.time : index}`;
    const rowDataAttrs = message.source === "photo_reply" && !isPlayer
      ? ` data-message-source="photo_reply" data-message-speaker="liya" data-card-id="${deps.escapeHtml(String(message.cardId || ""))}"${(shouldAnimate || isAnimating) ? " data-defer-read-until-lines-complete=\"true\"" : ""}`
      : "";
    const rowAnchorAttrs = ` data-scroll-anchor="${deps.escapeHtml(stableMessageAnchor)}"`;
    const messageHtml = isPolaroid
      ? `
        <div class="message-bubble message-bubble-${isPlayer ? "player" : "sister"} message-bubble-polaroid">
          <div class="chat-polaroid-message">
            ${deps.renderFieldGuideDetailPolaroid(message.card, message.snapshot, false, message.title, { variant: "chat" })}
          </div>
          ${message.text ? `<span class="chat-polaroid-caption">${deps.escapeHtml(message.text)}</span>` : ""}
        </div>
      `
      : lines.map((line, lineIndex) => {
        if ((shouldAnimate || isAnimating) && lineIndex >= visibleCount) {
          return `<div class="message-bubble-placeholder" data-message-id="${deps.escapeHtml(String(message.id || ""))}" data-line-index="${lineIndex}"></div>`;
        }
        return renderLineBubbleHtml(message, line, lineIndex, deps);
      }).join("");

    const shouldShowUnreadDivider = unreadDividerMessageId
      ? Boolean(message && typeof message.id === "string" && message.id === unreadDividerMessageId)
      : false;
    const unreadDividerHtml = shouldShowUnreadDivider ? renderUnreadDividerHtml() : "";
    return `
      ${unreadDividerHtml}
      <div class="${rowClassName}${isPolaroid ? " message-row-polaroid" : ""}"${rowDataAttrs}${rowAnchorAttrs}>
        ${avatarHtml}
        <div class="message-content">
          ${messageHtml}
        </div>
      </div>
    `;
  }).join("");
}

export function renderMessagePanel(options) {
  const {
    detailPanelEl,
    pendingChatScrollRestoreState,
    shouldAutoScrollChatHistory,
    threadStateById,
    threadOrder,
    activeThreadId,
    renderedChatThreadId,
    unreadDividerMessageId,
    escapeHtml,
    formatMessageTime,
    renderFieldGuideDetailPolaroid,
    isLiyaThreadOpen,
    onRequestRender,
    onLiyaMessageFinalProgress,
    canStartLiyaMessageLineAnimation,
    onLiyaMessageLineAnimationStarted,
    onLiyaMessageLinesComplete,
    onAfterChatRendered,
    onChatHistoryScroll,
    consumeAutoScrollChatHistory,
    consumePendingChatScrollRestoreState
  } = options;

  const forcedChatScrollState = pendingChatScrollRestoreState;
  const previousChatScrollState = captureChatScrollState(detailPanelEl);
  const isChatView = Boolean(activeThreadId && threadStateById[activeThreadId]);
  const renderedChatThread = renderedChatThreadId && threadStateById[renderedChatThreadId]
    ? threadStateById[renderedChatThreadId]
    : null;

  detailPanelEl.innerHTML = `
    <div class="message-overlay-view${isChatView ? " is-chat" : " is-list"}" data-message-view="${isChatView ? escapeHtml(String(activeThreadId || "")) : "list"}">
      <div class="message-slide-viewport">
        <div class="message-slide-track">
          <section class="message-slide-pane message-list-pane${isChatView ? " is-inactive" : " is-active"}" aria-hidden="${isChatView ? "true" : "false"}">
            ${renderMessageListPaneHtml(threadOrder, threadStateById, escapeHtml)}
          </section>
          <section class="message-slide-pane message-chat-pane${isChatView ? " is-active" : " is-inactive"}" aria-hidden="${isChatView ? "false" : "true"}">
            ${renderMessageChatPaneHtml(renderedChatThread, {
              isActive: isChatView,
              unreadDividerMessageId,
              detailPanelEl,
              escapeHtml,
              formatMessageTime,
              renderFieldGuideDetailPolaroid,
              isLiyaThreadOpen,
              onRequestRender,
              onLiyaMessageFinalProgress,
              canStartLiyaMessageLineAnimation,
              onLiyaMessageLineAnimationStarted,
              onLiyaMessageLinesComplete
            })}
          </section>
        </div>
      </div>
    </div>
  `;

  window.requestAnimationFrame(() => {
    const historyEl = detailPanelEl.querySelector('.message-chat-history[data-chat-history-active="true"]');
    if (historyEl) {
      if (shouldAutoScrollChatHistory) {
        historyEl.scrollTop = historyEl.scrollHeight;
        consumeAutoScrollChatHistory();
      } else {
        restoreChatScrollState(historyEl, forcedChatScrollState || previousChatScrollState);
      }
      if (typeof onChatHistoryScroll === "function" && historyEl.dataset.scrollReadObserverAttached !== "true") {
        historyEl.addEventListener("scroll", () => {
          onChatHistoryScroll(historyEl);
        }, { passive: true });
        historyEl.dataset.scrollReadObserverAttached = "true";
      }
      onAfterChatRendered(historyEl);
      if (typeof consumePendingChatScrollRestoreState === "function") {
        consumePendingChatScrollRestoreState();
      }
      return;
    }

    if (typeof consumePendingChatScrollRestoreState === "function") {
      consumePendingChatScrollRestoreState();
    }
  });
}
