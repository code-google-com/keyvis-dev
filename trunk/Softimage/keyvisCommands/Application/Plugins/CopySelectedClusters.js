// Script Name:  Copy Selected Clusters Plugin
// Host Application: Softimage
// Last changed: 2010-02-12, 01:05
// Author: Eugen Sares
// eugen@keyvis.at
// Description: Copy all selected clusters to all selected objects, with assigned materials
// 				If a cluster with the same name is found on the target Object(s), the cluster will be replaced
// Usage:
// select some Clusters and some Objects, run script



function XSILoadPlugin( in_reg )
{
	in_reg.Author = "Eugen Sares";
	in_reg.Name = "CopySelectedClustersPlugin";
	in_reg.Email = "eugen@keyvis.at";
	in_reg.Major = 1;
	in_reg.Minor = 0;

	in_reg.RegisterCommand("CopySelectedClusters","CopySelectedClusters");
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

function CopySelectedClusters_Init( in_ctxt )
{
	var oCmd;
	oCmd = in_ctxt.Source;
	oCmd.Description = "";
	oCmd.ReturnValue = true;

	return true;
}

function CopySelectedClusters_Execute(  )
{

	Application.LogMessage("CopySelectedClusters_Execute called",siVerbose);
	// 
	var oSel = Application.Selection;	// Collection
	//LogMessage(ClassName(oSel(0)));		// Cluster
	var oSourceClusters = SIFilter(oSel, "cluster");
	var oTargetObjects = SIFilter(oSel, "geometry");
	if(oSourceClusters && oTargetObjects)
	{
		//LogMessage("number of Clusters: " + oSourceClusters.Count);
		//LogMessage("number of objects: " + oTargetObjects.Count);
		
		for(var i = 0; i < oTargetObjects.Count; i++)
	// loop through all target Objects
		{
			var oClustersOnTarget = oTargetObjects(i).ActivePrimitive.Geometry.Clusters;
			
			for(var j = 0; j < oSourceClusters.Count; j++)
	// loop through all source Clusters
			{
				var oSourceCluster = oSourceClusters(j);
				if(oTargetObjects(i).Name != oSourceCluster.Parent3DObject.Name)
	// only copy this Cluster to another Object
				{
	// check if the name of this Cluster already exists on the target object
	// if yes, remove it first
					if(oClustersOnTarget)
					{
						for(var k = 0; k < oClustersOnTarget.Count; k++)
						{
							if(oSourceCluster.Name == oClustersOnTarget(k).Name)
							{
								RemoveCluster(oClustersOnTarget(k));
							}
						}
					}
					
	// Copy this Cluster
					CopyCluster(oSourceCluster, oTargetObjects(i));	// from, to
					 
	// get the newly created Cluster on the target Object
					oClustersOnTarget = oTargetObjects(i).ActivePrimitive.Geometry.Clusters;
					var createdCluster = oClustersOnTarget.Item(oSourceCluster.Name);
					oMat = oSourceCluster.Material;
	// Copy the Material of this Cluster
					createdCluster.SetMaterial(oMat);

				} else LogMessage("Will not copy Cluster to it's own Object!", siVerbose);
			}
		}
	} else LogMessage("Please select some Clusters and some Objects first.");
	// 
	return true;
}

