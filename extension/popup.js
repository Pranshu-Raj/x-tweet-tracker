const urlInput = document.getElementById("appUrl");
const tokenInput = document.getElementById("token");
const status = document.getElementById("status");

chrome.storage.sync.get(["appUrl", "cockpitToken"], ({ appUrl, cockpitToken }) => {
  urlInput.value = appUrl || "http://localhost:3000";
  tokenInput.value = cockpitToken || "";
});
urlInput.addEventListener("change", () =>
  chrome.storage.sync.set({ appUrl: urlInput.value.trim() })
);
tokenInput.addEventListener("change", () =>
  chrome.storage.sync.set({ cockpitToken: tokenInput.value.trim() })
);

document.getElementById("cap").addEventListener("click", async () => {
  status.textContent = "capturing…";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { type: "capture-followers" }, (res) => {
    if (chrome.runtime.lastError) {
      status.textContent = "open your X profile tab first";
      return;
    }
    status.textContent =
      res && res.ok ? "sent " + res.followers + " followers ✓" : "failed: " + ((res && res.error) || "unknown");
  });
});

document.getElementById("capAct").addEventListener("click", async () => {
  status.textContent = "counting today's activity…";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { type: "capture-activity" }, (res) => {
    if (chrome.runtime.lastError) {
      status.textContent = "open an x.com tab (logged in) first";
      return;
    }
    status.textContent =
      res && res.ok
        ? "counting… your profile tabs will flip briefly; watch for the toast ✓"
        : "failed: " + ((res && res.error) || "unknown");
  });
});

document.getElementById("importTweets").addEventListener("click", async () => {
  status.textContent = "importing recent tweets…";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { type: "import-tweets" }, (res) => {
    if (chrome.runtime.lastError) {
      status.textContent = "open an x.com tab (logged in) first";
      return;
    }
    status.textContent =
      res && res.ok
        ? "importing… your profile opens and scans; watch for the toast ✓"
        : "failed: " + ((res && res.error) || "unknown");
  });
});

document.getElementById("capProfile").addEventListener("click", async () => {
  status.textContent = "capturing profile…";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { type: "capture-profile" }, (res) => {
    if (chrome.runtime.lastError) {
      status.textContent = "open YOUR X profile tab first";
      return;
    }
    status.textContent =
      res && res.ok ? "profile sent → open Coach ✓" : "failed: " + ((res && res.error) || "unknown");
  });
});
