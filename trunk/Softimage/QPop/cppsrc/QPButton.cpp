#include "QP.h"
#include "QPButton.h"

using namespace System;


//________________________________________________________________________
QPButton::QPButton(QPNode^ argTree)	// Constructor
{
// hint: this->buttonIndex is set in creating code
//	XSI::Application().LogMessage( L"creating button. handle: " + XSI::CValue( (LONG)( (int)this->Handle ) ) );
	buttonLabel = argTree->nodeList[0]->nodeString;	// str->Substring(0,10)

	String^ subMnuIdxStr = argTree->nodeList[1]->nodeString;
	this->subMenuIndex = Convert::ToInt32(subMnuIdxStr);	// -1 means no SubMenu

	String^ statusFlagStr = argTree->nodeList[2]->nodeString;
	int statusFlag = Convert::ToInt32(statusFlagStr);
	if(statusFlag & 1) this->isActive = true;	else this->isActive = false;
	if(statusFlag & 2) this->isTitle = true;	else this->isTitle = false;
	if(statusFlag & 4) this->isToggle = true;	else this->isToggle = false;

	//this->hasOpenSubMenu = false;
	//this->buttonOpenSubMenu = nullptr;
	this->Text = "";
	this->Name = "QPButton";
	if(this->isTitle) this->Font = QP::QPFontBold; else this->Font = QP::QPFont;
	//this->CanFocus = false;

	Drawing::Graphics^ gc = this->CreateGraphics();
	this->textDim = gc->MeasureString(this->buttonLabel, this->Font, -1, QP::stringFormat);	// calculate text dimension and store it

// for double-buffering
	this->SetStyle(Windows::Forms::ControlStyles::UserPaint | 
		Windows::Forms::ControlStyles::AllPaintingInWmPaint |
		Windows::Forms::ControlStyles::OptimizedDoubleBuffer |
		Windows::Forms::ControlStyles::Opaque, true);

// event handlers
	this->MouseEnter += gcnew EventHandler(this, &QPButton::QPButton_MouseEnter);
	this->MouseLeave += gcnew EventHandler(this, &QPButton::QPButton_MouseLeave);
	this->MouseUp += gcnew Windows::Forms::MouseEventHandler(this, &QPButton::QPButton_MouseUp);
}
// end of Constructor


//________________________________________________________________________
// Event Handlers

void QPButton::OnPaint(Windows::Forms::PaintEventArgs^ e)
{
	redrawButton(e->Graphics);
}


//________________________________________________________________________
void QPButton::QPButton_MouseEnter(Object^ sender, EventArgs^ e)
{
	QP::buttonUnderMouse = this;	// for supra key support

// do nothing if the entered button is already blue (which is indicating it has an open SubMenu)
	if(this->isBlue) return;

// entered button is gray, close all open SubMenus

	if(this->containingMenu->isSubMenu)
// if the button entered is in an open SubMenu, close this SubMenu's SubMenus
	{
		//QP::closeSubMenu(this->containingMenu);
		this->containingMenu->closeSubMenu();
	}
	else
// if the button entered is in a QuadMenu, loop through all QuadMenus and close their SubMenus
	{
		for(int i = 0; i < 4; i++)
		{
			//QP::closeSubMenu(QP::menus[i]);
			QP::menus[i]->closeSubMenu();
		}
	}

// an entered button gets always rendered blue, and there cannot be more than one blue button in a menu
	this->isBlue = true;
// in the containing menu, remember which button is blue
	this->containingMenu->blueButton = this;
	Drawing::Graphics^ g = this->CreateGraphics();
	redrawButton(g);

// if the entered button has no SubMenu to open, we're done here
	if(this->subMenuIndex == -1) return;

//________________________________________________________________________
// the button has a SubMenu

// get this button's location in screen space
	Drawing::Point buttonLoc = this->PointToScreen(this->Location);
// to get the correct location in screen space, this button's location (in parent space) has to be subtracted (why??)
	buttonLoc.X -= this->Location.X;
	buttonLoc.Y -= this->Location.Y;

// create the SubMenu
	QPMenu^ newSubMenu = gcnew QPMenu(QP::argTree->nodeList[this->subMenuIndex]/*, this->subMenuIndex*/);
	newSubMenu->menuIndex = this->subMenuIndex;
	//newSubMenu->Owner = this->containingMenu;	// working! proof: close a menu and all owned windows are closed as well.
	// making SubMenus owned causes more trouble than it solves. SubMenus are closed with an error, and parent menus can overlap SubMenus anyway

	newSubMenu->isSubMenu = true;
	newSubMenu->parentMenu = this->containingMenu;
	this->containingMenu->openSubMenu = newSubMenu;
	this->containingMenu->openSubMenuIndex = this->subMenuIndex;
	QP::topmostSubMenu = newSubMenu;

// calculate the two possible SubMenu locations
	Drawing::Point subMenuLocRight = Drawing::Point(buttonLoc.X + this->containingMenu->menuSize.Width - 8, buttonLoc.Y - QP::menuBorder - 1);
	Drawing::Point subMenuLocLeft = Drawing::Point(buttonLoc.X - newSubMenu->menuSize.Width + 4, buttonLoc.Y - QP::menuBorder - 1);

	bool alignLeft = this->containingMenu->alignLeft;
	if(alignLeft == true)
	{
// does the SubMenu exceed the right screen border?
		if(subMenuLocRight.X + newSubMenu->menuSize.Width > QP::rightLimit) alignLeft = false;
	} else
	{
// does the SubMenu exceed the left screen border?
		if(subMenuLocLeft.X < QP::leftLimit) alignLeft = true;
	}

	Drawing::Point subMenuLoc;
	if(alignLeft == true)
	{
// place the new SubMenu to the right of the button
		newSubMenu->alignLeft = true;
		subMenuLoc = subMenuLocRight;
	} else
	{
// place the new SubMenu to the left of the button
		newSubMenu->alignLeft = false;
		subMenuLoc = subMenuLocLeft;
	}
// does the SubMenu exceed the screen borders vertically?
	//if(subMenuLoc.Y < QP::topLimit.Y) subMenuLoc.Y = QP::topLimit.Y; // actually, this can never happen
	if(subMenuLoc.Y + newSubMenu->Height > QP::bottomLimit) subMenuLoc.Y = QP::bottomLimit - newSubMenu->Height;	// this CAN happen

// show the SubMenu
	newSubMenu->Location = subMenuLoc;
	newSubMenu->Show(QP::SIwrapper);	// 
}


