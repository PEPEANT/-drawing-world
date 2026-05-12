import { WORLD } from "./config.js";
import { drawBillboard, ensureBillboardReady } from "./billboard.js";
import { drawItems } from "./item-render.js";
import { drawLayeredStrokes } from "./layer-render.js";
import { state } from "./state.js";
import { drawStroke } from "./stroke-render.js";

const GRID_SIZE = 80;
const JPEG_QUALITY = 0.92;

export async function exportDrawing(scope, format) {
  await ensureBillboardReady();
  const setup = scope === "full" ? getFullExportSetup() : getViewportExportSetup();
  const canvas = document.createElement("canvas");
  canvas.width = setup.width;
  canvas.height = setup.height;

  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(setup.scale, 0, 0, setup.scale, setup.offsetX, setup.offsetY);
  drawPaper(ctx, setup.view, setup.zoom);
  drawLayeredStrokes(ctx, drawStroke);
  drawItems(ctx);
  const blob = await canvasToBlob(canvas, format);
  await saveBlob(blob, scope, format);
}

function getFullExportSetup() {
  return {
    width: WORLD.width,
    height: WORLD.height,
    scale: 1,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    view: { left: 0, top: 0, right: WORLD.width, bottom: WORLD.height }
  };
}

function getViewportExportSetup() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.floor(state.viewport.width * dpr);
  const height = Math.floor(state.viewport.height * dpr);
  const zoom = state.camera.zoom;
  return {
    width,
    height,
    scale: dpr * zoom,
    zoom,
    offsetX: dpr * (state.viewport.width / 2 - state.camera.x * zoom),
    offsetY: dpr * (state.viewport.height / 2 - state.camera.y * zoom),
    view: {
      left: state.camera.x - state.viewport.width / (2 * zoom),
      right: state.camera.x + state.viewport.width / (2 * zoom),
      top: state.camera.y - state.viewport.height / (2 * zoom),
      bottom: state.camera.y + state.viewport.height / (2 * zoom)
    }
  };
}

function drawPaper(ctx, view, zoom) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.strokeStyle = "#eef2f7";
  ctx.lineWidth = 1 / zoom;
  const startX = Math.floor(view.left / GRID_SIZE) * GRID_SIZE;
  const endX = Math.ceil(view.right / GRID_SIZE) * GRID_SIZE;
  const startY = Math.floor(view.top / GRID_SIZE) * GRID_SIZE;
  const endY = Math.ceil(view.bottom / GRID_SIZE) * GRID_SIZE;

  ctx.beginPath();
  for (let x = startX; x <= endX; x += GRID_SIZE) {
    ctx.moveTo(x, Math.max(0, startY));
    ctx.lineTo(x, Math.min(WORLD.height, endY));
  }
  for (let y = startY; y <= endY; y += GRID_SIZE) {
    ctx.moveTo(Math.max(0, startX), y);
    ctx.lineTo(Math.min(WORLD.width, endX), y);
  }
  ctx.stroke();
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 3 / zoom;
  ctx.strokeRect(0, 0, WORLD.width, WORLD.height);
  drawBillboard(ctx);
}

function canvasToBlob(canvas, format) {
  const isJpeg = format === "jpg";
  const mime = isJpeg ? "image/jpeg" : "image/png";
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("export failed")),
      mime,
      isJpeg ? JPEG_QUALITY : undefined
    );
  });
}

async function saveBlob(blob, scope, format) {
  const fileName = `drawing-online-${scope}-${timestamp()}.${format === "jpg" ? "jpg" : "png"}`;
  if ("showSaveFilePicker" in window) {
    const handle = await window.showSaveFilePicker({
      suggestedName: fileName,
      types: [getPickerType(format)]
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }

  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
}

function getPickerType(format) {
  if (format === "jpg") {
    return {
      description: "JPG image",
      accept: { "image/jpeg": [".jpg", ".jpeg"] }
    };
  }
  return {
    description: "PNG image",
    accept: { "image/png": [".png"] }
  };
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}
