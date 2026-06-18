export function renderToolOverlayShell(options = {}) {
  const type = typeof options.type === "string" ? options.type : "";
  const title = typeof options.title === "string" ? options.title : "";
  const subtitle = typeof options.subtitle === "string" ? options.subtitle : "";
  const hideHeader = options.hideHeader === true;
  const flushChrome = options.flushChrome === true;
  const ariaLabel = typeof options.ariaLabel === "string" && options.ariaLabel.trim()
    ? options.ariaLabel.trim()
    : title || "工具面板";
  const extraClassName = typeof options.extraClassName === "string" ? options.extraClassName.trim() : "";
  const enteringClass = options.isEntering === true ? " is-entering" : "";
  const sheetClassName = flushChrome ? " is-flush-chrome" : "";
  const contentClassName = flushChrome ? " is-flush-chrome" : "";

  return `
    <div class="tool-overlay-root is-open${enteringClass}${extraClassName ? ` ${extraClassName}` : ""}" data-overlay="${type}">
      <button class="tool-overlay-scrim" type="button" data-action="observe" aria-label="关闭工具面板"></button>
      <section class="tool-overlay-sheet${sheetClassName}" role="dialog" aria-modal="false" aria-label="${ariaLabel}">
        ${hideHeader ? "" : `
          <header class="tool-overlay-header">
            <button class="tool-overlay-back" type="button" data-action="observe" aria-label="返回观察">‹</button>
            <div class="tool-overlay-heading">
              <h2 class="tool-overlay-title">${title}</h2>
              ${subtitle ? `<p class="tool-overlay-subtitle">${subtitle}</p>` : ""}
            </div>
          </header>
        `}
        <div class="tool-overlay-content${contentClassName}" data-tool-overlay-content></div>
      </section>
    </div>
  `;
}
