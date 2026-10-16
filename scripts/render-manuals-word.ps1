param([string]$FileName = '*.docx')
$ErrorActionPreference = 'Stop'
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$documents = Join-Path $project 'docs/manuals'
$qa = Join-Path $project 'test-results/manual-qa'
New-Item -ItemType Directory -Force -Path $qa | Out-Null
$word = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    foreach ($file in Get-ChildItem -LiteralPath $documents -Filter $FileName) {
        $document = $null
        try {
            $document = $word.Documents.Open($file.FullName, $false, $false, $false)
            $document.Fields.Update() | Out-Null
            foreach ($toc in $document.TablesOfContents) { $toc.Update() }
            $document.Repaginate()
            foreach ($toc in $document.TablesOfContents) { $toc.UpdatePageNumbers() }
            $document.Save()
            $pdf = Join-Path $qa ($file.BaseName + '.pdf')
            $document.ExportAsFixedFormat($pdf, 17)
            [pscustomobject]@{ document=$file.Name; pages=$document.ComputeStatistics(2); pdf=$pdf } | ConvertTo-Json -Compress
        } finally {
            if ($null -ne $document) { $document.Close(0); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($document) }
        }
    }
} finally {
    if ($null -ne $word) { $word.Quit(); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($word) }
    [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
exit 0
