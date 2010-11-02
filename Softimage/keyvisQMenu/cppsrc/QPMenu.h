// QPMenu class declaration

#pragma once

#include <xsi_application.h>
#include <xsi_context.h>
#include <xsi_pluginregistrar.h>
#include <xsi_status.h>
#include <xsi_argument.h>
#include <xsi_command.h>
#include "QP.h"
#include "QPNode.h"
#include "QPButton.h"

using namespace System;

//________________________________________________________________________

public ref class QPMenu : public Windows::Forms::Form
{
public:
	QPMenu(QPNode^ argTree);	// Constructor
//	~QPMenu();	// Destructor

	//static Control^ FromHandle (IntPtr handle);
	bool exists;
	bool isSubMenu;
	int menuIndex;				// one of the 2 return values of QMenu
	QPMenu^ openSubMenu;
	int openSubMenuIndex;
	QPMenu^ parentMenu;			// set in function that instances a QPMenu
	QPButton^ blueButton;		// remember button with open SubMenu. The button stays blue as long as the SubMenu is open.
	bool isClosing;				// to prevent deactivate event after ESC
	bool alignLeft;				// true is the buttons are left aligned
	bool alignTop;				// true if the menu title is displayed at the top
	Drawing::Size buttonSize;	// for dynamic menu width: after the complete menu is created, the maximum width is known. The buttons can fetch it here.
	Drawing::Size menuSize;		// remember menu size. There's a Size property, of course, but there's a bug that prevents forms from being smaller than 124x30px.
								// Workaround: Size has to be set again in Load event

	//Reflection::Assembly^ assembly;
// 	Resources::ResourceManager^ resources;
// 	Drawing::Bitmap^ bitmapCheckbox;

	Collections::Generic::List<Drawing::Point>^ separators;
	void closeSubMenu();
	bool hitTest(Drawing::Point mp);

protected:
	virtual void OnPaint(Windows::Forms::PaintEventArgs^ e) override;
	virtual void OnPaintBackground(Windows::Forms::PaintEventArgs^ e) override;
	virtual void WndProc(Windows::Forms::Message% m ) override;

//	virtual bool ProcessCmdKey(Windows::Forms::Message% m, Windows::Forms::Keys keyData) override;	// for ALT+TAB, but not working
//	virtual IntPtr LowLevelKeyboardProc(int nCode, Windows::Forms::Message::WParam wparam, Windows::Forms::Message::LParam lparam) override;

private:
// 	Drawing::Bitmap^ backBuffer;	// for manual Double-Buffering. Slower than automatic DB!

	void QPMenu_Activated(Object^ sender, EventArgs^ e);
	void QPMenu_Deactivate(Object^ sender, EventArgs^ e);
//	void QPMenu_LostFocus(Object^ sender, EventArgs^ e);	// Occurs when the control loses focus. (Inherited from Control.)
//	void QPMenu_Leave(Object^ sender, EventArgs^ e);	// 	Occurs when the input focus leaves the control. (Inherited from Control.)

//	void QPMenu_MouseDown(Object^ sender, Windows::Forms::MouseEventArgs^ e);
	void QPMenu_MouseEnter(Object^ sender, EventArgs^ e);
	void QPMenu_KeyDown(Object^ sender, Windows::Forms::KeyEventArgs^ e); // ESC closes last open menu, Space all menus
//	void QPMenu_KeyPress(Object^ sender, Windows::Forms::KeyPressEventArgs^ e);
	void QPMenu_KeyUp(Object^ sender, Windows::Forms::KeyEventArgs^ e);
	void QPMenu_Load(Object^ sender, EventArgs^ e );	// needed because of the "minimum size bug"
//	void QPMenu_Click(Object^  sender, EventArgs^  e);
//	void QPMenu_FormClosing(Object^ sender, Windows::Forms::FormClosingEventArgs^ e);
//	void QPMenu_ApplicationExit(...);

};
