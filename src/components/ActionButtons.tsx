"use client";

import type { AIAction } from "@/app/api/agent-chat/route";

interface ActionButtonsProps {
  actions: AIAction[];
  onAction: (action: AIAction) => void;
}

export function ActionButtons({ actions, onAction }: ActionButtonsProps) {
  if (!actions || actions.length === 0) return null;

  const getButtonStyle = (type: string) => {
    switch (type) {
      case "trade":
        return "bg-bags-green/20 border-bags-green text-bags-green hover:bg-bags-green/30";
      case "launch":
        return "bg-bags-gold/20 border-bags-gold text-bags-gold hover:bg-bags-gold/30";
      case "claim":
        return "bg-purple-500/20 border-purple-500 text-purple-400 hover:bg-purple-500/30";
      case "link":
        return "bg-blue-500/20 border-blue-500 text-blue-400 hover:bg-blue-500/30";
      default:
        return "bg-gray-500/20 border-gray-500 text-gray-400 hover:bg-gray-500/30";
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "trade":
        return "↗";
      case "launch":
        return "🚀";
      case "claim":
        return "💰";
      case "link":
        return "🔗";
      default:
        return "▶";
    }
  };

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {actions.map((action, i) => (
        <button
          key={`${action.type}-${i}`}
          onClick={() => onAction(action)}
          className={`
            px-3 py-2 border rounded
            font-pixel text-[8px] sm:text-[9px]
            transition-colors active:scale-95
            min-h-[36px] sm:min-h-0
            ${getButtonStyle(action.type)}
          `}
        >
          <span className="mr-1">{getIcon(action.type)}</span>
          {action.label}
        </button>
      ))}
    </div>
  );
}
