"use client";

export default function OfflinePage() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        backgroundColor: "#0a0a0f",
        color: "#4ade80",
        fontFamily: "'Press Start 2P', monospace",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "3rem", marginBottom: "1.5rem" }}>&#x1F30E;</div>
      <h1 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>OFFLINE</h1>
      <p
        style={{
          fontSize: "0.625rem",
          lineHeight: "1.8",
          maxWidth: "400px",
          color: "#9ca3af",
        }}
      >
        BagsWorld needs an internet connection to load live on-chain data from Solana. Please
        reconnect and try again.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: "2rem",
          padding: "0.75rem 1.5rem",
          backgroundColor: "#4ade80",
          color: "#0a0a0f",
          border: "none",
          fontSize: "0.625rem",
          fontFamily: "'Press Start 2P', monospace",
          cursor: "pointer",
        }}
      >
        RETRY
      </button>
    </div>
  );
}