//________________________________________________________________________
void QPButton::QPButton_MouseLeave(Object^ sender, EventArgs^ e)
{
// for supra key support
	QP::buttonUnderMouse = nullptr;

	if(this->subMenuIndex == -1)
// if the button that was left has no SubMenu, remove blue highlight
	{
		this->isBlue = false;
		this->containingMenu->blueButton = nullptr;
	}

	Drawing::Graphics^ g = this->CreateGraphics();
	redrawButton(g);
}


//________________________________________________________________________
void QPButton::QPButton_MouseUp(Object^ sender, Windows::Forms::MouseEventArgs^ e)
{
//	Media::SystemSounds::Asterisk->Play();
	if(QP::lockExit) return;
	if(this->subMenuIndex == -1 && this->isActive /*&& this->isTitle == false*/ )	// If the clicked Button has no SubMenu...
	{
		QPButton^ btn = dynamic_cast<QPButton^>(sender);
		QP::returnButtonIndex = btn->buttonIndex;
		QP::returnMenuIndex = btn->containingMenu->menuIndex;
		QP::exitQMenu();
	}
}


//________________________________________________________________________
void QPButton::redrawButton(Drawing::Graphics^ g)
{
	this->Size = this->containingMenu->buttonSize;
	Drawing::Brush^ backgroundBrush;
	Drawing::SolidBrush^ textBrush;

	if(this->isTitle)
	{
// a title button
		if(this->isBlue)
		{
			backgroundBrush = gcnew Drawing::SolidBrush(QP::titleHighlightBackColor);
			if(this->isActive) textBrush = gcnew Drawing::SolidBrush(QP::highlightTextColor);
			else textBrush = gcnew Drawing::SolidBrush(QP::inactiveTextColor);

		} else 
		{
			backgroundBrush = gcnew Drawing::SolidBrush(QP::titleBackColor);
			if(this->isActive) textBrush = gcnew Drawing::SolidBrush(QP::textColor);
			else textBrush = gcnew Drawing::SolidBrush(QP::inactiveTextColor);
		}	

		g->FillRectangle(backgroundBrush, 0, 0, this->Size.Width, this->Size.Height);
		//drawButtonText(g, textBrush, this->isToggle);

	} else
	{
// a regular button
		if(this->isBlue)
		{
			backgroundBrush = gcnew Drawing::SolidBrush(QP::highlightBackColor);
			if(this->isActive) textBrush = gcnew Drawing::SolidBrush(QP::highlightTextColor);
			else textBrush = gcnew Drawing::SolidBrush(QP::highlightInactiveTextColor);

			g->FillRectangle(backgroundBrush, 1, 1, this->Size.Width - 2, this->Size.Height - 2);
			// ...with rounded corners
			Drawing::Pen^ pen = gcnew Drawing::Pen(QP::highlightBackColor);	//for drawing the "rounded corner" lines
			g->DrawLine(pen, 1, 0, this->Size.Width - 2, 0);
			g->DrawLine(pen, this->Size.Width - 1, 1, this->Size.Width - 1, this->Size.Height - 2);
			g->DrawLine(pen, this->Size.Width - 2, this->Size.Height - 1, 1, this->Size.Height - 1);
			g->DrawLine(pen, 0, this->Size.Height - 2, 0, 1);
			delete pen;

		} else 
		{
			backgroundBrush = gcnew Drawing::SolidBrush(QP::backColor);
			if(this->isActive) textBrush = gcnew Drawing::SolidBrush(QP::textColor);
			else textBrush = gcnew Drawing::SolidBrush(QP::inactiveTextColor);

			g->FillRectangle(backgroundBrush, 0, 0, this->Size.Width, this->Size.Height);
		}

		//drawButtonText(g, textBrush, this->isToggle);
		
	}
	drawButtonText(g, textBrush, this->isToggle);

	delete backgroundBrush;
	delete textBrush;

}


