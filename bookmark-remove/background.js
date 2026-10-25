// ショートカット（⌥⇧X）かツールバーのアイコンで、表示中のページのブックマークを削除する

// 結果をツールバーのアイコンに一瞬表示する
async function flash(tabId, text, color) {
  await chrome.action.setBadgeBackgroundColor({ tabId, color });
  await chrome.action.setBadgeTextColor({ tabId, color: "#ffffff" });
  await chrome.action.setBadgeText({ tabId, text });
  setTimeout(() => chrome.action.setBadgeText({ tabId, text: "" }), 1500);
}

async function removeBookmarks(tab) {
  try {
    if (!tab?.url) throw new Error("タブの URL を取得できません");
    const existing = await chrome.bookmarks.search({ url: tab.url });
    if (existing.length === 0) {
      await flash(tab.id, "0", "#5f6368");
      return "none";
    }
    // 同じ URL が複数のフォルダにあれば、すべて削除する
    await Promise.all(existing.map((node) => chrome.bookmarks.remove(node.id)));
    await flash(tab.id, "−", "#d93025");
    return "removed";
  } catch (error) {
    console.error(error);
    await flash(tab?.id, "!", "#5f6368");
    return "error";
  }
}

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "remove-bookmark") removeBookmarks(tab);
});

chrome.action.onClicked.addListener(removeBookmarks);
