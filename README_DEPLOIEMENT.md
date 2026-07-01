# Guide local et deploiement - Gestion Planning

Ce fichier sert de procedure simple pour travailler en local puis redeployer l'application sans assistance repetitive.

## 1. Travail en local

### Option A - Tout lancer avec Docker

Depuis la racine du projet:

```powershell
docker compose up -d --build
```

Adresses locales:

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api
- PostgreSQL cote machine: localhost:5433
- PostgreSQL cote conteneur backend: postgres:5432

Verifier les services:

```powershell
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
```

Arreter:

```powershell
docker compose down
```

Arreter et supprimer aussi la base locale Docker:

```powershell
docker compose down -v
```

### Option B - PostgreSQL Docker + backend/frontend en mode developpement

Demarrer seulement PostgreSQL:

```powershell
docker compose up -d postgres
```

Lancer le backend local:

```powershell
.\scripts\deploy-backend-local.ps1
```

Depuis IntelliJ, tu peux aussi lancer `GestionPlanningApplication` directement. Le backend utilise par defaut:

```properties
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/plannings
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=supersecret
```

Ou manuellement:

```powershell
$env:SERVER_PORT="3001"
$env:APP_FRONTEND_URL="http://localhost:3000"
$env:SPRING_DATASOURCE_URL="jdbc:postgresql://localhost:5432/plannings"
$env:SPRING_DATASOURCE_USERNAME="postgres"
$env:SPRING_DATASOURCE_PASSWORD="supersecret"
cd backend
mvn spring-boot:run
```

Lancer le frontend local dans un autre terminal:

```powershell
cd frontend
npm install
$env:VITE_API_BASE_URL="http://localhost:3001/api"
npm run dev
```

## 2. Fichier .env

Pour Docker, le fichier `.env` doit rester oriente conteneurs:

```env
VM_HOST=192.168.1.117
APP_FRONTEND_URL=http://192.168.1.117:3000
VITE_API_BASE_URL=/api
SPRING_DATASOURCE_URL=jdbc:postgresql://192.168.1.117:5433/plannings
POSTGRES_HOST_PORT=5433
```

Important:

- Ne mets pas de vrais mots de passe dans `.env.example`.
- Garde tes vrais secrets uniquement dans `.env` sur la machine de deploiement.
- Si tu lances le backend hors Docker avec PostgreSQL expose par Docker, utilise `jdbc:postgresql://localhost:5433/plannings`.
- Sur la VM, le compose utilise par defaut `jdbc:postgresql://192.168.1.117:5433/plannings`.
- Si tu veux forcer une connexion interne Docker uniquement, utilise `jdbc:postgresql://postgres:5432/plannings`.

## 3. Deploiement sur une machine ou VM

Installer Docker et Git sur la machine:

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin git
sudo systemctl enable docker
sudo systemctl start docker
```

Recuperer le projet:

```bash
git clone https://github.com/VOTRE_COMPTE/VOTRE_REPO.git
cd VOTRE_REPO
```

Creer le fichier `.env`:

```bash
cp .env.example .env
nano .env
```

Adapter au minimum:

```env
VM_HOST=IP_OU_DOMAINE
POSTGRES_PASSWORD=mot_de_passe_fort
APP_FRONTEND_URL=http://IP_OU_DOMAINE:3000
VITE_API_BASE_URL=/api
SPRING_DATASOURCE_URL=jdbc:postgresql://IP_OU_DOMAINE:5433/plannings
POSTGRES_HOST_PORT=5433
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
SPRING_MAIL_HOST=...
SPRING_MAIL_PORT=...
SPRING_MAIL_USERNAME=...
SPRING_MAIL_PASSWORD=...
```

Lancer:

```bash
docker compose up -d --build
```

Ouvrir les ports si le firewall est actif:

```bash
sudo ufw allow 3000
sudo ufw allow 3001
sudo ufw allow 5433
```

Verifier:

```bash
docker compose ps
docker compose logs -f backend
```

Services optionnels:

```bash
docker compose --profile monitoring up -d prometheus grafana
docker compose --profile quality up -d sonar-db sonarqube
```

## 4. Mettre a jour apres des modifications

Depuis la machine de deploiement:

```bash
git pull
docker compose up -d --build
docker compose ps
```

Si le frontend ne change pas dans le navigateur:

```bash
docker compose build --no-cache frontend
docker compose up -d frontend
```

Si le backend ne redemarre pas correctement:

```bash
docker compose logs --tail=200 backend
docker compose restart backend
```

## 5. Sauvegarder la base PostgreSQL

Sauvegarde:

```bash
docker exec gestion-planning-postgres pg_dump -U postgres plannings > backup-plannings.sql
```

Restauration:

```bash
cat backup-plannings.sql | docker exec -i gestion-planning-postgres psql -U postgres plannings
```

## 6. Commandes utiles

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
docker compose restart backend
docker compose restart frontend
docker compose up -d --build
docker compose down
```

## 7. Erreurs frequentes

### Backend ne se connecte pas a PostgreSQL

Verifier `SPRING_DATASOURCE_URL`:

- Backend Docker: `jdbc:postgresql://postgres:5432/plannings`
- VM / LAN: `jdbc:postgresql://192.168.1.117:5433/plannings`
- Backend local Maven: `jdbc:postgresql://localhost:5433/plannings`

### Frontend charge mais API ne repond pas

Verifier:

```bash
docker compose ps
docker compose logs --tail=100 backend
```

En Docker, le frontend appelle `/api`, puis Nginx redirige vers le conteneur backend.

### Maven dit "No compiler is provided"

Java pointe vers un JRE au lieu d'un JDK. Installer un JDK 17 ou definir `JAVA_HOME` vers un JDK:

```powershell
$env:JAVA_HOME="C:\Users\kamel\.jdks\jbr-17.0.12"
$env:Path="$env:JAVA_HOME\bin;$env:Path"
java -version
mvn -version
```
