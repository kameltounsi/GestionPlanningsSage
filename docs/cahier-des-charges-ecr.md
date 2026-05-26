# Cahier des charges ECR

Source: `C:\Users\kamel\OneDrive\Bureau\Sage_ECR_Web_Application_Complete_Explanation.pdf`

Ce document sert de reference de travail pour la migration de l'application Access ECR vers une application web Spring Boot + React.

## Objectif

Transformer l'outil Microsoft Access de suivi ECR en plateforme web moderne, securisee, collaborative et maintenable.

L'application doit suivre une demande de modification industrielle depuis sa creation jusqu'a sa cloture ou son annulation, avec responsables, actions, delais, preuves, documents, retards, penalites et rapports.

## Stack cible

- Frontend: React.js
- Backend: Spring Boot REST API
- Base cible: PostgreSQL
- Securite: Spring Security + JWT
- Acces: roles et permissions par profil utilisateur

## Roles

- Admin: gere les utilisateurs, roles, comptes, acces et parametres globaux.
- Manager: suit l'avancement global, le dashboard, les retards, rapports et validations.
- Pilote Engineering: cree et suit les ECR, affecte les actions, met a jour les statuts et delais.
- Qualite: ajoute les preuves qualite, suit la validation client, prepare le PPAP et controle la conformite.
- Finance: renseigne le chiffrage, les impacts financiers, penalites et retards couteux.
- Production / Methodes: analyse l'impact process, machines, postes, instructions, controles et lancement.

## Modules attendus

- Authentification: login, logout, JWT, protection des routes, acces par role.
- Dashboard: ECR en cours, clotures, annules, actions en retard, penalites, performance.
- Gestion ECR: creation, modification, suppression, consultation et filtrage.
- Workflow ECR: suivi des etapes et changement de statut.
- Actions: taches par ECR avec responsable, deadline, statut et commentaire.
- Retards: detection automatique des actions/ECR en retard.
- Penalites: suivi financier des retards.
- Documents: upload, consultation et telechargement des preuves.
- Reports: export PDF/Excel et rapports de performance.

## Workflow ECR

1. Demande client/interne
2. Creation ECR
3. Feasibility Validation
4. Project Management
5. Product Development
6. Process Development
7. Customer Validation
8. PPAP / SOP Preparation
9. Launch
10. Closed ou Cancelled

## Modele cible

- `users`: id, full_name, email, password, role, enabled, created_at
- `ecr`: id, ecr_number, client, product, project_name, description, change_type, criticality, status, current_step, pilot_id, received_date, target_date, created_at
- `ecr_steps`: id, ecr_id, step_type, status, responsible_id, start_date, end_date, comment, evidence_file
- `actions`: id, ecr_id, title, description, responsible_id, deadline, status, closed_date, comment
- `penalties`: id, ecr_id, pilot_id, delay_type, amount, date, comment
- `documents`: id, ecr_id, file_name, file_url, file_type, uploaded_by, uploaded_at

## Phases de realisation

1. Spring Boot, PostgreSQL, User/Role, JWT authentication, CRUD ECR.
2. React, page login, layout dashboard, sidebar, liste ECR, creation ECR, detail ECR.
3. Etapes ECR, stepper React, changement de statut et historique.
4. CRUD actions, actions par ECR, actions en retard et actions du jour.
5. Upload/download fichiers et association aux ECR.
6. Export PDF/Excel et graphiques dashboard.

## Regles de decision

- Toute nouvelle fonctionnalite doit etre rattachee a un module attendu du cahier des charges.
- Le workflow code doit rester coherent avec les etapes ci-dessus.
- Les donnees doivent etre persistantes dans PostgreSQL; aucun fichier SQL de demonstration ne doit servir de source fonctionnelle principale.
- Les ajouts de securite doivent converger vers Spring Security + JWT avec roles.
- Les ecrans React doivent privilegier les usages metier: suivi, filtrage, actions, retards et preuves.
