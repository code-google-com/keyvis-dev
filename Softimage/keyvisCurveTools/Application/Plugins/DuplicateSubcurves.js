//______________________________________________________________________________
// DuplicateSubcurvesPlugin
// 11/2009 by Eugen Sares
// 
// Installation:
// Put it in your Plugins folder, restart SI or refresh the Plugin Manager
// You get a ApplyDuplicateSubcurves command, which can be put to a Toolbar button for example.
//
// Usage:
// Assuming you have a NurbsCurveObject with multiple Subcurves -
// Switch to selection filter "Subcurve" > select some Subcurves > ApplyDuplicateSubcurves.
//______________________________________________________________________________

function XSILoadPlugin( in_reg )
{
	in_reg.Author = "Gene";
	in_reg.Name = "DuplicateSubcurvesPlugin";
	in_reg.Major = 1;
	in_reg.Minor = 0;

	in_reg.RegisterOperator("DuplicateSubcurves");
	in_reg.RegisterCommand("ApplyDuplicateSubcurves","ApplyDuplicateSubcurves");
	in_reg.RegisterMenu(siMenuTbModelModifyCurveID,"ApplyDuplicateSubcurves_Menu",false,false);
	//RegistrationInsertionPoint - do not remove this line

	return true;
}


//______________________________________________________________________________

function XSIUnloadPlugin( in_reg )
{
	var strPluginName;
	strPluginName = in_reg.Name;
	Application.LogMessage(strPluginName + " has been unloaded.",siVerbose);
	return true;
}


//______________________________________________________________________________

function ApplyDuplicateSubcurves_Init( in_ctxt )	// called after _Execute
{
	var oCmd;
	oCmd = in_ctxt.Source;	// source object that is the cause of the callback being fired
	oCmd.Description = "Create an instance of DuplicateSubcurves operator";
	oCmd.SetFlag(siNoLogging,false);

	// TODO: You may want to add some arguments to this command so that the operator
	// can be applied to objects without depending on their specific names.
	// Tip: the Collection ArgumentHandler is very useful

	var oArgs = oCmd.Arguments;
	// To get a collection of subcomponents, or the current selection of subcomponents: 
	oArgs.AddWithHandler("args", "Collection");
	
	return true;
}


//______________________________________________________________________________

function ApplyDuplicateSubcurves_Execute(args)
{
	Application.LogMessage("ApplyDuplicateSubcurves_Execute called",siVerbose);

	do{
		if(args == "") break;
		if(args(0).Type != "subcrvSubComponent") break;
		// var oSubCurves = args(0);
		// LogMessage(oSubCurves);														// "text.subcrv[3-LAST]"
		// LogMessage(oSubCurves.Type);													// "subcrvSubComponent"
		var oSubComponent = args(0).SubComponent;
		var oParent = oSubComponent.Parent3DObject;
		var oComponentCollection = oSubComponent.ComponentCollection;
		// LogMessage("No. of Subcurves: " + oComponentCollection						// OK
		
		// create an index Array from the Subcurve collection
		var idxArray = new Array();
		for(i = 0; i < oComponentCollection.Count; i++)
		{
			var subcrv = oComponentCollection.item(i);
			// Logmessage("Subcurve [" + subcrv.Index + "] selected");
			idxArray[i] = subcrv.Index;
		}
		
		// create Cluster with Subcurves to delete
		// ToDo: unique ClusterNames!!!
		oCluster = oParent.ActivePrimitive.Geometry.AddCluster( siSubCurveCluster, "DuplicatedSubcurves", idxArray );
		
		//DeselectAllUsingFilter("SubCurve");
		

		var newOp = XSIFactory.CreateObject("DuplicateSubcurves");	// known to the system through XSILoadPlugin callback
		// DuplicateSubcurves_Init and
		// DuplicateSubcurves_Define are called...
		
		newOp.AddOutputPort(oParent.ActivePrimitive, "outputCurve");	// working
		newOp.AddInputPort(oParent.ActivePrimitive, "inputCurve");	// working

//		newOp.AddOutputPort(oParent.Name + ".crvlist", "outputCurve");	// also working
//		newOp.AddInputPort(oParent.Name + ".crvlist", "inputCurve");	// also working
		newOp.AddInputPort(oCluster, "duplicateCluster");	// params: PortTarget, [PortName]

		newOp.Connect();
		return newOp;

	} while(false);	// block is left in case of an error.

	LogMessage("Please select some Subcurves first.");
	return false;
	
}


