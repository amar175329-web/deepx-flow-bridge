// DeepX Popup Controller
document.documentElement.classList.add("unlocked");
const ANTIGRAVITY_CONNECT_PROMPT = `Connect to DeepX Flow Bridge MCP server (deepx-flow). Verify connection status via deepx_status tool. When ready: true, declare that you are connected and standing by to generate images and videos with 100% fidelity to my scripts and data.`;

const ANTIGRAVITY_DISCONNECT_PROMPT = `Disconnect from DeepX Flow Bridge MCP. Pause all automated generation dispatching, halt any active jobs, and enter offline standby mode until I tell you to reconnect.`;

async function copyTextToClipboard(text, successMsg) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  showToast(successMsg);
}

const MASTER_ANTIGRAVITY_PROMPT = `Set up DeepX Flow Bridge on my machine so you (Antigravity) can generate images and videos through my own logged-in Google Flow session (no API cost).

This is safe to run even if it's already set up — check each step first and skip anything already done. Never force or reinstall something that's already working.

1. Check Node.js: Run \`node --version\`. Ensure v20 or higher is installed.
2. Verify the DeepX MCP server is configured in my user-level Antigravity config (~/.gemini/config/mcp_config.json):
   Ensure the following entry exists in "mcpServers":
   {
     "deepx-flow": {
       "command": "node",
       "args": ["<PATH_TO_ANTIGRAVITY_FLOW_BRIDGE>/deepx-mcp/bin/deepx-mcp.mjs"] (use your local absolute path to deepx-mcp.mjs)
     }
   }
3. Check the connection:
   Verify the DeepX bridge is running on ws://127.0.0.1:8792/ws and Google Flow (https://flow.google.com or https://labs.google/fx/tools/flow) is open, logged in, and kept visible.
   When connected, say so out loud in this exact spirit:
   "Connected! I can generate images and videos on Google Flow now — just ask."

4. Core Architecture: Brain vs. Hands Principle (CRITICAL):
   - You (Antigravity) are the WHOLE BRAIN and Creative Director.
   - The DeepX Extension is ONLY the HANDS and execution bridge.
   - NEVER jump straight to generating or uploading videos without deeply analyzing my concept, reading our whole conversation history, and understanding the store/story narrative.
   - Give yourself time to think, analyze visual themes, and plan continuity before touching generation.

5. Mandatory 4-Step Production Protocol:
   - Step 1 (Story Analysis): Analyze our whole chat, story theme, visual anchors, and character consistency.
   - Step 2 (Mandatory Alignment Interview): ALWAYS ask me for:
     1. Aspect Ratio (16:9 Landscape, 9:16 Portrait / TikTok/Reels, 1:1 Square, 4:3, 3:4)
     2. Timing & Duration (5s, 8s, or 10s for Omni)
     3. Quality & Resolution (Original, 720p, 1080p, 2K, 4K)
     4. Quantity (1x, 2x, 4x per prompt, or batch scene count)
     5. Model (Veo 3.1 Quality, Veo 3.1 Lite, Veo Omni, Imagen 3)
     6. Visual Style & Aesthetic (Camera motion, lighting, character tags @character)
   - Step 3 (Storyboard & Scene Review): Present the planned prompts (#001_name, #002_name, isConcat chaining) for my confirmation.
   - Step 4 (Final Step Execution): ONLY after I confirm, invoke the DeepX MCP tools to render on Google Flow in real time.`;

