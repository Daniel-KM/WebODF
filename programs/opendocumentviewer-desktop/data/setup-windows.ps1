# Installs what the viewer of the desktop is built with on windows, so that a
# machine that has just been installed, in a virtual one or not, builds it.
#
# It is run once, in a terminal opened as an administrator:
#
#   powershell -ExecutionPolicy Bypass -File setup-windows.ps1
#
# What it installs is what "README-Products.md" lists: the compiler of
# Microsoft, since Qt WebEngine does not compile with MinGW, Qt with the
# modules the viewer links to, and the tools the build runs, node among them.
# Everything comes from the maker of each, over https, and nothing is taken
# from this repository.

[CmdletBinding()]
param(
    [string] $QtVersion = "6.8.2",
    [string] $QtDirectory = "C:\Qt",
    # The compiler weighs several gigabytes: a machine that already has Visual
    # Studio skips it.
    [switch] $SkipCompiler
)

$ErrorActionPreference = "Stop"

function Say([string] $words) {
    Write-Host "==> $words" -ForegroundColor Cyan
}

function Fail([string] $words) {
    Write-Host "!!! $words" -ForegroundColor Red
    exit 1
}

if (-not ([Security.Principal.WindowsPrincipal] `
        [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Fail "This script installs programs, so it is run as an administrator."
}

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Fail ("Winget was not found. It comes with windows 11 and with the recent" +
        " windows 10; on an older one, install 'App Installer' from the store.")
}

# The tools of the build. Winget answers 0 when it installed something, and a
# code of its own when the program is already there, which is not a failure.
$tools = @(
    "Git.Git",
    "Kitware.CMake",
    "Ninja-build.Ninja",
    "OpenJS.NodeJS.LTS",
    "EclipseAdoptium.Temurin.21.JRE",
    "Python.Python.3.12",
    "JRSoftware.InnoSetup"
)
foreach ($tool in $tools) {
    Say "Installing $tool"
    winget install --id $tool --exact --silent --accept-package-agreements `
        --accept-source-agreements --disable-interactivity | Out-Host
}

if (-not $SkipCompiler) {
    # Only the workload of C++ is asked for, not the whole of Visual Studio.
    Say "Installing the build tools of Visual Studio 2022"
    winget install --id Microsoft.VisualStudio.2022.BuildTools --exact `
        --silent --accept-package-agreements --accept-source-agreements `
        --disable-interactivity --override ("--quiet --wait --norestart" +
        " --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended") |
        Out-Host
}

# The paths of what was just installed are not in this session yet.
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") +
    ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

# Qt is installed with aqtinstall, that reads the repository of Qt and takes
# the archives from it: the installer of Qt asks for an account, which a script
# cannot answer for.
Say "Installing aqtinstall"
python -m pip install --upgrade --quiet pip aqtinstall | Out-Host

# Since Qt 6.8, WebEngine is an extension rather than a module, and it lives in
# a repository of its own: aqt is told to take it as a module all the same, and
# what it wrote is checked below.
Say "Installing Qt $QtVersion with WebEngine, in $QtDirectory"
python -m aqt install-qt windows desktop $QtVersion win64_msvc2022_64 `
    --outputdir $QtDirectory `
    --modules qtwebengine qtwebchannel qtpositioning | Out-Host

$prefix = Join-Path $QtDirectory "$QtVersion\msvc2022_64"
$webengine = Join-Path $prefix "lib\cmake\Qt6WebEngineWidgets"
if (-not (Test-Path $webengine)) {
    Write-Host ""
    Fail ("Qt was installed in $prefix, but WebEngine was not: it is the" +
        " extension 'extensions.qtwebengine.$($QtVersion -replace '\.','')" +
        ".win64_msvc2022_64'. Install it with the online installer of Qt, or" +
        " with a newer aqtinstall, and run this script again.")
}

Say "What is installed"
$found = [ordered] @{}
foreach ($pair in @(
        @("git", "git --version"),
        @("cmake", "cmake --version"),
        @("ninja", "ninja --version"),
        @("node", "node --version"),
        @("npm", "npm --version"),
        @("java", "java -version"))) {
    try {
        $line = (Invoke-Expression ($pair[1] + " 2>&1") | Select-Object -First 1)
    } catch {
        $line = "not found"
    }
    $found[$pair[0]] = $line
}
$found["qt"] = $prefix
$found.GetEnumerator() | ForEach-Object {
    "{0,-8} {1}" -f $_.Key, $_.Value
}

Write-Host ""
Say "The viewer is built from a terminal of the compiler:"
Write-Host @"
  "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
  cd \path\to\webodf
  npm install
  cmake -S . -B build -G Ninja -DWEBODF_DESKTOP=ON -DWEBODF_QTJSRUNTIME=ON -DCMAKE_PREFIX_PATH=$prefix

  rem The tests of the library, run in the webengine of qt: the whole suite of
  rem the browser, which is what tells that the library behaves here as it does
  rem elsewhere.
  cmake --build build --target test-qtjsruntime

  cmake --build build --target product-opendocumentviewer-desktop
  cmake --install build --prefix build\dist
  iscc build\programs\opendocumentviewer-desktop\opendocumentviewer.iss
"@
