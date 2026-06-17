export function wrapNoteFolder(innerHtml, options = {}) {
  const escapeHtml = options.escapeHtml || ((value) => String(value || ""));
  const tabLabel = options.folderTabLabel || "观察笔记";
  return `
    <div class="note-book-folder">
      <div class="note-book-folder-tab" aria-hidden="true">${escapeHtml(tabLabel)}</div>
      <div class="note-book-folder-inner">
        ${innerHtml}
      </div>
    </div>
  `;
}

export function renderFieldGuideBottomCloseButton() {
  return `
    <div class="field-guide-bottom-actions">
      <button class="button-secondary field-guide-close-bottom" type="button" data-action="fieldGuide">关闭手册</button>
    </div>
  `;
}

export function renderFieldGuideEmptyPanel(options = {}) {
  const resetSaveButtonHtml = options.resetSaveButtonHtml || options.clearGuideButtonHtml || "";
  return wrapNoteFolder(`
    <section class="field-guide-page field-guide-empty note-book-page">
      <h2>笔记</h2>
      <p class="field-guide-empty-title">笔记还是空白的。</p>
      <p class="field-guide-empty-desc">去野外，遇见你的第一只鸟。</p>
      ${resetSaveButtonHtml}
      ${renderFieldGuideBottomCloseButton()}
    </section>
  `, options);
}

function renderFamiliarityDots(score, maxScore = 5) {
  const safeMax = Number.isFinite(maxScore) ? Math.max(1, Math.floor(maxScore)) : 5;
  const safeScore = Number.isFinite(score) ? Math.max(0, Math.min(safeMax, Math.floor(score))) : 0;

  return Array.from({ length: safeMax }, (_, index) => {
    const className = index < safeScore
      ? "note-familiarity-dot is-filled"
      : "note-familiarity-dot";
    return `<span class="${className}" aria-hidden="true"></span>`;
  }).join("");
}

export function renderFieldGuideJournalPanel(options = {}) {
  const escapeHtml = options.escapeHtml || ((value) => String(value || ""));
  const entries = Array.isArray(options.entries) ? options.entries : [];
  const totalCount = Number.isFinite(options.totalCount)
    ? Math.max(0, Math.floor(options.totalCount))
    : entries.length;
  const currentIndex = Number.isFinite(options.currentIndex)
    ? Math.max(0, Math.floor(options.currentIndex))
    : 0;
  const currentEntry = options.currentEntry || null;
  const emptyTitle = options.emptyTitle || "观察笔记";
  const emptyDescription = options.emptyDescription || "还没有哪只鸟真正留在你的笔记里。等你看清它们，再慢慢写下来。";
  const pagerClassName = options.pagerClassName || "field-guide-pager";
  const prevButtonHtml = options.prevButtonHtml || "";
  const nextButtonHtml = options.nextButtonHtml || "";

  const bodyHtml = entries.length > 0 && currentEntry
    ? (() => {
      const familiarityScore = Number.isFinite(currentEntry.familiarityScore)
        ? Math.max(0, Math.min(5, Math.floor(currentEntry.familiarityScore)))
        : 0;
      const paragraphs = Array.isArray(currentEntry.paragraphs) ? currentEntry.paragraphs : [];
      const dailySupplementText = currentEntry.dailySupplementText || "等晚上整理照片时，也许会再添上一句。";
      const speciesNumber = totalCount > 0 ? `${currentIndex + 1} / ${totalCount}` : "";
      const pageBarsHtml = totalCount > 1
        ? `
          <div class="journal-page-bars" aria-hidden="true">
            ${Array.from({ length: totalCount }, (_, index) => {
              const className = index === currentIndex
                ? "journal-page-bar is-active"
                : "journal-page-bar";
              return `<span class="${className}"></span>`;
            }).join("")}
          </div>
        `
        : "";

      return `
        ${pageBarsHtml}
        <div class="journal-page-nav ${pagerClassName}" aria-label="笔记翻页">
          ${prevButtonHtml}
          ${speciesNumber ? `<div class="journal-page-counter field-guide-species-number">${escapeHtml(speciesNumber)}</div>` : ""}
          ${nextButtonHtml}
        </div>
        <article class="journal-species journal-species--page">
          <header class="journal-species__header">
            <h3 class="journal-species__name">${escapeHtml(currentEntry.displayName || "还没认出的鸟")}</h3>
            <div class="note-familiarity-dots" aria-label="熟悉度 ${familiarityScore} / 5">
              ${renderFamiliarityDots(familiarityScore, 5)}
            </div>
          </header>
          <div class="journal-species__copy">
            ${paragraphs.map((line) => `<p class="journal-species__line">${escapeHtml(line)}</p>`).join("")}
          </div>
          <section class="journal-species__supplement is-empty" aria-label="今日补充">
            <h4 class="journal-species__supplement-title">今日补充</h4>
            <p class="journal-species__supplement-body">${escapeHtml(dailySupplementText)}</p>
          </section>
        </article>
      `;
    })()
    : `
      <section class="journal-empty-state">
        <h3>${escapeHtml(emptyTitle)}</h3>
        <p>${escapeHtml(emptyDescription)}</p>
      </section>
    `;

  return `
    <section class="field-guide-page note-book-page journal-field-guide">
      ${bodyHtml}
    </section>
  `;
}

