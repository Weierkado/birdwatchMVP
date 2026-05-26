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

export function captureChatScrollState(detailPanelEl) {
  const historyEl = detailPanelEl && detailPanelEl.querySelector(".message-chat-history");
  if (!historyEl) {
    return null;
  }

  return {
    scrollTop: historyEl.scrollTop,
    scrollHeight: historyEl.scrollHeight,
    nearBottom: isNearBottom(historyEl)
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

  const heightDelta = historyEl.scrollHeight - previousState.scrollHeight;
  historyEl.scrollTop = Math.max(0, previousState.scrollTop + heightDelta);
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

function scheduleLiyaMessageLineAnimation(message, lines, context) {
  if (!message || !message.id || !message.cardId || lines.length <= 1 || animatingLiyaMessageIds.has(message.id)) {
    return;
  }
  animatingLiyaMessageIds.add(message.id);
  let totalDelay = 0;
  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    totalDelay += getLiyaLineDelay(lines[lineIndex - 1]);
    const timerId = window.setTimeout(() => {
      if (!context.isLiyaThreadOpen()) {
        return;
      }
      const beforeRenderScrollState = captureChatScrollState(context.detailPanelEl);
      liyaAnimatedLineCounts.set(message.id, lineIndex + 1);
      context.onRequestRender();
      if (lineIndex === lines.length - 1) {
        animatingLiyaMessageIds.delete(message.id);
        liyaAnimatedLineCounts.delete(message.id);
        context.onLiyaMessageLinesComplete({ message, beforeRenderScrollState });
      }
    }, totalDelay);
    liyaLineAnimationTimers.push(timerId);
  }
}

function renderMessageAvatar(label, escapeHtml) {
  return `<span class="message-avatar" aria-hidden="true">${escapeHtml(label)}</span>`;
}

function getSisterThreadPreview(messages) {
  const latestText = [...messages].reverse().find((message) => message && message.type !== "polaroid" && message.text);

  if (latestText) {
    const text = String(latestText.text);
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

function renderChatHistoryV2(messages, avatarLabel, deps, context) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  return safeMessages.map((message) => {
    const isPlayer = message.sender === "player";
    const isPolaroid = message.type === "polaroid";
    const rowClassName = isPlayer ? "message-row message-row-player" : "message-row message-row-sister";
    const timeHtml = `<span class="message-time">${deps.formatMessageTime(message.time)}</span>`;
    const avatarHtml = isPlayer ? "" : renderMessageAvatar(avatarLabel, deps.escapeHtml);
    const lines = getRenderableMessageLines(message);
    const shouldAnimate = shouldAnimateLiyaMessageLines(message, context);
    const isAnimating = Boolean(message && message.id && animatingLiyaMessageIds.has(message.id));
    const visibleCount = (shouldAnimate || isAnimating)
      ? Math.max(1, Math.min(lines.length, liyaAnimatedLineCounts.get(message.id) || 1))
      : lines.length;
    if (shouldAnimate) {
      scheduleLiyaMessageLineAnimation(message, lines, context);
    }

    const rowDataAttrs = message.source === "photo_reply" && !isPlayer
      ? ` data-message-source="photo_reply" data-message-speaker="liya" data-card-id="${deps.escapeHtml(String(message.cardId || ""))}"${(shouldAnimate || isAnimating) ? " data-defer-read-until-lines-complete=\"true\"" : ""}`
      : "";
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

    return `
      <div class="${rowClassName}${isPolaroid ? " message-row-polaroid" : ""}"${rowDataAttrs}>
        ${avatarHtml}
        <div class="message-content">
          ${timeHtml}
          ${messageHtml}
        </div>
      </div>
    `;
  }).join("");
}

export function renderMessagePanel(options) {
  const {
    detailPanelEl,
    inlinePanelJustOpened,
    pendingChatScrollRestoreState,
    shouldAutoScrollChatHistory,
    threadStateById,
    threadOrder,
    activeThreadId,
    escapeHtml,
    formatMessageTime,
    renderFieldGuideDetailPolaroid,
    isLiyaThreadOpen,
    onRequestRender,
    onLiyaMessageLinesComplete,
    onAfterChatRendered,
    consumeAutoScrollChatHistory
  } = options;

  const enteringClass = inlinePanelJustOpened === "messages" ? " is-inline-panel-entering" : "";
  const forcedChatScrollState = pendingChatScrollRestoreState;
  const previousChatScrollState = captureChatScrollState(detailPanelEl);

  if (activeThreadId && threadStateById[activeThreadId]) {
    const activeThread = threadStateById[activeThreadId];
    detailPanelEl.innerHTML = `
      <section class="message-panel message-panel-shell message-chat-view${enteringClass}" aria-label="和${activeThread.displayName}的聊天">
        <div class="message-panel-inner">
          <header class="message-chat-header">
            <button class="message-chat-back" type="button" data-action="backToMessageList" aria-label="返回消息列表">←</button>
            <h2 class="message-chat-title">${escapeHtml(activeThread.displayName)}</h2>
            <span class="message-chat-header-spacer" aria-hidden="true"></span>
          </header>
          <div class="message-thread message-chat-history" aria-label="聊天记录">
            ${renderChatHistoryV2(activeThread.messages, activeThread.avatarText, { escapeHtml, formatMessageTime, renderFieldGuideDetailPolaroid }, { detailPanelEl, isLiyaThreadOpen, onRequestRender, onLiyaMessageLinesComplete })}
          </div>
        </div>
      </section>
    `;

    window.requestAnimationFrame(() => {
      const historyEl = detailPanelEl.querySelector(".message-chat-history");
      if (historyEl) {
        if (shouldAutoScrollChatHistory) {
          historyEl.scrollTop = historyEl.scrollHeight;
          consumeAutoScrollChatHistory();
        } else {
          restoreChatScrollState(historyEl, forcedChatScrollState || previousChatScrollState);
        }
        onAfterChatRendered(historyEl);
      }
    });
    return;
  }

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

  detailPanelEl.innerHTML = `
    <section class="message-panel message-panel-shell message-list-view${enteringClass}" aria-label="消息">
      <div class="message-panel-inner">
        <header class="message-header message-list-header">
          <h3 class="message-panel-title message-title">消息列表</h3>
        </header>
        ${threadListHtml}
        <div class="message-list-empty-space" aria-hidden="true"></div>
        <div class="message-panel-actions message-panel-bottom">
          ${renderMessageCloseButton()}
        </div>
      </div>
    </section>
  `;
}
