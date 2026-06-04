export function wrapNoteFolder(innerHtml, options = {}) {
  const enteringClass = options && options.isEntering ? " is-inline-panel-entering" : "";
  return `
    <div class="note-book-folder${enteringClass}">
      <div class="note-book-folder-tab" aria-hidden="true">观察笔记 / 给妹妹力娅看的照片笔记</div>
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
  `, { isEntering: Boolean(options.isEntering) });
}

export function renderFieldGuideListPanel(options = {}) {
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

  return wrapNoteFolder(`
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
  `, { isEntering: Boolean(options.isEntering) });
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
  `, { isEntering: Boolean(options.isEntering) });
}

export function renderFieldGuideDetailCornerHtml() {
  return `
    <span class="field-guide-detail-corner corner-tl"></span>
    <span class="field-guide-detail-corner corner-tr"></span>
    <span class="field-guide-detail-corner corner-bl"></span>
    <span class="field-guide-detail-corner corner-br"></span>
  `;
}

export function renderFieldGuideSnapshotNav(snapshotCount, snapshotIndex) {
  if (snapshotCount <= 1) {
    return "";
  }

  const prevDisabled = snapshotIndex <= 0 ? " disabled" : "";
  const nextDisabled = snapshotIndex >= snapshotCount - 1 ? " disabled" : "";

  return `
    <div class="field-guide-snapshot-nav" aria-label="照片翻阅">
      <button class="field-guide-snapshot-button" type="button" data-action="fieldGuidePrevSnapshot"${prevDisabled} aria-label="上一张照片">◀</button>
      <span class="field-guide-snapshot-page">${snapshotIndex + 1} / ${snapshotCount}</span>
      <button class="field-guide-snapshot-button" type="button" data-action="fieldGuideNextSnapshot"${nextDisabled} aria-label="下一张照片">▶</button>
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

export function renderFieldGuideCardDetailPanel(options = {}) {
  const escapeHtml = options.escapeHtml || ((value) => String(value || ""));
  return wrapNoteFolder(`
    <section class="field-guide-detail-view note-book-page note-card-detail-panel" aria-label="${escapeHtml(options.displayTitle)}卡牌详情">
      <div class="field-guide-detail-toolbar">
        <button class="field-guide-detail-back button-ghost" type="button" data-action="fieldGuideDetailBack">◀ 返回笔记</button>
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
      ${renderFieldGuideBottomCloseButton()}
    </section>
  `, { isEntering: Boolean(options.isEntering) });
}
