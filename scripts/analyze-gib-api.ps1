$basePath = 'C:\Users\msafa\AppData\Local\Apps\2.0\MGA2H9QA.VH8\CJCC6M5E.6YA\ofis..tion_2bfd1c09f3eee2c5_0001.0000_7663c0cfe824473a\'

# Tüm DLL'leri oku ve birleştir
$allText = ""
$dllFiles = Get-ChildItem $basePath -Filter '*.dll'
foreach ($dll in $dllFiles) {
    $bytes = [System.IO.File]::ReadAllBytes($dll.FullName)
    $allText += [System.Text.Encoding]::UTF8.GetString($bytes)
}

Write-Host "=== GIB DOMAIN URLs ===" -ForegroundColor Green
# GİB domain'leri
$gibDomains = [regex]::Matches($allText, '(?i)https?://[a-zA-Z0-9\.\-]+\.gib\.gov\.tr[^\s"<>]*')
$gibDomains | ForEach-Object { $_.Value } | Sort-Object -Unique

# intvrg (İnternet Vergi Dairesi)
Write-Host "`n=== INTVRG URLs ===" -ForegroundColor Cyan
$intvrg = [regex]::Matches($allText, '(?i)https?://[^\s"<>]*intvrg[^\s"<>]*')
$intvrg | ForEach-Object { $_.Value } | Sort-Object -Unique

# ivd (İnteraktif Vergi Dairesi)
Write-Host "`n=== IVD URLs ===" -ForegroundColor Yellow
$ivd = [regex]::Matches($allText, '(?i)https?://[^\s"<>]*ivd[^\s"<>]*')
$ivd | ForEach-Object { $_.Value } | Sort-Object -Unique

# ebeyanname
Write-Host "`n=== EBEYANNAME URLs ===" -ForegroundColor Magenta
$ebeyan = [regex]::Matches($allText, '(?i)https?://[^\s"<>]*ebeyan[^\s"<>]*')
$ebeyan | ForEach-Object { $_.Value } | Sort-Object -Unique

# vergi.gov.tr
Write-Host "`n=== VERGI.GOV.TR URLs ===" -ForegroundColor Blue
$vergi = [regex]::Matches($allText, '(?i)https?://[^\s"<>]*vergi\.gov\.tr[^\s"<>]*')
$vergi | ForEach-Object { $_.Value } | Sort-Object -Unique

# JSON Body patterns (API calls)
Write-Host "`n=== JSON/API PATTERNS ===" -ForegroundColor White
$jsonPattern = '(?i)application/json|content-type|bearer|authorization|api-key|x-api'
[regex]::Matches($allText, $jsonPattern) | ForEach-Object { $_.Value } | Sort-Object -Unique

# Cookie/Session patterns
Write-Host "`n=== SESSION/COOKIE PATTERNS ===" -ForegroundColor Green
$sessionPattern = '(?i)jsessionid|cookie|set-cookie|session|token'
[regex]::Matches($allText, $sessionPattern) | ForEach-Object { $_.Value } | Sort-Object -Unique

# Beyanname türleri
Write-Host "`n=== BEYANNAME TYPES ===" -ForegroundColor Cyan
$beyannameTypes = [regex]::Matches($allText, '(?i)KDV[12]?|MUHTASAR|KURUMLAR|GELIR|BA.BS|DAMGA|MTV|KGK|YILLIK')
$beyannameTypes | ForEach-Object { $_.Value } | Sort-Object -Unique

# API Endpoint paths
Write-Host "`n=== API ENDPOINT PATHS ===" -ForegroundColor Yellow
$apiPaths = [regex]::Matches($allText, '(?i)/api/[a-zA-Z0-9/\-_]+|/services/[a-zA-Z0-9/\-_]+|/rest/[a-zA-Z0-9/\-_]+')
$apiPaths | ForEach-Object { $_.Value } | Sort-Object -Unique | Select-Object -First 50

# Scraper klasöründeki tüm public method isimleri
Write-Host "`n=== PUBLIC METHODS IN SCRAPER ===" -ForegroundColor Magenta
$scraperFile = Get-ChildItem $basePath -Filter '*Scraper.Net.dll' | Select-Object -First 1
$scraperBytes = [System.IO.File]::ReadAllBytes($scraperFile.FullName)
$scraperText = [System.Text.Encoding]::UTF8.GetString($scraperBytes)
$publicMethods = [regex]::Matches($scraperText, '(?i)public\s+(?:async\s+)?(?:Task<)?[A-Za-z<>]+\s+([A-Z][a-zA-Z0-9]+)\s*\(')
$publicMethods | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique | Select-Object -First 100
