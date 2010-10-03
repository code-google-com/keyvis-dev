@echo off

call "C:\Softimage\XSI_7.01_x64\Application\bin\Setenv.bat"
call "C:\Program Files (x86)\Microsoft Visual Studio 9.0\VC\vcvarsall.bat" amd64

set PATH
set XSISDK_ROOT="C:\Softimage\XSI_7.01_x64\XSISDK"

"C:\Program Files (x86)\Microsoft Visual Studio 9.0\Common7\IDE\devenv.exe" /useenv

echo on
