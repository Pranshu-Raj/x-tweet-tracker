const urlInput = document.getElementById("appUrl");
const status = document.getElementById("status");

chrome.storage.sync.get("appUrl", ({ appUrl }) => {
  urlInput.value = appUrl || "http://localhost:3000";
});
urlInput.addEventListener("change", () =>
  chrome.storage.sync.set({ appUrl: urlInput.value.trim() })
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
