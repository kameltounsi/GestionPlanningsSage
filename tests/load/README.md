# Test de capacité du site

Ce scénario mesure la capacité avec une montée progressive. Chaque utilisateur virtuel se connecte puis consulte le profil, les demandes ECR et les actions du tableau de bord.

## Prérequis

- Installer k6 sur la machine qui exécutera le test.
- Utiliser un compte dédié au test, sans données sensibles.
- Surveiller en parallèle CPU, mémoire, PostgreSQL et erreurs du backend.

## Test prudent (10 utilisateurs maximum)

PowerShell :

```powershell
$env:BASE_URL = "http://192.168.1.117:3000"
$env:TEST_EMAIL = "compte-test@example.com"
$env:TEST_PASSWORD = "mot-de-passe-du-compte-test"
$env:MAX_VUS = "10"
k6 run .\tests\load\site-capacity.js
```

Si les seuils restent verts, répéter avec `MAX_VUS=25`, puis `50`, `100`, etc. Ne pas doubler la charge après l'apparition d'erreurs ou d'une saturation durable.

## Critères

- moins de 1 % d'échecs HTTP et d'erreurs applicatives ;
- 95 % des réponses sous 2 secondes ;
- 99 % des réponses sous 5 secondes.

La capacité retenue est le dernier palier stable respectant ces critères, pas le palier où le serveur finit par s'arrêter.
