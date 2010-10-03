@echo off

call "C:\Program Files\Autodesk\Softimage 2011 SP1\Application\bin"
call "C:\Program Files (x86)\Microsoft Visual Studio 9.0\VC\vcvarsall.bat" x86

set PATH
set XSISDK_ROOT="C:\Program Files\Autodesk\Softimage 2011 SP1\XSISDK"

"C:\C:\Program Files (x86)\Microsoft Visual Studio 9.0\Common7\IDE\devenv.exe" /useenv

echo on
