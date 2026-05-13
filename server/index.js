const { PORT } = require("./config");
const { attachAdminSocket } = require("./admin");
const { createHttpServer } = require("./http");
const { attachGameSocket } = require("./websocket");

const server = createHttpServer();
attachGameSocket(server);
attachAdminSocket(server);

server.listen(PORT, () => {
  console.log(`시뮬라크월드 PvP 아레나 running at http://localhost:${PORT}`);
});
