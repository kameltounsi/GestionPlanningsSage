# Backend Gestion Planning

## PostgreSQL

L'application utilise PostgreSQL par defaut. Aucune donnee metier statique n'est chargee au demarrage.

Configuration par defaut:

```properties
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/plannings
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=postgres
```

Si votre PostgreSQL local ecoute sur un autre port, adaptez la variable avant de lancer le backend:

```powershell
$env:SPRING_DATASOURCE_URL="jdbc:postgresql://localhost:5432/plannings"
$env:SPRING_DATASOURCE_USERNAME="postgres"
$env:SPRING_DATASOURCE_PASSWORD="votre_mot_de_passe"
mvn spring-boot:run
```

La base doit exister avant le demarrage:

```sql
CREATE DATABASE plannings;
```

Hibernate cree et met a jour les tables avec `spring.jpa.hibernate.ddl-auto=update`.
