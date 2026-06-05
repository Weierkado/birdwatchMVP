export function renderBottomNav(options = {}) {
  const activeOverlay = typeof options.activeOverlay === "string" ? options.activeOverlay : "";
  const hasUnreadMessages = options.hasUnreadMessages === true;
  const unreadMessageCount = Number.isFinite(options.unreadMessageCount) ? options.unreadMessageCount : 0;
  const hasNewFieldGuideContent = options.hasNewFieldGuideContent === true;

  const messageBadgeText = unreadMessageCount > 99 ? "99+" : String(Math.max(0, unreadMessageCount));

  return `
    <div class="bottom-nav" aria-label="底部导航">
      <button class="bottom-nav__button${activeOverlay === "" ? " is-active" : ""}" type="button" data-action="observe" aria-pressed="${activeOverlay === ""}">
        <span class="bottom-nav__label">观察</span>
      </button>
      <button class="bottom-nav__button${activeOverlay === "messages" ? " is-active" : ""}" type="button" data-action="messages" aria-pressed="${activeOverlay === "messages"}">
        <span class="bottom-nav__label">消息</span>
        ${hasUnreadMessages ? `<span class="bottom-nav__badge" aria-label="${messageBadgeText} 条未读消息">${messageBadgeText}</span>` : ""}
      </button>
      <button class="bottom-nav__button${activeOverlay === "fieldGuide" ? " is-active" : ""}" type="button" data-action="fieldGuide" aria-pressed="${activeOverlay === "fieldGuide"}">
        <span class="bottom-nav__label">笔记</span>
        ${hasNewFieldGuideContent ? '<span class="bottom-nav__badge bottom-nav__badge--new">new</span>' : ""}
      </button>
    </div>
  `;
}
