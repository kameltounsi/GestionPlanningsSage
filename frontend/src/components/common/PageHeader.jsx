import React from "react";
import PropTypes from "prop-types";

export function PageHeader({ eyebrow, title, subtitle, actions }) {
  const heading = (
    <header className="page-header">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  );
  return actions ? <div className="page-heading">{heading}<div className="export-actions">{actions}</div></div> : heading;
}

PageHeader.propTypes = {
  eyebrow: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string.isRequired,
  actions: PropTypes.node
};
