/*//////////////////////////////////////////////////////////////////////////
	QMenu: quadrant pop-up menu for Autodesk Softimage
	2009 by Eugen Sares
//////////////////////////////////////////////////////////////////////////*/

#pragma once

#include "QP.h"
#include "QPNode.h"

using namespace System;


//________________________________________________________________________
XSIPLUGINCALLBACK XSI::CStatus XSILoadPlugin( XSI::PluginRegistrar& in_reg )
{
	in_reg.PutAuthor(L"Eugen Sares");
	in_reg.PutName(L"QMenuRenderer");
	in_reg.PutEmail(L"eugen@keyvis.at");
	in_reg.PutURL(L"");
	in_reg.PutVersion(1,0);
	in_reg.RegisterCommand(L"QMenuRender",L"QMenuRender");

	return XSI::CStatus::OK;
}


//________________________________________________________________________
XSIPLUGINCALLBACK XSI::CStatus XSIUnloadPlugin( const XSI::PluginRegistrar& in_reg )
{
	XSI::CString strPluginName;
	strPluginName = in_reg.GetName();
	//XSI::Application().LogMessage(strPluginName + L" has been unloaded.", XSI::siVerboseMsg);
	return XSI::CStatus::OK;
}


//________________________________________________________________________
XSIPLUGINCALLBACK XSI::CStatus QMenuRender_Init( XSI::CRef& in_ctxt )
{
	XSI::Context ctxt( in_ctxt );
	XSI::Command oCmd;
	oCmd = ctxt.GetSource();
	oCmd.PutDescription(L"");
	oCmd.EnableReturnValue(true);

	oCmd.SetFlag(XSI::siSupportsKeyAssignment, true);	// Specifies whether a keyboard shortcut can be assigned to the command in the Keyboard Mapping dialog box.
	oCmd.SetFlag(XSI::siCannotBeUsedInBatch, true);		// Specifies whether the command can be used in scripts run from the command line using xsibatch or xsi -script.
	oCmd.SetFlag(XSI::siNoLogging, true);				// Specifies whether the command is logged to the command history.

	XSI::ArgumentArray oArgs;
	oArgs = oCmd.GetArguments();

	// You must mention the arguments you want
	// The name is not important but must be unique

	oArgs.Add(L"menuSafeArray", L"someString");	// The first QMenu argument: a CString, syntax see below
// 	Unfortunately, an CValueArray of CValueArrays of CValueArrays does not work correctly as argument
// 	Therefore, all arguments are passed in one CString with this format:
// 	[
// 	[[buttonLabel00][subMenuIdx][isActive]]
// 	[[buttonLabel01][subMenuIdx][isActive]]
// 	...
// 	[[buttonLabel0n][subMenuIdx][isActive]]
// 	]
// 	[
// 	[[buttonLabel10][subMenuIdx][isActive]]
// 	[[buttonLabel11][subMenuIdx][isActive]]
// 	...
// 	[[buttonLabel1n][subMenuIdx][isActive]]
// 	]
// 	...
// 	[
// 	[[buttonLabel10][subMenuIdx][isActive]]
// 	[[buttonLabel11][subMenuIdx][isActive]]
// 	...
// 	[[buttonLabel1n][subMenuIdx][isActive]]
// 	]

// Argument are not checked for correctness - the calling script is responsible

	// the second argument is the window handle hWnd, to parent the QPMenus to the SI window
//	oArgs.Add(L"handle", 0l);

	// Windows::Forms::Application::EnableVisualStyles(); // Controls look like desktop theme
	// Windows::Forms::Application::SetCompatibleTextRenderingDefault(false);	// crashes XSI when invoked for the second time!!

	return XSI::CStatus::OK;
}


//________________________________________________________________________
XSIPLUGINCALLBACK XSI::CStatus QMenuRender_Execute( XSI::CRef& in_ctxt )
{
	try
	{
		QP::startTime = (long)DateTime::Now.Ticks;
		QP::center = Windows::Forms::Control::MousePosition;

		XSI::Context ctxt( in_ctxt );	// The main reason context objects are used in XSI is to ensure backward compatibility for XSI plugins.
		XSI::CValueArray cvarr = ctxt.GetAttribute(L"Arguments");	// GetCount: 1
		XSI::CValue args = cvarr[0];
// 		XSI::CString argstring = args.GetAsText();
// 		XSI::Application().LogMessage(L"argstring: " + argstring);

		String^ argString = QP::CStringToString(args);
// 		XSI::Application().LogMessage(L"argString: " + QP::StringToCString(argString) );
// 		XSI::Application().LogMessage(L"length: " + XSI::CValue( (LONG)argString->Length) );
//		if(argString != "someString")	// crap: an empty string becomes "someString" for whatever reason
		
		//throw gcnew Exception("String argument needed!");
		Diagnostics::Process^ currentProcess = Diagnostics::Process::GetCurrentProcess();
//		XSI::Application().LogMessage(L"current process: " + QP::StringToCString(currentProcess->ProcessName) );	// XSI
		IntPtr hwnd = currentProcess->MainWindowHandle;	// window handle of Softimage window
//		XSI::Application().LogMessage(L"SI HWnd: " + XSI::CValue( (LONG)((int)hwnd) ) );
//		Windows::Forms::MessageBox::Show(gcnew WindowWrapper(hwnd), "Message box attached to SI");
	// 		array<Diagnostics::Process^>^ SIprocesses = Diagnostics::Process::GetProcessesByName("XSI");
// 		XSI::Application().LogMessage(L"number of XSI processes: " + XSI::CValue( (LONG)SIprocesses->Length) );	// 1
		QP::SIwrapper = gcnew WindowWrapper((IntPtr)hwnd);	// hwnd is the handle of the Softimage window
	// 		QP::siMessageFilter = gcnew SIMessageFilter();
// 		Windows::Forms::Application::AddMessageFilter(QP::siMessageFilter);	// for recognizing mouse clicks outside QMenu

// MAIN CALL
		QP::QPInitialize(argString);	// some .net objects cannot reside in this C++ callback, so this function is needed


		XSI::CValueArray retArray;	// for returning multiple arguments to SI from a C++ command 
		retArray.Add(XSI::CValue(QP::returnMenuIndex));
		retArray.Add(XSI::CValue(QP::returnButtonIndex));
//		XSI::Application().LogMessage(L"index0: " + retArray[0].GetAsText());	// test
//		XSI::Application().LogMessage(L"index1: " + retArray[1].GetAsText());	// test

		XSI::CValue retval1 = XSI::CValue(QP::returnMenuIndex);
		XSI::CValue retval2 = XSI::CValue(QP::returnButtonIndex);

// Return a value by setting this attribute:
		ctxt.PutAttribute(L"ReturnValue", retArray);
		return XSI::CStatus::OK;
	}	// end of try block

	catch (Exception^ e)
	{
		String^ Str = e->ToString();
//		Str = L"QMenu Error: " + Str;
		QP::XSILogMessage(Str);

		return XSI::CStatus::Fail;	// Return CStatus::Fail if you want to raise a script error
	}
}

