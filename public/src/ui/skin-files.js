export function saveSkinPng(canvas, player, savePlayerIdentity) {
  player.skin = canvas.toDataURL("image/png");
  savePlayerIdentity(player);

  const link = document.createElement("a");
  link.href = player.skin;
  link.download = "drawing-online-skin.png";
  link.click();
}

export function loadSkinImageFile(file, canvas, size) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("invalid image"));
      return;
    }

    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, size, size);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image load failed"));
    };
    image.src = url;
  });
}
