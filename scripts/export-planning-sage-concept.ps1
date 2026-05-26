param(
    [string]$AccessPath = "C:\Users\kamel\OneDrive\Bureau\PlanningSage.accdb",
    [string]$OutputPath = "backend\src\main\resources\planning-sage-action-template.tsv"
)

$ErrorActionPreference = "Stop"

function CleanText($value) {
    if ($null -eq $value -or $value -is [DBNull]) { return "" }
    return ([string]$value).Replace("`t", " ").Replace("`r", " ").Replace("`n", " ").Trim()
}

function ReadTable($connection, [string]$table) {
    $adapter = New-Object System.Data.OleDb.OleDbDataAdapter("SELECT * FROM [$table]", $connection)
    $data = New-Object System.Data.DataTable
    [void]$adapter.Fill($data)
    return ,$data
}

if (!(Test-Path -LiteralPath $AccessPath)) {
    throw "Fichier Access introuvable: $AccessPath"
}

$phaseTables = @(
    @{ Table = "ECR_inf_modele"; Stage = "FEASIBILITY_VALIDATION" },
    @{ Table = "ECR_inf2_modele"; Stage = "PROJECT_MANAGEMENT" },
    @{ Table = "ECR_inf3_modele"; Stage = "PRODUCT_DEVELOPMENT" },
    @{ Table = "ECR_inf4_modele"; Stage = "PROCESS_DEVELOPMENT" },
    @{ Table = "ECR_inf5_modele"; Stage = "CUSTOMER_VALIDATION" },
    @{ Table = "ECR_inf6_modele"; Stage = "PPAP_SOP_PREPARATION" },
    @{ Table = "ECR_inf7_modele"; Stage = "CANCELLED" }
)

$connection = New-Object System.Data.OleDb.OleDbConnection("Provider=Microsoft.ACE.OLEDB.16.0;Data Source=$AccessPath;Persist Security Info=False;")
$connection.Open()

try {
    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("stage`tname`ttopicRisk`ttitle`tresponsible`tcriticality`texpectedEvidence`tevidence`tproofDocument")

    foreach ($phase in $phaseTables) {
        $rows = ReadTable $connection $phase.Table
        $order = 1
        foreach ($row in $rows.Rows) {
            $values = @(
                $phase.Stage,
                "$($phase.Table)-$order",
                (CleanText $row["Topic_Risk"]),
                (CleanText $row["Point_verif"]),
                (CleanText $row["Pilote"]),
                (CleanText $row["Critique"]),
                (CleanText $row["element_preuve"]),
                (CleanText $row["evidence"]),
                (CleanText $row["Document_preuve"])
            )
            $lines.Add(($values -join "`t"))
            $order++
        }
    }
} finally {
    $connection.Close()
}

$resolvedOutput = Join-Path (Get-Location) $OutputPath
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $resolvedOutput) | Out-Null
Set-Content -LiteralPath $resolvedOutput -Value $lines -Encoding UTF8

Write-Output "Concept Access exporte vers $resolvedOutput"
Write-Output "Actions modele exportees: $($lines.Count - 1)"