export function renderFieldGuideListContent(options = {}) {
  const escapeHtml = options.escapeHtml || ((value) => String(value || ""));
  const pageTabsHtml = options.pageTabsHtml || "";
  const pagerClassName = options.pagerClassName || "field-guide-pager is-single-page";
  const prevButtonHtml = options.prevButtonHtml || "";
  const nextButtonHtml = options.nextButtonHtml || "";
  const speciesNumber = options.speciesNumber || "";
  const speciesTitle = options.speciesTitle || "";
  const speciesTitleHtml = options.speciesTitleHtml || "";
  const speciesMetaHtml = options.speciesMetaHtml || "";
  const speciesAppearance = options.speciesAppearance || "";
  const catalogueButtonHtml = options.catalogueButtonHtml || "";
  const cardListHtml = options.cardListHtml || "";
  const resetSaveButtonHtml = options.resetSaveButtonHtml || options.clearGuideButtonHtml || "";

  return `
    <section class="field-guide-page note-book-page">
      <div class="field-guide-page-tabs" aria-label="笔记页数">${pageTabsHtml}</div>
      <div class="${pagerClassName}">
        ${prevButtonHtml}
        <div class="field-guide-species-header${options.speciesHeaderRevealAttrs || ""}">
          ${speciesNumber ? `<div class="field-guide-species-number">${escapeHtml(speciesNumber)}</div>` : ""}
          <h2 class="field-guide-species-title">${speciesTitleHtml || escapeHtml(speciesTitle)}</h2>
        </div>
        ${nextButtonHtml}
      </div>
      ${speciesMetaHtml}
      <p class="field-guide-appearance${options.speciesAppearanceRevealAttrs || ""}">${escapeHtml(speciesAppearance)}</p>
      ${catalogueButtonHtml}
      ${cardListHtml}
      ${resetSaveButtonHtml}
      ${renderFieldGuideBottomCloseButton()}
    </section>
  `;
}

export function renderFieldGuideListPanel(options = {}) {
  return wrapNoteFolder(renderFieldGuideListContent(options), options);
}

