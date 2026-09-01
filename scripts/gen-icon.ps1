Add-Type -AssemblyName System.Drawing

$size = 1024
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::Transparent)

# Rounded dark background
function New-RoundedRect([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $r * 2
    $path.AddArc($x, $y, $d, $d, 180, 90)
    $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    return $path
}

$bgPath = New-RoundedRect 32 32 960 960 224
$bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 20, 20, 26))
$g.FillPath($bgBrush, $bgPath)

# Draw equalizer bars (indigo)
$barW = 84
$gap = 60
$heights = @(260, 420, 620, 420, 260)
$colors = @(
  [System.Drawing.Color]::FromArgb(255, 129, 140, 248),
  [System.Drawing.Color]::FromArgb(255, 117, 122, 245),
  [System.Drawing.Color]::FromArgb(255, 99, 102, 241),
  [System.Drawing.Color]::FromArgb(255, 117, 122, 245),
  [System.Drawing.Color]::FromArgb(255, 129, 140, 248)
)
$totalW = 5 * $barW + 4 * $gap
$startX = ($size - $totalW) / 2
$centerY = $size / 2
for ($i = 0; $i -lt 5; $i++) {
    $h = $heights[$i]
    $x = $startX + $i * ($barW + $gap)
    $y = $centerY - $h / 2
    $barPath = New-RoundedRect $x $y $barW $h ($barW / 2)
    $barBrush = New-Object System.Drawing.SolidBrush($colors[$i])
    $g.FillPath($barBrush, $barPath)
    $barBrush.Dispose()
}

$g.Dispose()
$outDir = Join-Path $PSScriptRoot "src-tauri"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
$bmp.Save((Join-Path $outDir "app-icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host "Icon source created: $outDir\app-icon.png"
