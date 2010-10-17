#include "QP.h"
#include "QPNode.h"
#include "QPMenu.h"
#include "QPButton.h"

using namespace System;


//________________________________________________________________________

QPMenu::QPMenu(QPNode^ argTree/*, int menuIndex*/)	// Constructor
{
//	XSI::Application().LogMessage( L"creating QPMenu: " + XSI::CValue( (LONG)menuIndex ));
//	XSI::Application().LogMessage( L"creating QPMenu. handle: " + XSI::CValue( (LONG)( (int)this->Handle ) ) );
	this->openSubMenuIndex = -1;	// No open SubMenu
	this->openSubMenu = nullptr;
	this->blueButton = nullptr;
	//this->menuIndex = menuIndex;
	this->isClosing = false;

// FormBorderStyle has to be set before Size!
// problem: minimum size of (124, 30) = border plus buttons -> set Size again in FormLoad event
																	
	this->FormBorderStyle = Windows::Forms::FormBorderStyle::None;
//	this->FormBorderStyle = Windows::Forms::FormBorderStyle::FixedToolWindow;	// no icons are shown in the task switcher, but it has a border
	this->ControlBox = false;
	this->MinimizeBox = false;
	this->MaximizeBox = false;
	this->ShowInTaskbar = false;
//	this->MinimumSize = Drawing::Size(0, 0);
	this->Size = Drawing::Size(0, 0);

	if(!argTree->nodeList->Count)	// no nodes (menu entries) found: this menu is going to be empty
	{
		this->exists = false;
		return;
	}

	this->exists = true;

// for icons
// 	this->resources = gcnew Resources::ResourceManager("QMenu.QMenuIcons", Reflection::Assembly::GetAssembly(this->GetType() ) );
// 	this->bitmapCheckbox = Resources::ResourceManager::GetObject();

	//if(QP::mainMenuIndex == -1) QP::mainMenuIndex = menuIndex;	// first non-empty menu will be run
	this->blueButton = nullptr;	// used for clearing this button's blue highlight
	this->buttonSize = Drawing::Size(0, QP::buttonHeight);
	this->separators = gcnew Collections::Generic::List<Drawing::Point>(3);	// dynamic list of separator coordinates. 3 is just the default length, can have more.
	this->SuspendLayout();
	this->StartPosition = Windows::Forms::FormStartPosition::Manual;
	this->AutoScaleMode = Windows::Forms::AutoScaleMode::None;
	//this->BackColor = Drawing::Color::Beige;	// overridden
	this->Name = L"QPMenu";
	this->Text = L"";
	this->Font = QP::QPFont;
	QP::returnMenuIndex = -1;
	QP::returnButtonIndex = -1;
// Double-buffering stuff http://msdn.microsoft.com/en-us/library/system.windows.forms.controlstyles.aspx
// ControlStyles-Enumeration
 	this->SetStyle(Windows::Forms::ControlStyles::UserPaint |	// control paints itself rather than the operating system
		Windows::Forms::ControlStyles::DoubleBuffer |			// AllPaintingInWmPaint style is also set
 		Windows::Forms::ControlStyles::AllPaintingInWmPaint |	// causes the WM_ERASEBKGRND message to be ignored and helps eliminate the flicker
 		Windows::Forms::ControlStyles::OptimizedDoubleBuffer |
 		Windows::Forms::ControlStyles::Opaque
		//Windows::Forms::ControlStyles::Selectable
		, true);

//________________________________________________________________________
// fill this menu with buttons according to argument tree
	Drawing::Point pos = Drawing::Point(QP::buttonX, QP::menuBorder + 1);	// Start position for the Buttons, top left of the menu
	int maxWidth = 0;	// increased with each wider button
	QPNode^ buttonArgs;

//	XSI::Application().LogMessage( L"menu count: " + XSI::CValue( (LONG)argTree->nodeList->Count ) );
	for(int i = 0; i < argTree->nodeList->Count; i++)
	{
		buttonArgs = argTree->nodeList[i];
		if(!buttonArgs->nodeList->Count)
		{
			
// blank entries [] are interpreted as separator lines.
 			this->separators->Add( Drawing::Point(pos.X, pos.Y) );
// 			QPSeparator^ separator = gcnew QPSeparator();
// 			separator->Location = Drawing::Point(pos.X, pos.Y);
// 			this->Controls->Add(separator);
 			pos.Y += QP::separatorHeight;
		} else
		{
// regular button
			QPButton^ button = gcnew QPButton(buttonArgs);
			if(button->textDim.Width > maxWidth) maxWidth = button->textDim.Width;	// float to int conversion!
			button->buttonIndex = i;
			button->containingMenu = this;
			button->Location = Drawing::Point(pos.X, pos.Y);
//			XSI::Application().LogMessage( L"button y: " + XSI::CValue( (LONG)button->Location.Y ) );
			this->Controls->Add(button);

			pos.Y += QP::buttonHeight;
//			XSI::Application().LogMessage( L"pos.Y: " + XSI::CValue( (LONG)pos.Y ) );
		}
	}

// maxWidth is known now
	this->menuSize = Drawing::Size(maxWidth + 2 * QP::buttonTextOffset + QP::whitespace, pos.Y + QP::menuBorder + 1);
	this->Size = this->menuSize;
	this->buttonSize.Width = maxWidth + 2 * QP::buttonTextOffset;	// this menu's button width

// hook into event handler delegates
	//this->Activated += gcnew EventHandler(this, &QPMenu::QPMenu_Activated);
	this->Deactivate += gcnew EventHandler(this, &QPMenu::QPMenu_Deactivate);
	this->MouseEnter += gcnew EventHandler(this, &QPMenu::QPMenu_MouseEnter);
	this->KeyDown += gcnew Windows::Forms::KeyEventHandler(this, &QPMenu::QPMenu_KeyDown);
	this->KeyUp += gcnew Windows::Forms::KeyEventHandler(this, &QPMenu::QPMenu_KeyUp);
	//this->KeyPress += gcnew Windows::Forms::KeyPressEventHandler(this, &QPMenu::QPMenu_KeyPress);
	this->Load += gcnew EventHandler(this, &QPMenu::QPMenu_Load);	// needed because of the "minimum size bug"
	//this->FormClosing += gcnew Windows::Forms::FormClosingEventHandler(this, &QPMenu::QPMenu_FormClosing);
}
// end of Constructor