export function renderResetSaveConfirmPanel(options = {}) {
  const escapeHtml = options.escapeHtml || ((value) => String(value || ""));
  const collectedCardsCount = Number.isFinite(options.collectedCardsCount) ? options.collectedCardsCount : 0;
  const discoveredSpeciesCount = Number.isFinite(options.discoveredSpeciesCount) ? options.discoveredSpeciesCount : 0;
  const testerStatusText = options.testerStatusText || "暂未启用";
  const analyticsStatusText = options.analyticsStatusText || "暂未启用";

  return wrapNoteFolder(`
    <section class="field-guide-page note-book-page reset-save-confirm" aria-label="重置游戏存档确认">
      <h2 class="reset-save-confirm__title">⚠ 重置游戏存档？</h2>
      <p class="reset-save-confirm__body">此操作不可撤销。下面是会被影响的数据。</p>
      <section class="reset-save-confirm__section reset-save-confirm__section--danger">
        <h3>将清空</h3>
        <ul>
          <li>所有图鉴卡牌（当前 ${escapeHtml(collectedCardsCount)} 张）</li>
          <li>所有鸟种发现状态（当前 ${escapeHtml(discoveredSpeciesCount)} 种）</li>
          <li>所有妹妹消息进度（队列、已读、初见解锁）</li>
          <li>所有拍立得 snapshot</li>
          <li>所有计数（拍照次数、卡牌捕获次数等）</li>
        </ul>
      </section>
      <section class="reset-save-confirm__section reset-save-confirm__section--keep">
        <h3>不会清空</h3>
        <ul>
          <li>测试者身份（${escapeHtml(testerStatusText)}）</li>
          <li>埋点上报缓存（${escapeHtml(analyticsStatusText)}）</li>
        </ul>
      </section>
      <div class="field-guide-bottom-actions reset-save-confirm__actions">
        <button class="reset-save-confirm__cancel" type="button" data-action="resetSaveCancel">取消</button>
        <button class="reset-save-confirm__confirm" type="button" data-action="resetSaveConfirm">确认重置</button>
      </div>
    </section>
  `, options);
}

export function renderFieldGuideDetailCornerHtml() {
  return `
    <span class="field-guide-detail-corner corner-tl"></span>
    <span class="field-guide-detail-corner corner-tr"></span>
    <span class="field-guide-detail-corner corner-bl"></span>
    <span class="field-guide-detail-corner corner-br"></span>
  `;
}

export function renderFieldGuideSnapshotNav(snapshotCount, snapshotIndex, options = {}) {
  if (snapshotCount <= 1) {
    return "";
  }

  const prevDisabled = snapshotIndex <= 0 ? " disabled" : "";
  const nextDisabled = snapshotIndex >= snapshotCount - 1 ? " disabled" : "";
  const prevAction = options.prevAction || "fieldGuidePrevSnapshot";
  const nextAction = options.nextAction || "fieldGuideNextSnapshot";

  return `
    <div class="field-guide-snapshot-nav" aria-label="照片翻阅">
      <button class="field-guide-snapshot-button" type="button" data-action="${prevAction}"${prevDisabled} aria-label="上一张照片">◀</button>
      <span class="field-guide-snapshot-page">${snapshotIndex + 1} / ${snapshotCount}</span>
      <button class="field-guide-snapshot-button" type="button" data-action="${nextAction}"${nextDisabled} aria-label="下一张照片">▶</button>
    </div>
  `;
}

