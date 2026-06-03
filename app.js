const storageKey = "letterdrop.customWords";

const presets = {
  calm: ["深呼吸", "余白", "静けさ", "ほどける", "やわらかな光", "ここにいる"],
  focus: ["ひとつずつ", "澄ませる", "手を動かす", "今", "集中", "小さく進む"],
  night: ["夜風", "月明かり", "眠りの前", "しずむ", "星の間", "おだやかに"],
  create: ["ひらめき", "まだ見ぬ形", "試す", "言葉の種", "描き出す", "余韻"],
};

const fallbackCustomWords = ["ゆっくり", "呼吸", "余白"];

const sky = document.querySelector("#sky");
const presetSelect = document.querySelector("#presetSelect");
const customWords = document.querySelector("#customWords");
const wordFile = document.querySelector("#wordFile");
const saveWords = document.querySelector("#saveWords");
const saveStatus = document.querySelector("#saveStatus");
const customEntry = document.querySelector("#customEntry");
const customWordList = document.querySelector("#customWordList");
const emptyMessage = document.querySelector("#emptyMessage");
const settingsDrawer = document.querySelector("#settingsDrawer");
const listDrawer = document.querySelector("#listDrawer");
const settingsToggle = document.querySelector("#settingsToggle");
const listToggle = document.querySelector("#listToggle");

let customWordItems = [];
let activeWords = [...presets.calm];
let spawnTimer = null;
let statusTimer = null;
let tokenizerPromise = null;

const kuromojiDictionaryPath = "https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/";

const randomBetween = (min, max) => Math.random() * (max - min) + min;

function normalizeWords(words) {
  return [...new Set(words.map((word) => word.trim()).filter(Boolean))];
}

function parseTextAreaWords() {
  return normalizeWords(customWords.value.split(/\r?\n/));
}

function appendWordsToTextArea(words) {
  const currentWords = parseTextAreaWords();
  const nextWords = normalizeWords([...currentWords, ...words]);

  customWords.value = nextWords.join("\n");
  presetSelect.value = "custom";
  updateCustomEntryVisibility();
}

function parseDelimitedWords(text, delimiter) {
  const separators = delimiter === "," ? /[,\r\n]+/ : /[\t\r\n]+/;
  return normalizeWords(text.split(separators));
}

function stripMarkdown(text) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[\s>*+-]*\[[ xX]]\s+/gm, "")
    .replace(/^[\s>*+-]+/gm, "")
    .replace(/[*_~|#]/g, " ");
}

function getKuromojiTokenizer() {
  if (tokenizerPromise) return tokenizerPromise;

  tokenizerPromise = new Promise((resolve, reject) => {
    if (!window.kuromoji) {
      reject(new Error("kuromoji.js を読み込めませんでした"));
      return;
    }

    window.kuromoji.builder({ dicPath: kuromojiDictionaryPath }).build((error, tokenizer) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(tokenizer);
    });
  });

  return tokenizerPromise;
}

async function extractNounsFromText(text) {
  const tokenizer = await getKuromojiTokenizer();
  const tokens = tokenizer.tokenize(stripMarkdown(text));

  return normalizeWords(
    tokens
      .filter((token) => token.pos === "名詞" && token.pos_detail_1 === "一般")
      .map((token) => token.surface_form),
  );
}

function getFileExtension(fileName) {
  const match = fileName.toLowerCase().match(/\.([^.]+)$/);
  return match ? match[1] : "";
}

function readFileAsUtf8(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsText(file, "UTF-8");
  });
}

async function extractWordsFromFile(file) {
  const text = await readFileAsUtf8(file);
  const extension = getFileExtension(file.name);

  if (extension === "csv") {
    return parseDelimitedWords(text, ",");
  }

  if (extension === "tsv") {
    return parseDelimitedWords(text, "\t");
  }

  if (extension === "txt" || extension === "md") {
    return extractNounsFromText(text);
  }

  throw new Error("対応しているファイルは .txt、.md、.csv、.tsv です");
}

function parseSavedWords(rawValue) {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? normalizeWords(parsed) : [];
  } catch {
    return normalizeWords(rawValue.split(/\r?\n/));
  }
}

function showSaveStatus(message) {
  saveStatus.textContent = message;
  clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => {
    saveStatus.textContent = "";
  }, 2200);
}

function saveCustomWordItems() {
  localStorage.setItem(storageKey, JSON.stringify(customWordItems));
}

