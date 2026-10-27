// フォルダを選んで、表示中のページをブックマークに追加する。登録済みなら選んだフォルダへ移動する

const PINNED_KEY = "pinnedFolderIds";
const RECENT_KEY = "recentFolderIds";
const RECENT_MAX = 10;

const $page = document.getElementById("page");
const $status = document.getElementById("status");
const $query = document.getElementById("query");
const $list = document.getElementById("folders");

let tab;
let existing = []; // このページの既存のブックマーク
let allFolders = []; // { id, title, parentPath, path, folderType }（ツリー順）
let folders = []; // allFolders を表示順に並べたもの
let pinned = []; // 固定したフォルダの id
let recent = []; // 最近使ったフォルダの id
let shown = [];
let selected = 0;
let saving = false;

// ブックマークツリーから、変更できるフォルダを「親 › 子」のパス付きで列挙する
function collectFolders(node, parents, out) {
  for (const child of node.children ?? []) {
    if (child.url !== undefined || child.unmodifiable) continue;
    const title = child.title || "（名前なし）";
    out.push({
      id: child.id,
      title,
      parentPath: parents.join(" › "),
      path: [...parents, title].join(" › "),
      folderType: child.folderType,
    });
    collectFolders(child, [...parents, title], out);
  }
  return out;
}

// 固定したフォルダ → 最近使ったフォルダ → 「その他のブックマーク」 → 残りをツリー順
function orderFolders(all, pinnedIds, recentIds) {
  const byId = new Map(all.map((f) => [f.id, f]));
  const first = [...new Set([...pinnedIds, ...recentIds])].map((id) => byId.get(id)).filter(Boolean);
  const other = all.find((f) => f.folderType === "other");
  if (other && !first.includes(other)) first.push(other);
  return [...first, ...all.filter((f) => !first.includes(f))];
}

// keep を渡すと、並びが変わってもそのフォルダを選んだままにする
function render(keep) {
  const q = $query.value.trim().toLowerCase();
  shown = q ? folders.filter((f) => f.path.toLowerCase().includes(q)) : folders;
  if (keep) selected = Math.max(shown.indexOf(keep), 0);
  selected = Math.min(selected, Math.max(shown.length - 1, 0));
  $list.replaceChildren(
    ...shown.map((f, i) => {
      const li = document.createElement("li");
      li.className = i === selected ? "selected" : "";
      const name = document.createElement("div");
      name.className = "name";
      name.append(f.title);
      if (f.parentPath) {
        const parent = document.createElement("span");
        parent.className = "parent";
        parent.textContent = f.parentPath;
        name.append(parent);
      }
      const isPinned = pinned.includes(f.id);
      const pin = document.createElement("button");
      pin.className = isPinned ? "pin on" : "pin";
      pin.title = isPinned ? "固定を外す" : "一番上に固定";
      pin.textContent = "📌";
      pin.addEventListener("mousedown", (e) => e.preventDefault()); // 検索欄のフォーカスを保つ
      pin.addEventListener("click", (e) => {
        e.stopPropagation();
        togglePin(f);
      });
      li.append(name, pin);
      li.addEventListener("click", () => save(f));
      return li;
    }),
  );
  $list.children[selected]?.scrollIntoView({ block: "nearest" });
}

async function togglePin(folder) {
  pinned = pinned.includes(folder.id) ? pinned.filter((id) => id !== folder.id) : [...pinned, folder.id];
  await chrome.storage.local.set({ [PINNED_KEY]: pinned });
  folders = orderFolders(allFolders, pinned, recent);
  render(folder);
}

function move(delta) {
  if (shown.length === 0) return;
  selected = (selected + delta + shown.length) % shown.length;
  render();
}

async function save(folder) {
  if (saving) return;
  saving = true;
  try {
    if (existing.length === 0) {
      await chrome.bookmarks.create({ parentId: folder.id, title: tab.title || tab.url, url: tab.url });
    } else if (!existing.some((b) => b.parentId === folder.id)) {
      await chrome.bookmarks.move(existing[0].id, { parentId: folder.id });
    }
    await chrome.storage.local.set({
      [RECENT_KEY]: [folder.id, ...recent.filter((id) => id !== folder.id)].slice(0, RECENT_MAX),
    });
    $status.textContent = `${existing.length === 0 ? "追加しました" : "移動しました"}: ${folder.path}`;
    setTimeout(() => window.close(), 500);
  } catch (error) {
    $status.textContent = `失敗しました: ${error.message}`;
    saving = false;
  }
}

document.addEventListener("keydown", (e) => {
  if (e.isComposing) return; // IME の変換確定の Enter などは無視する
  if (e.key === "ArrowDown") {
    e.preventDefault();
    move(1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    move(-1);
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (shown[selected]) save(shown[selected]);
  } else if (e.key === "Escape") {
    window.close();
  }
});

$query.addEventListener("input", () => {
  selected = 0;
  render();
});

async function init() {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) {
    $status.textContent = "このページはブックマークできません";
    $query.disabled = true;
    return;
  }
  $page.textContent = tab.title || tab.url;
  existing = await chrome.bookmarks.search({ url: tab.url });
  const [root] = await chrome.bookmarks.getTree();
  allFolders = collectFolders(root, [], []);
  const pathOf = (id) => allFolders.find((f) => f.id === id)?.path ?? "?";
  $status.textContent =
    existing.length === 0 ? "未登録" : `登録済み: ${existing.map((b) => pathOf(b.parentId)).join("、")}`;
  const stored = await chrome.storage.local.get([PINNED_KEY, RECENT_KEY]);
  pinned = stored[PINNED_KEY] ?? [];
  recent = stored[RECENT_KEY] ?? [];
  folders = orderFolders(allFolders, pinned, recent);
  render();
  $query.focus();
}

init();
