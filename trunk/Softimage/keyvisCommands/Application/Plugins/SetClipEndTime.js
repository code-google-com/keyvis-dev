// Script Name: Set Clip End Time Plugin 
// Host Application: Softimage
// Last changed: 2009-08-01
// Author: Eugen Sares
// eugen@keyvis.at
// Description: Sets the selected clip's end time

function XSILoadPlugin( in_reg )
{
	in_reg.Author = "Eugen Sares";
	in_reg.Name = "SetClipEndTime";
	in_reg.Email = "eugen@keyvis.at";
	in_reg.URL = "";
	in_reg.Major = 1;
	in_reg.Minor = 0;

	in_reg.RegisterCommand("SetClipEndTime","SetClipEndTime");
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

function SetClipEndTime_Init( in_ctxt )
{
	var oCmd;
	oCmd = in_ctxt.Source;
	oCmd.Description = "Set Clip End Time";
	oCmd.Tooltip = "Set Clip End Time";
	oCmd.ReturnValue = true;

	return true;
}

function SetClipEndTime_Execute(  )
{

	Application.LogMessage("SetClipEndTime_Execute called",siVerbose);
	// 
	var oClip = selection(0);
	if ( oClip.Type == "mixeranimclip" )
	{
		//logmessage(oClip.Name);
		//LogMessage(oClip.Type);
		oTimeControl = oClip.TimeControl;
		var keyTime = GetValue("PlayControl.Key");
		var oStartOffset = oTimeControl.StartOffset;
		var oScale = oTimeControl.Scale;
		var oClipIn = oTimeControl.ClipIn;
		var oClipOut = (keyTime - oStartOffset) * oScale + oClipIn -1;
		if(oClipOut >= oClipIn) oTimeControl.Parameters("ClipOut").Value = oClipOut;
	}; // else LogMessage("wrong type");
	// 
	return true;
}

