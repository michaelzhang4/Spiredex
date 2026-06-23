# Assembles "index.html" by inlining the CSV data and the
# lib.js / app.js scripts into template.html. Run from anywhere:
#   powershell -ExecutionPolicy Bypass -File "build/build.ps1"
$ErrorActionPreference = 'Stop'
$bd  = $PSScriptRoot
$dir = Split-Path $bd -Parent
function Get-Text($p) { [System.IO.File]::ReadAllText($p) }

$html = Get-Text (Join-Path $bd 'template.html')
$P = Join-Path (Join-Path $dir 'data') 'Slay the Spire 2 Reference - '
$pairs = [ordered]@{
  '__LIB_JS__'         = (Get-Text (Join-Path $bd 'lib.js'))
  '__APP_JS__'         = (Get-Text (Join-Path $bd 'app.js'))
  '__CSV_MONSTERS__'   = (Get-Text ($P + 'Monsters.csv'))
  '__CSV_ELITES__'     = (Get-Text ($P + 'Elites.csv'))
  '__CSV_BOSSES__'     = (Get-Text ($P + 'Bosses.csv'))
  '__CSV_ANCIENTS__'   = (Get-Text ($P + 'Ancients.csv'))
  '__CSV_EVENTS__'     = (Get-Text ($P + 'Events.csv'))
  '__CSV_MECHANICS__'  = (Get-Text ($P + 'Mechanics_Statistics.csv'))
  '__CSV_OVERGROWTH__' = (Get-Text ($P + 'Act 1_ Overgrowth.csv'))
  '__CSV_UNDERDOCKS__' = (Get-Text ($P + 'Act 1_ Underdocks.csv'))
  '__CSV_HIVE__'       = (Get-Text ($P + 'Act 2_ Hive.csv'))
  '__CSV_GLORY__'      = (Get-Text ($P + 'Act 3_ Glory.csv'))
}
foreach ($k in $pairs.Keys) { $html = $html.Replace($k, [string]$pairs[$k]) }

$left = ([regex]::Matches($html, '__(?:LIB_JS|APP_JS|CSV_[A-Z]+)__')).Count
if ($left -ne 0) { throw "Build failed: $left unreplaced placeholder(s) remain." }

$out = Join-Path $dir 'index.html'
[System.IO.File]::WriteAllText($out, $html, (New-Object System.Text.UTF8Encoding($false)))
Write-Host ("Built '{0}' ({1:N0} bytes)." -f $out, (Get-Item $out).Length)
