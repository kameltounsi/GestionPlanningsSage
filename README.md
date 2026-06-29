# Gestion Planning Web

Migration de l'application Access `PlanningSage.accdb` vers une application web:

- Backend: Spring Boot 2.7, Java 8 compatible
- Frontend: React + Vite
- Base de donnees: PostgreSQL

Le cahier des charges de reference est resume dans `docs/cahier-des-charges-ecr.md`.
La cible fonctionnelle complete reste: Spring Boot + React.js + PostgreSQL + Spring Security JWT.

Guide local/deploiement autonome: `README_DEPLOIEMENT.md`.

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
POSTGRES_HOST_PORT=5432
APP_FRONTEND_URL=http://localhost:3000
VITE_API_BASE_URL=/api
SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/plannings
CLOUDINARY_CLOUD_NAME=votre_cloud_name
CLOUDINARY_API_KEY=votre_api_key
CLOUDINARY_API_SECRET=votre_api_secret
SPRING_MAIL_HOST=smtp.gmail.com
SPRING_MAIL_PORT=587
SPRING_MAIL_USERNAME=votre_adresse_gmail
SPRING_MAIL_PASSWORD=votre_mot_de_passe_application_gmail
APP_ACCOUNT_MAIL_ENABLED=true
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

## CI/CD Jenkins

Le pipeline Jenkins est defini dans `Jenkinsfile`. Il execute:

1. Verification Docker
2. Tests Maven backend
3. Build frontend Vite
4. Creation du fichier `.env`
5. Build des images Docker
6. Deploiement `docker compose up -d`
7. Health check backend, Prometheus et Grafana

Credentials Jenkins a creer:

```text
gestion-planning-postgres-password
gestion-planning-grafana-password
gestion-planning-cloudinary-name
gestion-planning-cloudinary-key
gestion-planning-cloudinary-secret
gestion-planning-mail-username
gestion-planning-mail-password
```

Important: le Jenkinsfile utilise des commandes `sh`; il doit tourner sur un agent Linux ou un agent Docker compatible.

## Monitoring Grafana / Prometheus

Le backend expose les metriques Spring Boot Actuator pour Prometheus:

```text
http://localhost:3001/actuator/prometheus
```

Demarrer l'application avec le monitoring:

```bash
docker compose up -d --build
```

URLs:

```text
Application: http://localhost:3000
API:         http://localhost:3001/api
Prometheus: http://localhost:9090
Grafana:    http://localhost:3002
SonarQube:  http://localhost:9000
```

Grafana est deja provisionne avec la datasource Prometheus suivante:

```text
http://prometheus:9090
```

Identifiant Grafana par defaut en local:

```text
admin / admin
```

En production, changer `GRAFANA_ADMIN_PASSWORD` dans `.env`.

## Analyse Qualite SonarQube

SonarQube analyse le code backend Java et frontend React pour detecter:

- bugs
- vulnerabilites
- code smells
- duplications
- couverture des tests Java via JaCoCo

Demarrer SonarQube:

```powershell
docker compose up -d sonar-db sonarqube
```

Ouvrir SonarQube:

```text
http://localhost:9000
```

Identifiants initiaux:

```text
admin / admin
```

Au premier login, SonarQube demande de changer le mot de passe. Ensuite, creer un token:

```text
My Account > Security > Generate Tokens
```

Lancer une analyse locale complete depuis PowerShell:

```powershell
.\scripts\sonar-scan.ps1 -Token "VOTRE_TOKEN_SONAR"
```

Le scan effectue:

1. Demarrage de SonarQube
2. Tests Maven backend avec rapport JaCoCo
3. Build frontend
4. Analyse SonarQube du backend et du frontend

Dans Jenkins, creer aussi ces credentials:

```text
gestion-planning-sonar-db-password
gestion-planning-sonar-token
```

Ouvrir les ports sur la VM:

```bash
sudo ufw allow 3000
sudo ufw allow 3001
sudo ufw allow 5432
sudo ufw allow 9090
sudo ufw allow 3002
sudo ufw allow 9000
```

Interface web: `http://localhost:3000`

API backend: `http://localhost:3001/api`

Pour mettre a jour apres un push GitHub:

```bash
git pull
docker compose up -d --build
```

Pour la procedure complete avec logs, sauvegarde base et depannage, voir `README_DEPLOIEMENT.md`.

## Prochaines etapes

1. Ajouter Spring Security + JWT autour des roles utilisateurs.
2. Completer les ecrans React pour les modules Penalites, Documents et Users.
3. Ajouter l'upload reel de fichiers.
4. Ajouter les exports PDF/Excel.
5. Ajouter un import automatique depuis `PlanningSage.accdb` vers PostgreSQL.
