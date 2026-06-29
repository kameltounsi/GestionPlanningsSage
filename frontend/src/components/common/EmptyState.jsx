import React from "react";
import PropTypes from "prop-types";
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

EmptyState.propTypes = {
  title: PropTypes.string.isRequired,
  text: PropTypes.string.isRequired,
  compact: PropTypes.bool
};
