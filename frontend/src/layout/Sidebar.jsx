import React from "react";
import { Bot, ChevronLeft, ChevronRight, Database, FolderKanban, History, LayoutDashboard, ListChecks, LogOut, MessageCircle, UserCircle, Users } from "lucide-react";

const navItems = [
  ["dashboard", "Tableau", LayoutDashboard],
  ["modifications", "Modifications", ListChecks],
  ["ask-ai", "Ask AI", Bot],
  ["messages", "Messagerie", MessageCircle],
  ["projects", "Actions", FolderKanban],
  ["traceability", "Tracabilite", History],
  ["preferentials", "Preferentiels", Database],
  ["users", "Utilisateurs", Users],
  ["profile", "Profil", UserCircle]
];

export function Sidebar({ canAdmin, collapsed, currentUser, page, pageHref, onCollapseToggle, onLogout, onNavigate }) {
  const visibleItems = navItems.filter(([key]) => canAdmin || ["dashboard", "modifications", "ask-ai", "messages", "profile"].includes(key));

  return (
      <aside className="app-nav">
        <div className="brand">
          <img className="brand-logo" src="/sage_logo1.png" alt="SAGE Automotive Interiors" />

          <div className="brand-copy">
            <h1>Sage Plannings</h1>
            <span>Application ECR</span>
          </div>
        </div>

        <nav className="main-menu">
          <div className="nav-user-card">
            <div className="nav-user-controls">
              <div className="nav-user-avatar">
                {currentUser?.profilePhotoUrl ? (
                    <img src={currentUser.profilePhotoUrl} alt={currentUser.fullName || "Utilisateur"}/>
                ) : (
                    <UserCircle size={28}/>
                )}
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

            <div className="nav-user-info">
              <strong>{currentUser?.fullName || currentUser?.username || "Utilisateur"}</strong>
              <span>{currentUser?.jobTitle || currentUser?.role || "-"}</span>
            </div>
          </div>

          {visibleItems.map(([key, label, Icon]) => (
              <a
                  key={key}
                  className={page === key ? "menu-item active" : "menu-item"}
                  href={pageHref(key)}
                  onClick={(event) => onNavigate(key, event)}
                  title={label}
              >
                <Icon size={18}/>
                <span>{label}</span>
              </a>
          ))}

          <button
              className="menu-item logout-item"
              onClick={onLogout}
              title="Déconnexion"
              type="button"
          >
            <LogOut size={18}/>
            <span>Déconnexion</span>
          </button>
        </nav>
      </aside>
  );
}
