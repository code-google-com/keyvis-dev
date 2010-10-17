// wrapper class that implements IWin32Window
// see http://ryanfarley.com/blog/archive/2004/03/23/465.aspx

using namespace System;

public ref class WindowWrapper : Windows::Forms::IWin32Window	// IWin32Window: provides an interface to expose Win32 HWND handles
{
public:
	WindowWrapper(IntPtr handle)	// Constructor
	{
		_hwnd = handle;
	}

	property IntPtr Handle	// IWin32Window has one property: Handle
	{
		virtual IntPtr get()
		{
			return _hwnd;
		}
	}

private:
	IntPtr _hwnd;

};