export function renderFieldGuideDetailPolaroid(options = {}) {
  const {
    card,
    snapshot,
    isIdentified,
    displayTitle,
    variant,
    enableCardIdentifyUi,
    recentlyIdentifiedCardId,
    getPolaroidFocusGradeClass,
    getStateClassFromCapturedState,
    shouldShowPolaroidCrown,
    clampPolaroidPercent,
    getSnapshotFinalScale,
    clampNumber,
    getSnapshotBadgeRotation,
    getSpeciesById,
    getPolaroidTimeTintStyle,
    gameState,
    buildSpeciesBadgeStyle,
    buildBehaviorBadgeStyle,
    getSnapshotBehaviorState,
    getFocusFrameStyle,
    escapeHtml,
    formatPolaroidDate
  } = options;

  const safeDisplayTitle = displayTitle || (card && card.title) || "";
  const shouldUseIdentifyUi = Boolean(enableCardIdentifyUi && isIdentified);
  const identifyingClass = enableCardIdentifyUi && card && recentlyIdentifiedCardId === card.id ? " is-identifying" : "";
  const safeVariant = variant === "chat" ? "chat" : "detail";
  const variantClass = safeVariant === "chat" ? " is-chat-polaroid" : "";

  if (!snapshot) {
    return `
      <div class="field-guide-detail-polaroid${identifyingClass}${variantClass}">
        <div class="field-guide-detail-polaroid-paper">
          <div class="field-guide-detail-polaroid-frame">
            <div class="field-guide-detail-no-snapshot">本卡无拍摄记录</div>
          </div>
        </div>
      </div>
    `;
  }

  const focusClassName = snapshot.focusAffix === "IN_FOCUS" ? "is-green" : "is-blur";
  const focusGradeClass = getPolaroidFocusGradeClass(snapshot);
  const badgeClassName = [
    "field-guide-detail-badge",
    "behavior-badge",
    getStateClassFromCapturedState(snapshot.capturedState),
    snapshot.focusAffix === "BLUR" ? "is-blur" : "",
    focusGradeClass
  ].filter(Boolean).join(" ");
  const crownHtml = shouldShowPolaroidCrown(snapshot)
    ? "<span class=\"field-guide-detail-crown\">♛</span>"
    : "";
  const badgeRelX = clampPolaroidPercent(snapshot.badgeRelX);
  const badgeRelY = clampPolaroidPercent(snapshot.badgeRelY);
  const finalScale = getSnapshotFinalScale(snapshot);
  const badgeScale = safeVariant === "chat" ? clampNumber(finalScale, 0.85, 1.15) : finalScale;
  const badgeRotation = getSnapshotBadgeRotation(snapshot);
  const species = getSpeciesById(card.speciesId);
  const timeTintStyle = getPolaroidTimeTintStyle(snapshot, gameState);
  const badgeColorStyle = shouldUseIdentifyUi
    ? buildSpeciesBadgeStyle(species, snapshot)
    : buildBehaviorBadgeStyle(getSnapshotBehaviorState(snapshot, card));
  const inlineBadgeStyle = [
    `left: ${badgeRelX}%`,
    `top: ${badgeRelY}%`,
    `transform: translate(-50%, -50%) rotate(${badgeRotation}deg) scale(${badgeScale})`,
    badgeColorStyle
  ].filter(Boolean).join("; ");

  return `
    <div class="field-guide-detail-polaroid${identifyingClass}${variantClass}">
      <div class="field-guide-detail-polaroid-paper">
        <div class="field-guide-detail-polaroid-frame" style="${timeTintStyle}">
          <div class="field-guide-detail-focus-area ${focusClassName}" style="${getFocusFrameStyle()}">
            ${renderFieldGuideDetailCornerHtml()}
          </div>
          <div class="${badgeClassName}" style="${inlineBadgeStyle};">${escapeHtml(safeDisplayTitle)}</div>
        </div>
        <div class="field-guide-detail-date">${formatPolaroidDate(snapshot.realTimestamp)}</div>
        ${crownHtml}
      </div>
    </div>
  `;
}

