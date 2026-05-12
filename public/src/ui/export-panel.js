import { exportDrawing } from "../export-render.js";
import { ui } from "./dom.js";

let selectedFormat = "png";

export function initExportPanel() {
  ui.exportToggle.addEventListener("click", toggleExportPanel);
  ui.exportCloseButton.addEventListener("click", closeExportPanel);
  ui.exportPanel.addEventListener("click", async (event) => {
    const formatButton = event.target.closest("button[data-export-format-choice]");
    if (formatButton) {
      selectFormat(formatButton.dataset.exportFormatChoice);
      return;
    }

    const exportButton = event.target.closest("button[data-export-scope]");
    if (!exportButton) return;
    await saveDrawing(exportButton.dataset.exportScope);
  });
}

function toggleExportPanel() {
  ui.exportPanel.classList.toggle("hidden");
  ui.exportToggle.classList.toggle("active", !ui.exportPanel.classList.contains("hidden"));
}

function closeExportPanel() {
  ui.exportPanel.classList.add("hidden");
  ui.exportToggle.classList.remove("active");
}

function selectFormat(format) {
  selectedFormat = format === "jpg" ? "jpg" : "png";
  for (const button of ui.exportPanel.querySelectorAll("[data-export-format-choice]")) {
    button.classList.toggle("active", button.dataset.exportFormatChoice === selectedFormat);
  }
}

async function saveDrawing(scope) {
  try {
    showExportStatus("저장 중");
    await exportDrawing(scope, selectedFormat);
    showExportStatus("저장 완료");
  } catch (error) {
    if (error?.name === "AbortError") {
      showExportStatus("");
      return;
    }
    showExportStatus("저장 실패");
  }
}

function showExportStatus(text) {
  ui.exportStatus.textContent = text;
  window.setTimeout(() => {
    if (ui.exportStatus.textContent === text) {
      ui.exportStatus.textContent = "";
    }
  }, 1800);
}
