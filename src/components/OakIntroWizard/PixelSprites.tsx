"use client";

import React from "react";

/* ─────────────────────────────────────────────
   Sprite components using actual BagsWorld agent
   images from /public/agents/
   ───────────────────────────────────────────── */

interface SpriteProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Shared base: renders an agent PNG scaled up with pixelated rendering.
 * The source images are small pixel art (~48-64px), so imageRendering
 * "pixelated" keeps them crisp when scaled.
 */
function AgentImage({
  src,
  alt,
  className = "",
  style,
}: SpriteProps & { src: string; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={64}
      height={64}
      className={className}
      style={{
        imageRendering: "pixelated",
        ...style,
      }}
      draggable={false}
    />
  );
}

/* Professor Oak — white lab coat, red shirt, spiky gray hair */
export const OakSprite = React.memo(function OakSprite({ className = "", style }: SpriteProps) {
  return (
    <AgentImage
      src="/agents/professor-oak.png"
      alt="Professor Oak"
      className={className}
      style={style}
    />
  );
});
OakSprite.displayName = "OakSprite";

/* Trainer — Ash, the Pokemon-themed ecosystem guide */
export const TrainerSprite = React.memo(function TrainerSprite({
  className = "",
  style,
}: SpriteProps) {
  return <AgentImage src="/agents/ash.png" alt="Trainer" className={className} style={style} />;
});
TrainerSprite.displayName = "TrainerSprite";

/* Partner (Rival) — Ghost, the community funding partner */
export const RivalSprite = React.memo(function RivalSprite({ className = "", style }: SpriteProps) {
  return (
    <AgentImage src="/agents/ghost.png" alt="Partner Trainer" className={className} style={style} />
  );
});
RivalSprite.displayName = "RivalSprite";

/* TokenCreatureSprite — kept for backwards compat, uses Finn (Bags CEO) */
export const TokenCreatureSprite = React.memo(function TokenCreatureSprite({
  className = "",
  style,
}: SpriteProps) {
  return <AgentImage src="/agents/finn.png" alt="Token" className={className} style={style} />;
});
TokenCreatureSprite.displayName = "TokenCreatureSprite";
