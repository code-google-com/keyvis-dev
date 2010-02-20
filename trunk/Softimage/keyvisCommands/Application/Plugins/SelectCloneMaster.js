// Script Name:  Select Clone Master Plugin
// Host Application: Softimage
// Last changed: 2010-01-28
// Author: Eugen Sares
// eugen@keyvis.at
// Description: Selects the original(master) in case selected object is a clone


function XSILoadPlugin( in_reg )
{
	in_reg.Author = "Eugen Sares";
	in_reg.Name = "SelectCloneMaster";
	in_reg.Email = "eugen@keyvis.at";
	in_reg.Major = 1;
	in_reg.Minor = 0;

	in_reg.RegisterCommand("SelectCloneMaster","SelectCloneMaster");
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

function SelectCloneMaster_Init( in_ctxt )
{
	var oCmd;
	oCmd = in_ctxt.Source;
	oCmd.Description = "Selects a clone's original object";
	oCmd.Tooltip = "Selects a clone's original object";
	oCmd.ReturnValue = true;
	
	oArgs = oCmd.Arguments;
	oArgs.AddWithHandler("Arg0","Collection");
	return true;
}

function SelectCloneMaster_Execute( Arg0 )
{

	Application.LogMessage("SelectCloneMaster_Execute called",siVerbose);
	
	var oCollection = new ActiveXObject("XSI.Collection");
	for(var i = 0; i < Arg0.Count; i++)
	{
		var oClone = Arg0(i);
		if(ClassName(oClone) == "X3DObject")
		{
			var oCopyOp = oClone.ActivePrimitive.ConstructionHistory.Find("copyop");
			if(oCopyOp)
			{
				oInputPorts = oCopyOp.InputPorts(0);
				oTarget = oInputPorts.Target2;
				oCollection.Add(oTarget.parent);
			}
		}
	}
	
	Application.Selection.Clear();
	for(var i = 0; i < oCollection.Count; i++)
	{
		Application.Selection.Add(oCollection.Item(i));
	}
	return true;
}

