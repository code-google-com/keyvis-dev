/////////////////////////////////////////////////////////////////////////////////////////////////////
// OpenCloseSubcurvesPlugin
// Nov 8 2009 by Eugen Sares
// 
// Installation:
// Put it in your Plugins folder, restart SI or refresh the Plugin Manager
// You get a ApplyOpenCloseSubcurves command, which can be put to a Toolbar button for example.
//
// Usage:
// Assuming you have a NurbsCurveObject with multiple Subcurves -
// Switch to selection filter "Subcurve" > select some Subcurves > ApplyOpenCloseSubcurves.

function XSILoadPlugin( in_reg )
{
	in_reg.Author = "Gene";
	in_reg.Name = "OpenCloseSubcurvesPlugin";
	in_reg.Major = 1;
	in_reg.Minor = 0;

	in_reg.RegisterOperator("OpenCloseSubcurves");
	in_reg.RegisterCommand("ApplyOpenCloseSubcurves","ApplyOpenCloseSubcurves");
	//RegistrationInsertionPoint - do not remove this line

	return true;
}


/////////////////////////////////////////////////////////////////////////////////////////////////////
function XSIUnloadPlugin( in_reg )
{
	var strPluginName;
	strPluginName = in_reg.Name;
	Application.LogMessage(strPluginName + " has been unloaded.",siVerbose);
	return true;
}


/////////////////////////////////////////////////////////////////////////////////////////////////////
function ApplyOpenCloseSubcurves_Init( in_ctxt )	// called after _Execute
{
	var oCmd;
	oCmd = in_ctxt.Source;	// source object that is the cause of the callback being fired
	oCmd.Description = "Create an instance of OpenCloseSubcurves operator";
	oCmd.SetFlag(siNoLogging,false);

	// TODO: You may want to add some arguments to this command so that the operator
	// can be applied to objects without depending on their specific names.
	// Tip: the Collection ArgumentHandler is very useful

	var oArgs = oCmd.Arguments;
	// To get a collection of subcomponents, or the current selection of subcomponents: 
	oArgs.AddWithHandler("args", "Collection");
	
	return true;
}


/////////////////////////////////////////////////////////////////////////////////////////////////////
function ApplyOpenCloseSubcurves_Execute(args)
{
	Application.LogMessage("ApplyOpenCloseSubcurves_Execute called",siVerbose);

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
		oCluster = oParent.ActivePrimitive.Geometry.AddCluster( siSubCurveCluster, "OpenCloseSubcurves", idxArray );
		
		DeselectAllUsingFilter("SubCurve");
		

		var newOp = XSIFactory.CreateObject("OpenCloseSubcurves");	// known to the system through XSILoadPlugin callback
		// OpenCloseSubcurves_Init and
		// OpenCloseSubcurves_Define are called...
		
		newOp.AddOutputPort(oParent.ActivePrimitive, "outputCurve");	// working
		newOp.AddInputPort(oParent.ActivePrimitive, "inputCurve");	// working

//		newOp.AddOutputPort(oParent.Name + ".crvlist", "outputCurve");	// also working
//		newOp.AddInputPort(oParent.Name + ".crvlist", "inputCurve");	// also working
		newOp.AddInputPort(oCluster, "deleteCluster");	// params: PortTarget, [PortName]

		newOp.Connect();
		return newOp;

	} while(false);	// block is left in case of an error.

	LogMessage("Please select some Subcurves first.");
	return false;
	
}


