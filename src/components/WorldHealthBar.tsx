"use client";

import {
  WorldIcon,
  StarIcon,
  SunIcon,
  CloudSunIcon,
  StormIcon,
  SkullIcon,
} from "./icons";

interface WorldHealthBarProps {
  health: number;
}

export function WorldHealthBar({ health }: WorldHealthBarProps) {
  const getHealthClass = () => {
    if (health >= 40) return "";
    if (health >= 20) return "warning";
    return "danger";
  };

  const getStatusInfo = (): { text: string; icon: React.ReactNode } => {
    if (health >= 80) return { text: "THRIVING", icon: <StarIcon className="text-bags-gold" size={14} /> };
    if (health >= 60) return { text: "HEALTHY", icon: <SunIcon className="text-yellow-400" size={14} /> };
    if (health >= 40) return { text: "CLOUDY", icon: <CloudSunIcon className="text-gray-300" size={14} /> };
    if (health >= 20) return { text: "STORMY", icon: <StormIcon className="text-purple-400" size={14} /> };
    return { text: "DYING", icon: <SkullIcon className="text-red-400" size={14} /> };
  };

  const status = getStatusInfo();

  return (
    <div className="flex items-center gap-2">
      <span className="font-pixel text-[10px] text-gray-400 flex items-center gap-1">
        <WorldIcon className="text-bags-green" size={14} /> WORLD:
      </span>
      <div
        className="w-32 health-bar"
        role="progressbar"
        aria-valuenow={health}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`World health: ${health}%`}
      >
        <div
          className={`health-bar-fill ${getHealthClass()}`}
          style={{ width: `${health}%` }}
        />
      </div>
      <span className="font-pixel text-[10px] text-gray-500">{Math.round(health)}%</span>
      <span
        className={`font-pixel text-[10px] flex items-center gap-1 ${
          health >= 40
            ? "text-bags-green"
            : health >= 20
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
