//______________________________________________________________________________
// SplitSubcurvesPlugin
// 2010/05 by Eugen Sares
// last update: 2011/02/18
//
// Usage:
// - Select Knot(s) on a NurbsCurve(List)
// - Model > Modify > Curve > SplitSubcurve
//______________________________________________________________________________

function XSILoadPlugin( in_reg )
{
	in_reg.Author = "Eugen Sares";
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

//	LogMessage(args);	// crvlist.knot[4,5]

	try
	{
		var cSel = Selection;

		// Filter a Collection of Subcurve Clusters out of the Selection.
		var cKnotClusters = new ActiveXObject("XSI.Collection");
		var cCurveLists = new ActiveXObject("XSI.Collection");

		// Filter the Selection for Clusters and Subcurves.
		for(var i = 0; i < cSel.Count; i++)
		{
			if( cSel(i).Type == "knot" && ClassName(cSel(i)) == "Cluster")
			{
				cKnotClusters.Add(cSel(i));
				cCurveLists.Add( cSel(i).Parent3DObject );
				
			}

			if( cSel(i).Type == "knotSubComponent" )
			{
				var oObject = cSel(i).SubComponent.Parent3DObject;
				var elementIndices = cSel(i).SubComponent.ElementArray.toArray();
				var oCluster = oObject.ActivePrimitive.Geometry.AddCluster( siKnotCluster, "Knot_AUTO", elementIndices );

				cKnotClusters.Add( oCluster );
				cCurveLists.Add( oObject );
			}
			
/*			if( cSel(i).Type == "crvlist")
			{
				// Problem: PickElement does not bother if CurveLists is already selected.
				// Otherwise, we could iterate through all selected CurveLists and start a pick session for each.
				SetSelFilter("Knot");
				
				var ret = pickElements("Knot", "Argument must be Knots.");
				var oObject = ret.oObject;
				var elementIndices = ret.elementIndices;
			}
*/
			
		}

		// If nothing usable was selected, start a Pick Session.
		if(cKnotClusters.Count == 0)
		{
			var ret = pickElements("Knot");
			var oObject = ret.oObject;
			var elementIndices = ret.elementIndices;
			
			var oCluster = oObject.ActivePrimitive.Geometry.AddCluster( siKnotCluster, "Knot_AUTO", elementIndices );

			cKnotClusters.Add(oCluster);
			cCurveLists.Add( oObject );

		}

/*		for(var i = 0; i < cSubcurveClusters.Count; i++)
		{
			LogMessage("cSubcurveClusters(" + i + "): " + cSubcurveClusters(i));
			LogMessage("cCurveLists(" + i + "): " + cCurveLists(i));
		}
*/
		DeselectAllUsingFilter("Knot");

		// Construction mode automatic updating.
		var constructionModeAutoUpdate = GetValue("preferences.modeling.constructionmodeautoupdate");
		if(constructionModeAutoUpdate) SetValue("context.constructionmode", siConstructionModeModeling);


		// Create Output Objects string
/*		var cOutput = new ActiveXObject("XSI.Collection");
		for(var i = 0; i < cSubcurveClusters.Count; i++)
		{
			cOutput.Add( cCurveLists(i) );
		}
*/		
		var operationMode = Preferences.GetPreferenceValue( "xsiprivate_unclassified.OperationMode" );
		var bAutoinspect = Preferences.GetPreferenceValue("Interaction.autoinspect");
		
		var createdOperators = new ActiveXObject("XSI.Collection");
		
		if(operationMode == siImmediateOperation)
		{
			// Loop through all selected/created Clusters and apply the Operator.
			for(var i = 0; i < cKnotClusters.Count; i++)
			{
				// Add the Operator
				var oOutput = cCurveLists(i).ActivePrimitive;
				var oInput1 = cCurveLists(i).ActivePrimitive;
				var oInput2 = cKnotClusters(i);

				// Mult. 3 on degree 3 Curves, and 2 on degree 2 Curves.
				// This factory Op also solves the selection problem in Custom Topo Ops.
				SetCurveKnotMultiplicity(cKnotClusters(i), 3, siPersistentOperation);
				
				//AddCustomOp( Type, OutputObjs, [InputObjs], [Name], [ConstructionMode] )
				// Port names will be generated automatically!
				var newOp = AddCustomOp("SplitSubcurves", oOutput, [oInput1, oInput2], "SplitSubcurves");

				/*
				var rtn = GetKeyboardState();
				modifier = rtn(1);
				var bCtrlDown = false;
				if(modifier == 2) bCtrlDown = true;

				if(Application.Interactive && bAutoinspect && !bCtrlDown)
					//AutoInspect(newOp); // BUG: does not work with Custom Ops(?)
					InspectObj(newOp, "", "", siModal, true);
				*/

				// FreezeModeling( [InputObjs], [Time], [PropagationType] )
				FreezeModeling(cCurveLists(i), null, siUnspecified);
				
				createdOperators.Add(newOp);
			}
			
		} else
		{
			// Loop through all selected/created Clusters and apply the Operator.
			for(var i = 0; i < cKnotClusters.Count; i++)
			{
				// Define Outputs and Inputs.
				var oOutput = cCurveLists(i).ActivePrimitive;
				var oInput1 = cCurveLists(i).ActivePrimitive;
				var oInput2 = cKnotClusters(i);
				
				// Mult. 3 on degree 3 Curves, and 2 on degree 2 Curves.
				// This factory Op also solves the selection problem in Custom Topo Ops.
				SetCurveKnotMultiplicity(cKnotClusters(i), 3, siPersistentOperation);

				var newOp = AddCustomOp("SplitSubcurves", oOutput, [oInput1, oInput2], "SplitSubcurves");

				createdOperators.Add(newOp);
				
			}

			/*
			if(createdOperators.Count != 0 && bAutoinspect && Application.Interactive)
				AutoInspect(createdOperators); // Multi-PPG
			*/
		}

		return true;

	} catch(e)
	{
		LogMessage(e, siWarning);
		return false;
	};

}

