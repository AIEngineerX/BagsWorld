"use client";

import {
  WorldIcon,
  StarIcon,
  SunIcon,
  CloudSunIcon,
  RainIcon,
  StormIcon,
  SkullIcon,
} from "./icons";

interface WorldHealthBarProps {
  health: number;
}

export function WorldHealthBar({ health }: WorldHealthBarProps) {
  const getHealthClass = () => {
    if (health >= 60) return "";
    if (health >= 30) return "warning";
    return "danger";
  };

  const getStatusInfo = (): { text: string; icon: React.ReactNode } => {
    if (health >= 80) return { text: "THRIVING", icon: <StarIcon className="text-bags-gold" size={14} /> };
    if (health >= 60) return { text: "HEALTHY", icon: <SunIcon className="text-yellow-400" size={14} /> };
    if (health >= 40) return { text: "NORMAL", icon: <CloudSunIcon className="text-gray-300" size={14} /> };
    if (health >= 20) return { text: "STRUGGLING", icon: <RainIcon className="text-blue-400" size={14} /> };
    return { text: "DYING", icon: <SkullIcon className="text-red-400" size={14} /> };
  };

  const status = getStatusInfo();

  return (
    <div className="flex items-center gap-2">
      <span className="font-pixel text-[10px] text-gray-400 flex items-center gap-1">
        <WorldIcon className="text-bags-green" size={14} /> WORLD:
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
        {status.icon}
        {status.text}
      </span>
    </div>
  );
}
