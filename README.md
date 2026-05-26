# Gestion Planning Web

Migration de l'application Access `PlanningSage.accdb` vers une application web:

- Backend: Spring Boot 2.7, Java 8 compatible
- Frontend: React + Vite
- Base de donnees: PostgreSQL

Le cahier des charges de reference est resume dans `docs/cahier-des-charges-ecr.md`.
La cible fonctionnelle complete reste: Spring Boot + React.js + PostgreSQL + Spring Security JWT.

## Concept metier

L'application suit des demandes de modification ECR (`Engineering Change Request`).
Chaque demande suit le workflow cible du cahier des charges:

1. Feasibility Validation
2. Project Management
3. Product Development
4. Process Development
5. Customer Validation
6. PPAP / SOP Preparation
7. Launch
8. Closed / Cancelled

Chaque jalon contient une checklist d'actions: point a verifier, pilote, preuve attendue, statut, criticite et dates.

## Modules a respecter

- Authentification JWT et roles: Admin, Manager, Pilote Engineering, Qualite, Finance, Production / Methodes
- Dashboard ECR, retards, penalites et performance
- CRUD ECR et filtrage
- Workflow ECR et historique des etapes
- Actions avec responsable, deadline, statut et commentaire
- Detection des retards
- Penalites financieres
- Documents et preuves
- Exports PDF/Excel

## Lancer le backend

Demarrer PostgreSQL:

```powershell
docker compose up -d postgres
```

Variables disponibles si votre base n'utilise pas les valeurs par defaut:

```powershell
$env:SPRING_DATASOURCE_URL="jdbc:postgresql://localhost:5432/plannings"
$env:SPRING_DATASOURCE_USERNAME="postgres"
$env:SPRING_DATASOURCE_PASSWORD="supersecret"
```

```powershell
cd backend
mvn spring-boot:run
```

API: `http://localhost:8088/api`

## Lancer le frontend

```powershell
cd frontend
npm install
npm run dev
```

Interface: `http://localhost:5173`

## Prochaines etapes

1. Ajouter Spring Security + JWT autour des roles utilisateurs.
2. Completer les ecrans React pour les modules Penalites, Documents et Users.
3. Ajouter l'upload reel de fichiers.
4. Ajouter les exports PDF/Excel.
5. Ajouter un import automatique depuis `PlanningSage.accdb` vers PostgreSQL.
