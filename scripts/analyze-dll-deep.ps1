$basePath = 'C:\Users\msafa\AppData\Local\Apps\2.0\MGA2H9QA.VH8\CJCC6M5E.6YA\ofis..tion_2bfd1c09f3eee2c5_0001.0000_7663c0cfe824473a\'

# Tüm DLL'leri analiz et
$dllFiles = Get-ChildItem $basePath -Filter '*.dll'

Write-Host "=== GIB PORTAL URLs ===" -ForegroundColor Green
foreach ($dll in $dllFiles) {
    $bytes = [System.IO.File]::ReadAllBytes($dll.FullName)
    $text = [System.Text.Encoding]::UTF8.GetString($bytes)

    # intvrg, ivd, ebeyanname URL'leri
    $gibUrls = [regex]::Matches($text, '(?i)https?://[^\s"<>]+(?:intvrg|ivd|gib|ebeyan)[^\s"<>]*')
    if ($gibUrls.Count -gt 0) {
        Write-Host "`n[$($dll.Name)]" -ForegroundColor Yellow
        $gibUrls | ForEach-Object { $_.Value } | Sort-Object -Unique
    }
}

Write-Host "`n=== EBEYANNAME RELATED ===" -ForegroundColor Cyan
$scraperFile = Get-ChildItem $basePath -Filter '*Scraper.Net.dll' | Select-Object -First 1
$bytes = [System.IO.File]::ReadAllBytes($scraperFile.FullName)
$text = [System.Text.Encoding]::UTF8.GetString($bytes)

# EBeyanname ile ilgili tüm stringler
$ebeyanPattern = '(?i)ebeyan[a-zA-Z0-9_/\.]*'
[regex]::Matches($text, $ebeyanPattern) | ForEach-Object { $_.Value } | Sort-Object -Unique

Write-Host "`n=== DOWNLOAD METHODS ===" -ForegroundColor Magenta
$downloadPattern = '(?i)[A-Z][a-zA-Z]*Download[A-Za-z]*|Download[A-Za-z]+'
[regex]::Matches($text, $downloadPattern) | ForEach-Object { $_.Value } | Sort-Object -Unique

Write-Host "`n=== PDF RELATED ===" -ForegroundColor Blue
$pdfPattern = '(?i)pdf|\.pdf|application/pdf'
[regex]::Matches($text, $pdfPattern) | ForEach-Object { $_.Value } | Sort-Object -Unique

Write-Host "`n=== HTTP CLIENT METHODS ===" -ForegroundColor White
$httpPattern = '(?i)HttpClient|WebClient|HttpWebRequest|GetAsync|PostAsync|DownloadData|DownloadFile'
[regex]::Matches($text, $httpPattern) | ForEach-Object { $_.Value } | Sort-Object -Unique

Write-Host "`n=== SCRAPER CLASS NAMES ===" -ForegroundColor Green
$classPattern = '(?i)class\s+[A-Z][a-zA-Z]*(?:Scraper|Parser|Downloader|Fetcher|Bot)[A-Za-z]*'
[regex]::Matches($text, $classPattern) | ForEach-Object { $_.Value } | Sort-Object -Unique

# Entities DLL'i de kontrol et
Write-Host "`n=== ENTITIES DLL - BEYANNAME MODELS ===" -ForegroundColor Yellow
$entitiesFile = Get-ChildItem $basePath -Filter '*Entities.dll' | Select-Object -First 1
if ($entitiesFile) {
    $bytes = [System.IO.File]::ReadAllBytes($entitiesFile.FullName)
    $text = [System.Text.Encoding]::UTF8.GetString($bytes)
    $modelPattern = '(?i)[A-Z][a-zA-Z]*(?:Beyanname|Gib|Vergi|Tahsilat|Tebligat)[A-Za-z]*Model'
    [regex]::Matches($text, $modelPattern) | ForEach-Object { $_.Value } | Sort-Object -Unique
}
