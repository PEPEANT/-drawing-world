export function setupChoiceButtons(onChoice) {
  for (const button of getChoiceButtons()) {
    button.addEventListener("click", () => {
      onChoice({
        action: button.dataset.action || "",
        text: button.dataset.choice || button.textContent.trim()
      });
    });
  }
}

export function setChoiceButtonsEnabled(enabled) {
  for (const button of getChoiceButtons()) {
    button.disabled = !enabled;
  }
}

function getChoiceButtons() {
  return Array.from(document.querySelectorAll("[data-choice]"));
}