function loadCustomWordItems() {
  customWordItems = parseSavedWords(localStorage.getItem(storageKey));
  saveCustomWordItems();
}

function setDrawerOpen(drawer, isOpen) {
  drawer.classList.toggle("is-open", isOpen);

  const toggle = drawer.querySelector(".drawer-tab");
  toggle.setAttribute("aria-expanded", String(isOpen));
}

function updateCustomEntryVisibility() {
  const isCustom = presetSelect.value === "custom";
  customEntry.hidden = !isCustom;
}

function renderCustomWordList() {
  customWordList.replaceChildren();
  emptyMessage.hidden = customWordItems.length > 0;

  customWordItems.forEach((word, index) => {
    const item = document.createElement("li");
    const text = document.createElement("span");
    const removeButton = document.createElement("button");

    text.textContent = word;
    removeButton.type = "button";
    removeButton.textContent = "削除";
    removeButton.className = "delete-button";
    removeButton.addEventListener("click", () => {
      customWordItems.splice(index, 1);
      saveCustomWordItems();
      renderCustomWordList();

      if (presetSelect.value === "custom") {
        restartWords();
      }
    });

    item.append(text, removeButton);
    customWordList.append(item);
  });
}

function getWordsForSelection() {
  if (presetSelect.value === "custom") {
    return customWordItems.length > 0 ? customWordItems : fallbackCustomWords;
  }

  return presets[presetSelect.value] ?? presets.calm;
}

function createFallingWord(initial = false) {
  if (!sky || activeWords.length === 0) return;

  const word = document.createElement("span");
  const text = activeWords[Math.floor(Math.random() * activeWords.length)];
  const duration = randomBetween(24, 42);

  word.className = "falling-word";
  word.textContent = text;
  word.style.setProperty("--x", `${randomBetween(4, 96)}vw`);
  word.style.setProperty("--size", `${randomBetween(18, 38)}px`);
  word.style.setProperty("--duration", `${duration}s`);
  word.style.setProperty("--delay", initial ? `${randomBetween(-duration * 0.9, 0)}s` : "0s");
  word.style.setProperty("--drift", `${randomBetween(-90, 90)}px`);
  word.style.setProperty("--alpha", randomBetween(0.42, 0.86).toFixed(2));

  word.addEventListener("animationend", () => word.remove());
  sky.appendChild(word);
}

function restartWords() {
  activeWords = getWordsForSelection();
  sky.replaceChildren();

  for (let index = 0; index < 24; index += 1) {
    createFallingWord(true);
  }

  clearInterval(spawnTimer);
  spawnTimer = window.setInterval(createFallingWord, 1800);
}

presetSelect.addEventListener("change", () => {
  updateCustomEntryVisibility();
  restartWords();
});

customWords.addEventListener("input", () => {
  presetSelect.value = "custom";
  updateCustomEntryVisibility();
});

wordFile.addEventListener("change", async () => {
  const file = wordFile.files?.[0];
  if (!file) return;

  showSaveStatus("ファイルを読み込んでいます");

  try {
    const words = await extractWordsFromFile(file);

    if (words.length === 0) {
      showSaveStatus("追加できる文字列が見つかりませんでした");
      return;
    }

    appendWordsToTextArea(words);
    showSaveStatus(`${words.length}件を入力欄に追加しました`);
  } catch (error) {
    console.error(error);
    showSaveStatus(error.message || "ファイルを読み込めませんでした");
  } finally {
    wordFile.value = "";
  }
});

saveWords.addEventListener("click", () => {
  const nextWords = parseTextAreaWords();

  if (nextWords.length === 0) {
    showSaveStatus("追加する文字列を入力してください");
    return;
  }

  presetSelect.value = "custom";
  customWordItems = normalizeWords([...customWordItems, ...nextWords]);
  saveCustomWordItems();
  renderCustomWordList();
  customWords.value = "";
  updateCustomEntryVisibility();
  restartWords();
  showSaveStatus("保存しました");
});

settingsToggle.addEventListener("click", () => {
  setDrawerOpen(settingsDrawer, !settingsDrawer.classList.contains("is-open"));
});

listToggle.addEventListener("click", () => {
  setDrawerOpen(listDrawer, !listDrawer.classList.contains("is-open"));
});

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => {
    const drawer = document.querySelector(`#${button.dataset.close}`);
    setDrawerOpen(drawer, false);
  });
});

loadCustomWordItems();
updateCustomEntryVisibility();
renderCustomWordList();
restartWords();
