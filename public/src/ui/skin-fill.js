export function fillSkinArea(ctx, x, y, color) {
  const image = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  const target = getPixel(image, x, y);
  const next = hexToRgba(color);
  if (sameColor(target, next)) return false;

  const stack = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop();
    if (cx < 0 || cy < 0 || cx >= image.width || cy >= image.height) continue;
    if (!sameColor(getPixel(image, cx, cy), target)) continue;
    setPixel(image, cx, cy, next);
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  ctx.putImageData(image, 0, 0);
  return true;
}

function getPixel(image, x, y) {
  const index = (y * image.width + x) * 4;
  return image.data.slice(index, index + 4);
}

function setPixel(image, x, y, color) {
  const index = (y * image.width + x) * 4;
  for (let offset = 0; offset < 4; offset += 1) image.data[index + offset] = color[offset];
}

function sameColor(a, b) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

function hexToRgba(hex) {
  const value = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : "111827";
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
    255
  ];
}
