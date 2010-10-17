// message filter class for recognizing mouseclicks in Softimage window, which closes QMenu
// "subclassing"

#pragma once

using namespace System;


//________________________________________________________________________
public ref class SIMessageFilter : public Windows::Forms::IMessageFilter
{
public:
	SIMessageFilter(){}	// Constructor

	virtual bool PreFilterMessage( Windows::Forms::Message % m );

// private:
// 	IntPtr _hwnd;
};