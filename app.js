const presets = {
  calm: ["深呼吸", "余白", "静けさ", "ほどける", "やわらかな光", "ここにいる"],
  focus: ["ひとつずつ", "澄ませる", "手を動かす", "今", "集中", "小さく進む"],
  night: ["夜風", "月明かり", "眠りの前", "しずむ", "星の間", "おだやかに"],
  create: ["ひらめき", "まだ見ぬ形", "試す", "言葉の種", "描き出す", "余韻"],
};

const sky = document.querySelector("#sky");
const presetSelect = document.querySelector("#presetSelect");
const customWords = document.querySelector("#customWords");
const applyWords = document.querySelector("#applyWords");

let activeWords = [...presets.calm];
let spawnTimer = null;

const randomBetween = (min, max) => Math.random() * (max - min) + min;

function parseCustomWords() {
  return customWords.value
    .split(/\r?\n/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function getWordsForSelection() {
  if (presetSelect.value === "custom") {
    const words = parseCustomWords();
    return words.length > 0 ? words : ["ゆっくり", "呼吸", "余白"];
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
  if (presetSelect.value !== "custom") {
    restartWords();
  }
});

customWords.addEventListener("input", () => {
  presetSelect.value = "custom";
});

applyWords.addEventListener("click", restartWords);

restartWords();
