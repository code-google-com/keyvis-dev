//______________________________________________________________________________
// Delete2Plugin
// 2009/10 by Eugen Sares
// last update: 2011/06/30
//______________________________________________________________________________

function XSILoadPlugin( in_reg )
{
	in_reg.Author = "Eugen Sares";
	in_reg.Name = "Delete2Plugin";
	in_reg.Major = 1;
	in_reg.Minor = 0;

	in_reg.RegisterCommand("Delete2","Delete2");
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

function Delete2_Init( in_ctxt )
{
	var oCmd;
	oCmd = in_ctxt.Source;
	oCmd.Description = "";
	oCmd.ReturnValue = true;

	return true;
}

function Delete2_Execute(  )
{

	Application.LogMessage("Delete2_Execute called",siVerbose);

	try
	{
		DeleteObj();
	}
	catch(e)
	{
		ApplyDeleteSubcurves();

	}
	
	return true;
}

