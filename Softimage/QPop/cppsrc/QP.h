#pragma once

#include <xsi_application.h>
#include <xsi_context.h>
#include <xsi_pluginregistrar.h>
#include <xsi_status.h>
#include <xsi_argument.h>
#include <xsi_command.h>
#include <vcclr.h>
#include "QP.h"
#include "QPNode.h"
#include "QPMenu.h"
#include "WindowWrapper.h"
#include "SIMessageFilter.h"



using namespace System;


//________________________________________________________________________

ref class QP
{
private:
	[Runtime::InteropServices::DllImportAttribute("User32.dll")]
	static IntPtr SetForegroundWindow(int hWnd);

public:
// hint: no global variables in .net! static class members have to be used, hence this class.
// values can only be assigned to constants here (static const ...)!
// static variables have to be initialized at runtime!

	static IntPtr hwnd;				// store handle to Softimage window

	static SIMessageFilter^ siMessageFilter;
	static WindowWrapper^ SIwrapper;
	static QPNode^ argTree;

	//static bool allowDeactivate;	// to prevent menus from exiting too early
	static bool lockExit;			// to avoid multiple Exit()
	static bool waitForKeyUp;		// needed for supra key support
	static long startTime;			// initialized immediately at start

	static array<QPMenu^>^ menus;	// array of all menus and SubMenus
	static QPMenu^ topmostSubMenu;
	//static int mainMenuIndex;		// set in Menu constructor. The first not-empty menu that will be Run()
	static QPMenu^ mainMenu;
	static QPButton^ buttonUnderMouse;	// when in supra mode (the invoking key is held longer than ~300ms), and key is released, this menu button delivers the return value

// Layout constants
	static Drawing::Point center;	// mouse location, remembered when QMenu is called
// 	static Drawing::Rectangle primScrRect;	// X, Y, Width, Height: 0, 0, 1920, 1200 (on my dual monitor setup)
// 	static Drawing::Rectangle clickScrRect;	// X, Y, Width, Height: 1920, 0, 1600, 1200
// 	static Drawing::Rectangle clickScrWorkingArea;
// 	static Drawing::Point clickScrOffset;
// 	static Drawing::Point centerInClickScr;
	static int leftLimit;
	static int rightLimit;
	static int topLimit;
	static int bottomLimit;
	static const int textTab = 25;
	static const int buttonHeight = 17;
	static const Single buttonTextOffset = 21.0;
	static const int menuBorder = 1;
	static const int whitespace = 2 * menuBorder + 2;
	static const int separatorHeight = 10;
	static const int buttonX = menuBorder + 1;
	static Drawing::Font^ QPFont = gcnew Drawing::Font(L"Tahoma", 11, Drawing::FontStyle::Regular, Drawing::GraphicsUnit::Pixel);
	static Drawing::Font^ QPFontBold = gcnew Drawing::Font(L"Tahoma", 11, Drawing::FontStyle::Bold, Drawing::GraphicsUnit::Pixel);
	static Drawing::StringFormat^ stringFormat = Drawing::StringFormat::GenericTypographic;
	static const Drawing::Color backColor =						Drawing::Color::FromArgb(255, 224, 224, 224);
	static const Drawing::Color textColor =						Drawing::Color::Black;
	static const Drawing::Color inactiveTextColor =				Drawing::Color::FromArgb(255, 140, 140, 140);
	static const Drawing::Color highlightBackColor =			Drawing::SystemColors::MenuHighlight;	// blue
	static const Drawing::Color highlightTextColor =			Drawing::Color::White;
	static const Drawing::Color highlightInactiveTextColor =	Drawing::Color::FromArgb(255, 180, 180, 180);
	static const Drawing::Color titleBackColor =				Drawing::Color::FromArgb(255, 159, 156, 154);
	static const Drawing::Color titleHighlightBackColor =		Drawing::SystemColors::MenuHighlight;
	static const Drawing::Color viewportColor =					Drawing::Color::FromArgb(128, 128, 128);

// separator line colors
	static Drawing::Pen^ separatorColor1 = gcnew Drawing::Pen(Drawing::Color::FromArgb(255, 128, 128, 128));
	static Drawing::Pen^ separatorColor2 = gcnew Drawing::Pen(Drawing::Color::FromArgb(255, 234, 234, 234));

// icons
	static Drawing::Bitmap^ bitmapCheckbox;
	static Drawing::Bitmap^ bitmapDot;

// Return values
	static int returnMenuIndex;
	static int returnButtonIndex;



//________________________________________________________________________
// Initialize QMenu Quadrant Menus
// for some reason, .net List^ object cannot be used in C++ callback (compiler error C2526), so it has to be put in here
// hint: keyword "static" before functions means this function can be called via the classname - QP::QPRun
	static void QP::QPInitialize(String^ argString)
	{
		if(argString == "someString") return;
		//QP::allowDeactivate = false;
		QP::lockExit = true;
		QP::waitForKeyUp = true;	// next KeyDown event is ignored.
		QP::buttonUnderMouse = nullptr;
		QP::returnMenuIndex = -1;
		QP::returnButtonIndex = -1;
		//QP::mainMenuIndex = -1;
		QP::mainMenu = nullptr;
		QP::topmostSubMenu = nullptr;

// 		Assembly a = Assembly.GetExecutingAssembly();
// 
// 		QP::bitmapCheckbox = gcnew Drawing::Bitmap("checkmark.png");	// Type type, string resource

// get window handle of Softimage window, to make the QMenuMenus owned
		Diagnostics::Process^ currentProcess = Diagnostics::Process::GetCurrentProcess();
//		XSI::Application().LogMessage(L"current process: " + QP::StringToCString(currentProcess->ProcessName) );	// XSI
		QP::hwnd = currentProcess->MainWindowHandle;	
//		XSI::Application().LogMessage(L"SI HWnd: " + XSI::CValue( (LONG)((int)hwnd) ) );
//		Windows::Forms::MessageBox::Show(gcnew WindowWrapper(hwnd), "Message box attached to SI");

// 		array<Diagnostics::Process^>^ SIprocesses = Diagnostics::Process::GetProcessesByName("XSI");
// 		XSI::Application().LogMessage(L"number of XSI processes: " + XSI::CValue( (LONG)SIprocesses->Length) );	// 1

// using the class SIMessageFilter (implements interface PreFilterMessage), notifications sent to Softimage window can be tracked
// 		QP::SIwrapper = gcnew WindowWrapper((IntPtr)hwnd);	// hwnd is the handle of the Softimage window.
// 		QP::siMessageFilter = gcnew SIMessageFilter();
// 		Windows::Forms::Application::AddMessageFilter(QP::siMessageFilter);	// for recognizing SI's popup menus

//________________________________________________________________________
// parse the string and create the argument tree
		QP::argTree = gcnew QPNode(argString);
//		Windows::Forms::MessageBox::Show("number of [...]: " + argTree->nodeList->Count);
		if(argTree->nodeList->Count < 4) throw gcnew Exception("At least 4 menus expected (3 can be empty). [][xxx][][]");


//________________________________________________________________________
// create the first 4 menus = quad menus
		QP::menus = gcnew array<QPMenu^>(4);
		for(int i = 0; i < 4; i++)	// i < argTree->nodeList->Count
		{
// create menu from it's branch of the argument tree
			QP::menus[i] = gcnew QPMenu(argTree->nodeList[i]);
			QP::menus[i]->parentMenu = nullptr;
			QP::menus[i]->menuIndex = i;
// the first non-empty menu will be "mainMenu" = the one to Run()
			if(QP::menus[i]->exists && QP::mainMenu == nullptr) QP::mainMenu = QP::menus[i];
			QP::menus[i]->isSubMenu = false;	// the first 4 menus are no SubMenus
//			XSI::Application().LogMessage( L"main loop menuToRun: " + XSI::CValue( (LONG)QP::menuToRun ) );
		}
//		XSI::Application().LogMessage( L"run index: " + XSI::CValue( (LONG)menuToRun ) );
		if(mainMenu == nullptr) throw gcnew Exception("At least one of the first 4 [] must not be empty.");


// Menu sizes are known now (calculated in the constructors), so the menu locations around the clicked point can be set
		int leftMax = Math::Max(menus[0]->Size.Width, menus[3]->Size.Width);
		int rightMax = Math::Max(menus[1]->Size.Width, menus[2]->Size.Width);
		int upperMax = Math::Max(menus[0]->Size.Height, menus[1]->Size.Height);
		int lowerMax = Math::Max(menus[2]->Size.Height, menus[3]->Size.Height);


// multi-monitor support:
// the origin of screen space (complete desktop) is the upper left corner of the primary screen
//		Windows::Forms::Screen clickedScreen = Windows::Forms::Screen.FromPoint(QP::center);
		Drawing::Rectangle primScrRect = Windows::Forms::Screen::GetBounds(Drawing::Point(0, 0) );	// 0,0,1920,1200
		Drawing::Rectangle clickScrRect = Windows::Forms::Screen::GetBounds(center);
		Drawing::Rectangle clickScrWorkingArea = Windows::Forms::Screen::GetWorkingArea(center);
		Drawing::Point clickScrOffset = Drawing::Point(clickScrRect.X - primScrRect.X, clickScrRect.Y - primScrRect.Y);
		Drawing::Point centerInClickScr = Drawing::Point(QP::center.X - clickScrRect.X, QP::center.Y - clickScrRect.Y);

// check if screen boundaries are exceeded and re-align if necessary
		QP::leftLimit = clickScrOffset.X + clickScrWorkingArea.X;
		QP::rightLimit = clickScrOffset.X + clickScrWorkingArea.X + clickScrWorkingArea.Width;
		QP::topLimit = clickScrOffset.Y + clickScrWorkingArea.Y;
		QP::bottomLimit = clickScrOffset.Y + clickScrWorkingArea.Y + clickScrWorkingArea.Height;

		if(centerInClickScr.X < QP::leftLimit + leftMax)
			center.X = QP::leftLimit + leftMax;
		if(centerInClickScr.X > QP::rightLimit - rightMax)
			center.X = QP::rightLimit - rightMax;
		if(centerInClickScr.Y < QP::topLimit + upperMax)
			center.Y = QP::topLimit + upperMax;
		if(centerInClickScr.Y > QP::bottomLimit - lowerMax)
			center.Y = QP::bottomLimit - lowerMax;


// upper left menu location
		menus[0]->Location = Drawing::Point(center.X - menus[0]->Width, center.Y - menus[0]->Height);
//		XSI::Application().LogMessage( L"menu0.X " + XSI::CValue( (LONG)(menus[0]->Location.X) ) + L"   menu0.Y " + XSI::CValue( (LONG)(menus[0]->Location.Y) ) );
		menus[0]->alignLeft = false;
// upper right menu location
		menus[1]->Location = Drawing::Point(center.X, center.Y - menus[1]->Height);
		menus[1]->alignLeft = true;
// lower right menu location
		menus[2]->Location = Drawing::Point(center.X, center.Y);
		menus[2]->alignLeft = true;
// lower left menu location
		menus[3]->Location = Drawing::Point(center.X - menus[3]->Width, center.Y);
		menus[3]->alignLeft = false;


// make the menus owned
		for(int i = 0; i < 4; i++)
		{
			if(QP::menus[i]->exists) QP::menus[i]->Show(QP::SIwrapper);	// argument: handle of owner window (Softimage)
		}
// menus are in place, now it's ok to exit by deactivating
		//QP::allowDeactivate = true;
		QP::lockExit = false;

//		XSI::Application().LogMessage( L"running menu: " + XSI::CValue( (LONG)QP::menuToRun ) );
//		XSI::Application().LogMessage( L"running mainmenu...");
// run the first non-empty menu (if an empty menu is run, it gets the standard-titlebar)
// plugin callback QMenu_Execute is stopped, focus is passed to this menu.
		Windows::Forms::Application::Run(QP::mainMenu);
		// when QMenu exits, the callback continues here

		//Windows::Forms::Application::RemoveMessageFilter(QP::siMessageFilter);
		//QP::SetForegroundWindow((int)QP::hwnd);
	}


//________________________________________________________________________
// For deactivation: check if mouse is outside any menu boundary. If so, return true.
 	static bool hitTestAll(void)
 	{
		Drawing::Point mp = Windows::Forms::Control::MousePosition;
		bool hit = false;
		for(int i = 0; i < 4 ; i++)
		{
			if(!QP::menus[i]->exists) continue;
			if(QP::menus[i]->hitTest(mp) == true)
			{
				hit = true;	// if a menu is hit, we need not check further
				break;
			}
		}
		return hit;
	}


//________________________________________________________________________
// String conversion between managed C++ and unmanaged XSI
	static String^ CStringToString(const XSI::CString &CStr) // XSI CString to managed String
	{
		const wchar_t* wch = CStr.GetWideString();
		String^ Str = gcnew String(wch);
		return Str;
	}


//________________________________________________________________________
	static XSI::CString StringToCString(String^ Str)	// vice versa
	{
		pin_ptr<const wchar_t> wch = PtrToStringChars(Str);	// vcclr.h
		XSI::CString cstr = L"";
		cstr += XSI::CString(wch);
		return cstr;
	}


//________________________________________________________________________
// Convert a managed (always wide char) string to an unmanaged wide char string and log it to XSI
	static void XSILogMessage(String^ Str)
	{
		XSI::CString logstring = StringToCString(Str);
		XSI::Application().LogMessage(logstring);
	}


//________________________________________________________________________
	static void exitQMenu()
	{
		if(QP::lockExit) return;				// just to make sure
		//QP::mainMenu->Close();
		QP::lockExit = true;					// to block multiple exiting
		QP::SetForegroundWindow((int)QP::hwnd);	// give focus to Softimage window
		Windows::Forms::Application::Exit();	// exit
	}
};