//________________________________________________________________________
// QPMenu::~QPMenu()
// {
// 	XSI::Application().LogMessage( L"destructing menu: " + XSI::CValue( (LONG)this->menuIndex) );
// }


//________________________________________________________________________
// filter WM_MOUSEACTIVATE notification
// otherwise a clicked SubMenu will be brought in the foreground
[Security::Permissions::SecurityPermission(Security::Permissions::SecurityAction::Demand, Flags=Security::Permissions::SecurityPermissionFlag::UnmanagedCode)]
void QPMenu::WndProc(Windows::Forms::Message% m )
{
	const Int32 WM_MOUSEACTIVATE	= 0x0021;
/*	const Int32 MA_NOACTIVATE		= 0x0003;*/
	const Int32 MA_NOACTIVATEANDEAT = 0x0004;
// 	const Int32 WM_ACTIVATEAPP		= 0x001C;
// 	const Int32 WM_ACTIVATE			= 0x0006;
// 	const Int32 WM_NCACTIVATE		= 0x0086;	// happens here
// 	const Int32 WM_LBUTTONDOWN		= 0x201;
//	const Int32 WM_INITMENUPOPUP	= 0x117;

// 	String^ hexstring = Convert::ToString(m.Msg, 16);
// 	XSI::CValue cv = QP::StringToCString(hexstring);
// 	XSI::Application().LogMessage( L"WndProc: " + cv);

	switch(m.Msg)
	{
// a clicked menu must not be brought to front
	case WM_MOUSEACTIVATE:
//		XSI::Application().LogMessage( L"WM_MOUSEACTIVATE");
//		XSI::Application().LogMessage(L"HWnd: " + XSI::CValue( (LONG)((int)m.HWnd) ) );
		m.Result = (IntPtr)MA_NOACTIVATEANDEAT;	// MA_NOACTIVATE seems to work as well
		break;
// 	case WM_INITMENUPOPUP:
// 		XSI::Application().LogMessage( L"WM_INITMENUPOPUP");	// not working

	default:
		Windows::Forms::Form::WndProc( m );
	}	
}


//________________________________________________________________________
void QPMenu::QPMenu_Activated(Object^ sender, EventArgs^ e)
{	
//	XSI::Application().LogMessage( L"activated menu: " + XSI::CValue( (LONG)this->menuIndex ));
}


