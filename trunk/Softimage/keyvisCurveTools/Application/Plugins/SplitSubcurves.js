//______________________________________________________________________________
// SplitSubcurvesPlugin
// 05/2010 by Eugen Sares
// last revision: 2010.04.26
// 
// Installation:
// Put it in your Plugins folder, restart SI or refresh the Plugin Manager
// You get a ApplySplitSubcurves command, which can be put to a Toolbar for example.
//
// Usage:
// Select one or more Knots on a Curve(list), apply SplitSubcurves
//______________________________________________________________________________

function XSILoadPlugin( in_reg )
{
	in_reg.Author = "Eugen";
	in_reg.Name = "SplitSubcurvesPlugin";
	in_reg.Major = 1;
	in_reg.Minor = 0;

	in_reg.RegisterOperator("SplitSubcurves");
	in_reg.RegisterCommand("ApplySplitSubcurves","ApplySplitSubcurves");
	in_reg.RegisterMenu(siMenuTbModelModifyCurveID,"ApplySplitSubcurves_Menu",false,false);
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

function ApplySplitSubcurves_Init( in_ctxt )
{
	var oCmd;
	oCmd = in_ctxt.Source;
	oCmd.Description = "Create an instance of SplitSubcurves operator";
	oCmd.SetFlag(siNoLogging,false);

	// TODO: You may want to add some arguments to this command so that the operator
	// can be applied to objects without depending on their specific names.
	// Tip: the Collection ArgumentHandler is very useful
	
	var oArgs = oCmd.Arguments;
	// To get a collection of subcomponents, or the current selection of subcomponents: 
	oArgs.AddWithHandler("args", "Collection");	// ArgumentName, ArgumentHandler, DefaultValue
	
	return true;
}







//______________________________________________________________________________

function ApplySplitSubcurves_Execute( args )
{
	Application.LogMessage("ApplySplitSubcurves_Execute called",siVerbose);
	// TODO: This generated code works by hardcoding the exact names of the
	// input and output objects.
	// If you want to operator to be applied to objects with different names
	// you way want to generalise this code to determine the objects
	// based on the Selection or the arguments to this command
	// 
	// Note: The AddCustomOp command is an alternative way to build the operator
	
//	LogMessage(args);	// crvlist.knot[4,5]

	do{
		if(args(0) == null || args(0).Type != "knotSubComponent") break;

		var oCrvListObj = args(0).SubComponent.Parent3DObject;
		var oCrvList = oCrvListObj.ActivePrimitive.Geometry;
		
		// get the Array of selected Knots
		var aKnotIndices = Selection(0).SubComponent.ElementArray.toArray();
//LogMessage(aKnotIndices);
		if(aKnotIndices.length == 0) break;

		// set all selected Knots to full multiplicity
		// Knots that already have full mult. are ignored
		// after that, slicing does not change the curvature
		// (Commands can be used here)
		SetCurveKnotMultiplicity(Application.Selection(0), 3, siPersistentOperation);	// Mult. 3 on degree 3 Curves, and 2 on degree 2 Curves.

		// create the Knot Cluster
		var oCluster = oCrvList.AddCluster( siKnotCluster, "SplitKnots", aKnotIndices);	// Type, [Name], [Indices]
// logCluster(oCluster);

		DeselectAllUsingFilter("Knot");

		// create the Operator
		var newOp = XSIFactory.CreateObject("SplitSubcurves");		// known to the system through XSILoadPlugin callback
		// SplitSubcurves_Init and
		// SplitSubcurves_Define are called...

		// connect the ports
		newOp.AddOutputPort(oCrvListObj.ActivePrimitive, "outputCurve");
		newOp.AddInputPort(oCrvListObj.ActivePrimitive, "inputCurve");
		newOp.AddInputPort(oCluster, "splitCluster");	// params: PortTarget, [PortName]
		
		newOp.Connect();
		return newOp;
	
	} while(true);
	// error message
	LogMessage("Please select some NurbsCurve Knots first.", siError);
}

/*
// for debugging:
//______________________________________________________________________________
function logKnotVector(knotVector)	// OK
{
	var knotString = "";
		for(var j = 0; j < knotVector.Count; j++)
		{
			if(j > 0) knotString = knotString + ","
			knotString = knotString + knotVector.item(j);
		}
		LogMessage(knotString);
}


//______________________________________________________________________________
function logCluster(oCluster)	// OK
{
	LogMessage("Cluster.Name: " + oCluster.Name);
	LogMessage("Cluster.Type: " + oCluster.Type);
	for(var i = 0; i < oCluster.Elements.Count; i++)
	{
		oElement = oCluster.Elements(i);
		LogMessage("i = " + i + ": " + oElement);
	}
}
*/







//______________________________________________________________________________

function SplitSubcurves_Define( in_ctxt )
{
	var oCustomOperator;
	var oPDef;
	oCustomOperator = in_ctxt.Source;

	oCustomOperator.AlwaysEvaluate = false;
	oCustomOperator.Debug = 1;
	return true;
}

//______________________________________________________________________________

function SplitSubcurves_Init( in_ctxt )
{
	Application.LogMessage("SplitSubcurves_Init called",siVerboseMsg);
	return true;
}

function SplitSubcurves_Term( in_ctxt )
{
	Application.LogMessage("SplitSubcurves_Term called",siVerboseMsg);
	return true;
}







//______________________________________________________________________________

function SplitSubcurves_Update( in_ctxt )
{
	Application.LogMessage("SplitSubcurves_Update called",siVerboseMsg);
	
	var geomOut = in_ctxt.OutputTarget.Geometry;	// Type: NurbsCurveCollection, ClassName: ""
	
	var oKnotCluster = in_ctxt.GetInputValue("splitCluster");

	var inputCrvColl = in_ctxt.GetInputValue("inputCurve").Geometry.Curves;

// create empty arrays to hold the new CurveList data
// http://softimage.wiki.softimage.com/index.php/Creating_a_merge_curve_SCOP

	var numSubcurves = 0;
	var aAllPoints = new Array();
	var aAllNumPoints = new Array();
	var aAllKnots = new Array();
	var aAllNumKnots = new Array();
	var aAllIsClosed = new Array();
	var aAllDegree = new Array();
	var aAllParameterization = new Array();

	
	// the indices of the selected Knots do not correspond to the Subcurves' Knot Vectors
	// so prepare some arrays for easy access:
	
	var aKnotHasKnotVecIdx = new Array();
	var aKnotIsOnSubcurve = new Array();
	var aKnotIsFirst = new Array();
	var aAllSubcrvSlices = new Array();	// Array of Arrays
	var aLastKnotIndices = new Array();

	// Example: CurveList with one open and one closed Subcurve
	// Knots 3 and 12 were selected (one on each Subcurve)
	// oKnotCluster = [3, 12]
	
	// KnotVectors =		[0, 0, 0, 1, 2, 3, 3, 3, 4, 5, 6, 6, 6]	[0, 0, 0, 1, 2, 3, 4, 5, 5, 5, 6, 7 ]
	// aKnotHasKnotVecIdx =	[0,       3, 4, 5,       8, 9, 10,		 0,       3, 4, 5, 6, 7,       10,11]
	// aKnotIsOnSubcurve =	[0,       0, 0, 0,       0, 0, 0,		 1,       1, 1, 1, 1, 1,       1,  1]
	// aKnotIsFirst =		[t,       f, f, f,       f, f, f,		 t,       f, f, f, f, f,       f,  f]
	
	// aLastKnotIndices =		[                              10,										  11]


	// this is what we want:
	// aAllSubcrvSlices =	[[0,            5,             10],     [0,                  7,           11]]
	// could also be someting like: [ [], [0, 4, 11, 14], [], [0, 6, 40], [0, 7] ]
	
	// note:
	// all selected Knots have already been converted to full multiplicity Knots in the Execute Callback.
	// such a Knot conincides with a Point.
	// conveniently, the KnotVector index of a full mult. Knot is also the index of that Point.
	// aKnotHasKnotVecIdx[3] = 5
	// aKnotHasKnotVecIdx[12] = 7
	// the Subcurve Point- and Knot-Arrays are then sliced/concatenated according to aAllSubcrvSlices
	
	// on closed Subcurves:
	// if only the first/last Knot was selected, the Subcurve will just be opened!



// 1) prepare arrays
// aKnotHasKnotVecIdx, aKnotIsOnSubcurve, aKnotIsFirst, aLastKnotIndices
	
	// loop through all Subcurves
	for(var subCrvIdx = 0; subCrvIdx < inputCrvColl.Count; subCrvIdx++)
	{
		// get input Subcurve
		var subCrv = inputCrvColl.item(subCrvIdx);
		VBdata = new VBArray(subCrv.Get2(siSINurbs));									
		var subCrvData = VBdata.toArray();
		
		// get Control Points array
		var vbArg0 = new VBArray(subCrvData[0]);
		var aPoints = vbArg0.toArray();

		// put number of Control Points in an array
		//aLastKnotIndices[subCrvIdx] = aPoints.length/4;	// /4? x,y,z,weight
		
		// get KnotVector
		var vbArg1 = new VBArray(subCrvData[1]);
		var aKnots = vbArg1.toArray();

		

		// first Point in the KnotVector
		aKnotHasKnotVecIdx.push(0);
		aKnotIsOnSubcurve.push(subCrvIdx);
		aKnotIsFirst.push(true);
				
		// loop through all Knots in the Vector
		for(var i = 1; i < aKnots.length; i++)
		{
			// eliminate Multiplicity
			// is the Knot different than the one before?
			if(aKnots[i] != aKnots[i - 1])
			{
				aKnotHasKnotVecIdx.push(i);
				aKnotIsOnSubcurve.push(subCrvIdx);
				aKnotIsFirst.push(false);
			}
		}
		
		// store the array index of this Subcurve's last Knot
		aLastKnotIndices.push(aKnotHasKnotVecIdx[aKnotHasKnotVecIdx.length - 1]);
		
	}	// end for

// debug:
/*	LogMessage("");
	LogMessage("aKnotHasKnotVecIdx: " + aKnotHasKnotVecIdx);
	LogMessage("aKnotIsOnSubcurve: " + aKnotIsOnSubcurve);
	LogMessage("aKnotIsFirst: " + aKnotIsFirst);
	LogMessage("aLastKnotIndices: " + aLastKnotIndices);
	LogMessage("");
*/
//return true;


// 2) prepare aAllSubcrvSlices array

	for(var i = 0; i < inputCrvColl.Count; i++) aAllSubcrvSlices[i] = [];
	
	// loop through all Knots in the input Cluster
	// note: the Knots in oKnotCluster are NOT sorted by index!
	for(var i = 0; i < oKnotCluster.Elements.Count; i++)
	{
		var knotIdx = oKnotCluster.Elements(i);
		var subcrv = aKnotIsOnSubcurve[knotIdx];
		
		// get slice array for the Knot's Subcurve
		var aSubcrvSlices = aAllSubcrvSlices[subcrv];

		if(aAllSubcrvSlices[subcrv].length == 0)
		{
		// no Knots in this slice array yet
			// put the Subcurve's start and end in it's slice array
			// if they remain the only knots in this array, this will in 3) be interpreted as "open Subcrv"
			aSubcrvSlices.push(0);
			aSubcrvSlices.push(aLastKnotIndices[subcrv]);
		}

		// splice in the Knot into Subcurve's slice array
		// loop through the slice array
//LogMessage("splicing Knots...");
		for(var j = 0; j < aSubcrvSlices.length; j++)
		{
			// if the Knot is already in the array, ignore it
			// can happen for 0 or LAST, since these are put in every new slice array
//LogMessage("knotIdx: " + knotIdx);
//LogMessage("aKnotHasKnotVecIdx[knotIdx]: " + aKnotHasKnotVecIdx[knotIdx]);
			if(aKnotHasKnotVecIdx[knotIdx] < aSubcrvSlices[j])
			{
			// splice it in here
				aSubcrvSlices.splice(j, 0, aKnotHasKnotVecIdx[knotIdx]);
				break;
			}
			
			if(aKnotHasKnotVecIdx[knotIdx] == aSubcrvSlices[j])
				break;
			
		}	// end for
		
		// write back the array
		aAllSubcrvSlices[subcrv] = aSubcrvSlices;
		
	}	// end for



// debug:
/*	LogMessage("");
	LogMessage("aAllSubcrvSlices:");
	for(var i = 0; i < aAllSubcrvSlices.length; i++)
	{
		LogMessage(i + ": " + aAllSubcrvSlices[i]);
	};
*/
//return true;



// 3) concatenate Subcurves / Subcurve slices
	
	// loop through all Subcurves
	for(var subCrvIdx = 0; subCrvIdx < inputCrvColl.Count; subCrvIdx++)
	{
		// get input Subcurve
		var subCrv = inputCrvColl.item(subCrvIdx);
		VBdata = new VBArray(subCrv.Get2(siSINurbs));										
		var subCrvData = VBdata.toArray();

		// 1. get Control Points array
		var vbArg0 = new VBArray(subCrvData[0]);
		var aPoints = vbArg0.toArray();

		// 2. get Number of Control Points
		var numPoints = aPoints.length/4;	// /4? x,y,z,weight

		// 3. get aAllKnots array
		var vbArg1 = new VBArray(subCrvData[1]);
		var aKnots = vbArg1.toArray();

		// 4. get Number of AllKnots	
		var numKnots = aKnots.length;

		// 5. get OpenClose flag
		var isClosed = subCrvData[2];

		// 6. get Curve Degree
		var degree = subCrvData[3];

		// 7. get Parameterization
		var parameterization = subCrvData[4];
	
	
// debug
/*		LogMessage("");
		LogMessage("Old Subcurve:");
		LogMessage("subCrvIdx: " + subCrvIdx);
		LogMessage("aPoints: " + aPoints.toString() );
		LogMessage("numPoints: " + numPoints);
		LogMessage("aKnots: " + aKnots.toString() );
		LogMessage("numKnots: " + numKnots );
		LogMessage("isClosed: " + isClosed );
		LogMessage("degree: " + degree );
		LogMessage("parameterization: " + parameterization );
		LogMessage("");
*/
		var aSubcrvSlices = aAllSubcrvSlices[subCrvIdx];	// above example: [0,5,10] and [0,7,11]
//LogMessage("aSubcrvSlices: " + aSubcrvSlices);
		switch(aSubcrvSlices.length)
		{
		case 2:	// [0,LAST]
		// only first & last Knot were selected
			if(isClosed)
			{
			// Subcurve was closed -> Subcurve will be opened
				// copy first Point to end
				for(var j = 0; j < 4; j++)	aPoints.push(aPoints[j]);	
				
				// adapt Knot vector length: In open Curves: K = P + degree - 1
				aKnots.length = aPoints.length / 4 + degree - 1;	// x,y,z,w

				// set first Knot to full Mult.
				var firstKnot = aKnots[degree] - 1;
				for(var j = 0; j < degree - 1; j++)	aKnots[j] = firstKnot;
				
				// set last Knot to full Mult.
				var lastKnot = aKnots[aKnots.length - degree - 1] + 1;
				for(var j = degree; j > 0; j--)	aKnots[aKnots.length - j] = lastKnot;

				// write this Subcurve to the CurveList data
				aAllPoints = aAllPoints.concat(aPoints);
				aAllNumPoints[numSubcurves] = aPoints.length / 4;
				aAllKnots = aAllKnots.concat(aKnots);
				aAllNumKnots[numSubcurves] = aKnots.length;
				aAllIsClosed[numSubcurves] = false;	// open this Subcurve
				aAllDegree[numSubcurves] = degree;
				aAllParameterization[numSubcurves] = parameterization;
				
				numSubcurves++;
				break;
			}
			// Subcurve was open, first and last Knot were selected (which doesn't make much sense, but can happen) ->
			// simply do the same as in case 0:
			
		case 0:	// []
		// no Knots were selected on this Subcurve ->
		// copy this Subcurve to the CurveList data unchanged
			aAllPoints = aAllPoints.concat(aPoints);
			aAllNumPoints[numSubcurves] = aPoints.length / 4;	// x,y,z,w
			aAllKnots = aAllKnots.concat(aKnots);
			aAllNumKnots[numSubcurves] = aKnots.length;
			aAllIsClosed[numSubcurves] = isClosed;
			aAllDegree[numSubcurves] = degree;
			aAllParameterization[numSubcurves] = parameterization;
			
			numSubcurves++;
			break;


		default:
		// Knots were selected along the Subcurve, add it's slices to the CurveList data
		// example: aSubcrvSlices = [0,5,10],[0,7,11]

			// loop through all Knots in aSubcrvSlices
			var lastIdx = aSubcrvSlices.length - 1;
			for(var i = 0; i < lastIdx; i++)
			{
				var startIdx = aSubcrvSlices[i];
				var endIdx = aSubcrvSlices[i + 1];
				var aPointsSlice = aPoints.slice(startIdx * 4, (endIdx + 1) * 4);	// x,y,z,w
				var aKnotsSlice = aKnots.slice(startIdx, endIdx + degree);

			if(isClosed)
			{
				if(i == 0)
				{
				// first slice pulled from a closed Subcurve ->
				// set first Knot to full Mult.
				var firstKnot = aKnotsSlice[degree] - 1;
				for(var j = 0; j < degree - 1; j++)	aKnotsSlice[j] = firstKnot;
				
				} else if(i == lastIdx - 1)
				{
				// last slice pulled from a closed Subcurve
				// -> duplicate first Point to the end
				for(var j = 0; j < 4; j++)	aPointsSlice.push(aPoints[j]);

				// adapt Knot vector length: In open Curves: K = P + degree - 1
				aKnotsSlice.length = aPointsSlice.length / 4 + degree - 1;
		
				// set last Knot to full Multiplicity
				var lastKnot = aKnotsSlice[aKnotsSlice.length - degree - 1] + 1;

				for(var j = degree; j > 0; j--)	aKnotsSlice[aKnotsSlice.length - j] = lastKnot;

				}
			}

			// write this Slice to the CurveList data
			aAllPoints = aAllPoints.concat(aPointsSlice);
			aAllNumPoints[numSubcurves] = aPointsSlice.length / 4;
			aAllKnots = aAllKnots.concat(aKnotsSlice);
			aAllNumKnots[numSubcurves] = aKnotsSlice.length;
			aAllIsClosed[numSubcurves] = false;	// Subcurve Slices are never closed
			aAllDegree[numSubcurves] = degree;
			aAllParameterization[numSubcurves] = parameterization;
				
			numSubcurves++;
				
			}	// end for all Knots in aSubcrvSlices

		}	// end switch

	}	// end for


// debug

/*	LogMessage("--------------------------------------"); 
	LogMessage("New CurveList:");
	LogMessage("Number of Subcurves: " + numSubcurves);
	LogMessage("aAllPoints: " + aAllPoints);
	LogMessage("aAllPoints.length/4: " + aAllPoints.length/4);
	LogMessage("aNumAllPoints: " + aAllNumPoints);
	LogMessage("aAllKnots: " + aAllKnots);
	LogMessage("aAllKnots.length: " + aAllKnots.length);
	LogMessage("aNumAllKnots: " + aAllNumKnots);
	LogMessage("aIsClosed: " + aAllIsClosed);
	LogMessage("aDegree: " + aAllDegree);
	LogMessage("aParameterization: " + aAllParameterization);
*/

	// overwrite this CurveList using Set
	geomOut.Set(
		numSubcurves,				// 0. number of Subcurves in the Curvelist
		aAllPoints, 			// 1. Array
		aAllNumPoints, 			// 2. Array, number of Control Points per Subcurve
		aAllKnots,				// 3. Array
		aAllNumKnots,			// 4. Array
		aAllIsClosed, 			// 5. Array
		aAllDegree, 			// 6. Array
		aAllParameterization, 	// 7. Array
		0) ;					// 8. NurbsFormat: 0 = siSINurbs, 1 = siIGESNurbs			// 8. NurbsFormat: 0 = siSINurbs, 1 = siIGESNurbs

	return true;
}


//______________________________________________________________________________

function ApplySplitSubcurves_Menu_Init( in_ctxt )
{
	var oMenu;
	oMenu = in_ctxt.Source;
	oMenu.AddCommandItem("SplitSubcurves","ApplySplitSubcurves");
	return true;
}

//______________________________________________________________________________
