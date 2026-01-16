"use client";

interface WorldHealthBarProps {
  health: number;
}

export function WorldHealthBar({ health }: WorldHealthBarProps) {
  const getHealthClass = () => {
    if (health >= 60) return "";
    if (health >= 30) return "warning";
    return "danger";
  };

  const getStatusInfo = (): { text: string; icon: string } => {
    if (health >= 80) return { text: "THRIVING", icon: "🌟" };
    if (health >= 60) return { text: "HEALTHY", icon: "☀️" };
    if (health >= 40) return { text: "NORMAL", icon: "⛅" };
    if (health >= 20) return { text: "STRUGGLING", icon: "🌧️" };
    return { text: "DYING", icon: "💀" };
  };

  const status = getStatusInfo();

  return (
    <div className="flex items-center gap-2">
      <span className="font-pixel text-[10px] text-gray-400 flex items-center gap-1">
        <span className="text-sm">🌍</span> WORLD:
      </span>
      <div className="w-32 health-bar">
        <div
          className={`health-bar-fill ${getHealthClass()}`}
          style={{ width: `${health}%` }}
        />
      </div>
      <span
        className={`font-pixel text-[10px] flex items-center gap-1 ${
          health >= 60
            ? "text-bags-green"
            : health >= 30
            ? "text-bags-gold"
            : "text-bags-red"
        }`}
      >
        <span>{status.icon}</span>
        {status.text}
      </span>
    </div>
  );
}