//______________________________________________________________________________

function pickElements(selFilter, errorMsg)
{

	var subcurves, button;	// useless, but needed in JScript.
	// Tip: PickElement() automatically manages to select a CurveList first, then a Subcurve!
	var rtn = PickElement( selFilter, selFilter, selFilter, subcurves, button, 0 );
	button = rtn.Value( "ButtonPressed" );
	if(!button) throw errorMsg;
	element = rtn.Value( "PickedElement" );
	//var modifier = rtn.Value( "ModifierPressed" );
	
	// element.Type: subcrvSubComponent
	// ClassName(element): CollectionItem

	var oObject = element.SubComponent.Parent3DObject;
	var elementIndices = element.SubComponent.ElementArray.toArray();

	return {oObject: oObject, elementIndices: elementIndices};
	
}


function SplitSubcurves_Define( in_ctxt )
{
	var oCustomOperator;
	var oPDef;
	oCustomOperator = in_ctxt.Source;

	oCustomOperator.AlwaysEvaluate = false;
	oCustomOperator.Debug = 0;
	return true;
}


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

	//// Get Port connections.
	var outCrvListGeom = in_ctxt.OutputTarget.Geometry;
	var inCrvListGeom = in_ctxt.GetInputValue(0).Geometry; // Port 0: "Incrvlist"
	var oKnotCluster = in_ctxt.GetInputValue(1); // Port 1: "InSubcurve_AUTO"
	var cInCurves = inCrvListGeom.Curves;
	
