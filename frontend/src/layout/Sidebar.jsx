import React from "react";
import { ChevronLeft, ChevronRight, FolderKanban, LayoutDashboard, ListChecks, LogOut, UserCircle, Users } from "lucide-react";

const navItems = [
  ["dashboard", "Tableau", LayoutDashboard],
  ["modifications", "Modifications", ListChecks],
  ["projects", "Projets", FolderKanban],
  ["users", "Utilisateurs", Users],
  ["profile", "Profil", UserCircle]
];

export function Sidebar({ collapsed, page, onCollapseToggle, onLogout, onNavigate }) {
  return (
    <aside className="app-nav">
      <div className="brand">
        <img className="brand-logo" src="/sage_logo1.png" alt="SAGE Automotive Interiors" />
        <div className="brand-copy">
          <h1>Sage Plannings</h1>
          <span>Application ECR</span>
        </div>
        <button
          aria-label={collapsed ? "Agrandir le menu" : "Reduire le menu"}
          className="nav-toggle"
          onClick={onCollapseToggle}
          title={collapsed ? "Agrandir le menu" : "Reduire le menu"}
          type="button"
        >
          {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
        </button>
      </div>
      <nav className="main-menu">
        {navItems.map(([key, label, Icon]) => (
          <button
            key={key}
            className={page === key ? "menu-item active" : "menu-item"}
            onClick={() => onNavigate(key)}
            type="button"
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
        <button className="menu-item logout-item" onClick={onLogout} type="button">
          <LogOut size={18} />
          <span>Deconnexion</span>
        </button>
      </nav>
    </aside>
  );
}
