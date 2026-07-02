# Guide local et deploiement VM - Gestion Planning

Ce guide donne un parcours fiable pour lancer l'application en local, la deployer sur une VM Linux, puis verifier que le deploiement est utilisable.

## 1. Lancement local rapide

Depuis la racine du projet:

```powershell
docker compose up -d --build
docker compose ps
```

Adresses locales:

- Frontend: http://localhost:3000
- Backend health: http://localhost:3001/actuator/health
- Backend API: http://localhost:3001/api
- PostgreSQL cote machine: localhost:5432
- PostgreSQL cote conteneur backend: postgres:5432

Verification locale:

```powershell
docker compose ps
docker compose logs --tail=120 backend
docker compose logs --tail=120 frontend
```

Arreter:

```powershell
docker compose down
```

Arreter et supprimer aussi la base locale Docker:

```powershell
docker compose down -v
```

## 2. Developpement local sans tout Dockeriser

Demarrer seulement PostgreSQL:

```powershell
docker compose up -d postgres
```

Lancer le backend local:

```powershell
.\scripts\deploy-backend-local.ps1
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

## 3. Preparer une VM Linux

Installer Docker, Docker Compose et Git:

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin git curl
sudo systemctl enable docker
sudo systemctl start docker
```

Autoriser l'utilisateur courant a utiliser Docker sans `sudo`:

```bash
sudo usermod -aG docker "$USER"
newgrp docker
```

Recuperer le projet:

```bash
git clone https://github.com/VOTRE_COMPTE/VOTRE_REPO.git
cd VOTRE_REPO
```

## 4. Configurer le `.env` de la VM

Utiliser le template dedie VM:

```bash
cp .env.vm.example .env
nano .env
```

Valeurs a modifier obligatoirement:

```env
POSTGRES_PASSWORD=mot_de_passe_fort
APP_FRONTEND_URL=http://IP_OU_DOMAINE:3000
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
SPRING_MAIL_USERNAME=...
SPRING_MAIL_PASSWORD=...
GRAFANA_ADMIN_PASSWORD=mot_de_passe_fort
SONAR_POSTGRES_PASSWORD=mot_de_passe_fort
```

Important:

- Ne jamais commiter `.env`.
- Garder les secrets uniquement sur la VM.
- En Docker, ne pas definir `SPRING_DATASOURCE_URL` dans `.env`: `docker-compose.yml` force deja `jdbc:postgresql://postgres:5432/plannings`.
- Le template VM limite PostgreSQL a `127.0.0.1:5432`; ne l'exposer au reseau que si c'est vraiment necessaire.

## 5. Lancer sur la VM

Construire et demarrer:

```bash
docker compose up -d --build
```

Ouvrir les ports applicatifs si `ufw` est actif:

```bash
sudo ufw allow 3000/tcp
sudo ufw allow 3001/tcp
```

Ne pas ouvrir `5432/tcp` sauf besoin explicite d'acces PostgreSQL depuis l'exterieur.

## 6. Verifier apres deploiement

Lancer le smoke test fourni:

```bash
chmod +x scripts/smoke-test-vm.sh
BASE_URL=http://IP_OU_DOMAINE:3000 BACKEND_URL=http://IP_OU_DOMAINE:3001 ./scripts/smoke-test-vm.sh
```

Le script verifie:

- l'etat Docker Compose;
- le healthcheck PostgreSQL;
- le healthcheck backend `/actuator/health`;
- le frontend servi par Nginx;
- la connexion PostgreSQL interne avec `pg_isready`.

En local sur la VM, sans passer par l'IP publique:

```bash
./scripts/smoke-test-vm.sh
```

Verification manuelle utile:

```bash
docker compose ps
curl -fsS http://localhost:3001/actuator/health
curl -I http://localhost:3000
```

## 7. Mettre a jour la VM

Depuis la machine de deploiement:

```bash
git pull
docker compose up -d --build
./scripts/smoke-test-vm.sh
```

Si le frontend ne change pas dans le navigateur:

```bash
docker compose build --no-cache frontend
docker compose up -d frontend
./scripts/smoke-test-vm.sh
```

Si le backend ne redemarre pas correctement:

```bash
docker compose logs --tail=200 backend
docker compose restart backend
./scripts/smoke-test-vm.sh
```

## 8. Services optionnels

Monitoring:

```bash
docker compose --profile monitoring up -d prometheus grafana
```

Qualite:

```bash
docker compose --profile quality up -d sonar-db sonarqube
```

Ports par defaut:

- Prometheus: http://IP_OU_DOMAINE:9090
- Grafana: http://IP_OU_DOMAINE:3002
- SonarQube: http://IP_OU_DOMAINE:9000

## 9. Sauvegarder et restaurer PostgreSQL

Sauvegarde:

```bash
docker exec gestion-planning-postgres pg_dump -U postgres plannings > backup-plannings.sql
```

Restauration:

```bash
cat backup-plannings.sql | docker exec -i gestion-planning-postgres psql -U postgres plannings
```

## 10. Diagnostic rapide

Commandes utiles:

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
docker compose restart backend
docker compose restart frontend
docker compose up -d --build
docker compose down
```

Backend ne se connecte pas a PostgreSQL:

- Backend Docker: utiliser `postgres:5432`, deja configure par `docker-compose.yml`.
- Backend Maven local: utiliser `jdbc:postgresql://localhost:5432/plannings`.
- VM/LAN externe: utiliser l'IP de la VM uniquement si PostgreSQL doit vraiment etre expose.

Frontend charge mais API ne repond pas:

```bash
docker compose ps
docker compose logs --tail=120 backend
curl -fsS http://localhost:3001/actuator/health
```

En Docker, le frontend appelle `/api`, puis Nginx redirige vers le conteneur backend.

Maven dit "No compiler is provided":

Java pointe vers un JRE au lieu d'un JDK. Installer un JDK 17 ou definir `JAVA_HOME` vers un JDK:

```powershell
$env:JAVA_HOME="C:\Users\kamel\.jdks\jbr-17.0.12"
$env:Path="$env:JAVA_HOME\bin;$env:Path"
java -version
mvn -version
```
