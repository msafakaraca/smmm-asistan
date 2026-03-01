$basePath = 'C:\Users\msafa\AppData\Local\Apps\2.0\MGA2H9QA.VH8\CJCC6M5E.6YA\ofis..tion_2bfd1c09f3eee2c5_0001.0000_7663c0cfe824473a\'

# Scraper DLL
$scraperFile = Get-ChildItem $basePath -Filter '*Scraper.Net.dll' | Select-Object -First 1
if ($scraperFile) {
    Write-Host "=== SCRAPER DLL URLs ===" -ForegroundColor Green
    $bytes = [System.IO.File]::ReadAllBytes($scraperFile.FullName)
    $text = [System.Text.Encoding]::UTF8.GetString($bytes)
    $pattern = 'https?://[a-zA-Z0-9./_\-:]+'
    [regex]::Matches($text, $pattern) | ForEach-Object { $_.Value } | Sort-Object -Unique
}

# Client DLL
$clientFile = Get-ChildItem $basePath -Filter '*Client.Net.dll' | Select-Object -First 1
if ($clientFile) {
    Write-Host "`n=== CLIENT DLL URLs ===" -ForegroundColor Green
    $bytes = [System.IO.File]::ReadAllBytes($clientFile.FullName)
    $text = [System.Text.Encoding]::UTF8.GetString($bytes)
    $pattern = 'https?://[a-zA-Z0-9./_\-:]+'
    [regex]::Matches($text, $pattern) | ForEach-Object { $_.Value } | Sort-Object -Unique
}

# GIB related strings
Write-Host "`n=== GIB RELATED STRINGS (Scraper) ===" -ForegroundColor Cyan
$scraperBytes = [System.IO.File]::ReadAllBytes($scraperFile.FullName)
$scraperText = [System.Text.Encoding]::UTF8.GetString($scraperBytes)
$gibPattern = '(?i)(gib|intvrg|ivd|ebeyan|beyanname|tahsilat|vergi)'
[regex]::Matches($scraperText, $gibPattern) | ForEach-Object { $_.Value } | Sort-Object -Unique | Select-Object -First 50

# Method names containing interesting keywords
Write-Host "`n=== INTERESTING METHOD/CLASS NAMES ===" -ForegroundColor Yellow
$methodPattern = '(?i)[A-Z][a-zA-Z]*(Download|Beyanname|Gib|Pdf|Fetch|Get|List|Query)[A-Za-z]*'
[regex]::Matches($scraperText, $methodPattern) | ForEach-Object { $_.Value } | Sort-Object -Unique | Select-Object -First 100
