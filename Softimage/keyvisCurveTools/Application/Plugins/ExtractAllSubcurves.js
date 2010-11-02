// ExtractAllSubcurvesPlugin

function XSILoadPlugin( in_reg )
{
	in_reg.Author = "Gene";
	in_reg.Name = "ExtractAllSubcurvesPlugin";
	in_reg.Major = 1;
	in_reg.Minor = 0;

	in_reg.RegisterCommand("ExtractAllSubcurves","ExtractAllSubcurves");
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

	return true;
}

function ExtractAllSubcurves_Execute(  )
{

	Application.LogMessage("ExtractAllSubcurves_Execute called",siVerbose);
	
	var selection = Application.Selection; 
	for(var i = 0; i < selection.Count; i++) 
	{ 
	  oSel = selection(i); 
	  if(oSel.Type == "crvlist") 
	  { 
		  //LogMessage("Extracting '" + oSel + "'."); 
		  for(var j = 0; j < oSel.ActivePrimitive.Geometry.Curves.Count; j++) 
		  { 
				ExtractFromComponents("ExtractSubCrvOp", 
					  oSel + ".subcrv[" + j + "]", 
					  oSel + "_Subcurve" + j, 
					  false, 
					  siImmediateOperation);
				FreezeObj(); 
				//Desktop.RedrawUI(); 
		  } 
		  DeleteObj(oSel);
	  } 
	  else 
	  { 
		  LogMessage(oSel + " is not a curve, can't extract!"); 
	  }
	}
	return true;
}

