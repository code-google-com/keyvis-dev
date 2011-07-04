//______________________________________________________________________________
// IsopointToolsPlugin
// 2011/06 by Eugen Sares
// 
// 
// Tip: The wizard only exposes a small subset of the possible controls
// and layout that can be achieved on a Property Page.  To find out more
// please refer to the Object Model reference documentation for PPGLayout, PPG
// and CustomProperty
// 
// Tip: Don't be concerned about achieving the exact ordering of the parameters
// because they can easily be reordered in the second phase.
// Tip: To add a command to this plug-in, right-click in the 
// script editor and choose Tools > Add Command.

function XSILoadPlugin( in_reg )
{
	in_reg.Author = "Eugen Sares";
	in_reg.Name = "IsopointToolsPlugin";
	in_reg.Major = 1;
	in_reg.Minor = 0;

	in_reg.RegisterProperty("IsopointTools");
	in_reg.RegisterMenu(siMenuTbModelModifyCurveID,"IsopointTools_Menu",false,false);
	//RegistrationInsertionPoint - do not remove this line

	return true;
}


function XSIUnloadPlugin( in_reg )
{
	var strPluginName;
	strPluginName = in_reg.Name;
	Application.LogMessage(strPluginName + " has been unloaded.",siVerbose);
	return true;
}


function IsopointTools_Define( in_ctxt )
{
	var oCustomProperty;
	oCustomProperty = in_ctxt.Source;
	var oGridParam = oCustomProperty.AddGridParameter("CrvGrid");
	// To change the contents of the grid via scripting use the GridData object,
	// which is accessible via the Parameter.Value property.
	var oCrvGrid = oGridParam.Value;
	oCrvGrid.RowCount = 3;
	oCrvGrid.ColumnCount = 4;
	oCrvGrid.SetColumnLabel(0, "NurbsCurveList");
	oCrvGrid.SetColumnLabel(1, "SubCrv");
	oCrvGrid.SetColumnLabel(2, "Gets");
	oCrvGrid.SetColumnLabel(3, "Sets");
	//oGridParam.Value.ColumnType = 3;
		
	oCustomProperty.AddParameter2("Approximation",siInt4,6,0,20,0,10,siClassifUnknown,siPersistable | siKeyable);
	oCustomProperty.AddParameter2("Divisions",siInt4,1,0,100,0,100,siClassifUnknown,siPersistable | siKeyable);
	return true;
}


// Tip: Use the "Refresh" option on the Property Page context menu to 
// reload your script changes and re-execute the DefineLayout callback.
function IsopointTools_DefineLayout( in_ctxt )
{
	var oLayout,oItem;
	oLayout = in_ctxt.Source;
	oLayout.Clear();

	oLayout.AddGroup("Select Isopoints at Intersections");
	oLayout.AddRow();
	oLayout.AddButton("AddCurves", "Add (Sub)Curves");
	oLayout.AddButton("RemoveCurves", "Remove Curves");
	oLayout.EndRow();
	oPPGItem = oLayout.AddItem("CrvGrid", siControlGrid);
	oPPGItem.SetAttribute(siUINoLabel, true);
	oPPGItem.SetAttribute(siUINoLabel, true); // SetAttribute("NoLabel", true);
	//oPPGItem.SetAttribute(siUIValueOnly,true);
	oPPGItem.SetAttribute(siUICX, 330);
	oPPGItem.SetAttribute(siUICY, 100);
	//oPPGItem.SetAttribute(siUIGridHideRowHeader, true);
	oPPGItem.SetAttribute("ColumnWidths", "20:180:44:30:30");
	
	//oLayout.AddGroup("Select Isopoints at Curve Intersections");
	var oApproximation = oLayout.AddItem("Approximation", "Approximation");
	//oApproximation.SetAttribute(siUILabelMinPixels, 200);
	oLayout.AddButton("SelectIntersectionIsopoints", "Select Intersection Isopoints");
	//oLayout.EndGroup();
	oLayout.EndGroup();
	
	oLayout.AddGroup("Select Isopoints at Divisions");
	oLayout.AddStaticText("Tip: select Knots first to limit to a Curve segment.", 290);
	oLayout.AddItem("Divisions", "Divisions");
	oLayout.AddButton("SelectDivisionIsopoints", "Select Division Isopoints");
	oLayout.EndGroup();

	oLayout.AddGroup("At Selected Isopoints");
	//oLayout.AddButton("ClearIsopoints", "Clear Isopoint Selection");
	oLayout.AddRow();
	oLayout.AddButton("InsertKnots1", "Insert Mult. 1 Knots");
	oLayout.AddButton("InsertKnots2", "Insert Mult. 2 Knots");
	oLayout.AddButton("InsertKnots3", "Insert Mult. 3 (Bezier-)Knots");
	oLayout.EndRow();
	oLayout.AddButton("Scissor", "Scissor");
	oLayout.EndGroup();

	return true;
}


