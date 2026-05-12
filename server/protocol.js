function send(ws, payload) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcast(room, payload, except) {
  const message = JSON.stringify(payload);
  for (const client of room.clients) {
    if (client !== except && client.readyState === client.OPEN) {
      client.send(message);
    }
  }
}

module.exports = {
  broadcast,
  send
};