//______________________________________________________________________________

// Use this callback to build a set of parameters that will appear in the property page.
function DuplicateSubcurves_Define( in_ctxt )
{
	Application.LogMessage("DuplicateSubcurves_Define called",siVerboseMsg);
	
	var oCustomOperator;
	var oPDef;
	oCustomOperator = in_ctxt.Source;
/*
	oPDef = XSIFactory.CreateParamDef2("DeleteTheseSubcurves",siString,"",null,null);
	oCustomOperator.AddParameter(oPDef);
*/
	oCustomOperator.AlwaysEvaluate = false;
	oCustomOperator.Debug = 1;
	return true;
}


//______________________________________________________________________________

// User data can be stored in the operator context of the Init callback
// and then retrieved later in the Update and Term callbacks.
function DuplicateSubcurves_Init( in_ctxt )
{
	Application.LogMessage("DuplicateSubcurves_Init called",siVerboseMsg);
	return true;
}


//______________________________________________________________________________

function DuplicateSubcurves_Term( in_ctxt )
{
	Application.LogMessage("DuplicateSubcurves_Term called",siVerboseMsg);
	// var cluster = in_ctxt.GetInputValue("duplicateCluster");	// ERROR : 21000 - Unspecified failure
	// DeleteObj(cluster);
	return true;
}




//______________________________________________________________________________

function DuplicateSubcurves_Update( in_ctxt )
{
	Application.LogMessage("DuplicateSubcurves_Update called",siVerboseMsg);
	
	var geomOut = in_ctxt.OutputTarget.Geometry;	// Type: NurbsCurveCollection, ClassName: ""
	
	//var inputCluster = in_ctxt.GetInputValue("duplicateCluster");	// Type: subcrv, ClassName: Cluster, FullName: xy.crvlist.cls.DuplicatedSubcurves
	//var oSubcurves = inputCluster.CreateSubComponent();	// ERROR : 2009 - Access denied

	// var inputClusters = in_ctxt.GetInputValue("inputCurve").Geometry.Clusters;	// ERROR : 2009 - Access denied
	var inputClusterElements = in_ctxt.GetInputValue("duplicateCluster").Elements;	// ClassName: ClusterElementCollection
	var clusterCount = inputClusterElements.Count;

	var inputCrvColl = in_ctxt.GetInputValue("inputCurve").Geometry.Curves;
	
	// for fast checking which Subcurve is marked/selected:
	// "flagArray" is a boolean array which is true at the index of each selected Subcurve.
	// inputClusterElements.FindIndex() can be used as well, but this should be faster at higher Subcurve counts.
	var flagArray = new Array(inputCrvColl.Count);
	for(i = 0; i < inputCrvColl.Count; i++) { flagArray[i] = false; }	// initialize
	for(i = 0; i < clusterCount; i++) { flagArray[inputClusterElements(i)] = true; }

	for(i = 0; i < inputCrvColl.Count; i++)
	{
		if(!flagArray[i]) continue;
	
		var subcrv = inputCrvColl.item(i);	// get input Subcurve. Type: NurbsCurve, ClassName: NurbsCurve

		var VBdata = subcrv.Get2( siSiNurbs );
		var data = VBdata.toArray();

		var crtlvertices = data[0];
		var knots = data[1];
		var isclosed = data[2];
		var degree = data[3];
		var parameterization = data[4];

		geomOut.AddCurve( crtlvertices, knots, isclosed, degree, parameterization );
	}

	return true;
}

//______________________________________________________________________________

function ApplyDuplicateSubcurves_Menu_Init( in_ctxt )
{
	var oMenu;
	oMenu = in_ctxt.Source;
	oMenu.AddCommandItem("DuplicateSubcurves","ApplyDuplicateSubcurves");
	return true;
}

//______________________________________________________________________________
