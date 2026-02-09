import * as Phaser from "phaser";

// ========================================
// SPRITE EXPORT UTILITY
// Call window.exportAgentSprites() from browser console to download all agent PNGs
// ========================================
export function exportAgentSprites(scene: Phaser.Scene): void {
  const agentTextures: Record<string, string> = {
    ghost: "dev", // Ghost uses the "dev" texture
    neo: "neo",
    finn: "finn",
    toly: "toly",
    ash: "ash",
    shaw: "shaw",
    cj: "cj",
    ramo: "ramo",
    sincara: "sincara",
    stuu: "stuu",
    sam: "sam",
    alaa: "alaa",
    carlo: "carlo",
    bnn: "bnn",
    "professor-oak": "professorOak",
    bagsy: "bagsy",
  };

  let exportCount = 0;

  Object.entries(agentTextures).forEach(([agentName, textureKey], index) => {
    setTimeout(() => {
      try {
        const texture = scene.textures.get(textureKey);
        if (!texture || !texture.source || !texture.source[0]) {
          console.warn(`Texture "${textureKey}" not found for agent "${agentName}"`);
          return;
        }

        const source = texture.source[0];
        let canvas: HTMLCanvasElement;

        if (source.image instanceof HTMLCanvasElement) {
          canvas = source.image;
        } else if (source.image instanceof HTMLImageElement) {
          // Convert image to canvas
          canvas = document.createElement("canvas");
          canvas.width = source.width;
          canvas.height = source.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(source.image, 0, 0);
          }
        } else {
          console.warn(`Cannot export texture "${textureKey}" - unknown source type`);
          return;
        }

        // Download as PNG
        const link = document.createElement("a");
        link.download = `${agentName}.png`;
        link.href = canvas.toDataURL("image/png");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        exportCount++;
        console.log(
          `Exported: ${agentName}.png (${exportCount}/${Object.keys(agentTextures).length})`
        );
      } catch (error) {
        console.error(`Failed to export ${agentName}:`, error);
      }
    }, index * 300); // Stagger downloads to avoid browser blocking
  });

  console.log(
    `Exporting ${Object.keys(agentTextures).length} agent sprites... Check your downloads folder.`
  );
  console.log("Save these files to /public/agents/ in your project.");
}
