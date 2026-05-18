import { WORLD } from "./config.js";

const billboardImage = new Image();
billboardImage.src = "/assets/simulacre-billboard.png";

export const BILLBOARD = {
  x: 1600,
  y: WORLD.height + 220,
  width: 1100,
  height: 350
};

export function drawBillboard(ctx, view) {
  if (view && !rectIntersectsView(getBillboardRect(), view)) return;
  const x = BILLBOARD.x - BILLBOARD.width / 2;
  const y = BILLBOARD.y - BILLBOARD.height / 2;
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 4;
  roundRect(ctx, x, y, BILLBOARD.width, BILLBOARD.height, 10);
  ctx.clip();
  if (billboardImage.complete && billboardImage.naturalWidth > 0) {
    ctx.drawImage(billboardImage, x, y, BILLBOARD.width, BILLBOARD.height);
  } else {
    drawFallback(ctx, x, y);
  }
  ctx.restore();
}

function getBillboardRect() {
  return {
    left: BILLBOARD.x - BILLBOARD.width / 2,
    right: BILLBOARD.x + BILLBOARD.width / 2,
    top: BILLBOARD.y - BILLBOARD.height / 2,
    bottom: BILLBOARD.y + BILLBOARD.height / 2
  };
}

function rectIntersectsView(rect, view) {
  return rect.left <= view.right && rect.right >= view.left && rect.top <= view.bottom && rect.bottom >= view.top;
}

export async function ensureBillboardReady() {
  if (billboardImage.complete && billboardImage.naturalWidth > 0) return;
  if ("decode" in billboardImage) {
    await billboardImage.decode().catch(() => {});
    return;
  }
  await new Promise((resolve) => {
    billboardImage.onload = resolve;
    billboardImage.onerror = resolve;
  });
}

function drawFallback(ctx, x, y) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, BILLBOARD.width, BILLBOARD.height);
  ctx.fillStyle = "#111827";
  ctx.font = "72px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("simulacre.com", BILLBOARD.x, BILLBOARD.y);
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.fill();
  ctx.stroke();
}
