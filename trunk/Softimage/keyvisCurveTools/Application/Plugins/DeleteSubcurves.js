//______________________________________________________________________________
// DeleteSubcurvesPlugin
// 10/2009 by Eugen Sares
// last revision: 26.10.2010
//
// Usage:
// Set selection filter to "Subcurve" > select some Subcurves in a NurbsCurveList > ApplyDeleteSubcurves.
//______________________________________________________________________________

function XSILoadPlugin( in_reg )
{
	in_reg.Author = "Eugen";
	in_reg.Name = "DeleteSubcurvesPlugin";
	in_reg.Major = 1;
	in_reg.Minor = 0;

	in_reg.RegisterOperator("DeleteSubcurves");
	in_reg.RegisterCommand("ApplyDeleteSubcurves","ApplyDeleteSubcurves");
	in_reg.RegisterMenu(siMenuTbModelModifyCurveID,"ApplyDeleteSubcurves_Menu",false,false);	
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

function ApplyDeleteSubcurves_Init( in_ctxt )	// called before ApplyDeleteSubcurves_Execute
{
	Application.LogMessage("ApplyDeleteSubcurves_Init called",siVerbose);
	
	var oCmd;
	oCmd = in_ctxt.Source;	// source object that is the cause of the callback being fired
	oCmd.Description = "Create an instance of DeleteSubcurves operator";
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

function ApplyDeleteSubcurves_Execute(args)
{
	Application.LogMessage("ApplyDeleteSubcurves_Execute called",siVerbose);

	do{
		if(args == "") break;
// check if the selection is a Subcurve or a Cluster of Subcurves
		if(args(0).Type != "subcrvSubComponent" && args(0).Type != "subcrv" ) break;
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
		oCluster = oParent.ActivePrimitive.Geometry.AddCluster( siSubCurveCluster, "DeletedSubcurves", idxArray );

		DeselectAllUsingFilter("SubCurve");
		

		var newOp = XSIFactory.CreateObject("DeleteSubcurves");	// known to the system through XSILoadPlugin callback
		// DeleteSubcurves_Init and
		// DeleteSubcurves_Define are called...
		
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


//______________________________________________________________________________

// Use this callback to build a set of parameters that will appear in the property page.
function DeleteSubcurves_Define( in_ctxt )
{
	Application.LogMessage("DeleteSubcurves_Define called",siVerboseMsg);
	
	var oCustomOperator;
	//var oPDef;
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
function DeleteSubcurves_Init( in_ctxt )
{
	Application.LogMessage("DeleteSubcurves_Init called",siVerboseMsg);
	
	
//var inputClusterElements = in_ctxt.GetInputValue("deleteCluster").Elements;
	//var inputCluster = in_ctxt.GetInputValue("deleteCluster");
	//inputClusterID = inputCluster.ObjectID;
	//in_ctxt.SetAttribute("deleteCluster", inputClusterID);
	return true;
}


//______________________________________________________________________________

function DeleteSubcurves_Term( in_ctxt )
{
	Application.LogMessage("DeleteSubcurves_Term called",siVerboseMsg);
	
	//var inputClusterElements = in_ctxt.GetInputValue("deleteCluster").Elements;
	//var src = in_ctxt.Source;
	//LogMessage("Source: " + src);	// Source: text.crvlist.DeleteSubcurves
	//var cluster = in_ctxt.GetInputValue("deleteCluster");	// ERROR : 21000 - Unspecified failure
	//LogMessage("ok");
	//DeleteObj(cluster);
	return true;
}


//______________________________________________________________________________

function DeleteSubcurves_Update( in_ctxt )
{
	Application.LogMessage("DeleteSubcurves_Update called",siVerboseMsg);
	
	var geomOut = in_ctxt.OutputTarget.Geometry;	// Type: NurbsCurveCollection, ClassName: ""
	
	//var inputCluster = in_ctxt.GetInputValue("deleteCluster");	// Type: subcrv, ClassName: Cluster, FullName: xy.crvlist.cls.DeletedSubcurves
	//var oSubcurves = inputCluster.CreateSubComponent();	// ERROR : 2009 - Access denied

	// var inputClusters = in_ctxt.GetInputValue("inputCurve").Geometry.Clusters;	// ERROR : 2009 - Access denied
	var inputClusterElements = in_ctxt.GetInputValue("deleteCluster").Elements;	// ClassName: ClusterElementCollection
	var clusterCount = inputClusterElements.Count;

	var inputCrvColl = in_ctxt.GetInputValue("inputCurve").Geometry.Curves;

	// for fast checking which Subcurve is marked/selected:
	// "flagArray" is a boolean array which is true at the index of each selected Subcurve.
	// inputClusterElements.FindIndex() can be used as well, but this should be faster at higher Subcurve counts.
	var flagArray = new Array(inputCrvColl.Count);
	for(i = 0; i < inputCrvColl.Count; i++) { flagArray[i] = false; }	// initialize. is this necessary?
	for(i = 0; i < clusterCount; i++) { flagArray[inputClusterElements(i)] = true; }

	// create empty arrays to hold the new CurveList data
	// http://softimage.wiki.softimage.com/index.php/Creating_a_merge_curve_SCOP
	// "JScript has the Array() type which when passed to C++ ends up as a pointer to a scripting object.
	// The internal code is expecting either a flat 1 dimensional array or a 2 dimensional array constructed from a VBArray.
	// It is not able to convert an JScript Array of JScript Arrays and fails."

	var outCrvCount = 0;
	var ctrlPoints = new Array();
	var numCtrlPoints = new Array();
	var knots = new Array();
	var numKnots = new Array();
	var isClosed = new Array();
	var degree = new Array();
	var parameterization = new Array();

	if(inputCrvColl.Count > clusterCount)
	{
	// when not all Subcurves have to be deleted:
		for(inCrvCount = 0; inCrvCount < inputCrvColl.Count; inCrvCount++)
		{
			//searchIndex = inputClusterElements.FindIndex(inCrvCount);	// Returns the cluster index of the item as a Long, or returns -1 if the item is not found.
			//if(searchIndex != -1) continue;	// If this Subcurve index is found in the Cluster, skip it!
			if(flagArray[inCrvCount]) continue;

			var subcrv = inputCrvColl.item(inCrvCount);	// get input Subcurve. Type: NurbsCurve, ClassName: NurbsCurve
			VBdata = new VBArray(subcrv.Get2(siSINurbs));	// NurbsCurve.Get2 returns a complete data description of the Nurbs Curve as VBArray.										
			var subcrvData = VBdata.toArray();	// convert to native JScript array. Note: "toArray", NOT "ToArray"!
			
			// 1. Control Points
			var vbArg0 = new VBArray(subcrvData[0]);
			var subcrvCtrlPoints = vbArg0.toArray();				// Control Points array cannot be a JScript array
			ctrlPoints = ctrlPoints.concat(subcrvCtrlPoints);		// to flatten the array
			//LogMessage("CtrlPoints[" + outCrvCount + "]: " + subcrvCtrlPoints.toString() );
			
			// 2. number of Control Points
			numCtrlPoints[outCrvCount] = subcrvCtrlPoints.length/4;	// x,y,z,weight
			//LogMessage("numCtrlPoints[" + outCrvCount + "]: " + numCtrlPoints[outCrvCount]);
			
			// 3. Knots
			var vbArg1 = new VBArray(subcrvData[1]);
			var subcrvKnots = vbArg1.toArray();
			knots = knots.concat(subcrvKnots);						// Knots array cannot be a JScript array
			//LogMessage("Knots[" + outCrvCount + "]: " + subcrvKnots.toString() );
			
			// 4. number of Knots
			numKnots[outCrvCount] = subcrvKnots.length;
			//LogMessage("numKnots[" + outCrvCount + "]: " + numKnots[outCrvCount] );
			
			// 5. isClosed
			isClosed[outCrvCount] = subcrvData[2];
			//LogMessage("isClosed[" + outCrvCount + "]: " + isClosed[outCrvCount] );
			
			// 6. degree
			degree[outCrvCount] = subcrvData[3];
			//LogMessage("degree[" + outCrvCount + "]: " + degree[outCrvCount] );
			
			// 7. parameterization
			parameterization[outCrvCount] = subcrvData[4];
			//LogMessage("parameterization[" + outCrvCount + "]: " + parameterization[outCrvCount] );

			outCrvCount++;
		}
		//LogMessage("Count: " + outCrvCount);

	} else
	{
	// when all Subcurves are deleted:
		
	// hint: the .Set function does not take empty arguments. One point minimum.
	// This is the smallest possible CurveList, like it gets created by:
	// var oEmpty = SICreateCurve("emptyCurve", 3, 1);
		outCrvCount = 1;
		ctrlPoints = [0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1];	// 4 Points, each 0,0,0,1 (x,y,z,weight)
		numCtrlPoints = [4];
		knots = [0,0,0,1,1,1];	// 6 Knots
		numKnots = [6];
		isClosed = [false];
		degree = [3];
		parameterization = [siNonUniformParameterization];	// 1
	}
	
	// overwrite this CurveList using Set method
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

//______________________________________________________________________________

function ApplyDeleteSubcurves_Menu_Init( in_ctxt )
{
	var oMenu;
	oMenu = in_ctxt.Source;
	oMenu.AddCommandItem("DeleteSubcurves","ApplyDeleteSubcurves");
	return true;
}

//______________________________________________________________________________
