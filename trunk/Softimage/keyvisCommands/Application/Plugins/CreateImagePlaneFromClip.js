// Script Name:  Create Image Plane From Clip Plugin
// Host Application: Softimage
// Last changed: 2010-09-21
// Author: Eugen Sares
// eugen@keyvis.at
// Description: A command that creates a polymesh grid primitive with the right proportions, Constant Shader and Texture Support from a selected image clip
// Usage: Select an Image Source in the Explorer first (Filter: Sources/Clips, Keyshort O), then run this Script.


function XSILoadPlugin( in_reg )
{
	in_reg.Author = "Eugen Sares";
	in_reg.Name = "CrateImagePlaneFromClip";
	in_reg.Email = "eugen@keyvis.at";
	in_reg.Major = 1;
	in_reg.Minor = 0;

	in_reg.RegisterCommand("CrateImagePlaneFromClip","CrateImagePlaneFromClip");
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

function CrateImagePlaneFromClip_Init( in_ctxt )
{
	var oCmd;
	oCmd = in_ctxt.Source;
	oCmd.Description = "Creates a textured polymesh grid from selected Image Clip with correct proportions";
	oCmd.Tooltip = "Create textured polymesh grid from Image Clip with correct proportions";
	oCmd.ReturnValue = true;

	return true;
}

function CrateImagePlaneFromClip_Execute(  )
{

	Application.LogMessage("CrateImagePlaneFromClip_Execute called",siVerbose);

try {
	if(Selection.count == 0)
		throw "Please select an Image Clip first.";
			
	var oImageClip = Application.Selection(0);
	if(oImageClip.Type != "ImageClip")
		throw "Please select an Image Clip first.";
	
	var oImageSource = oImageClip.Source;
	xres = oImageSource.Parameters("XRes").Value;
	yres = oImageSource.Parameters("YRes").Value;
	
	var oRoot = ActiveProject.ActiveScene.Root;
	var oPictureGrid = oRoot.AddGeometry( "Grid", "MeshSurface" );
	SetValue(oPictureGrid.Name + ".polymsh.geom.subdivu", 2);
	SetValue(oPictureGrid.Name + ".polymsh.geom.subdivv", 2);

	var vlen = oPictureGrid.Parameters("vlength").Value;
	vlen *= yres/xres;
	SetValue(oPictureGrid + ".grid.vlength", vlen, null);
	
	
	var oMaterial = oPictureGrid.AddMaterial("Constant");
	var oConstantShader = oMaterial.Surface.Source;
	var oColorParam = oConstantShader.Parameters( "color" );
	
	var oImageNode = oColorParam.connectfrompreset("Image", siTextureShaderFamily);
	oColorParam.Connect( oImageNode );
	oImageNode.parameters( "tex" ).Connect(oImageClip);


	oProjection = CreateProjection(oPictureGrid, siTxtPlanarXZ, siTxtDefaultPlanarXZ, "", 
		"Texture_Projection", null, siRelDefault, "");
	};

catch(e)
	{
		Application.LogMessage(e, siWarning);
	}

	return true;
}

