$basePath = 'C:\Users\msafa\AppData\Local\Apps\2.0\MGA2H9QA.VH8\CJCC6M5E.6YA\ofis..tion_2bfd1c09f3eee2c5_0001.0000_7663c0cfe824473a\'
$outputDir = 'C:\Users\msafa\Desktop\smmm_asistan\scripts\turmob-decompiled'
$ilspy = Join-Path $env:USERPROFILE '.dotnet\tools\ilspycmd.exe'

# Create output directory
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

# Decompile Scraper DLL
$scraperDll = Get-ChildItem $basePath -Filter '*Scraper.Net.dll' | Select-Object -First 1
Write-Host "Decompiling: $($scraperDll.Name)" -ForegroundColor Green
& $ilspy $scraperDll.FullName -o "$outputDir\Scraper" -p

# Decompile Client DLL
$clientDll = Get-ChildItem $basePath -Filter '*Client.Net.dll' | Where-Object { $_.Name -notlike '*Entities*' -and $_.Name -notlike '*XmlSerializers*' } | Select-Object -First 1
Write-Host "Decompiling: $($clientDll.Name)" -ForegroundColor Green
& $ilspy $clientDll.FullName -o "$outputDir\Client" -p

# Decompile Entities DLL
$entitiesDll = Get-ChildItem $basePath -Filter '*Entities.dll' | Select-Object -First 1
Write-Host "Decompiling: $($entitiesDll.Name)" -ForegroundColor Green
& $ilspy $entitiesDll.FullName -o "$outputDir\Entities" -p

Write-Host "`nDecompilation complete!" -ForegroundColor Cyan
Write-Host "Output: $outputDir" -ForegroundColor Cyan
