Add-Type -AssemblyName System.Drawing

function New-AppIcons($inputPng, $outputDir) {
    Write-Host "Processing: $inputPng"
    $fullPath = (Resolve-Path $inputPng).Path
    $bytes = [System.IO.File]::ReadAllBytes($fullPath)
    $ms = New-Object System.IO.MemoryStream(,$bytes)
    $src = [System.Drawing.Image]::FromStream($ms)
    
    # Generate 512x512 PNG
    $bmp512 = New-Object System.Drawing.Bitmap 512, 512
    $g512 = [System.Drawing.Graphics]::FromImage($bmp512)
    $g512.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g512.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g512.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g512.DrawImage($src, 0, 0, 512, 512)
    $g512.Dispose()
    
    # Dispose src and ms so file is not locked
    $src.Dispose()
    $ms.Dispose()
    
    # Save 512x512 PNG
    $outPng = Join-Path $outputDir "icon.png"
    $tempPng = Join-Path $outputDir "icon_temp.png"
    $bmp512.Save($tempPng, [System.Drawing.Imaging.ImageFormat]::Png)
    Move-Item -Force $tempPng $outPng
    Write-Host "Saved 512x512 PNG: $outPng"
    
    # Generate 256x256 Bitmap for ICO
    $bmp256 = New-Object System.Drawing.Bitmap 256, 256
    $g256 = [System.Drawing.Graphics]::FromImage($bmp256)
    $g256.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g256.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g256.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g256.DrawImage($bmp512, 0, 0, 256, 256)
    $g256.Dispose()
    
    # Create ICO using Hicon
    $hIcon = $bmp256.GetHicon()
    $icon = [System.Drawing.Icon]::FromHandle($hIcon)
    $outIco = Join-Path $outputDir "icon.ico"
    $fs = New-Object System.IO.FileStream $outIco, ([System.IO.FileMode]::Create)
    $icon.Save($fs)
    $fs.Close()
    $icon.Dispose()
    
    $bmp256.Dispose()
    $bmp512.Dispose()
    Write-Host "Saved ICO: $outIco"
}

$desktopBuildDir = "apps/desktop/build"
$adminBuildDir = "apps/admin-desktop/build"

New-AppIcons "$desktopBuildDir/icon.png" $desktopBuildDir
New-AppIcons "$adminBuildDir/icon.png" $adminBuildDir
Write-Host "All icons generated successfully!"