/*	var outCrvListGeom = in_ctxt.OutputTarget.Geometry;	// Type: NurbsCurveCollection, ClassName: ""
	var oKnotCluster = in_ctxt.GetInputValue("splitClusterPort");
	var cInCurves = in_ctxt.GetInputValue("InCurvePort").Geometry.Curves;
*/

	// Create arrays for complete CurveList data.
	var numAllSubcurves = 0;
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


	// INFO
	// Example: CurveList with one open and one closed Subcurve
	// Knots 3 and 12 were selected (one on each Subcurve) -> oKnotCluster = [3, 12]
	
	// KnotVectors =		[0, 0, 0, 1, 2, 3, 3, 3, 4, 5, 6, 6, 6]	[0, 0, 0, 1, 2, 3, 4, 5, 5, 5, 6, 7 ]
	// aKnotHasKnotVecIdx =	[0,       3, 4, 5,       8, 9, 10,		 0,       3, 4, 5, 6, 7,       10,11]
	// aKnotIsOnSubcurve =	[0,       0, 0, 0,       0, 0, 0,		 1,       1, 1, 1, 1, 1,       1,  1]
	// aKnotIsFirst =		[t,       f, f, f,       f, f, f,		 t,       f, f, f, f, f,       f,  f]
	
	// aLastKnotIndices =	[                              10,										  11]


	// This is what we want:
	// aAllSubcrvSlices =	[[0,            5,             10],     [0,                  7,           11]]
	// Another example: [ [], [0, 4, 11, 14], [], [0, 6, 40], [0, 7] ]
	
	// Note:
	// Knots with full multiplicity (knot repeated degree times - 1,2,3) is called Bezier Knot.
	// Bezier Knots coincide with a Point. That's where we can split the Subcurve.
	// All selected Knots have already been converted to Bezier Knots in the Execute Callback.
	// Conveniently, the KnotVector index of a Bezier Knot is also the index of the Point.
	// Example: Bezier Knot 3 is selected.
	// aKnotHasKnotVecIdx[3] = 5
	// 5 is the array position where the Knot Vector can be split, and also
	// the index of the Point on this Knot.
	
	// The Subcurve Point- and Knot-Arrays are then sliced/concatenated according to aAllSubcrvSlices
	
	// On closed Subcurves:
	// If only the first/last Knot was selected, the Subcurve will be opened.



	// 1) Prepare arrays
	// aKnotHasKnotVecIdx, aKnotIsOnSubcurve, aKnotIsFirst, aLastKnotIndices
	
	// Loop through all Subcurves.
	for(var subCrvIdx = 0; subCrvIdx < cInCurves.Count; subCrvIdx++)
	{
		// Get input Subcurve.
		var subCrv = cInCurves.item(subCrvIdx);
		VBdata = new VBArray(subCrv.Get2(siSINurbs)); var subCrvData = VBdata.toArray();
		
		// Get Control Points array.
		var VBdata0 = new VBArray(subCrvData[0]); var aPoints = VBdata0.toArray();

		// Put number of Control Points in an array.
		//aLastKnotIndices[subCrvIdx] = aPoints.length/4;	// /4? x,y,z,weight
		
		// Get KnotVector.
		var VBdata1 = new VBArray(subCrvData[1]); var aKnots = VBdata1.toArray();


		// First Point in the KnotVector
		aKnotHasKnotVecIdx.push(0);
		aKnotIsOnSubcurve.push(subCrvIdx);
		aKnotIsFirst.push(true);
				
		// Loop through all Knots in the Vector.
		for(var i = 1; i < aKnots.length; i++)
		{
			// Eliminate Multiplicity.
			// Is the Knot different than the one before?
			if(aKnots[i] != aKnots[i - 1])
			{
				aKnotHasKnotVecIdx.push(i);
				aKnotIsOnSubcurve.push(subCrvIdx);
				aKnotIsFirst.push(false);
			}
		}
		
		// Store the array index of this Subcurve's last Knot.
		aLastKnotIndices.push(aKnotHasKnotVecIdx[aKnotHasKnotVecIdx.length - 1]);
		
	}	// end for

// debug:
/*	LogMessage("");
	LogMessage("aKnotHasKnotVecIdx: " + aKnotHasKnotVecIdx);
	LogMessage("aKnotIsOnSubcurve: " + aKnotIsOnSubcurve);
	LogMessage("aKnotIsFirst: " + aKnotIsFirst);
	LogMessage("aLastKnotIndices: " + aLastKnotIndices);
	LogMessage("");
	return true;
*/

	// 2) Prepare array aAllSubcrvSlices

	for(var i = 0; i < cInCurves.Count; i++) aAllSubcrvSlices[i] = [];
	
	// Loop through all Knots in the input Cluster.
	// Note: the Knots in oKnotCluster are NOT sorted by index!
	for(var i = 0; i < oKnotCluster.Elements.Count; i++)
	{
		var knotIdx = oKnotCluster.Elements(i);
		var subcrv = aKnotIsOnSubcurve[knotIdx];
		
		// Get slice array for the Knot's Subcurve.
		var aSubcrvSlices = aAllSubcrvSlices[subcrv];

		if(aAllSubcrvSlices[subcrv].length == 0)
		{
		// No Knots in this slice array yet.
			// Put the Subcurve's start and end in it's slice array.
			// If they remain the only knots in this array,
			// the Subcurve will be opened in 3)
			aSubcrvSlices.push(0);
			aSubcrvSlices.push(aLastKnotIndices[subcrv]);
		}

		// Splice in the Knot into Subcurve's slice array.
		// Loop through slice array.
		for(var j = 0; j < aSubcrvSlices.length; j++)
		{
			// If the Knot is already in the array, ignore it.
			// Can happen for 0 or LAST, since these are put in every new slice array.
			if(aKnotHasKnotVecIdx[knotIdx] < aSubcrvSlices[j])
			{
			// Splice it in here.
				aSubcrvSlices.splice(j, 0, aKnotHasKnotVecIdx[knotIdx]);
				break;
			}
			
			if(aKnotHasKnotVecIdx[knotIdx] == aSubcrvSlices[j])
				break;
			
		}	// end for

		aAllSubcrvSlices[subcrv] = aSubcrvSlices;
		
	}	// end for



