param([switch]$SkipWarmup)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$target = Join-Path $projectRoot 'tools/tectonic'
$archive = Join-Path $target 'tectonic-0.17.0-windows.zip'
$url = 'https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.17.0/tectonic-0.17.0-x86_64-pc-windows-msvc.zip'
# SHA-256 published by the official tectonic@0.17.0 GitHub release asset API.
$expected = 'f61ce51f0b0ade1015b7de7ef368541c5424e9756ecbd0d7af97d6d48030845f'
New-Item -ItemType Directory -Force -Path $target | Out-Null
if (-not (Test-Path -LiteralPath $archive)) { Invoke-WebRequest -Uri $url -OutFile $archive }
$actual = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) { throw "Tectonic checksum mismatch. Delete $archive and retry." }
Expand-Archive -LiteralPath $archive -DestinationPath $target -Force
& (Join-Path $target 'tectonic.exe') --version
if ($LASTEXITCODE -ne 0) { throw 'Tectonic verification failed.' }
Write-Host 'Installed verified Tectonic 0.17.0.'
if (-not $SkipWarmup) {
    $warmup = Join-Path $projectRoot '.cache/tex-setup'
    New-Item -ItemType Directory -Force -Path $warmup | Out-Null
    $savedCache = $env:TECTONIC_CACHE_DIR
    $savedFontconfig = $env:FONTCONFIG_FILE
    $env:TECTONIC_CACHE_DIR = Join-Path $projectRoot '.cache/tectonic'
    $fontCache = Join-Path $projectRoot '.cache/fontconfig'
    New-Item -ItemType Directory -Force -Path $fontCache | Out-Null
    $fontDirectoryXml = [System.Security.SecurityElement]::Escape((Join-Path $env:WINDIR 'Fonts').Replace('\', '/'))
    $fontCacheXml = [System.Security.SecurityElement]::Escape($fontCache.Replace('\', '/'))
    $env:FONTCONFIG_FILE = Join-Path $fontCache 'fonts.conf'
    "<?xml version=`"1.0`"?><!DOCTYPE fontconfig SYSTEM `"urn:fontconfig:fonts.dtd`"><fontconfig><dir>$fontDirectoryXml</dir><cachedir>$fontCacheXml</cachedir></fontconfig>" | Set-Content -LiteralPath $env:FONTCONFIG_FILE -Encoding utf8
    @'
\documentclass{article}
\usepackage[margin=1in]{geometry}
\usepackage{amsmath,amssymb,graphicx,xcolor,booktabs,hyperref}
\begin{document}
\section{Leaf Workbench is ready}
Your local compiler produces real PDF documents. $E=mc^2$.
\end{document}
'@ | Set-Content -LiteralPath (Join-Path $warmup 'main.tex') -Encoding utf8
    try {
        Write-Host 'Warming the official TeX bundle and common fonts. Initial download can take several minutes.'
        & (Join-Path $target 'tectonic.exe') --untrusted --outdir $warmup (Join-Path $warmup 'main.tex')
        if ($LASTEXITCODE -ne 0) { throw 'Compiler installed, but initial TeX bundle download failed. Check network access and rerun setup.' }
    } finally { $env:TECTONIC_CACHE_DIR = $savedCache; $env:FONTCONFIG_FILE = $savedFontconfig }
    Write-Host 'Verified a real PDF compile. Start the app with npm run dev.'
}
