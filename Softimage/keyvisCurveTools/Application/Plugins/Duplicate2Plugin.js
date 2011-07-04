//______________________________________________________________________________
// Duplicate2Plugin
// 2009/10 by Eugen Sares
// last update: 2011/06/30
//______________________________________________________________________________

function XSILoadPlugin( in_reg )
{
	in_reg.Author = "Eugen Sares";
	in_reg.Name = "Duplicate2Plugin";
	in_reg.Major = 1;
	in_reg.Minor = 0;

	in_reg.RegisterCommand("Duplicate2","Duplicate2");
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

function Duplicate2_Init( in_ctxt )
{
	var oCmd;
	oCmd = in_ctxt.Source;
	oCmd.Description = "";
	oCmd.ReturnValue = true;

	return true;
}

function Duplicate2_Execute(  )
{

	Application.LogMessage("Duplicate2_Execute called",siVerbose);

	try
	{
		// Problem: works only for objects.
		// This should be the command "Duplicate/Extrude Single", which is hidden.
		Duplicate();
	}
	catch(e)
	{
		ApplyDuplicateSubcurves();

	}
	return true;
}