/////////////////////////////////////////////////////////////////////////////////////////////////////
// Use this callback to build a set of parameters that will appear in the property page.
function OpenCloseSubcurves_Define( in_ctxt )
{
	Application.LogMessage("OpenCloseSubcurves_Define called",siVerboseMsg);
	
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


/////////////////////////////////////////////////////////////////////////////////////////////////////
// User data can be stored in the operator context of the Init callback
// and then retrieved later in the Update and Term callbacks.
function OpenCloseSubcurves_Init( in_ctxt )
{
	Application.LogMessage("OpenCloseSubcurves_Init called",siVerboseMsg);
	return true;
}


/////////////////////////////////////////////////////////////////////////////////////////////////////
function OpenCloseSubcurves_Term( in_ctxt )
{
	Application.LogMessage("OpenCloseSubcurves_Term called",siVerboseMsg);
	// var cluster = in_ctxt.GetInputValue("deleteCluster");	// ERROR : 21000 - Unspecified failure
	// DeleteObj(cluster);
	return true;
}


/////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////
function OpenCloseSubcurves_Update( in_ctxt )
{
	Application.LogMessage("OpenCloseSubcurves_Update called",siVerboseMsg);
	
	var geomOut = in_ctxt.OutputTarget.Geometry;	// Type: NurbsCurveCollection, ClassName: ""
	
	//var inputCluster = in_ctxt.GetInputValue("deleteCluster");	// Type: subcrv, ClassName: Cluster, FullName: xy.crvlist.cls.OpenCloseSubcurves
	//var oSubcurves = inputCluster.CreateSubComponent();	// ERROR : 2009 - Access denied

	// var inputClusters = in_ctxt.GetInputValue("inputCurve").Geometry.Clusters;	// ERROR : 2009 - Access denied
	var inputClusterElements = in_ctxt.GetInputValue("deleteCluster").Elements;	// ClassName: ClusterElementCollection
		
	var clusterCount = inputClusterElements.Count;

	var inputCrvColl = in_ctxt.GetInputValue("inputCurve").Geometry.Curves;

	// for quicker checking which Subcurve is marked/selected:
	// "flagArray" is a boolean array which is true at the index of each selected Subcurve.
	// inputClusterElements.FindIndex() can be used as well, but this should be faster at higher Subcurve counts.
	var flagArray = new Array(inputCrvColl.Count);
	for(i = 0; i < inputCrvColl.Count; i++) { flagArray[i] = false; }	// initialize
	for(i = 0; i < clusterCount; i++) { flagArray[inputClusterElements(i)] = true; }

	// create empty arrays to hold the new CurveList data
	// http://softimage.wiki.softimage.com/index.php/Creating_a_merge_curve_SCOP
	var outCrvCount = 0;
	var ctrlPoints = new Array();
	var numCtrlPoints = new Array();
	var knots = new Array();
	var numKnots = new Array();
	var isClosed = new Array();
	var degree = new Array();
	var parameterization = new Array();


	for(inCrvCount = 0; inCrvCount < inputCrvColl.Count; inCrvCount++)
	{
		var subcrv = inputCrvColl.item(inCrvCount);	// get input Subcurve. Type: NurbsCurve, ClassName: NurbsCurve
		VBdata = new VBArray(subcrv.Get2(siSINurbs));	// NurbsCurve.Get2 returns a complete data description of the Nurbs Curve as VBArray.										
		var subcrvData = VBdata.toArray();	// convert to native JScript array. Note: "toArray", NOT "ToArray"!
		
		var vbArg0 = new VBArray(subcrvData[0]);
		var subcrvCtrlPoints = vbArg0.toArray();				// Control Points array, cannot be a JScript array
		ctrlPoints = ctrlPoints.concat(subcrvCtrlPoints);		// 1.
		//LogMessage("CtrlPoints[" + outCrvCount + "]: " + subcrvCtrlPoints.toString() );
		
		numCtrlPoints[outCrvCount] = subcrvCtrlPoints.length/4;	// 2. x,y,z,weight
		//LogMessage("numCtrlPoints[" + outCrvCount + "]: " + numCtrlPoints[outCrvCount]);
		
		var vbArg1 = new VBArray(subcrvData[1]);
		var subcrvKnots = vbArg1.toArray();
		knots = knots.concat(subcrvKnots);						// 3. Knots array cannot be a JScript array
		//LogMessage("Knots[" + outCrvCount + "]: " + subcrvKnots.toString() );
		
		numKnots[outCrvCount] = subcrvKnots.length;				// 4.
		//LogMessage("numKnots[" + outCrvCount + "]: " + numKnots[outCrvCount] );
		
		var oc = subcrvData[2];									// 5.
		if(flagArray[inCrvCount]) { oc = !oc; }	// ...toggle the OpenClose flag of that Subcurve
		isClosed[outCrvCount] = oc;
		//LogMessage("isClosed[" + outCrvCount + "]: " + isClosed[outCrvCount] );
		
		degree[outCrvCount] = subcrvData[3];					// 6.
		//LogMessage("degree[" + outCrvCount + "]: " + degree[outCrvCount] );
		
		parameterization[outCrvCount] = subcrvData[4];			// 7.
		//LogMessage("parameterization[" + outCrvCount + "]: " + parameterization[outCrvCount] );
		outCrvCount++;
	}
	//LogMessage("Count: " + outCrvCount);

	
	// overwrite this CurveList using Set
	geomOut.Set(
		outCrvCount, 		// 0. number of Subcurves in the Curvelist
		ctrlPoints, 		// 1. Array
		numCtrlPoints, 		// 2. Array, number of Control Points per Subcurve
		knots, 				// 3. Array
		numKnots, 			// 4. Array
		isClosed, 			// 5. Array
		degree, 			// 6. Array
		parameterization, 	// 7. Array
		0) ;				// 8. NurbsFormat: 0 = siSINurbs, 1 = siIGESNurbs
		
	return true;
}

