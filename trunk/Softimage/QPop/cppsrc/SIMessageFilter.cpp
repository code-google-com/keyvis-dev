// listen to notifications sent to SI window
// obsolete, since closing via deactivate works!

#include "SIMessageFilter.h"
#include "QP.h"


//________________________________________________________________________
// SIMessageFilter::SIMessageFilter(IntPtr handle)	// Constructor
// {
// 	_hwnd = handle;
// }


//________________________________________________________________________
[Security::Permissions::SecurityPermission(Security::Permissions::SecurityAction::LinkDemand, Flags = Security::Permissions::SecurityPermissionFlag::UnmanagedCode)]
bool SIMessageFilter::PreFilterMessage( Windows::Forms::Message % m )
{
	if(QP::lockExit) return false;

	// notifications that will quit QMenu
//	const Int32 WM_ACTIVATE			= 0x0006;	// The WM_ACTIVATE message is sent to both the window being activated and the window being deactivated.
//	const Int32 WM_ACTIVATEAPP		= 0x001C;	// The WM_ACTIVATEAPP message is sent when a window belonging to a different application than the active window is about to be activated.
//	const Int32 WM_MOUSEACTIVATE	= 0x0021;	// The WM_MOUSEACTIVATE message is sent when the cursor is in an inactive window and the user presses a mouse button.
//	const Int32 WM_NCACTIVATE		= 0x0086;
//	const Int32 WM_NCLBUTTONDOWN	= 0x00A1;
//	const Int32 WM_NCRBUTTONDOWN	= 0x00A4;
// 	const Int32 WM_NCMBUTTONDOWN	= 0x00A7;
// 	const Int32 WM_LBUTTONDOWN		= 0x0201;
// 	const Int32 WM_RBUTTONDOWN		= 0x0204;
// 	const Int32 WM_MBUTTONDOWN		= 0x0207;
	const Int32 WM_INITMENUPOPUP	= 0x117;

// 	String^ hexstring = Convert::ToString(m.Msg, 16);	// base 16, hex
// 	XSI::CValue cv = QP::StringToCString(hexstring);
// 	XSI::Application().LogMessage( L"WndProc: " + cv);

	switch(m.Msg)
	{
//  	case WM_LBUTTONDOWN:
// 		XSI::Application().LogMessage(L"WM_LBUTTONDOWN");
// 		if(!QP::hitTestAll()) QP::mainMenu->Close();
// 		break;
// 	case WM_NCACTIVATE:
// 		XSI::Application().LogMessage(L"WM_NCACTIVATE");
// 		break;
// 	case WM_MBUTTONDOWN:
// 	case WM_RBUTTONDOWN:
// 	case WM_NCLBUTTONDOWN:
// 	case WM_NCRBUTTONDOWN:
// 	case WM_NCMBUTTONDOWN:
//	case WM_MOUSEACTIVATE:
	case WM_INITMENUPOPUP:
		XSI::Application().LogMessage(L"WM_INITMENUPOPUP");
		if(!QP::hitTestAll()) Windows::Forms::Application::Exit(); //QP::mainMenu->Close();
		break;
	}
	return false;
}