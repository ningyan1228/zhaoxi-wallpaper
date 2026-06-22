const fs = require("fs");
const path = require("path");

const root = __dirname;
const jsonPath = path.join(root, "wallpapers.json");
const imagesDir = path.join(root, "images");
const imageExts = new Set([".webp", ".png", ".jpg", ".jpeg", ".avif"]);

function log(title, value) {
  console.log(`${title}: ${value}`);
}

function listImageFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((item) => item.isFile() && imageExts.has(path.extname(item.name).toLowerCase()))
    .map((item) => item.name);
}

function readWallpapers() {
  try {
    return JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  } catch (error) {
    console.error("wallpapers.json 不是合法 JSON：");
    console.error(error.message);
    process.exitCode = 1;
    return [];
  }
}

const wallpapers = readWallpapers();
const imageFiles = new Set(listImageFiles(imagesDir));
const rootImages = listImageFiles(root).filter((name) => !["og-cover.webp"].includes(name));
const ids = wallpapers.map((item) => Number(item.id));
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
const idContinuous = ids.every((id, index) => id === index + 1);

const missingImages = wallpapers.filter((item) => {
  const fileName = path.basename(String(item.cover || ""));
  return !fileName || !imageFiles.has(fileName);
});

const unusedImages = [...imageFiles].filter((fileName) => (
  !wallpapers.some((item) => path.basename(String(item.cover || "")) === fileName)
));

const riskyNames = [...imageFiles].filter((fileName) => (
  fileName.startsWith("_") || /[?#%]/.test(fileName)
));

console.log("朝夕壁纸本地检查");
console.log("================");
log("壁纸数量", wallpapers.length);
log("图片数量", imageFiles.size);
log("ID 连续", idContinuous ? "是" : "否");
log("重复 ID", duplicateIds.length ? [...new Set(duplicateIds)].join(", ") : "无");
log("JSON 缺图", missingImages.length);
log("根目录误放图片", rootImages.length);
log("未被 JSON 使用的 images 图片", unusedImages.length);
log("风险文件名", riskyNames.length);

if (missingImages.length) {
  console.log("\n缺图前 30 条：");
  missingImages.slice(0, 30).forEach((item) => {
    console.log(`- id ${item.id} ${item.title} -> ${item.cover}`);
  });
  process.exitCode = 1;
}

if (rootImages.length) {
  console.log("\n根目录误放图片前 30 个：");
  rootImages.slice(0, 30).forEach((name) => console.log(`- ${name}`));
  process.exitCode = 1;
}

if (riskyNames.length) {
  console.log("\n建议改名的风险图片前 30 个：");
  riskyNames.slice(0, 30).forEach((name) => console.log(`- ${name}`));
}

if (!idContinuous || duplicateIds.length) {
  process.exitCode = 1;
}

console.log("\n检查完成。");
