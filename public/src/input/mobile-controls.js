import { state } from "../state.js";
import { ui } from "../ui/dom.js";

const maxDistance = 46;
let joystickPointerId = null;

export function bindMobileControls() {
  if (!ui.joystickBase) return;
  ui.joystickBase.addEventListener("pointerdown", startJoystick);
  ui.joystickBase.addEventListener("pointermove", moveJoystick);
  ui.joystickBase.addEventListener("pointerup", stopJoystick);
  ui.joystickBase.addEventListener("pointercancel", stopJoystick);
}

function startJoystick(event) {
  joystickPointerId = event.pointerId;
  ui.joystickBase.setPointerCapture(joystickPointerId);
  moveJoystick(event);
}

function moveJoystick(event) {
  if (event.pointerId !== joystickPointerId) return;
  const rect = ui.joystickBase.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const rawX = event.clientX - centerX;
  const rawY = event.clientY - centerY;
  const distance = Math.min(maxDistance, Math.hypot(rawX, rawY));
  const angle = Math.atan2(rawY, rawX);
  const x = Math.cos(angle) * distance;
  const y = Math.sin(angle) * distance;

  state.mobileMove.x = x / maxDistance;
  state.mobileMove.y = y / maxDistance;
  ui.joystickKnob.style.transform = `translate(${x}px, ${y}px)`;
}

function stopJoystick(event) {
  if (event.pointerId !== joystickPointerId) return;
  joystickPointerId = null;
  state.mobileMove.x = 0;
  state.mobileMove.y = 0;
  ui.joystickKnob.style.transform = "translate(0, 0)";
}
