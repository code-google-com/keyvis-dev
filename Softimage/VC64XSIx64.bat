@echo off

call "C:\Program Files\Autodesk\Softimage 2011 SP1\Application\bin\Setenv.bat"
call "C:\Program Files (x86)\Microsoft Visual Studio 9.0\VC\vcvarsall.bat" amd64

set PATH
set XSISDK_ROOT="C:\Program Files\Autodesk\Softimage 2011 SP1\XSISDK"

"C:\Program Files (x86)\Microsoft Visual Studio 9.0\Common7\IDE\devenv.exe" /useenv

echo on
rem pause