function IsopointTools_OnInit( )
{
	Application.LogMessage("IsopointTools_OnInit called",siVerbose);
	
	var oGridData = PPG.CrvGrid.value;
	var cSel = Selection;
	
	var rowCount = 0;

	for(var i = 0; i < cSel.Count; i++)
	{
		if( cSel(i).Type == "crvlist")
		{
			var cCurves = cSel(i).ActivePrimitive.Geometry.Curves;
			for(var j = 0; j < cCurves.Count; j++)
			{
				if(rowCount == oGridData.RowCount)
					oGridData.RowCount = rowCount + 1;

				oGridData.SetCell( 0, rowCount, cSel(i).Name );
				oGridData.SetCell( 1, rowCount, j );
				rowCount++;

			}

		} else if( cSel(i).Type == "subcrvSubComponent" )
		{
			var oObject = cSel(i).SubComponent.Parent3DObject;
			var aElementIndices = cSel(i).SubComponent.ElementArray.toArray();
			oGridData.RowCount = aElementIndices.length;

LogMessage("aElementIndices:" + aElementIndices);
			for(var j = 0; j < aElementIndices.length; j++)
			{
				if(rowCount == oGridData.RowCount)
					oGridData.RowCount = rowCount + 1;

				oGridData.SetCell( 0, rowCount, oObject.Name );
				oGridData.SetCell( 1, rowCount, aElementIndices[j] );
				rowCount++;
				
			}
			
			rowCount++;

		}
	}
}






function IsopointTools_OnClosed( )
{
	Application.LogMessage("IsopointTools_OnClosed called",siVerbose);
}


function IsopointTools_AddCurves_OnClicked( )
{
	Application.LogMessage("IsopointTools_AddCurves_OnClicked called",siVerbose);
}


function IsopointTools_RemoveCurves_OnClicked( )
{
	Application.LogMessage("IsopointTools_RemoveCurves_OnClicked called",siVerbose);
}


function IsopointTools_SelectDivisionIsopoints_OnClicked( )
{
	Application.LogMessage("IsopointTools_SelectDivisionIsopoints_OnClicked called",siVerbose);

	oCrvGrid = PPG.CrvGrid.Value;

	AddToSelection(sCnx, null, null);
	
}


function IsopointTools_CrvGrid_OnChanged( )
{
	Application.LogMessage("IsopointTools_CrvGrid_OnChanged called",siVerbose);
	var oParam;
	oParam = PPG.CrvGrid;
	var oGridData;
	oGridData = oParam.Value;
}


function IsopointTools_SelectIntersectionIsopoints_OnClicked( )
{
	Application.LogMessage("IsopointTools_SelectIntersectionIsopoints_OnClicked called",siVerbose);
}




function IsopointTools_InsertKnots1_OnClicked( )
{
	Application.LogMessage("IsopointTools_InsertKnots1_OnClicked called",siVerbose);
	
	var cSel = Selection;
	cSel = SIFilter(cSel, siIsopointFilter);
	InsertCurveKnot(cSel, 1, siPersistentOperation);
}


function IsopointTools_InsertKnots2_OnClicked( )
{
	Application.LogMessage("IsopointTools_InsertKnots2_OnClicked called",siVerbose);
	
	var cSel = Selection;
	cSel = SIFilter(cSel, siIsopointFilter);
	InsertCurveKnot(cSel, 2, siPersistentOperation);
}


function IsopointTools_InsertKnots3_OnClicked( )
{
	Application.LogMessage("IsopointTools_InsertKnots3_OnClicked called",siVerbose);
	
	var cSel = Selection;
	cSel = SIFilter(cSel, siIsopointFilter);
	InsertCurveKnot(cSel, 3, siPersistentOperation);
}


function IsopointTools_Scissor_OnClicked( )
{
	Application.LogMessage("IsopointTools_Scissor_OnClicked called",siVerbose);
	
	ApplyScissorSubcurves();

}


/*function IsopointTools_ClearIsopoints_OnClicked( )
{
	Application.LogMessage("IsopointTools_ClearIsopoints_OnClicked called",siVerbose);
}
*/




function IsopointTools_Approximation_OnChanged( )
{
	Application.LogMessage("IsopointTools_Approximation_OnChanged called",siVerbose);
	var oParam;
	oParam = PPG.Approximation;
	var paramVal;
	paramVal = oParam.Value;
	Application.LogMessage("New value: " + paramVal,siVerbose);
}


function IsopointTools_Divisions_OnChanged( )
{
	Application.LogMessage("IsopointTools_Divisions_OnChanged called",siVerbose);
	var oParam;
	oParam = PPG.Divisions;
	var paramVal;
	paramVal = oParam.Value;
	Application.LogMessage("New value: " + paramVal,siVerbose);
}








function IsopointTools_Menu_Init( in_ctxt )
{
	var oMenu;
	oMenu = in_ctxt.Source;
	oMenu.AddCallbackItem("Isopoint Tools","OnIsopointToolsMenuClicked");
	return true;
}


// Menu Button klicked
function OnIsopointToolsMenuClicked( in_ctxt )
{
	var oProp = new Object();

	var cCPs = FindObjects2(siCustomPropertyID);
	//var cCPIsoTools = new ActiveXObject("XSI.Collection");

	for(var i = 0; i < cCPs.Count; i++)
	{
		if(cCPs(i).Type == "IsopointTools")
		{
			oProp = cCPs(i);
			break;
		}	
	}

	if(oProp.Type == undefined)
	{
		oReturn = Application.AddProp("IsopointTools", ActiveSceneRoot, 0, "IsopointTools");
		oProp = oReturn(0);
	} else
	{
		InspectObj(oProp, "", "Isopoint Tools");
	}

	return true;
}

