#pragma once

using namespace System;

//////////////////////////////////////////////////////////////////////////

public ref class QPNode
{
public:
	String^ nodeString;
	Collections::Generic::List<QPNode^>^ nodeList;

	QPNode(void);
//	QPNode(QPNode^ qpn);	// Copy constructor
	QPNode(String^ argString);	// Constructor, creates a QPNodes tree

private:
	bool findNextNode(String^ argStr, String^% nodeStr, String^% restStr);	// returns the first "node" in the string:
};