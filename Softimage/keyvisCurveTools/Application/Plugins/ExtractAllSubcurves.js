//______________________________________________________________________________
// ExtractAllSubcurvesPlugin
// 2009/11 by Eugen Sares
// last revision: 2011/06/30
//______________________________________________________________________________

function XSILoadPlugin( in_reg )
{
	in_reg.Author = "Eugen Sares";
	in_reg.Name = "ExtractAllSubcurvesPlugin";
	in_reg.Major = 1;
	in_reg.Minor = 0;

	in_reg.RegisterCommand("ExtractAllSubcurves","ExtractAllSubcurves");
	in_reg.RegisterMenu(siMenuTbModelCreateCurveID,"ExtractAllSubcurves_Menu",false,false);
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


function ExtractAllSubcurves_Init( in_ctxt )
{
	var oCmd;
	oCmd = in_ctxt.Source;
	oCmd.Description = "Extract All Subcurves from a CurveList";
	oCmd.Tooltip = "Extract All Subcurves from a CurveList";
	oCmd.ReturnValue = true;
	var oArgs = oCmd.Arguments;
	// To get a collection of subcomponents, or the current selection of subcomponents:
	oArgs.AddWithHandler("args", "Collection");

	return true;
}


//______________________________________________________________________________

function ExtractAllSubcurves_Execute( args )
{
	Application.LogMessage("ExtractAllSubcurves_Execute called",siVerbose);

	var cSel = args;

	var immed = Application.Preferences.GetPreferenceValue("xsiprivate_unclassified.OperationMode");
	
	if(!immed)
	{
		var buttonPressed = XSIUIToolkit.Msgbox( "Keep modelling relations?", 
			siMsgYesNo | siMsgQuestion, "Extract All Subcurves" ) ;
		if (buttonPressed == siMsgNo) immed = true;
	}
	
	LogMessage("immed: " + immed);
	
	// Loop through all SubCurves
	for(var i = 0; i < cSel.Count; i++) 
	{ 
		oSel = cSel(i);
		if(oSel.Type == "crvlist")
		{ 
			//LogMessage("Extracting '" + oSel + "'."); 
			for(var j = 0; j < oSel.ActivePrimitive.Geometry.Curves.Count; j++) 
			{
				if(immed)
				{
					var rtn = ExtractFromComponents("ExtractSubCrvOp", oSel + ".subcrv[" + j + "]", oSel + "_Subcurve" + j, false, siImmediateOperation);
					var oCrv = rtn(0);	// ExtractFromComponents uses output arguments
					MoveCtr2Vertices(oCrv, null);
					FreezeObj(oCrv);
					
				} else
				{
					var rtn = ExtractFromComponents("ExtractSubCrvOp", oSel + ".subcrv[" + j + "]", oSel + "_Subcurve" + j, false, siPersistentOperation);
					var oCrv = rtn(0);
					MoveCtr2Vertices(oCrv, null);
				}

		  }
		  
		  if(immed) DeleteObj(oSel);
		  
	  }
	  else 
	  { 
		  LogMessage("Select a NurbsCurveList first.");
	  }
	  
	}
	return true;
}


//______________________________________________________________________________


function ExtractAllSubcurves_Menu_Init( in_ctxt )
{
	var oMenu;
	oMenu = in_ctxt.Source;
	oMenu.AddCommandItem("Extract All Subcurves","ExtractAllSubcurves");
	return true;
}
