// Script Name: Selection Filter Island Plugin
// Host Application: Softimage
// Last changed: 2010-01-29
// Author: Eugen Sares
// eugen@keyvis.at
// Description: Convenience command that activates the Island filter when a polymesh is selected or equivalent filter 
// when curves (subcurve filter) or surfaces (subsurface filter) are selected



function XSILoadPlugin( in_reg )
{
	in_reg.Author = "Eugen Sares";
	in_reg.Name = "SetIslandFilter";
	in_reg.Email = "eugen@keyvis.at";
	in_reg.Major = 1;
	in_reg.Minor = 0;

	in_reg.RegisterCommand("SetIslandFilter","SetIslandFilter");
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

function SetIslandFilter_Init( in_ctxt )
{
	var oCmd;
	oCmd = in_ctxt.Source;
	oCmd.Description = "";
	oCmd.ReturnValue = true;

	return true;
}

function SetIslandFilter_Execute(  )
{

	Application.LogMessage("SetIslandFilter_Execute called",siVerbose);

	Application.ActivateObjectSelTool("");
	var oSel = Application.Selection(0);
	//LogMessage(oSel.Type);
	if(oSel)
	{
		switch(oSel.Type)
		{
			case "polymsh":
				SetSelFilter("Polygon_Island");
				LogMessage("Polygon_Island");
				break;
			case "crvlist":
				SetSelFilter("SubCurve");
				break;
			case "surfmsh":
				SetSelFilter("SubSurface");
				break;
			default:
				LogMessage("Nothing selected.");
		}
	}
	return true;
}

