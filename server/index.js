const { PORT } = require("./config");
const { attachAdminSocket } = require("./admin");
const { createHttpServer } = require("./http");
const { attachGameSocket } = require("./websocket");
const { startFullBackupSweep } = require("./full-backup");

const server = createHttpServer();
attachGameSocket(server);
attachAdminSocket(server);
startFullBackupSweep();

server.listen(PORT, () => {
  console.log(`드로잉온라인 running at http://localhost:${PORT}`);
});
