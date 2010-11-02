// QPButton class declaration

#pragma once

#include <xsi_application.h>
#include <xsi_context.h>
#include <xsi_pluginregistrar.h>
#include <xsi_status.h>
#include <xsi_argument.h>
#include <xsi_command.h>
#include "QP.h"
#include "QPNode.h"
//#include "QPMenu.h"


using namespace System;

ref class QPMenu;	// #include "QPMenu.h" would lead to a circular include (compiler error C2143, C4430)

//________________________________________________________________________
// Since "real" Buttons make troubles with double buffering, Panels are used instead.
// Panels can also register a Click event.
public ref class QPButton : public Windows::Forms::Panel
{
public:
	int buttonIndex;	// // one of the 2 return values of QMenu
	QPMenu^ containingMenu;	//
	String^ buttonLabel;
	int subMenuIndex;
	//bool hasOpenSubMenu;
	//QPMenu^ buttonOpenSubMenu;
	bool isActive;
	bool isTitle;
	bool isToggle;
	bool isBlue;
	Drawing::SizeF textDim;

	QPButton(QPNode^ argTree);	// Constructor
	void redrawButton(Drawing::Graphics^ g);

protected:
	virtual void OnPaint(Windows::Forms::PaintEventArgs^ e) override;

private:
	void QPButton_MouseEnter(Object^ sender, EventArgs^ e);
	void QPButton_MouseLeave(Object^ sender, EventArgs^ e);
	void QPButton_MouseUp(Object^ sender, Windows::Forms::MouseEventArgs^ e);


	void drawButtonText(Drawing::Graphics^ g, Drawing::SolidBrush^ textColor, bool isToggle);
	void drawTriangle(Drawing::Graphics^ g, Drawing::Point p, bool alignLeft);
	void drawCheckmark(Drawing::Graphics^ g, Drawing::Point p);
	//void QPButton_Click(Object^ sender, EventArgs^ e);
};