//________________________________________________________________________
void QPMenu::QPMenu_Deactivate(Object^  sender, EventArgs^  e)	// sent when mouse is clicked outside or another menu is opened
{
	if(QP::lockExit) return;
	if(this->isClosing) return;
	if(!QP::hitTestAll()) QP::exitQMenu();
}


//________________________________________________________________________
void QPMenu::QPMenu_MouseEnter(Object^ sender, EventArgs^ e)
{
//	XSI::Application().LogMessage( L"menu was entered.");
	if(this->openSubMenu)
	{
		//QP::closeSubMenu(this);
		this->closeSubMenu();
	}
}


//________________________________________________________________________
// Close this SubMenu and all it's SubMenus
void QPMenu::closeSubMenu()
// Sub-SubMenu closing is handled by Windows, because SubMenus are "owned" by their parent
{
//	XSI::Application().LogMessage( L"CloseSubMenu called, menu" + XSI::CValue( (LONG)this->menuIndex ));
	if(!this->openSubMenu) return;	// if no SubMenu is open, do nothing

// close SubSubmenus recursively
	this->openSubMenu->closeSubMenu();
// close the SubMenu of this menu
	this->openSubMenu->isClosing = true;
	this->openSubMenu->Close();	// Sub-Sub-Menus are closed because they are owned
	this->openSubMenu = nullptr;
	this->openSubMenuIndex = -1;
	if(this->isSubMenu)
	{
// if this menu is a SubMenu, make it the new topmost menu
		QP::topmostSubMenu = this;
	}
	else
	{
// if this menu is a QuadMenu
		QP::topmostSubMenu = nullptr;
	}

// an open SubMenu always has a corresponding blue button
// render that button gray
	this->blueButton->isBlue = false;
	Drawing::Graphics^ g = this->blueButton->CreateGraphics();
 	this->blueButton->redrawButton(g);
	this->blueButton = nullptr;
}


//________________________________________________________________________
// is the mouse position inside this menu or any of it's SubMenus?
bool QPMenu::hitTest(Drawing::Point mp)
{
//	XSI::Application().LogMessage( L"hit testing in menu " + XSI::CValue( (LONG)this->menuIndex ));
	//Drawing::Point mp = Windows::Forms::Control::MousePosition;
	Drawing::Rectangle rect = this->RectangleToScreen(this->ClientRectangle);

	if(rect.Contains(mp))
	{
		return true;
	}
	else if(this->openSubMenu == nullptr)
	{
		return false;
	}
	else
	{
		return(this->openSubMenu->hitTest(mp));
	}
}


//________________________________________________________________________

void QPMenu::QPMenu_KeyDown(Object^ sender, Windows::Forms::KeyEventArgs^  e)
{
	if(QP::lockExit) return;
//	XSI::Application().LogMessage( L"QPMenu_KeyDown event");
	if(QP::waitForKeyUp) return;	// no KeyDown events allowed before the first KeyUp event!

// 	if(e->KeyCode == Windows::Forms::Keys::Space /*|| e->KeyCode == Windows::Forms::Keys::Tab*/ )	// Space exits (...toggles)
// 	{
// 		//Windows::Forms::Application::Exit();
//		QP::mainMenu->Close();
// 	}

	if(e->KeyCode == Windows::Forms::Keys::Escape)
	{
//		XSI::Application().LogMessage( L"ESC pressed, menu:" + XSI::CValue( (LONG)this->menuIndex )  );
		if(QP::topmostSubMenu == nullptr)
// if there's no SubMenu open, exit QMenu
		{
			QP::exitQMenu();
		}
// if a SubMenu is open, close it
		else
		{
//			XSI::Application().LogMessage( L"topmost menu is not null. closing SubMenu index: " + XSI::CValue( (LONG)QP::topmostSubMenu->menuIndex )  );
			QP::topmostSubMenu->parentMenu->closeSubMenu();
		}
	}
}


//________________________________________________________________________

