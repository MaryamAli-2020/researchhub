Add-Type -AssemblyName System.Drawing

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir
$buildDir = Join-Path $rootDir "build"
$pngPath = Join-Path $buildDir "icon.png"
$icoPath = Join-Path $buildDir "icon.ico"

[System.IO.Directory]::CreateDirectory($buildDir) | Out-Null

if ((Test-Path $pngPath) -and (Test-Path $icoPath)) {
  Write-Host "Icon files already exist. Skipping regeneration."
  exit 0
}

$size = 256
$bitmap = New-Object System.Drawing.Bitmap $size, $size
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.Clear([System.Drawing.Color]::Transparent)

function New-RoundedRectPath([float]$x, [float]$y, [float]$width, [float]$height, [float]$radius) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $radius * 2

  $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
  $path.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
  $path.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

$backgroundPath = New-RoundedRectPath 18 18 220 220 58
$backgroundBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Rectangle 18, 18, 220, 220),
  [System.Drawing.Color]::FromArgb(255, 133, 92, 252),
  [System.Drawing.Color]::FromArgb(255, 49, 194, 255),
  45
)
$graphics.FillPath($backgroundBrush, $backgroundPath)

$innerPath = New-RoundedRectPath 34 34 188 188 44
$innerBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Rectangle 34, 34, 188, 188),
  [System.Drawing.Color]::FromArgb(250, 7, 13, 24),
  [System.Drawing.Color]::FromArgb(245, 15, 23, 42),
  90
)
$graphics.FillPath($innerBrush, $innerPath)

$shineBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(42, 255, 255, 255))
$graphics.FillEllipse($shineBrush, 52, 46, 104, 58)

$bubblePath = New-Object System.Drawing.Drawing2D.GraphicsPath
$bubblePath.AddArc(64, 64, 132, 132, 180, 90)
$bubblePath.AddArc(64, 64, 132, 132, 270, 90)
$bubblePath.AddArc(64, 64, 132, 132, 0, 90)
$bubblePath.AddArc(64, 64, 132, 132, 90, 90)
$bubblePath.AddPolygon(@(
  (New-Object System.Drawing.Point 104, 192),
  (New-Object System.Drawing.Point 118, 176),
  (New-Object System.Drawing.Point 133, 194)
))
$bubblePath.CloseFigure()

$bubbleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(232, 238, 245, 255))
$graphics.FillPath($bubbleBrush, $bubblePath)

$letterFont = New-Object System.Drawing.Font("Segoe UI", 78, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 14, 21, 38))
$format = New-Object System.Drawing.StringFormat
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center
$textRect = New-Object System.Drawing.RectangleF(72, 66, 116, 116)
$graphics.DrawString("R", $letterFont, $textBrush, $textRect, $format)

$tempPngPath = Join-Path $buildDir "icon.generated.png"
$tempIcoPath = Join-Path $buildDir "icon.generated.ico"

try {
  $graphics.Dispose()

  if (Test-Path $tempPngPath) {
    Remove-Item $tempPngPath -Force
  }
  if (Test-Path $tempIcoPath) {
    Remove-Item $tempIcoPath -Force
  }

  $bitmap.Save($tempPngPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $icon = [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())
  $fileStream = [System.IO.File]::Open($tempIcoPath, [System.IO.FileMode]::Create)
  try {
    $icon.Save($fileStream)
  } finally {
    $fileStream.Dispose()
    $icon.Dispose()
  }

  Move-Item $tempPngPath $pngPath -Force
  Move-Item $tempIcoPath $icoPath -Force
} finally {
  $bitmap.Dispose()
  $backgroundPath.Dispose()
  $backgroundBrush.Dispose()
  $innerPath.Dispose()
  $innerBrush.Dispose()
  $shineBrush.Dispose()
  $bubblePath.Dispose()
  $bubbleBrush.Dispose()
  $letterFont.Dispose()
  $textBrush.Dispose()
  $format.Dispose()
}
