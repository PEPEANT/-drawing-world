export function setupCortexModal(dom) {
  if (!dom.cortexExpandButton || !dom.cortexModal || !dom.cortexModalBody || !dom.neuralDemo) return;

  dom.cortexExpandButton.addEventListener("click", () => openCortexModal(dom));
  dom.cortexCloseButton?.addEventListener("click", () => closeCortexModal(dom));
  dom.cortexModal.querySelector("[data-cortex-close]")?.addEventListener("click", () => closeCortexModal(dom));
}

function openCortexModal(dom) {
  dom.cortexModal.hidden = false;
  dom.cortexModalBody.appendChild(dom.neuralDemo);
  document.body.classList.add("cortex-modal-open");
}

function closeCortexModal(dom) {
  dom.cortexModal.hidden = true;
  dom.neuralHome.after(dom.neuralDemo);
  document.body.classList.remove("cortex-modal-open");
}