void QPMenu::QPMenu_KeyUp(System::Object^ sender, System::Windows::Forms::KeyEventArgs^ e)
{
	 
	if(e->KeyCode == Windows::Forms::Keys::Escape)
	{
//		XSI::Application().LogMessage( L"ESC keyup event. ignored.");
		return;
	}
//	XSI::Application().LogMessage( L"keyup event.");

	QP::waitForKeyUp = false;	// next KeyDown event will be processed
	long delay = ((long)DateTime::Now.Ticks - QP::startTime) / 10000;	// ticks/10000: milliseconds

	if(delay > 300)
	{
//		XSI::Application().LogMessage( L"ESC keycode: " + XSI::CValue( (LONG)Windows::Forms::Keys::Escape) );	// 27

//supra mode: KeyUp closes menu, but the command associated with the button under the mouse pointer is activated!
// could be that no button has been entered yet

		if(QP::buttonUnderMouse)	// mouse pointer was over a button?
		{
			QP::returnButtonIndex = QP::buttonUnderMouse->buttonIndex;
 			QP::returnMenuIndex =  QP::buttonUnderMouse->containingMenu->menuIndex;
		}
		QP::exitQMenu();
	}
//	XSI::Application().LogMessage( L"keyup event after: " + XSI::CValue( (LONG)delay ) + " msec");
}


//________________________________________________________________________

// void QPMenu::QPMenu_KeyPress(System::Object^ sender, System::Windows::Forms::KeyPressEventArgs^ e)
// {
// 	XSI::Application().LogMessage( L"keypress event" );
// 	Media::SystemSounds::Asterisk->Play();	// for testing
// }


//________________________________________________________________________

void QPMenu::OnPaint(Windows::Forms::PaintEventArgs^ e)
{
// 	if(this->backBuffer == nullptr)
// 	{
// 		this->backBuffer = gcnew Drawing::Bitmap(this->ClientSize.Width, this->ClientSize.Height);
// 	}

//	Drawing::Graphics^ g = Drawing::Graphics::FromImage(this->backBuffer);
	Drawing::Graphics^ g = e->Graphics;

	Drawing::SolidBrush^ viewportColor = gcnew Drawing::SolidBrush(QP::viewportColor);
	g->FillRectangle(viewportColor, 0, 0, this->Size.Width, this->Size.Height);

	Drawing::SolidBrush^ menuColor = gcnew Drawing::SolidBrush(QP::backColor);
	g->FillRectangle(menuColor, 1, 1, this->Size.Width - 2, this->Size.Height - 2);

	g->DrawLine(Drawing::Pens::Black, 2, 0, this->Size.Width - 3, 0);
	g->DrawLine(Drawing::Pens::Black, this->Size.Width - 3, 0, this->Size.Width - 1, 2);
	g->DrawLine(Drawing::Pens::Black, this->Size.Width - 1, 2, this->Size.Width - 1, this->Size.Height - 3);
	g->DrawLine(Drawing::Pens::Black, this->Size.Width - 1, this->Size.Height - 3, this->Size.Width - 3, this->Size.Height - 1);
	g->DrawLine(Drawing::Pens::Black, this->Size.Width - 3, this->Size.Height - 1, 2, this->Size.Height - 1);
	g->DrawLine(Drawing::Pens::Black, 2, this->Size.Height - 1, 0, this->Size.Height - 3);
	g->DrawLine(Drawing::Pens::Black, 0, this->Size.Height - 3, 0, 2);
	g->DrawLine(Drawing::Pens::Black, 0, 2, 2, 0);
	
	delete menuColor;

	for(int i = 0; i < this->separators->Count; i++)
	{
		int y = this->separators[i].Y + QP::separatorHeight / 2;
		g->DrawLine(QP::separatorColor1, 4, y, this->Size.Width - 4, y);			// QP::buttonWidth - 2
		g->DrawLine(QP::separatorColor2, 4, y + 1, this->Size.Width - 4, y + 1);
	}

// 	delete g;
// 	e->Graphics->DrawImageUnscaled(this->backBuffer, 0, 0);
}


//________________________________________________________________________
void QPMenu::OnPaintBackground(Windows::Forms::PaintEventArgs^ e)
{

}


//________________________________________________________________________
// Size has to be set again in Load event handler
// this workaround is needed because of the "minimum size bug".
// Load event occurs before a form is displayed for the first time.
void QPMenu::QPMenu_Load( System::Object^ sender, System::EventArgs^ e )
{
	this->Size = this->menuSize;
//	XSI::Application().LogMessage( L"load event size width: " + XSI::CValue( (LONG)this->Size.Width ) );
}

//________________________________________________________________________
