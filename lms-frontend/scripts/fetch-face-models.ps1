# Downloads the face-api.js model weights into public/models.
#
# Without these files the app runs in DEGRADED mode: no face detection, no
# landmarks, no head pose, no multi-face detection, and no attention scores are
# recorded at all. The UI says so on screen, but the feature genuinely does not
# work until this script has been run successfully.
#
# Usage (from the lms-frontend directory):
#   powershell -ExecutionPolicy Bypass -File scripts\fetch-face-models.ps1

$ErrorActionPreference = 'Stop'

# Pin to a commit SHA rather than a branch once you have confirmed one, so the
# weights cannot change underneath you.
$Ref  = 'master'
$Base = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/$Ref/weights"
$Dest = Join-Path $PSScriptRoot '..\public\models'

# ageGenderNet is deliberately absent: nothing reads its output.
$Files = @(
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_expression_model-weights_manifest.json',
  'face_expression_model-shard1'
)

New-Item -ItemType Directory -Force -Path $Dest | Out-Null
Write-Host "Downloading face-api.js weights to $Dest`n"

foreach ($file in $Files) {
  Write-Host "  $file ... " -NoNewline
  try {
    Invoke-WebRequest "$Base/$file" -OutFile (Join-Path $Dest $file) -UseBasicParsing
    Write-Host 'ok'
  } catch {
    Write-Host "FAILED: $($_.Exception.Message)"
    exit 1
  }
}

Write-Host "`nVerifying..."
$bad = @()
foreach ($file in $Files) {
  $item = Get-Item (Join-Path $Dest $file)
  # A shard under 100 KB is almost always a GitHub 404 page saved to disk.
  # That failure mode is what produced the original 85-byte stub file.
  $min = if ($file -like '*shard*') { 100KB } else { 100 }
  $ok  = $item.Length -ge $min
  if (-not $ok) { $bad += $file }
  '{0,-50} {1,10} bytes  {2}' -f $item.Name, $item.Length, $(if ($ok) { 'OK' } else { 'TOO SMALL' })
}

if ($bad.Count -gt 0) {
  Write-Host ''
  Write-Host 'FAILED. These files are too small to be real weights:'
  foreach ($b in $bad) { Write-Host "  $b" }
  Write-Host 'The download probably returned an error page. Check the $Ref value at the top of this script.'
  exit 1
}

Write-Host "`nDone. Restart the dev server, open a classroom or exam, and confirm the"
Write-Host 'camera panel badge reads "CNN face detection" rather than "DEGRADED".'
