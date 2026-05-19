export function setupStageTabs(dom) {
  for (const [tab, button] of Object.entries(getTabButtons(dom))) {
    button?.addEventListener("click", () => setStageTab(dom, tab));
  }
}

export function setStageTab(dom, tab) {
  const views = getTabViews(dom);
  const buttons = getTabButtons(dom);
  for (const [key, view] of Object.entries(views)) {
    const active = key === tab;
    if (view) {
      view.hidden = !active;
      view.classList.toggle("is-active", active);
    }
    if (buttons[key]) {
      buttons[key].classList.toggle("active", active);
      buttons[key].setAttribute("aria-selected", String(active));
    }
  }
}

function getTabButtons(dom) {
  return {
    bot: dom.botViewTab,
    interaction: dom.interactionViewTab,
    cortex: dom.cortexViewTab,
    observatory: dom.observatoryViewTab,
    draw: dom.drawViewTab
  };
}

function getTabViews(dom) {
  return {
    bot: dom.botView,
    interaction: dom.interactionView,
    cortex: dom.cortexView,
    observatory: dom.observatoryView,
    draw: dom.drawView
  };
}
