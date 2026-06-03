import React from "react";
import { AlertTriangle } from "lucide-react";

export function EmptyState({ title, text, compact = false }) {
  return (
    <div className={compact ? "empty-state compact" : "empty-state"}>
      <AlertTriangle size={compact ? 18 : 22} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}