//	debug:
/*	LogMessage("");
	LogMessage("aAllSubcrvSlices:");
	for(var i = 0; i < aAllSubcrvSlices.length; i++)
	{
		LogMessage(i + ": " + aAllSubcrvSlices[i]);
	};
*/
//	return true;



	// 3) Concatenate Subcurves / Subcurve slices
	
	// Loop through all Subcurves.
	for(var subCrvIdx = 0; subCrvIdx < cInCurves.Count; subCrvIdx++)
	{
		// Get input Subcurve.
		var subCrv = cInCurves.item(subCrvIdx);
		VBdata = new VBArray(subCrv.Get2(siSINurbs));									
		var subCrvData = VBdata.toArray();

		// Get Point data.
		var vbArg0 = new VBArray(subCrvData[0]);
		var aPoints = vbArg0.toArray();
		var numPoints = aPoints.length/4;	// /4? x,y,z,weight

		// Get Knot data.
		var vbArg1 = new VBArray(subCrvData[1]);
		var aKnots = vbArg1.toArray();
		var numKnots = aKnots.length;

		// Get other data.
		var isClosed = subCrvData[2];
		var degree = subCrvData[3];
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

		switch(aSubcrvSlices.length)
		{
		case 2:	// [0,LAST]
		// Only first & last Knot were selected.
			if(isClosed)
			{
			// Subcurve was closed -> Subcurve will be opened.
				// Copy first Point to end.
				for(var j = 0; j < 4; j++)	aPoints.push(aPoints[j]);	
				
				// Adapt Knot vector length: In open Curves: K = P + degree - 1
				aKnots.length = aPoints.length / 4 + degree - 1;	// x,y,z,w

				// Set first Knot to full Mult.
				var firstKnot = aKnots[degree] - 1;
				for(var j = 0; j < degree - 1; j++)	aKnots[j] = firstKnot;
				
				// Set last Knot to full Mult.
				var lastKnot = aKnots[aKnots.length - degree - 1] + 1;
				for(var j = degree; j > 0; j--)	aKnots[aKnots.length - j] = lastKnot;

				// Write this Subcurve to the CurveList data.
				aAllPoints = aAllPoints.concat(aPoints);
				aAllNumPoints[numAllSubcurves] = aPoints.length / 4;
				aAllKnots = aAllKnots.concat(aKnots);
				aAllNumKnots[numAllSubcurves] = aKnots.length;
				aAllIsClosed[numAllSubcurves] = false;	// open this Subcurve
				aAllDegree[numAllSubcurves] = degree;
				aAllParameterization[numAllSubcurves] = parameterization;
				
				numAllSubcurves++;
				break;
			}
			// Subcurve was open, first and last Knot were selected (which doesn't make much sense, but can happen) ->
			// simply do the same as in case 0:
			
		case 0:	// []
		// No Knots were selected on this Subcurve ->
		// Copy this Subcurve to the CurveList data unchanged
			aAllPoints = aAllPoints.concat(aPoints);
			aAllNumPoints[numAllSubcurves] = aPoints.length / 4;	// x,y,z,w
			aAllKnots = aAllKnots.concat(aKnots);
			aAllNumKnots[numAllSubcurves] = aKnots.length;
			aAllIsClosed[numAllSubcurves] = isClosed;
			aAllDegree[numAllSubcurves] = degree;
			aAllParameterization[numAllSubcurves] = parameterization;
			
			numAllSubcurves++;
			break;


		default:
		// Knots were selected along the Subcurve, add it's slices to the CurveList data
		// Example: aSubcrvSlices = [0,5,10],[0,7,11]

			// Loop through all Knots in aSubcrvSlices.
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
				// First slice pulled from a closed Subcurve ->
				// Set first Knot to full Mult.
				var firstKnot = aKnotsSlice[degree] - 1;
				for(var j = 0; j < degree - 1; j++)	aKnotsSlice[j] = firstKnot;
				
				} else if(i == lastIdx - 1)
				{
				// Last slice pulled from a closed Subcurve.
				// -> duplicate first Point to the end
				for(var j = 0; j < 4; j++)	aPointsSlice.push(aPoints[j]);

				// Adapt Knot vector length: In open Curves: K = P + degree - 1
				aKnotsSlice.length = aPointsSlice.length / 4 + degree - 1;
		
				// Set last Knot to full Multiplicity.
				var lastKnot = aKnotsSlice[aKnotsSlice.length - degree - 1] + 1;

				for(var j = degree; j > 0; j--)	aKnotsSlice[aKnotsSlice.length - j] = lastKnot;

				}
			}

			// Write this Slice to the CurveList data.
			aAllPoints = aAllPoints.concat(aPointsSlice);
			aAllNumPoints[numAllSubcurves] = aPointsSlice.length / 4;
			aAllKnots = aAllKnots.concat(aKnotsSlice);
			aAllNumKnots[numAllSubcurves] = aKnotsSlice.length;
			aAllIsClosed[numAllSubcurves] = false;	// Subcurve Slices are never closed
			aAllDegree[numAllSubcurves] = degree;
			aAllParameterization[numAllSubcurves] = parameterization;
				
			numAllSubcurves++;
				
			}	// end for all Knots in aSubcrvSlices

		}	// end switch

	}	// end for


	// Simple testCurve