//________________________________________________________________________
void QPButton::drawButtonText(Drawing::Graphics^ g, Drawing::SolidBrush^ textColor, bool isToggle)
{
	g->TextRenderingHint = Drawing::Text::TextRenderingHint::ClearTypeGridFit;	// best quality

	Drawing::Font^ font;
	if(this->isTitle) font = QP::QPFontBold; else font = QP::QPFont;

	


//	XSI::Application().LogMessage( "parentMenu->alignLeft: " + XSI::CValue( (bool)parentMenu->alignLeft ) );
	if(this->containingMenu->alignLeft)
	{
		g->DrawString(	this->buttonLabel,		// string
						font,					// font
						textColor,				// brush 
						QP::buttonTextOffset,	// x
						1.0f,					// y
						QP::stringFormat);		// format

		if(this->subMenuIndex != -1) drawTriangle(g, Drawing::Point(this->containingMenu->Width - QP::whitespace - 10, 6), this->containingMenu->alignLeft);	// QP::buttonWidth - 10
		if(this->isToggle) drawCheckmark(g, Drawing::Point(0, 0));

	} else
	{
//		XSI::Application().LogMessage( "align right");
		g->DrawString(	this->buttonLabel,		// string
						font,					// font
						textColor,				// brush
						(this->ClientSize.Width - this->textDim.Width - QP::buttonTextOffset),	// x
						1.0f,					// y
						QP::stringFormat);		// format

		if(this->subMenuIndex != -1) drawTriangle(g, Drawing::Point(10, 6), this->containingMenu->alignLeft);
		if(this->isToggle) drawCheckmark(g, Drawing::Point(this->containingMenu->Width - QP::whitespace - 16, 0));
	}
}


//________________________________________________________________________
// the little black triangle indicating a SubMenu
void QPButton::drawTriangle(Drawing::Graphics^ g, Drawing::Point p, bool alignLeft)
{
	Drawing::Brush^ brush = gcnew Drawing::SolidBrush(QP::textColor);
	array<Drawing::Point>^ triangle = gcnew array<Drawing::Point>(3);
	triangle[0] = p;
	if(alignLeft) triangle[1] = Drawing::Point(p.X + 4, p.Y + 4); else triangle[1] = Drawing::Point(p.X - 4, p.Y + 4);
	triangle[2] = Drawing::Point(p.X, p.Y + 8);
	g->FillPolygon(brush, triangle);
}


//________________________________________________________________________
// draw a checkmark
// ToDo: use a bitmap instead of a "x"
void QPButton::drawCheckmark(Drawing::Graphics^ g, Drawing::Point p)
{
 	Drawing::Brush^ brush = gcnew Drawing::SolidBrush(QP::textColor);

	array<Drawing::Point>^ checkmark =
		gcnew array<Drawing::Point> {
			Drawing::Point(p.X + 5, p.Y + 8),
			Drawing::Point(p.X + 7, p.Y + 10),
			Drawing::Point(p.X + 11, p.Y + 6),
			Drawing::Point(p.X + 11, p.Y + 8),
			Drawing::Point(p.X + 7, p.Y + 12),
			Drawing::Point(p.X + 5, p.Y + 10)
	};
	g->DrawPolygon(Drawing::Pens::Black, checkmark);
	g->FillPolygon(brush, checkmark);

}

