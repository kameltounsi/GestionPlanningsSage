$ErrorActionPreference = "Stop"

$env:JAVA_HOME = "C:\Users\kamel\.jdks\jbr-17.0.12"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
$env:SERVER_PORT = "3001"
$env:APP_FRONTEND_URL = "http://192.168.1.117:3000"
$env:SPRING_DATASOURCE_URL = "jdbc:postgresql://localhost:5432/plannings"
$env:SPRING_DATASOURCE_USERNAME = "postgres"
$env:SPRING_DATASOURCE_PASSWORD = "supersecret"

Set-Location "C:\Users\kamel\OneDrive\Documents\GestionPlanning\backend"
mvn -q "-Dmaven.repo.local=C:\Users\kamel\OneDrive\Documents\GestionPlanning\.m2\repository" spring-boot:run
