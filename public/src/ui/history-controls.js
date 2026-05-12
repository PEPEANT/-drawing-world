import { canRedo, canUndo, redoLastAction, undoLastAction } from "../history.js";
import { ui } from "./dom.js";

export function initHistoryControls() {
  bindHistoryButton(ui.undoButton, undoLastAction);
  bindHistoryButton(ui.mobileUndoButton, undoLastAction);
  bindHistoryButton(ui.redoButton, redoLastAction);
  bindHistoryButton(ui.mobileRedoButton, redoLastAction);
  window.addEventListener("historychanged", syncHistoryButtons);
  syncHistoryButtons();
}

function bindHistoryButton(button, action) {
  button?.addEventListener("click", action);
}

function syncHistoryButtons() {
  setDisabled([ui.undoButton, ui.mobileUndoButton], !canUndo());
  setDisabled([ui.redoButton, ui.mobileRedoButton], !canRedo());
}

function setDisabled(buttons, disabled) {
  for (const button of buttons) {
    if (button) button.disabled = disabled;
  }
}
