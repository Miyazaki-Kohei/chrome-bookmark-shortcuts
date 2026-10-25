// ショートカット（⌥⇧B）かツールバーのアイコンで、表示中のページのブックマークを追加・削除する

// 追加先の「その他のブックマーク」。アカウント保存とローカル保存の両方があればアカウント側を使う
async function otherBookmarksFolderId() {
  const [root] = await chrome.bookmarks.getTree();
  const others = root.children.filter((node) => node.folderType === "other");
  const folder = others.find((node) => node.syncing) ?? others[0];
  return folder?.id ?? "2";
}

// 結果をツールバーのアイコンに一瞬表示する
async function flash(tabId, text, color) {
  await chrome.action.setBadgeBackgroundColor({ tabId, color });
  await chrome.action.setBadgeTextColor({ tabId, color: "#ffffff" });
  await chrome.action.setBadgeText({ tabId, text });
  setTimeout(() => chrome.action.setBadgeText({ tabId, text: "" }), 1500);
}

async function toggleBookmark(tab) {
  try {
    if (!tab?.url) throw new Error("タブの URL を取得できません");
    const existing = await chrome.bookmarks.search({ url: tab.url });
    if (existing.length > 0) {
      // 同じ URL が複数のフォルダにあれば、すべて削除する
      await Promise.all(existing.map((node) => chrome.bookmarks.remove(node.id)));
      await flash(tab.id, "−", "#d93025");
      return "removed";
    }
    await chrome.bookmarks.create({
      parentId: await otherBookmarksFolderId(),
      title: tab.title || tab.url,
      url: tab.url,
    });
    await flash(tab.id, "+", "#1a73e8");
    return "added";
  } catch (error) {
    console.error(error);
    await flash(tab?.id, "!", "#5f6368");
    return "error";
  }
}

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "toggle-bookmark") toggleBookmark(tab);
});

chrome.action.onClicked.addListener(toggleBookmark);
