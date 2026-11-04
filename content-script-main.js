(() => {
  "use strict";

  if (window.__deepxMainLoaded) return;
  window.__deepxMainLoaded = true;

  console.log("%c[DeepX Flow]%c Main-world acceleration & UI knowledge engine loaded.", "color:#00e5ff;font-weight:bold;", "color:inherit;");

  let capturedAuthToken = null;
  let capturedProjectId = null;
  let lastKnownProjectId = null;

  function extractProjectId(str) {
    if (!str || typeof str !== "string") return null;
    // URL path patterns: /projects/<id> or /project/<id>
    const mPath = str.match(/projects?\/([a-zA-Z0-9_-]{6,})/i);
    if (mPath && !["new", "all", "recent", "templates", "trash"].includes(mPath[1].toLowerCase())) {
      return mPath[1];
    }
    // Query parameter patterns: ?project=<id> or ?projectId=<id>
    const mQuery = str.match(/[?&](?:project|projectId|project_id)=([a-zA-Z0-9_-]{6,})/i);
    if (mQuery) return mQuery[1];
    // JSON body patterns: "projectId": "<id>"
    const mJson = str.match(/"projectId"\s*:\s*"([a-zA-Z0-9_-]{6,})"/i);
    if (mJson) return mJson[1];
    return null;
  }

  let lastKnownProjectName = null;
  function getProjectName() {
    const heading = document.querySelector(".header-title-heading, [data-project-name], header .project-name")?.textContent?.trim();
    const inputVal = document.querySelector(".header-title input, flow-editable-text input, input[aria-label*='Project name' i], input[aria-label*='project title' i]")?.value?.trim();
    const titleClean = (document.title || "")
      .replace(/^Google Flow\s*[–—\-]\s*/i, "")
      .replace(/\s*[–—\-]\s*Google Flow.*$/i, "")
      .trim();

    if (heading && !["google flow", "flow"].includes(heading.toLowerCase())) return heading;
    if (inputVal && !["google flow", "flow"].includes(inputVal.toLowerCase())) return inputVal;
    if (titleClean && !["google flow", "flow", "home", "projects", "new project"].includes(titleClean.toLowerCase())) return titleClean;
    return null;
  }

  function notifyProjectIfChanged(newId) {
    if (newId && typeof newId === "string" && ["new", "all", "recent", "templates", "trash"].includes(newId.toLowerCase())) {
      newId = null;
    }
    const currentName = getProjectName();
    if (newId !== lastKnownProjectId || (currentName && currentName !== lastKnownProjectName)) {
      lastKnownProjectId = newId || null;
      lastKnownProjectName = currentName || lastKnownProjectName;
      capturedProjectId = newId || null;
      console.log("%c[DeepX Flow]%c Active Project updated:", "color:#00e5ff;font-weight:bold;", "color:#00e676;", newId || "None", currentName ? `(${currentName})` : "");
      window.postMessage({
        type: "DEEPX_PROJECT_CHANGED",
        projectId: newId || null,
        projectName: currentName || lastKnownProjectName,
        url: window.location.href
      }, "*");
    }
  }

  // 1. Network Sniffer: intercept fetch and XMLHttpRequest to automatically capture Bearer token & Project ID
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    try {
      const [resource, config] = args;
      const urlStr = typeof resource === "string" ? resource : (resource?.url || "");
      if (urlStr) {
        const pFromUrl = extractProjectId(urlStr);
        if (pFromUrl) notifyProjectIfChanged(pFromUrl);
      }
      if (typeof config?.body === "string") {
        const pFromBody = extractProjectId(config.body);
        if (pFromBody) notifyProjectIfChanged(pFromBody);
      }

      const headers = config?.headers;
      if (headers) {
        let auth = null;
        if (headers instanceof Headers) {
          auth = headers.get("Authorization") || headers.get("authorization");
        } else if (typeof headers === "object") {
          auth = headers["Authorization"] || headers["authorization"];
        }
        if (auth && typeof auth === "string" && auth.startsWith("Bearer ")) {
          capturedAuthToken = auth.replace(/^Bearer\s+/i, "");
          window.postMessage({ type: "DEEPX_AUTH_TOKEN_CAPTURED", token: capturedAuthToken }, "*");
        }
      }
    } catch {}
    return originalFetch.apply(this, args);
  };

  const origXhrOpen = XMLHttpRequest.prototype.open;
  const origXhrSend = XMLHttpRequest.prototype.send;
  const origXhrSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function(...args) {
    this._headers = {};
    try {
      const url = args[1];
      if (typeof url === "string") {
        const p = extractProjectId(url);
        if (p) notifyProjectIfChanged(p);
      }
    } catch {}
    return origXhrOpen.apply(this, args);
  };
  XMLHttpRequest.prototype.send = function(...args) {
    try {
      const body = args[0];
      if (typeof body === "string") {
        const p = extractProjectId(body);
        if (p) notifyProjectIfChanged(p);
      }
    } catch {}
    return origXhrSend.apply(this, args);
  };
  XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
    if (header && typeof header === "string" && header.toLowerCase() === "authorization") {
      if (value && value.startsWith("Bearer ")) {
        capturedAuthToken = value.replace(/^Bearer\s+/i, "");
        window.postMessage({ type: "DEEPX_AUTH_TOKEN_CAPTURED", token: capturedAuthToken }, "*");
      }
    }
    return origXhrSetRequestHeader.apply(this, arguments);
  };

  let lastKnownAccountEmail = null;
  let lastKnownIsLoggedIn = null;
  function notifyAccountIfChanged(acc) {
    if (!acc) return;
    if (acc.email !== lastKnownAccountEmail || acc.isLoggedIn !== lastKnownIsLoggedIn) {
      lastKnownAccountEmail = acc.email;
      lastKnownIsLoggedIn = acc.isLoggedIn;
      if (acc.isLoggedIn) {
        console.log("%c[DeepX Flow]%c Logged-in Google Account active:", "color:#00e5ff;font-weight:bold;", "color:#00e676;", acc.email || acc.accountName || "Authenticated");
      } else {
        console.log("%c[DeepX Flow]%c User signed out / No active Google Account.", "color:#00e5ff;font-weight:bold;", "color:#ff5252;");
      }
      window.postMessage({ type: "DEEPX_ACCOUNT_CHANGED", account: acc }, "*");
    }
  }

  // 2. Fetch or retrieve session access token
  async function getSessionToken() {
    if (capturedAuthToken) return capturedAuthToken;
    return capturedAuthToken;
  }

  // 3. Extract logged-in Google account info from Google Flow DOM & session
  async function getAccountInfo() {
    let accountName = null;
    let email = null;
    let plan = "Standard";
    let isLoggedIn = false;

    // A. Check DOM for Google Account profile avatar/button/indicators
    const accEl = document.querySelector(
      "a[aria-label*='Google Account' i], button[aria-label*='Google Account' i], [aria-label*='Google Account:' i], [aria-label*='Google खाता' i], [aria-label*='Compte Google' i], [aria-label*='Cuenta de Google' i], [aria-label*='Profile' i], [aria-label*='Account' i]"
    );
    if (accEl) {
      const aria = accEl.getAttribute("aria-label") || accEl.getAttribute("title") || "";
      const m = aria.match(/(?:Google Account|Google खाता|Compte Google|Account|Profile):\s*(.*?)(?:\s*\((.*?)\)|$)/i);
      if (m) {
        if (m[1]) accountName = m[1].replace(/[\r\n]+/g, " ").trim();
        if (m[2]) email = m[2].trim();
      } else {
        const emailMatch = aria.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (emailMatch) email = emailMatch[1].trim();
      }
    }

    // B. Check avatar image elements (img[src*='googleusercontent.com'])
    if (!accountName || !email) {
      const avatarImg = document.querySelector("img[src*='googleusercontent.com'], img[alt*='Google Account' i], img[alt*='Profile' i]");
      if (avatarImg) {
        const alt = avatarImg.getAttribute("alt") || avatarImg.getAttribute("title") || "";
        const m = alt.match(/(?:Google Account|Profile)?:\s*(.*?)(?:\s*\((.*?)\)|$)/i);
        if (m && m[1]) accountName = m[1].trim();
        if (m && m[2]) email = m[2].trim();
        const pAria = avatarImg.parentElement?.getAttribute("aria-label") || "";
        if (!email) {
          const em = pAria.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
          if (em) email = em[1].trim();
        }
      }
    }

    // C. Check Google Bar elements (.gb_g for name)
    if (!accountName || !email) {
      const gbarName = document.querySelector(".gb_g, [data-user-name], .user-email, [data-user-email]");
      if (gbarName && gbarName.textContent.trim()) {
        const text = gbarName.textContent.trim();
        if (text.includes("@")) email = text;
        else accountName = text;
      }
    }

    // D. Check Flow Project / Canvas Context to determine Login Status
    const url = window.location.href;
    const isProjectUrl = /\/projects?\/[a-zA-Z0-9_-]{6,}/i.test(url);
    const hasFlowUI = !!document.querySelector("flow-canvas, flow-prompt-box, flow-project-card, flow-create-project-card, [data-project-id], textarea");
    const isFlowHost = url.includes("flow.google.com") || url.includes("labs.google/fx/tools/flow");

    const signInLink = document.querySelector("a[href*='accounts.google.com/ServiceLogin'], a[href*='signin' i], a[href*='login' i]");
    const hasSignInBtn = Array.from(document.querySelectorAll("button, a")).some(b => /^\s*(sign\s*in|log\s*in)\s*$/i.test((b.innerText || b.textContent || "").trim()));

    if ((isProjectUrl || hasFlowUI) && !url.includes("accounts.google.com") && !signInLink && !hasSignInBtn) {
      isLoggedIn = true;
      if (!accountName) accountName = "Google Flow User";
      if (!email) email = "flow-user@google.com";
    } else if (email || (accountName && accountName !== "Google User")) {
      isLoggedIn = true;
    } else {
      isLoggedIn = false;
    }

    // E. Plan detection
    const proEl = document.querySelector("flow-user-tier-chip, .tier-chip, [aria-label*='PRO tier'], [aria-label*='PRO'], flow-pro-badge, .pro-badge, [class*='pro-badge'], [data-plan='pro']");
    const isPro = !!(proEl && ((proEl.textContent || "").includes("PRO") || (proEl.getAttribute("aria-label") || "").includes("PRO")));
    const upgradeEl = Array.from(document.querySelectorAll("button, a, span")).find(e => /upgrade to pro|get gemini advanced/i.test(e.textContent || ""));
    if (isPro) {
      plan = "PRO";
    } else if (upgradeEl) {
      plan = "Free";
    } else {
      plan = isLoggedIn ? "Standard" : "None";
    }

    const acc = {
      isLoggedIn,
      accountName: accountName || (isLoggedIn ? "Google User" : null),
      email: email || null,
      plan,
      hasToken: !!capturedAuthToken
    };

    notifyAccountIfChanged(acc);
    return acc;
  }

  // 4. Extract current Flow project ID with multi-layer detection
  function getProjectId() {
    // 1. From window URL
    const fromUrl = extractProjectId(window.location.href);
    if (fromUrl) {
      capturedProjectId = fromUrl;
      return fromUrl;
    }

    // If currently on home/gallery/explore and URL has no project ID, do NOT report a stale project!
    const pathname = window.location.pathname || "";
    if (pathname === "/" || pathname === "" || pathname.startsWith("/gallery") || pathname.startsWith("/explore")) {
      capturedProjectId = null;
      return null;
    }

    // 2. From network sniffer if still in a project context
    if (capturedProjectId && window.location.href.includes("/project")) return capturedProjectId;

    // 3. From Next.js data props if present
    try {
      const nextData = window.__NEXT_DATA__;
      const qId = nextData?.query?.projectId || nextData?.query?.id || nextData?.props?.pageProps?.projectId || nextData?.props?.pageProps?.project?.id;
      if (qId && typeof qId === "string" && !["new", "all"].includes(qId.toLowerCase())) {
        capturedProjectId = qId;
        return qId;
      }
    } catch {}

    // 4. From DOM data-project-id or links
    try {
      const dataEl = document.querySelector("[data-project-id]");
      if (dataEl) {
        const id = dataEl.getAttribute("data-project-id");
        if (id) {
          capturedProjectId = id;
          return id;
        }
      }
      const links = document.querySelectorAll("a[href*='/project/'], a[href*='/projects/']");
      for (const link of links) {
        const p = extractProjectId(link.href);
        if (p) {
          capturedProjectId = p;
          return p;
        }
      }
    } catch {}

    // 5. From sessionStorage / localStorage
    try {
      for (const k of ["flow_project_id", "current_project_id", "projectId", "last_project_id"]) {
        const val = sessionStorage.getItem(k) || localStorage.getItem(k);
        if (val && typeof val === "string" && val.length >= 6) {
          capturedProjectId = val;
          return val;
        }
      }
    } catch {}

    return null;
  }

  // SPA Client Navigation Hooks (pushState, replaceState, popstate, hashchange)
  function checkCurrentPageProject() {
    const p = getProjectId();
    notifyProjectIfChanged(p);
  }

  const origPushState = history.pushState;
  history.pushState = function(...args) {
    const res = origPushState.apply(this, args);
    setTimeout(checkCurrentPageProject, 50);
    return res;
  };
  const origReplaceState = history.replaceState;
  history.replaceState = function(...args) {
    const res = origReplaceState.apply(this, args);
    setTimeout(checkCurrentPageProject, 50);
    return res;
  };
  window.addEventListener("popstate", () => setTimeout(checkCurrentPageProject, 50));
  window.addEventListener("hashchange", () => setTimeout(checkCurrentPageProject, 50));
  setTimeout(checkCurrentPageProject, 200);
  setInterval(checkCurrentPageProject, 1000);

  // 5. Execute Google Enterprise reCAPTCHA
  async function getRecaptchaToken(action = "IMAGE_GENERATION") {
    try {
      const grecaptcha = window.grecaptcha;
      if (!grecaptcha?.enterprise) return null;

      let siteKey = "";
      const scripts = Array.from(document.querySelectorAll('script[src*="recaptcha"]'));
      for (const s of scripts) {
        const m = s.src.match(/render=([A-Za-z0-9_-]+)/);
        if (m) {
          siteKey = m[1];
          break;
        }
      }

      if (!siteKey) {
        siteKey = window.__NEXT_DATA__?.props?.pageProps?.recaptchaSiteKey || "6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV";
      }

      return await grecaptcha.enterprise.execute(siteKey, { action });
    } catch (err) {
      console.warn("[DeepX] Error executing enterprise reCAPTCHA:", err);
      return null;
    }
  }

  // 6. Make direct authenticated API requests
  async function apiPost(url, body, token) {
    const headers = {
      "Content-Type": "text/plain;charset=UTF-8"
    };
    const t = token || capturedAuthToken;
    if (t) {
      headers["Authorization"] = "Bearer " + t;
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body)
    });

    const text = await res.text();
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
      err.status = res.status;
      err.details = text;
      throw err;
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  // 7. Inject File Upload Catcher (AnyAI capability)
  let activeFileInput = null;
  const origInputClick = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function(...args) {
    if (this.type === "file" && (
      document.documentElement.getAttribute("data-deepx-upload") === "true" ||
      document.documentElement.getAttribute("data-veo-active") === "true"
    )) {
      activeFileInput = this;
      return;
    }
    return origInputClick.apply(this, args);
  };

  function handleFileInjection(detail) {
    if (detail && activeFileInput) {
      try {
        const { base64, filename, mimeType } = detail;
        const cleanBase64 = base64.includes(",") ? base64.split(",")[1] : base64;
        const binary = atob(cleanBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: mimeType || "image/jpeg" });
        const file = new File([blob], filename || "asset.jpg", { type: mimeType || "image/jpeg" });

        const dt = new DataTransfer();
        dt.items.add(file);
        activeFileInput.files = dt.files;
        activeFileInput.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (err) {
        console.warn("[DeepX] File injection warning:", err?.message || err);
      } finally {
        activeFileInput = null;
      }
    }
  }

  document.addEventListener("DEEPX_INJECT_FILE", (e) => handleFileInjection(e.detail));
  document.addEventListener("VEO_UPLOAD_FILE_DATA", (e) => handleFileInjection(e.detail));

  // 8. Listen to requests from ISOLATED world
  window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (data?.type !== "DEEPX_MAIN_REQUEST" || !data.id) return;

    const { id, action, args = [] } = data;
    try {
      let result;
      switch (action) {
        case "get_token":
          result = await getSessionToken();
          break;
        case "get_project_id":
          result = getProjectId();
          break;
        case "get_account_info":
          result = await getAccountInfo();
          break;
        case "get_recaptcha":
          result = await getRecaptchaToken(args[0] ?? "IMAGE_GENERATION");
          break;
        case "api_post":
          result = await apiPost(args[0], args[1], args[2]);
          break;
        case "get_flow_context": {
          const [t, p, acc] = await Promise.all([
            getSessionToken(),
            Promise.resolve(getProjectId()),
            getAccountInfo()
          ]);
          result = {
            token: t,
            projectId: p,
            projectName: getProjectName(),
            url: window.location.href,
            account: acc
          };
          break;
        }
        default:
          throw new Error("Unknown DeepX action: " + action);
      }

      window.postMessage({ type: "DEEPX_MAIN_RESPONSE", id, result }, "*");
    } catch (err) {
      window.postMessage({
        type: "DEEPX_MAIN_RESPONSE",
        id,
        error: err.message || String(err),
        status: err.status
      }, "*");
    }
  });
})();
