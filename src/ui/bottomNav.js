function renderObserveIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="8" cy="11" r="3.5"></circle>
      <circle cx="16" cy="11" r="3.5"></circle>
      <path d="M4.5 11h-2m19 0h-2m-8-1.5h1"></path>
      <path d="M9.5 14.5l-1.4 2.8m7.3-2.8l1.4 2.8"></path>
    </svg>
  `;
}

function renderMessagesIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4.5 6.5h15a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4.5 3v-13a1 1 0 0 1 1-1Z"></path>
      <path d="m7 10.5 5 3.2 5-3.2"></path>
    </svg>
  `;
}

function renderFieldGuideIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7 4.5h8.5a2 2 0 0 1 2 2V19a1 1 0 0 1-1.6.8L12 17l-3.9 2.8A1 1 0 0 1 6.5 19V6.5a2 2 0 0 1 2-2Z"></path>
      <path d="M9 8.5h6m-6 3h6"></path>
    </svg>
  `;
}

function getButtonLabel(baseLabel, options = {}) {
  if (options.hasUnreadMessages) {
    return `${baseLabel}，有未读消息`;
  }

  if (options.hasNewFieldGuideContent) {
    return `${baseLabel}，有新内容`;
  }

  return baseLabel;
}

export function renderBottomNav(options = {}) {
  const activeOverlay = typeof options.activeOverlay === "string" ? options.activeOverlay : "";
  const hasUnreadMessages = options.hasUnreadMessages === true;
  const unreadMessageCount = Number.isFinite(options.unreadMessageCount) ? options.unreadMessageCount : 0;
  const hasNewFieldGuideContent = options.hasNewFieldGuideContent === true;

  return `
    <div class="bottom-nav" aria-label="底部导航">
      <button class="bottom-nav__button${activeOverlay === "" ? " is-active" : ""}" type="button" data-action="observe" aria-pressed="${activeOverlay === ""}" aria-label="${getButtonLabel("观察")}">
        <span class="bottom-nav__icon" aria-hidden="true">${renderObserveIcon()}</span>
        <span class="bottom-nav__label">观察</span>
      </button>
      <button class="bottom-nav__button${activeOverlay === "messages" ? " is-active" : ""}" type="button" data-action="messages" aria-pressed="${activeOverlay === "messages"}" aria-label="${getButtonLabel("消息", { hasUnreadMessages })}" title="${hasUnreadMessages ? `${Math.max(0, unreadMessageCount)} 条未读消息` : "消息"}">
        <span class="bottom-nav__icon" aria-hidden="true">${renderMessagesIcon()}</span>
        <span class="bottom-nav__label">消息</span>
        ${hasUnreadMessages ? '<span class="bottom-nav__dot" aria-hidden="true"></span><span class="sr-only">有未读消息</span>' : ""}
      </button>
      <button class="bottom-nav__button${activeOverlay === "fieldGuide" ? " is-active" : ""}" type="button" data-action="fieldGuide" aria-pressed="${activeOverlay === "fieldGuide"}" aria-label="${getButtonLabel("笔记", { hasNewFieldGuideContent })}" title="${hasNewFieldGuideContent ? "笔记有新内容" : "笔记"}">
        <span class="bottom-nav__icon" aria-hidden="true">${renderFieldGuideIcon()}</span>
        <span class="bottom-nav__label">笔记</span>
        ${hasNewFieldGuideContent ? '<span class="bottom-nav__dot" aria-hidden="true"></span><span class="sr-only">有新内容</span>' : ""}
      </button>
    </div>
  `;
}
