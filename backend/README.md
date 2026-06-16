# Backend Gestion Planning

## PostgreSQL

L'application utilise PostgreSQL par defaut. Aucune donnee metier statique n'est chargee au demarrage.

Configuration par defaut:

```properties
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5433/plannings
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=postgres
```

Si votre PostgreSQL local ecoute sur un autre port, par exemple `5433`, lancez le backend avec:

```powershell
$env:SPRING_DATASOURCE_URL="jdbc:postgresql://localhost:5433/plannings"
$env:SPRING_DATASOURCE_USERNAME="postgres"
$env:SPRING_DATASOURCE_PASSWORD="votre_mot_de_passe"
mvn spring-boot:run
```

La base doit exister avant le demarrage:

```sql
CREATE DATABASE plannings;
```

Hibernate cree et met a jour les tables avec `spring.jpa.hibernate.ddl-auto=update`.
