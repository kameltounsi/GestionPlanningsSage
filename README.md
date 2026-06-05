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
$env:SERVER_PORT="3001"
$env:APP_FRONTEND_URL="http://localhost:3000"
$env:SPRING_DATASOURCE_URL="jdbc:postgresql://localhost:5432/plannings"
$env:SPRING_DATASOURCE_USERNAME="postgres"
$env:SPRING_DATASOURCE_PASSWORD="supersecret"
```

```powershell
cd backend
mvn spring-boot:run
```

API: `http://localhost:3001/api`

## Lancer le frontend

```powershell
cd frontend
npm install
npm run dev
```

Interface: `http://localhost:3000`

Si l'API backend tourne sur une autre adresse ou un autre port:

```powershell
$env:VITE_API_BASE_URL="http://localhost:3001/api"
npm run dev
```

## Deploiement Docker sur une VM

Sur la VM, installer Docker et Git:

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin git
sudo systemctl enable docker
sudo systemctl start docker
```

Cloner le projet:

```bash
git clone https://github.com/VOTRE_COMPTE/VOTRE_REPO.git
cd VOTRE_REPO
```

Creer le fichier d'environnement:

```bash
cp .env.example .env
nano .env
```

Valeurs importantes a adapter dans `.env`:

```env
POSTGRES_PASSWORD=votre_mot_de_passe_fort
APP_FRONTEND_URL=http://IP_DE_LA_VM:3000
VITE_API_BASE_URL=/api
```

Demarrer toute l'application:

```bash
docker compose up -d --build
```

Verifier les conteneurs et les logs:

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
```

Ouvrir les ports sur la VM:

```bash
sudo ufw allow 3000
sudo ufw allow 3001
sudo ufw allow 5432
```

Interface web: `http://IP_DE_LA_VM:3000`

API backend: `http://IP_DE_LA_VM:3001/api`

Pour mettre a jour apres un push GitHub:

```bash
git pull
docker compose up -d --build
```

## Prochaines etapes

1. Ajouter Spring Security + JWT autour des roles utilisateurs.
2. Completer les ecrans React pour les modules Penalites, Documents et Users.
3. Ajouter l'upload reel de fichiers.
4. Ajouter les exports PDF/Excel.
5. Ajouter un import automatique depuis `PlanningSage.accdb` vers PostgreSQL.