/*	var testCrvPoints = [0,0,0,1, 1,0,0,1];
	var testCrvKnots = [0,1];
	var testCrvIsClosed = false;
	var testCrvDegree = 1;
	var testCrvParameterization = siNonUniformParameterization;
*/

	// Debug
/*	LogMessage("New CurveList:");
	LogMessage("allSubcurvesCnt:      ");
	logControlPointsArray("aAllPoints: ", aAllPoints, 100);
	//LogMessage("aAllPoints:           " + aAllPoints);
	LogMessage("aAllPoints.length/4:  " + aAllPoints.length/4);
	//LogMessage("aAllNumPoints:        " + aAllNumPoints);
	//LogMessage("aAllKnots:            " + aAllKnots);
	logKnotsArray("aAllKnots: " + aAllKnots, 100);
	LogMessage("aAllKnots.length:     " + aAllKnots.length);
	LogMessage("aAllNumKnots:         " + aAllNumKnots);
	LogMessage("aAllIsClosed:         " + aAllIsClosed);
	LogMessage("aAllDegree:           " + aAllDegree);
	LogMessage("aAllParameterization: " + aAllParameterization);
*/

	// Set output CurveList.
	outCrvListGeom.Set(
		numAllSubcurves,		// 0. number of Subcurves in the Curvelist
		aAllPoints, 			// 1. Array
		aAllNumPoints, 			// 2. Array, number of Control Points per Subcurve
		aAllKnots,				// 3. Array
		aAllNumKnots,			// 4. Array
		aAllIsClosed, 			// 5. Array
		aAllDegree, 			// 6. Array
		aAllParameterization, 	// 7. Array
		siSINurbs) ;			// 8. NurbsFormat: 0 = siSINurbs, 1 = siIGESNurbs			// 8. NurbsFormat: 0 = siSINurbs, 1 = siIGESNurbs

	return true;
}


//______________________________________________________________________________

function SplitSubcurves_DefineLayout( in_ctxt )
{
	var oLayout,oItem;
	oLayout = in_ctxt.Source;
	oLayout.Clear();
	//oLayout.AddItem("xxx"); 
	return true;
}


function ApplySplitSubcurves_Menu_Init( in_ctxt )
{
	var oMenu;
	oMenu = in_ctxt.Source;
	oMenu.AddCommandItem("Split Subcurves","ApplySplitSubcurves");
	return true;
}


function logControlPointsArray(logString, aPoints, dp)
{
	LogMessage(logString);
	
	for ( var i = 0; i < aPoints.length; i += 4 )
	{
		var x = aPoints[i];
		var y = aPoints[i + 1];
		var z = aPoints[i + 2];
		var w = aPoints[i + 3]; 
		LogMessage( "[" + i/4 + "]: x = " + Math.round(x*dp)/dp +
									"; y = " + Math.round(y*dp)/dp +
									"; z = " + Math.round(z*dp)/dp ); // + "; w = " + Math.round(w*dp)/dp );

	}

}


function logKnotsArray(logString, aKnots, dp)
{
	//LogMessage(logString);
	var sKnotArray = logString;
	for ( var j = 0; j < aKnots.length; j++ )
	{
		var knotValue = Math.round(aKnots[j]*dp)/dp;
		if ( j == 0 ) sKnotArray = sKnotArray + /*"Knot Vector: " + */knotValue;//.toString(10);
		else sKnotArray = sKnotArray + ", " + knotValue;
	}
	
	LogMessage( sKnotArray );
	
}


function logCluster(oCluster)
{
	LogMessage("Cluster.Name: " + oCluster.Name);
	LogMessage("Cluster.Type: " + oCluster.Type);
	for(var i = 0; i < oCluster.Elements.Count; i++)
	{
		oElement = oCluster.Elements(i);
		LogMessage("i = " + i + ": " + oElement);
	}
}