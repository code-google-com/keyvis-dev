// Script Name: SixPointAlign Plugin 
// Host Application: Softimage
// Last changed: 2009-09-13
// Author: Eugen Sares
// eugen@keyvis.at
// Description: Activates the character key set of the currently selected object.
// To invoke automatically on selection enter SetCurrentCharacterKeySetFromSelection in Preferences > Tools > Selection > Selection Change Command


function XSILoadPlugin( in_reg )
{
	in_reg.Author = "Eugen Sares";
	in_reg.Name = "SetCurrentCharacterKeySetFromSelection";
	in_reg.Email = "eugen@keyvis.at";
	in_reg.URL = "";
	in_reg.Major = 1;
	in_reg.Minor = 0;

	in_reg.RegisterCommand("SetCurrentCharacterKeySetFromSelection","SetCurrentCharacterKeySetFromSelection");
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

function SetCurrentCharacterKeySetFromSelection_Init( in_ctxt )
{
	var oCmd;
	oCmd = in_ctxt.Source;
	oCmd.Description = "SetCurrentCharacterKeySetFromSelection";
	oCmd.Tooltip = "SetCurrentCharacterKeySetFromSelection";
	oCmd.ReturnValue = true;

	return true;
}

function SetCurrentCharacterKeySetFromSelection_Execute(  )
{

	Application.LogMessage("SetCurrentCharacterKeySetFromSelection_Execute called",siVerbose);

	var as = ActiveProject.ActiveScene;
	if(Application.Selection.Count > 0)
	{
		var obj = Application.Selection(0);
		if (obj.Type == "#model") { var mdl = obj; }
		else { var mdl = obj.Model; }
		
		if(mdl)
		{
			var props = mdl.Properties.Filter( siCustomParamSet );
			 
			var enumProps = new Enumerator( props );
			for (;!enumProps.atEnd();enumProps.moveNext() )
			{
				var prop = enumProps.item();
				var isKeySet = GetValue(prop.FullName+".IsCharacterKeySet");
				if (isKeySet) {
					// This works: SetCurrentCharacterKeySet(prop);
					// but if we don't wanna spam the log, so:
					as.CurrentCharacterKeySet = prop.FullName;
					break; // We're assuming there's only one keyset.
				}
			}
		}
	}
	
	return true;
}

