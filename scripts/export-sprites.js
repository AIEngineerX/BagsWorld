// Script to export agent sprites from the game using Playwright
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const AGENTS = [
  { name: "ghost", texture: "dev" },
  { name: "neo", texture: "neo" },
  { name: "finn", texture: "finn" },
  { name: "toly", texture: "toly" },
  { name: "ash", texture: "ash" },
  { name: "shaw", texture: "shaw" },
  { name: "cj", texture: "cj" },
  { name: "ramo", texture: "ramo" },
  { name: "sincara", texture: "sincara" },
  { name: "stuu", texture: "stuu" },
  { name: "sam", texture: "sam" },
  { name: "alaa", texture: "alaa" },
  { name: "carlo", texture: "carlo" },
  { name: "bnn", texture: "bnn" },
  { name: "professor-oak", texture: "professorOak" },
  { name: "bagsy", texture: "bagsy" },
  { name: "bags-bot", texture: "bagsy" },
  { name: "chadghost", texture: "dev" },
];

async function exportSprites() {
  const outputDir = path.join(__dirname, "..", "public", "agents");

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen for console messages
  page.on("console", (msg) => {
    if (msg.type() === "log" || msg.type() === "info") {
      console.log("Browser:", msg.text());
    }
  });

  console.log("Navigating to localhost:3000...");
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

  // Wait for Phaser game canvas to appear
  console.log("Waiting for game canvas...");
  await page.waitForSelector("canvas", { timeout: 30000 });

  // Wait for game to fully initialize
  console.log("Waiting for game textures to generate...");
  await page.waitForTimeout(8000);

  // Try to find all available textures first
  console.log("Checking available textures...");
  const availableTextures = await page.evaluate(() => {
    // Find the Phaser game - it should be stored somewhere
    const canvases = document.querySelectorAll("canvas");
    for (const canvas of canvases) {
      // Check if this canvas has a Phaser game attached
      if (canvas.__phaser) {
        return Object.keys(canvas.__phaser.textures.list || {});
      }
    }

    // Try window.game
    if (window.game && window.game.textures) {
      return Object.keys(window.game.textures.list || {});
    }

    // Try Phaser.GAMES
    if (window.Phaser && window.Phaser.GAMES && window.Phaser.GAMES[0]) {
      return Object.keys(window.Phaser.GAMES[0].textures.list || {});
    }

    return [];
  });

  console.log("Available textures:", availableTextures.length > 0 ? availableTextures.slice(0, 20).join(", ") + "..." : "None found directly");

  // Use the export function we added to the game
  console.log("\nUsing built-in export function...");

  // Set up download handling
  const downloadPromises = [];
  const downloadedFiles = new Map();

  page.on("download", async (download) => {
    const fileName = download.suggestedFilename();
    console.log(`Downloading: ${fileName}`);
    const filePath = path.join(outputDir, fileName);
    await download.saveAs(filePath);
    downloadedFiles.set(fileName, filePath);
    console.log(`Saved: ${fileName}`);
  });

  // Trigger the export
  await page.evaluate(() => {
    if (typeof window.exportAgentSprites === "function") {
      window.exportAgentSprites();
    } else {
      console.error("exportAgentSprites function not found on window");
    }
  });

  // Wait for downloads to complete (16 agents * 300ms delay + buffer)
  console.log("Waiting for downloads...");
  await page.waitForTimeout(10000);

  console.log(`\nDownloaded ${downloadedFiles.size} files`);

  // List what was saved
  const savedFiles = fs.readdirSync(outputDir).filter(f => f.endsWith('.png'));
  console.log("Files in public/agents/:", savedFiles);

  console.log("Closing browser...");
  await browser.close();

  console.log("\nDone!");
}

exportSprites().catch(console.error);
