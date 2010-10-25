// PartitionsFromLayersPlugin
// 2010.04.30 by Eugen Sares
// last revision:
//
// Create/Update Partitions to match Scene Layers
//
// Motivation: it is not possible to have different sets of Scene Layer's Visibility Flags per Pass.
// 
// When first run, the Script creates Partitions with names matching those of all Scene Layers.
// Visibility flags can then be set for the new Partitions.
// When new Objects or Lights are created, by default they are put in the Background Partitions.
// To fix that, re-run this Script. All Objects will be sorted in the matching Partitions again,
// leaving the Partition's flags untouched.
//

function XSILoadPlugin( in_reg )
{
	in_reg.Author = "Eugen";
	in_reg.Name = "PartitionsFromLayersPlugin";
	in_reg.Major = 1;
	in_reg.Minor = 0;

	in_reg.RegisterCommand("PartitionsFromLayers","PartitionsFromLayers");
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

function PartitionsFromLayers_Init( in_ctxt )
{
	var oCmd;
	oCmd = in_ctxt.Source;
	oCmd.Description = "";
	oCmd.ReturnValue = true;

	return true;
}

function PartitionsFromLayers_Execute(  )
{

	Application.LogMessage("PartitionsFromLayers_Execute called",siVerbose);
	
	var cLayers = ActiveProject.ActiveScene.Layers;	// Layer Collection
	var oPass = GetCurrentPass();
	// get old Partitions of current Pass
	var cPartitions = oPass.Partitions;	// Partition collection

	//DeleteObj(cPartitions);

	// loop through all Scene Layers
	for(var i = 0; i < cLayers.Count; i++)
	{
		// get Layer
		var oLayer = cLayers(i);
		var layerName = oLayer.Name;
		//LogMessage(layerName);
		
		// get objects on Layer
		var cObjects = oLayer.Members;
		// empty Layers are ignored
		if(cObjects.Count == 0) continue;


		// filter only Geometry
		cGeometry = SIFilter(cObjects, "geometry");
		if(cGeometry != null)
		{
			// does an Object Partition with this Layer's name already exist?
			var objectsPart = cPartitions.item(layerName /*+ "_Objects"*/);
			if(objectsPart == null)
			{
			// no, create one
				var rtn = SICreateEmptyPartition(oPass, layerName /*+ "_Objects"*/, siObjectPartition);
				objectsPart = rtn.value("Value");
			}
			MoveToPartition(objectsPart, cGeometry, oPass);
		}

		
		// filter only Lights
		var cLights = SIFilter(cObjects, "light");
		if(cLights != null)
		{
			// does a Light Partition with this Layer's name already exist?
			var lightsPart = cPartitions.item(layerName + "_Lights");
			if(lightsPart == null)
			{
			// no, create one
				var rtn = SICreateEmptyPartition(oPass, layerName + "_Lights", siLightPartition);
				lightsPart = rtn.value("Value");
			}
			MoveToPartition(lightsPart, cLights, oPass);
		}
	
	}
	
	return true;
}

