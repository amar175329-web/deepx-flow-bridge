#!/usr/bin/env node

import { DeepXWsBridge } from "../src/ws-bridge.js";

const port = parseInt(process.env.DEEPX_PORT || "8792", 10);
const bridge = new DeepXWsBridge(port);

async function main() {
  await bridge.start();
  console.log(`[DeepX Bridge] Persistent daemon running on http://127.0.0.1:${port} & ws://127.0.0.1:${port}/ws`);
}

main().catch((err) => {
  console.error("[DeepX Bridge] Startup error:", err);
  process.exit(1);
});
