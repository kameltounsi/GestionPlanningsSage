import React from "react";
import PropTypes from "prop-types";

export function StatCard({ icon: Icon, label, value, onClick }) {
  const Component = onClick ? "button" : "article";
  return (
    <Component
      className={onClick ? "stat-card clickable" : "stat-card"}
      type={onClick ? "button" : undefined}
      onClick={onClick}
    >
      <Icon size={20} />
      <span>{label}</span>
      <strong>{value}</strong>
    </Component>
  );
}

StatCard.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  onClick: PropTypes.func
};
