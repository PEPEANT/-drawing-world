export function downloadSnapshot(snapshot) {
  if (!snapshot?.id) return "";
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${snapshot.day || "drawing"}-${snapshot.room || "room"}-snapshot.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return `${snapshot.day} 그림 ${snapshot.strokeCount || 0}선을 JSON으로 저장했어.`;
}