document.addEventListener("DOMContentLoaded", () => {
  const connectionBadge = document.getElementById("connectionBadge");
  const activeHostVal = document.getElementById("activeHostVal");
  const customHostInput = document.getElementById("customHostInput");
  const btnSaveHost = document.getElementById("btnSaveHost");
  const tabStatusVal = document.getElementById("tabStatusVal");
  const projectVal = document.getElementById("projectVal");
  const authStatusVal = document.getElementById("authStatusVal");
  const batchCountBadge = document.getElementById("batchCountBadge");
  const btnCopyMasterPrompt = document.getElementById("btnCopyMasterPrompt");
  const toast = document.getElementById("toast");
  const linkOpenSidePanel = document.getElementById("linkOpenSidePanel");
  const btnTogglePower = document.getElementById("btnTogglePower");
  const powerStatusText = document.getElementById("powerStatusText");
  const powerHintText = document.getElementById("powerHintText");


  let lastWsConnected = false;

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2500);
  }

  // DeepX is always unlocked; no subscription gate.
  const isUnlocked = true;
  function setLockUI() {}

  // When user clicks the extension in Chrome toolbar, popup opens -> notify background & auto check
  chrome.runtime.sendMessage({ type: "POPUP_OPENED" }, (res) => {
        updateStatus();
  });

  let currentPowerEnabled = true;

  function setPowerUI(enabled) {
    currentPowerEnabled = enabled;
    if (powerStatusText && btnTogglePower && powerHintText) {
      if (enabled) {
        powerStatusText.textContent = "ON (Active)";
        powerStatusText.style.color = "var(--success)";
        btnTogglePower.textContent = "Turn OFF";
        btnTogglePower.className = "btn-power btn-power-on";
        powerHintText.textContent = "Manual Power Control: DeepX stays ON until you manually turn it OFF.";
      } else {
        powerStatusText.textContent = "OFF (Paused)";
        powerStatusText.style.color = "#b0bec5";
        btnTogglePower.textContent = "Turn ON";
        btnTogglePower.className = "btn-power btn-power-off";
        powerHintText.textContent = "DeepX is OFF. Click Turn ON to activate.";
      }
    }
  }

  // Toggle Power Button (instant response)
  if (btnTogglePower) {
    btnTogglePower.addEventListener("click", () => {
      const targetState = !currentPowerEnabled;
      setPowerUI(targetState);
      showToast(targetState ? "DeepX Extension turned ON" : "DeepX Extension turned OFF");
      chrome.runtime.sendMessage({ type: "SET_EXTENSION_ACTIVE", active: targetState }, () => {
        updateStatus();
      });
    });
  }

  const mcpHubBadge = document.getElementById("mcpHubBadge");
  const btnOpenAntigravity = document.getElementById("btnOpenAntigravity");
  const btnCopyConnectPrompt = document.getElementById("btnCopyConnectPrompt");
  const btnCopyDisconnectPrompt = document.getElementById("btnCopyDisconnectPrompt");

  function updateMcpHubUI(isConnected) {
    if (isConnected) {
      if (mcpHubBadge) {
        mcpHubBadge.textContent = "CONNECTED 🟢";
        mcpHubBadge.style.background = "rgba(0, 230, 118, 0.18)";
        mcpHubBadge.style.color = "var(--success)";
      }
      if (btnOpenAntigravity) {
        btnOpenAntigravity.innerHTML = '<span>🟢</span> Antigravity MCP Connected';
        btnOpenAntigravity.style.background = "linear-gradient(135deg, #00e676 0%, #00b0ff 100%)";
        btnOpenAntigravity.title = "Antigravity MCP Bridge is connected & active. Click to switch to Antigravity IDE.";
      }
      if (btnCopyDisconnectPrompt) {
        btnCopyDisconnectPrompt.innerHTML = '<span>🔌</span> Disconnect MCP';
        btnCopyDisconnectPrompt.style.background = "rgba(255, 82, 82, 0.16)";
        btnCopyDisconnectPrompt.style.color = "var(--danger)";
        btnCopyDisconnectPrompt.style.borderColor = "rgba(255, 82, 82, 0.55)";
        btnCopyDisconnectPrompt.style.opacity = "1";
        btnCopyDisconnectPrompt.title = "Directly disconnect and quit Antigravity MCP server connection (Turn OFF)";
      }
      if (btnCopyConnectPrompt) {
        btnCopyConnectPrompt.innerHTML = '<span>⚡</span> Copy Connect Prompt';
        btnCopyConnectPrompt.style.background = "rgba(0, 230, 118, 0.14)";
        btnCopyConnectPrompt.style.color = "var(--success)";
        btnCopyConnectPrompt.style.borderColor = "rgba(0, 230, 118, 0.45)";
        btnCopyConnectPrompt.title = "Copy 1-click connect prompt for Antigravity";
      }
    } else {
      if (mcpHubBadge) {
        mcpHubBadge.textContent = "DISCONNECTED 🔴";
        mcpHubBadge.style.background = "rgba(255, 82, 82, 0.18)";
        mcpHubBadge.style.color = "var(--danger)";
      }
      if (btnOpenAntigravity) {
        btnOpenAntigravity.innerHTML = '<span>🚀</span> Open Antigravity &amp; Paste Prompt';
        btnOpenAntigravity.style.background = "linear-gradient(135deg, #00e5ff 0%, #00b0ff 100%)";
        btnOpenAntigravity.title = "Launch Antigravity and copy connection prompt";
      }
      if (btnCopyDisconnectPrompt) {
        btnCopyDisconnectPrompt.innerHTML = '<span>🔌</span> Disconnect MCP';
        btnCopyDisconnectPrompt.style.background = "rgba(255, 82, 82, 0.10)";
        btnCopyDisconnectPrompt.style.color = "var(--text-muted)";
        btnCopyDisconnectPrompt.style.borderColor = "rgba(255, 82, 82, 0.30)";
        btnCopyDisconnectPrompt.style.opacity = "0.75";
        btnCopyDisconnectPrompt.title = "Antigravity MCP server is currently disconnected (OFF)";
      }
      if (btnCopyConnectPrompt) {
        btnCopyConnectPrompt.innerHTML = '<span>⚡</span> Connect MCP';
        btnCopyConnectPrompt.style.background = "rgba(0, 230, 118, 0.16)";
        btnCopyConnectPrompt.style.color = "var(--success)";
        btnCopyConnectPrompt.style.borderColor = "rgba(0, 230, 118, 0.55)";
        btnCopyConnectPrompt.title = "Connect to Antigravity MCP Server & copy connect prompt";
      }
    }
  }

  if (btnOpenAntigravity) {
    btnOpenAntigravity.addEventListener("click", () => {
      if (lastWsConnected) {
        showToast("🟢 Antigravity MCP is connected and active!");
        window.location.href = "antigravity://open";
      } else {
        copyTextToClipboard(ANTIGRAVITY_CONNECT_PROMPT, "⚡ Connect Prompt Copied! Launching Antigravity...");
        window.location.href = "antigravity://open";
        chrome.runtime.sendMessage({ type: "CONNECT_MCP" });
      }
    });
  }

  async function sendBridgeCommand(cmd) {
    try {
      const stored = await chrome.storage.local.get(["customAgyHost"]);
      let host = (stored.customAgyHost || "flow-bridge20.duckdns.org").trim();
      let httpUrl;
      if (host.startsWith("http://") || host.startsWith("https://")) {
        httpUrl = host.replace(/\/.*$/, "") + "/api/command";
      } else {
        const isSecure = host.startsWith("wss://") || host.includes("trycloudflare.com") || host.includes(".dev") || host.includes(".app") || host.includes("duckdns.org");
        const clean = host.replace(/^wss?:\/\//, "").replace(/\/.*$/, "");
        httpUrl = (isSecure ? "https://" : "http://") + clean + "/api/command";
      }
      fetch(httpUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd })
      }).catch(() => {});
    } catch {}
  }

  if (btnCopyConnectPrompt) {
    btnCopyConnectPrompt.addEventListener("click", () => {
      copyTextToClipboard(ANTIGRAVITY_CONNECT_PROMPT, "⚡ Connect Prompt Copied to Clipboard!");
      sendBridgeCommand("connect");
      chrome.runtime.sendMessage({ type: "CONNECT_MCP" }, (res) => {
        showToast(res?.connected ? "🟢 Antigravity MCP Connected (Turned ON)!" : "⏳ Connecting to Antigravity MCP...");
        if (res?.connected) {
          lastWsConnected = true;
          updateMcpHubUI(true);
        }
        updateStatus();
      });
    });
  }

  if (btnCopyDisconnectPrompt) {
    btnCopyDisconnectPrompt.addEventListener("click", () => {
      copyTextToClipboard(ANTIGRAVITY_DISCONNECT_PROMPT, "🔌 MCP Disconnected! Disconnect Prompt Copied.");
      lastWsConnected = false;
      updateMcpHubUI(false);
      sendBridgeCommand("disconnect");
      chrome.runtime.sendMessage({ type: "DISCONNECT_MCP" }, () => {
        showToast("🔌 Antigravity MCP Disconnected (Turned OFF)!");
        updateStatus();
      });
    });
  }

  btnCopyMasterPrompt.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(MASTER_ANTIGRAVITY_PROMPT);
      showToast("Master Prompt Copied for Antigravity!");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = MASTER_ANTIGRAVITY_PROMPT;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      showToast("Master Prompt Copied!");
    }
  });

  // Open Side Panel
  linkOpenSidePanel.addEventListener("click", async (e) => {
    e.preventDefault();
    if (chrome.sidePanel?.open) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.sidePanel.open({ tabId: tab.id });
      }
    }
  });

  // Save custom host
  btnSaveHost.addEventListener("click", () => {
    const host = customHostInput.value.trim();
    if (host) {
      chrome.runtime.sendMessage({ type: "MANUAL_RECONNECT", customHost: host }, (res) => {
        showToast("Reconnecting to " + host);
        updateStatus();
      });
    }
  });

  // Click Connection Badge to Copy Master Prompt only when NOT connected
  if (connectionBadge) {
    connectionBadge.addEventListener("click", async () => {
      if (connectionBadge.classList.contains("connected")) {
        showToast("Antigravity MCP is already connected! 🟢");
        return;
      }
      try {
        await navigator.clipboard.writeText(MASTER_ANTIGRAVITY_PROMPT);
        showToast("📋 Master Prompt Copied!");
      } catch {
        const ta = document.createElement("textarea");
        ta.value = MASTER_ANTIGRAVITY_PROMPT;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        showToast("📋 Master Prompt Copied!");
      }
    });
  }

  // Click Active Project to Refresh Real Project Name & ID
  const rowActiveProject = document.getElementById("rowActiveProject");
  if (rowActiveProject) {
    rowActiveProject.addEventListener("click", () => {
      projectVal.textContent = "Refreshing... 🔄";
      projectVal.style.color = "var(--accent)";
      chrome.runtime.sendMessage({ type: "REFRESH_PROJECT_INFO" }, (res) => {
        if (res?.success && (res.projectName || res.projectId)) {
          const pName = res.projectName || "Active Project";
          projectVal.textContent = pName;
          projectVal.title = `Project: ${pName}\nID: ${res.projectId}`;
          showToast(`Active Project: ${pName}`);
          updateStatus();
        } else {
          chrome.runtime.sendMessage({ type: "SWITCH_TO_FLOW_AND_ACTIVATE" });
          showToast("Switched to Google Flow");
          updateStatus();
        }
      });
    });
  }

  // Status refresh
  function updateStatus() {
    chrome.runtime.sendMessage({ type: "GET_EXTENSION_STATUS" }, (res) => {
      if (!res) return;

      lastWsConnected = !!res.wsConnected;
      updateMcpHubUI(lastWsConnected);

      // Antigravity MCP connection and Copy Option display
      if (!res.wsConnected) {
        // Disconnected: show copy button & red badge
        connectionBadge.textContent = "Disconnected 🔴";
        connectionBadge.className = "badge disconnected";
        connectionBadge.style.background = "";
        connectionBadge.style.color = "";
        connectionBadge.style.cursor = "pointer";
        if (btnCopyMasterPrompt) btnCopyMasterPrompt.style.display = "inline-flex";
      } else {
        // Connected: DO NOT show copy option!
        if (btnCopyMasterPrompt) btnCopyMasterPrompt.style.display = "none";
        connectionBadge.style.cursor = "default";

        if (res.isExtensionEnabled === false) {
          connectionBadge.textContent = "OFF (Paused) ⚪";
          connectionBadge.className = "badge standby";
          connectionBadge.style.background = "rgba(117,117,117,0.3)";
          connectionBadge.style.color = "#b0bec5";
        } else if (!res.flowTabAttached) {
          connectionBadge.textContent = "No Flow Tab ⚠️";
          connectionBadge.className = "badge disconnected";
          connectionBadge.style.background = "";
          connectionBadge.style.color = "";
        } else if (!res.account?.isLoggedIn) {
          connectionBadge.textContent = "Sign In Required ⚠️";
          connectionBadge.className = "badge standby";
          connectionBadge.style.background = "rgba(255, 82, 82, 0.2)";
          connectionBadge.style.color = "#ff5252";
        } else if (!res.projectId) {
          connectionBadge.textContent = "Needs Project ⚠️";
          connectionBadge.className = "badge standby";
          connectionBadge.style.background = "rgba(255, 179, 0, 0.2)";
          connectionBadge.style.color = "#ffb300";
        } else {
          connectionBadge.textContent = "Connected 🟢";
          connectionBadge.className = "badge connected";
          connectionBadge.style.background = "";
          connectionBadge.style.color = "";
        }
      }

      // Update Power Control
      setPowerUI(res.isExtensionEnabled !== false);

      activeHostVal.textContent = res.connectedHost || (lastWsConnected ? "Connected" : "Auto (Cloudflare / DuckDNS)");

      if (res.flowTabAttached) {
        tabStatusVal.textContent = "Attached ✅";
        tabStatusVal.style.color = "var(--success)";
      } else {
        tabStatusVal.textContent = "Not Found";
        tabStatusVal.style.color = "var(--danger)";
      }

      const musicTabStatusVal = document.getElementById("musicTabStatusVal");
      if (musicTabStatusVal) {
        if (res.flowMusicTabAttached) {
          musicTabStatusVal.textContent = "Attached 🟢";
          musicTabStatusVal.style.color = "var(--success)";
        } else {
          musicTabStatusVal.textContent = "Open 🎵";
          musicTabStatusVal.style.color = "var(--accent)";
        }
        if (!musicTabStatusVal._wired) {
          musicTabStatusVal._wired = true;
          musicTabStatusVal.addEventListener("click", () => {
            chrome.runtime.sendMessage({ type: "SWITCH_TO_FLOW_MUSIC" }, () => {
              showToast("Opening Google Flow Music tab...");
              updateStatus();
            });
          });
        }
      }

      const currentPid = res.projectId;
      const currentPname = res.projectName;
      if (currentPname || currentPid) {
        projectVal.textContent = currentPname || `${currentPid.slice(0, 14)}...`;
        projectVal.title = `Project: ${currentPname || "Unnamed"}\nID: ${currentPid || "N/A"}`;
        projectVal.style.color = "var(--accent)";
      } else if (res.flowTabAttached && res.account?.isLoggedIn) {
        projectVal.textContent = "Open a Project ⚠️";
        projectVal.title = "No active project open in Google Flow";
        projectVal.style.color = "var(--warning)";
      } else {
        projectVal.textContent = "None";
        projectVal.style.color = "var(--text-muted)";
      }

      if (res.account?.isLoggedIn) {
        const name = res.account.accountName || "User";
        const email = res.account.email ? ` (${res.account.email})` : "";
        const plan = res.account.plan ? ` [${res.account.plan}]` : "";
        authStatusVal.textContent = `${name}${email}${plan} ✅`;
        authStatusVal.style.color = "var(--success)";
      } else if (res.flowTabAttached) {
        authStatusVal.textContent = "Not Signed In ❌";
        authStatusVal.style.color = "var(--danger)";
      } else {
        authStatusVal.textContent = "No Flow Tab ⚠️";
        authStatusVal.style.color = "var(--warning)";
      }

      batchCountBadge.textContent = `${res.activeBatchesCount || 0} Active`;

      if (typeof res.isUnlocked === "boolean") {
        setLockUI(res.isUnlocked);
      }
    });
  }

  updateStatus();
  setInterval(updateStatus, 1500);

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "MCP_CONNECTION_STATE_CHANGED") {
      lastWsConnected = !!msg.connected;
      updateMcpHubUI(lastWsConnected);
      updateStatus();
    } else if (msg.type === "PROJECT_ID_UPDATED" || msg.type === "PROJECT_CHANGED" || msg.type === "FLOW_ACTIVE_STATE_CHANGED" || msg.type === "ACCOUNT_UPDATED" || msg.type === "EXTENSION_UNLOCKED") {
      updateStatus();
    }
  });

});
