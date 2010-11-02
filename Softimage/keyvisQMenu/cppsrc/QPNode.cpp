#pragma once

#include "QPNode.h"

using namespace System;


//________________________________________________________________________

QPNode::QPNode(void)	// Standard Constructor
{
	this->nodeString = nullptr;
	this->nodeList = nullptr;
}


//________________________________________________________________________

QPNode::QPNode(String^ argString)	// Constructor, creates a linked tree of QPNodes out of a recursive string: "[...][...][...][...]"
{
	//Windows::Forms::MessageBox::Show("argString = " + argString);
	this->nodeString = "";
	this->nodeList = gcnew Collections::Generic::List<QPNode^>();

	Text::StringBuilder^ argStr = gcnew Text::StringBuilder(argString);	// StringBuilder is used for dynamic strings
	String^ nodeStr;	// used as return value from findNextNode
	String^ restStr;	// used as return value from findNextNode

	do 
	{
		if(!findNextNode(argStr->ToString() /*param*/ , nodeStr /*return value*/, restStr /*return value*/))
			
		{	// string contains no "[ ]"
			this->nodeString = nodeStr;
			break;	// if leading character(s) not enclosed by brackets are found, the rest of the string is ignored: "abc[def][ghi]" -> "abc"
		} else
		{	// [ ] found
			String^ nodeStrNoBrackets = nodeStr->Substring(1, nodeStr->Length - 2);	// remove enclosing [ ]
			QPNode^ node = gcnew QPNode(nodeStrNoBrackets);	// recursively create a new sub-node with the content of the [ ]
			this->nodeList->Add(node);
		}
		argStr->Remove(0, nodeStr->Length);	// remove the leading node we just handled

	} while (argStr->Length);	// loop until nothing's left of the string
}


//________________________________________________________________________

bool QPNode::findNextNode(String^ argStr, String^% nodeStr, String^% restStr)
// findNextNode seeks next [...] and returns:	true if a [...] is found , which means the QPNode has sub-list/no string, "branch"
//												false if no [...] is found, which means the QPNode has string/no sub-list, "leaf"
{
	int level = 0;
	int start = 0;
	int end = argStr->Length;
	bool isNode = false;

	for(int i = start; i < argStr->Length; i++)
	{
		if(argStr[i] == '[')
		{
			if(level == 0 && i > start)	// when argStr is "a[b][c]" : a is returned, rest discarded
			{
				isNode = false;
				end = i;
				break;
			}

			if(level == 0)
			{
				start = i;	// first "[" is remembered... always 0
				isNode = true;
			}
			level++;
			continue;
		}

		if(argStr[i] == ']')
		{
			level--;
			if(level == 0)
			{
				end = i + 1;
				break;		// [...]... : last "]" was found
			}
		}
	}

	if(level != 0)	// syntax error: not as many "[" as "]"
	{
		isNode = false;
		nodeStr = "";
		restStr = "";
		return isNode;
	}

	nodeStr = argStr->Substring(start, end - start);
	restStr = argStr->Substring(end);
	return isNode;
}