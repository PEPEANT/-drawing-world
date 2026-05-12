import { ui } from "./dom.js";

let hue = 0;
let sat = 0;
let val = 0;

export function initColorPicker() {
  ({ hue, sat, val } = hexToHsv(ui.colorInput.value || "#111827"));
  syncColorPicker();
  bindColorCanvas(ui.colorAreaCanvas, pickColorArea);
  bindColorCanvas(ui.colorHueCanvas, pickHue);

  ui.colorInput.addEventListener("input", () => {
    ({ hue, sat, val } = hexToHsv(ui.colorInput.value));
    syncColorPicker();
  });
}

export function syncColorPicker() {
  drawHue();
  drawColorArea();
  const hex = hsvToHex(hue, sat, val);
  ui.colorHexOutput.value = hex.toUpperCase();
  ui.colorPreview.style.background = hex;
}

function bindColorCanvas(canvas, handler) {
  canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture(event.pointerId);
    handler(event);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (event.buttons !== 1) return;
    handler(event);
  });
}

function pickColorArea(event) {
  const point = getCanvasPoint(ui.colorAreaCanvas, event);
  sat = clamp(point.x / ui.colorAreaCanvas.width);
  val = clamp(1 - point.y / ui.colorAreaCanvas.height);
  commitColor();
}

function pickHue(event) {
  const point = getCanvasPoint(ui.colorHueCanvas, event);
  hue = clamp(point.y / ui.colorHueCanvas.height) * 360;
  commitColor();
}

function commitColor() {
  ui.colorInput.value = hsvToHex(hue, sat, val);
  ui.colorInput.dispatchEvent(new Event("input", { bubbles: true }));
}

function drawHue() {
  const ctx = ui.colorHueCanvas.getContext("2d");
  const { width, height } = ui.colorHueCanvas;
  for (let y = 0; y < height; y += 1) {
    ctx.fillStyle = `hsl(${(y / height) * 360}, 100%, 50%)`;
    ctx.fillRect(0, y, width, 1);
  }
  drawMarker(ctx, width / 2, (hue / 360) * height, width - 5);
}

function drawColorArea() {
  const ctx = ui.colorAreaCanvas.getContext("2d");
  const { width, height } = ui.colorAreaCanvas;
  ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
  ctx.fillRect(0, 0, width, height);

  const white = ctx.createLinearGradient(0, 0, width, 0);
  white.addColorStop(0, "#ffffff");
  white.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = white;
  ctx.fillRect(0, 0, width, height);

  const black = ctx.createLinearGradient(0, 0, 0, height);
  black.addColorStop(0, "rgba(0,0,0,0)");
  black.addColorStop(1, "#000000");
  ctx.fillStyle = black;
  ctx.fillRect(0, 0, width, height);
  drawMarker(ctx, sat * width, (1 - val) * height, 12);
}

function drawMarker(ctx, x, y, radius) {
  ctx.save();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function getCanvasPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / rect.width) * canvas.width,
    y: clamp((event.clientY - rect.top) / rect.height) * canvas.height
  };
}

function hexToHsv(hex) {
  const rgb = hexToRgb(hex);
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let nextHue = 0;

  if (delta && max === r) nextHue = 60 * (((g - b) / delta) % 6);
  if (delta && max === g) nextHue = 60 * ((b - r) / delta + 2);
  if (delta && max === b) nextHue = 60 * ((r - g) / delta + 4);
  if (nextHue < 0) nextHue += 360;

  return {
    hue: nextHue,
    sat: max === 0 ? 0 : delta / max,
    val: max
  };
}

function hsvToHex(nextHue, nextSat, nextVal) {
  const c = nextVal * nextSat;
  const x = c * (1 - Math.abs(((nextHue / 60) % 2) - 1));
  const m = nextVal - c;
  const [r, g, b] = getRgbParts(nextHue, c, x).map((part) => Math.round((part + m) * 255));
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function getRgbParts(nextHue, c, x) {
  if (nextHue < 60) return [c, x, 0];
  if (nextHue < 120) return [x, c, 0];
  if (nextHue < 180) return [0, c, x];
  if (nextHue < 240) return [0, x, c];
  if (nextHue < 300) return [x, 0, c];
  return [c, 0, x];
}

function hexToRgb(hex) {
  const safe = /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#111827";
  return {
    r: Number.parseInt(safe.slice(1, 3), 16),
    g: Number.parseInt(safe.slice(3, 5), 16),
    b: Number.parseInt(safe.slice(5, 7), 16)
  };
}

function toHex(value) {
  return value.toString(16).padStart(2, "0");
}

function clamp(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}
