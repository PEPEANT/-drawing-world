let socket = null;

export function connectAdmin(key, handlers) {
  if (socket) {
    socket.close();
  }

  const protocol = location.protocol === "https:" ? "wss" : "ws";
  socket = new WebSocket(`${protocol}://${location.host}/admin-ws?key=${encodeURIComponent(key)}`);

  socket.addEventListener("open", handlers.onOpen);
  socket.addEventListener("close", handlers.onClose);
  socket.addEventListener("message", (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }

    if (message.type === "error") {
      handlers.onError(message.message);
      return;
    }

    if (message.type === "state") {
      handlers.onState(message.state);
      return;
    }

    if (message.type === "snapshotSaved") {
      handlers.onSnapshotSaved?.(message.snapshot);
      return;
    }

    if (message.type === "snapshotError") {
      handlers.onSnapshotError?.(message.message);
      return;
    }

    if (message.type === "analyticsBackup") {
      handlers.onAnalyticsBackup?.(message.backup);
      return;
    }

    if (message.type === "analyticsRestored") {
      handlers.onAnalyticsRestored?.(message.backup);
      return;
    }

    if (message.type === "analyticsError") {
      handlers.onAnalyticsError?.(message.message);
      return;
    }

    if (message.type === "fullBackupExported") {
      handlers.onFullBackupExported?.(message.backup);
      return;
    }

    if (message.type === "fullBackupSaved") {
      handlers.onFullBackupSaved?.(message);
      return;
    }

    if (message.type === "fullBackupRestored") {
      handlers.onFullBackupRestored?.(message.result);
      return;
    }

    if (message.type === "fullBackupError") {
      handlers.onFullBackupError?.(message.message);
    }
  });
}

export function sendAdmin(payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}