export function renderFieldGuideCardDetailContent(options = {}) {
  const escapeHtml = options.escapeHtml || ((value) => String(value || ""));
  const backAction = options.backAction || "fieldGuideDetailBack";
  const backLabel = options.backLabel || "◀ 返回笔记";
  const bottomAction = options.bottomAction || "fieldGuide";
  const bottomLabel = options.bottomLabel || "关闭手册";
  return `
    <section class="field-guide-detail-view note-book-page note-card-detail-panel" aria-label="${escapeHtml(options.displayTitle)}卡牌详情">
      <div class="field-guide-detail-toolbar">
        <button class="field-guide-detail-back button-ghost" type="button" data-action="${backAction}">${escapeHtml(backLabel)}</button>
      </div>
      <section class="field-guide-detail-card-info">
        <div class="field-guide-card-title-row">
          ${options.rarityBadgeHtml || ""}
          <h2 class="field-guide-detail-card-title">${escapeHtml(options.displayTitle)}</h2>
        </div>
        <p class="field-guide-detail-card-description">${escapeHtml(options.displayDescription)}</p>
        ${options.identifyRowHtml || ""}
      </section>
      ${options.detailStatsHtml || ""}
      ${options.sisterKnowledgeHtml || ""}
      <div class="note-detail-photo-section">
        <div class="note-detail-photo-and-meta">
          <div class="note-detail-polaroid-wrap">
            ${options.polaroidHtml || ""}
          </div>
          <div class="field-guide-detail-capture-meta" aria-label="拍摄信息">
            <span class="field-guide-detail-capture-meta-item note-detail-photo-meta-row note-detail-photo-meta-row-time"><span class="field-guide-detail-capture-label">拍摄时间：</span><span class="field-guide-detail-capture-value">${escapeHtml(options.captureTimeText)}</span></span>
            <span class="field-guide-detail-capture-meta-item note-detail-photo-meta-row note-detail-photo-meta-row-location"><span class="field-guide-detail-capture-label">地点：</span><span class="field-guide-detail-capture-value">${escapeHtml(options.spotText)}</span></span>
            <span class="field-guide-detail-capture-meta-item note-detail-photo-meta-row note-detail-photo-meta-row-battery"><span class="field-guide-detail-capture-label">电量：</span><span class="field-guide-detail-capture-value">${options.batteryHtml || ""}</span></span>
            <span class="field-guide-detail-capture-meta-item note-detail-photo-meta-row note-detail-photo-meta-row-focus"><span class="field-guide-detail-capture-label">对焦：</span><span class="field-guide-detail-capture-value">${escapeHtml(options.focusText)}</span></span>
          </div>
        </div>
      </div>
      ${options.snapshotNavHtml || ""}
      ${options.sendToSisterHtml || ""}
      <div class="field-guide-bottom-actions">
        <button class="button-secondary field-guide-close-bottom" type="button" data-action="${bottomAction}">${escapeHtml(bottomLabel)}</button>
      </div>
    </section>
  `;
}

export function renderFieldGuideDetailContent(options = {}) {
  return renderFieldGuideCardDetailContent(options);
}

export function renderFieldGuideOverlayView(options = {}) {
  const basePanelHtml = options.basePanelHtml || "";
  const cardDetailHtml = options.cardDetailHtml || "";
  const hasCardModal = Boolean(cardDetailHtml);

  return wrapNoteFolder(`
    <div class="field-guide-overlay-view${hasCardModal ? " has-card-modal" : ""}">
      <div class="field-guide-base-pane">
        ${basePanelHtml}
      </div>
      ${hasCardModal ? `
        <div class="field-guide-card-modal-layer" data-field-guide-modal="card-detail">
          <button
            class="field-guide-card-modal-scrim"
            type="button"
            data-action="fieldGuideDetailBack"
            aria-label="关闭卡牌详情"
          ></button>
          <div class="field-guide-card-modal">
            ${cardDetailHtml}
          </div>
        </div>
      ` : ""}
    </div>
  `, options);
}

export function renderFieldGuideCardDetailPanel(options = {}) {
  return wrapNoteFolder(renderFieldGuideDetailContent(options), options);
}

export function renderAlbumPanel(options = {}) {
  const escapeHtml = options.escapeHtml || ((value) => String(value || ""));
  const contentHtml = options.contentHtml || "";

  return wrapNoteFolder(`
    <section class="field-guide-page note-book-page album-panel" aria-label="相册">
      <header class="album-panel__header">
        <h2>相册</h2>
        <p>保存拍到的瞬间。</p>
      </header>
      <div class="album-panel__body">
        ${contentHtml || `
          <section class="album-empty">
            <h3>${escapeHtml(options.emptyTitle || "还没有照片")}</h3>
            <p>${escapeHtml(options.emptyDescription || "等你拍下第一张鸟的照片，它会出现在这里。")}</p>
          </section>
        `}
      </div>
    </section>
  `, {
    ...options,
    folderTabLabel: options.folderTabLabel || "相册"
  });
}
