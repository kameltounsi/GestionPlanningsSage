param(
    [string]$DockerContainer = "planning",
    [string]$Database = "plannings",
    [string]$DbUser = "postgres"
)

$ErrorActionPreference = "Stop"

$sql = @"
TRUNCATE TABLE ecr_document, penalty, checklist_item, ecr_action, ecr_request, pilot, app_user RESTART IDENTITY CASCADE;
"@

docker exec $DockerContainer psql -v ON_ERROR_STOP=1 -U $DbUser -d $Database -c $sql
if ($LASTEXITCODE -ne 0) {
    throw "Reset SQL echoue."
}

Write-Output "Donnees applicatives supprimees. Le concept/template reste dans le code."
