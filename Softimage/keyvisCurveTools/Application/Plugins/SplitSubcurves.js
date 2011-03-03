//______________________________________________________________________________
// SplitSubcurvesPlugin
// 2010/05 by Eugen Sares
// last update: 2011/03/03
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
	// Tip: the Collection ArgumentHandler is very useful.
	
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


	// 1) Create Arrays.

	// for CurveList data
	var numAllSubcurves = 0;
	var aAllPoints = new Array();
	var aAllNumPoints = new Array();
	var aAllKnots = new Array();
	var aAllNumKnots = new Array();
	var aAllIsClosed = new Array();
	var aAllDegree = new Array();
	var aAllParameterization = new Array();


	// Main slice array. Holds arrays of indices where to split each Subcurves.
	var aAllSubCrvSlices = new Array();
	// Example:
	// Subcurve   0           1    2   3
	//         [ [0, 5, 10], [7], [], [2,4] ]

	// Knot indices stored in the input Cluster do not correspond
	// to the position of this Knot in the Knot Vector.
	// Some helper arrays are needed.
	//var aKnotIndices = new Array();
	var aKnotIsOnSubCrv = new Array();
	//var aKnotIsFirst = new Array();
	var aLastKnots = new Array();
	var aKnotsOnSubCrv = new Array();


	// Explanation
	// Example CurveList, one open and one closed Subcurve
	// Knots 3 and 12 were selected (one on each Subcurve) -> oKnotCluster = (3, 12)

	// oKnotCluster =		[               3,                                            12            ]
	// aSubCrvSlices =		[0,             3,             6      ],[0,                   5,          7 ] 
	// aKnots =				[0, 0, 0, 1, 2, 3, 3, 3, 4, 5, 6, 6, 6] [0, 0, 0, 1, 2, 3, 4, 5, 5, 5, 6, 7 ]
	// aKnotIsOnSubCrv =	[0,       0, 0, 0,       0, 0, 0,		 1,       1, 1, 1, 1, 1,       1,  1]
	// aLastKnots =			[                             10,										  11]


	// Note:
	// Knots with full multiplicity (Knots repeated {degree} times) are called
	// Bezier Knots, which always coincide with a Point. The Curve can be split there.
	// To make sure the curvature remains unchanges, all selected Knots
	// have to be raised to full mult. in the Execute Callback first.


	// Loop through all Subcurves.
	for(var subCrv = 0; subCrv < cInCurves.Count; subCrv++)
	{
		// Get input Subcurve.
		var oSubCrv = cInCurves.item(subCrv);
		VBdata = new VBArray(oSubCrv.Get2(siSINurbs));
		var subCrvData = VBdata.toArray();
		
		// Get Control Points array.
		var VBdata0 = new VBArray(subCrvData[0]);
		var aPoints = VBdata0.toArray();

		// Put number of Control Points in an array.
		//aLastKnots[subCrv] = aPoints.length/4;	// /4? x,y,z,weight
		
		// Get KnotVector.
		var VBdata1 = new VBArray(subCrvData[1]);
		var aKnots = VBdata1.toArray();

		// First Point in the KnotVector
		//aKnotIndices.push(0);
		aKnotIsOnSubCrv.push(subCrv);
		//aKnotIsFirst.push(true);
		aLastKnots[subCrv] = 0;

		var knot = 0;
		aKnotsOnSubCrv.push(knot++);

		// Loop through all Knots in the Vector.
		for(var i = 1; i < aKnots.length; i++)
		{
			// Eliminate Multiplicity.
			// Is the Knot different than the one before?
			if(aKnots[i] != aKnots[i - 1]) // also works when out of array bound
			{
				//aKnotIndices.push(i);
				aKnotIsOnSubCrv.push(subCrv);
				//aKnotIsFirst.push(false);
				aLastKnots[subCrv] += 1;
				aKnotsOnSubCrv.push(knot++);

			}
			
		}
		
	}	// end for


	// 2) Prepare aAllSubCrvSlices:
	// Copy Cluster Knots to aAllSubCrvSlices.
	// Note: oKnotCluster is NOT sorted by index!

	// Initialize.
	for(var i = 0; i < cInCurves.Count; i++)
		aAllSubCrvSlices[i] = new Array();

	// Loop through all Knots in the input Cluster, splice them into aAllSubCrvSlices.
	for(var i = 0; i < oKnotCluster.Elements.Count; i++)
	{
		var knot = oKnotCluster.Elements(i);
		var subCrv = aKnotIsOnSubCrv[knot];
		
		var knotOnSubCrv = aKnotsOnSubCrv[knot];
		
		var aSubCrvSlices = aAllSubCrvSlices[subCrv];
		var length = aSubCrvSlices.length;

		if(length == 0)
			aSubCrvSlices.push(knotOnSubCrv);
		else
		{
			for(var j = 0; j < length; j++)
			{
				if(knotOnSubCrv < aSubCrvSlices[j])
				{
					aSubCrvSlices.splice(j, 0, knotOnSubCrv);
					break;

				} else if(j == length - 1)
					aSubCrvSlices.push(knotOnSubCrv);

			}

		}

	}


	// 3) Create Subcurves according to aAllSubCrvSlices.
	
	// Loop through all Subcurves.
	for(var subCrv = 0; subCrv < cInCurves.Count; subCrv++)
	{
		// Get input Subcurve.
		var oSubCrv = cInCurves.item(subCrv);
		VBdata = new VBArray(oSubCrv.Get2(siSINurbs));									
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


		// Get slice array for this Subcurve.
		var aSubCrvSlices = aAllSubCrvSlices[subCrv];

		// aSubCrvSlices is empty:
		// Copy the Subcurve with no changes.
		if(aSubCrvSlices.length == 0)
		{
			aAllPoints = aAllPoints.concat(aPoints);
			aAllNumPoints[numAllSubcurves] = aPoints.length / 4;	// x,y,z,w
			aAllKnots = aAllKnots.concat(aKnots);
			aAllNumKnots[numAllSubcurves] = aKnots.length;
			aAllIsClosed[numAllSubcurves] = isClosed;
			aAllDegree[numAllSubcurves] = degree;
			aAllParameterization[numAllSubcurves] = parameterization;
				
			numAllSubcurves++;
			continue;

		}


		// aSubCrvSlices is not empty:
		// Slice the Subcurve.

		var firstKnot = aSubCrvSlices[0];
		var lastKnot = aSubCrvSlices[aSubCrvSlices.length - 1];

		if(!isClosed)
		{
			// Subcurve was open.
			
			// Make sure we have clean start and end indices, because the slice loop expects those.
			if(firstKnot != 0)
				aSubCrvSlices.unshift(0);
				
			if( lastKnot != aLastKnots[subCrv] )
				aSubCrvSlices.push( aLastKnots[subCrv] );


		} else
		{
			// Subcurve was closed.

			if(firstKnot != 0)
			{
				// Subcurve is closed, first/last Knot was not selected:
				// SHIFT the Subcurve to the first selected Knot.

				var ret = shiftNurbsCurve(aPoints, aKnots, firstKnot);
				aPoints = ret.aPoints;
				aKnots = ret.aKnots;

			// Shift slice array as well.
				for(var i = 0; i < aSubCrvSlices.length; i++)
					aSubCrvSlices[i] -= firstKnot;

				aSubCrvSlices.push(aLastKnots[subCrv]);

			}

			// OPEN the Subcurve.
			var ret = openNurbsCurve(aPoints, aKnots, degree, false);
			aPoints = ret.aPoints;
			aKnots = ret.aKnots;
			isClosed = false;

		}


		// Subcurve is always open here.
//LogMessage("aSubCrvSlices: " + aSubCrvSlices);
		// Slice loop: CONCAT all Slices to the CurveList data arrays.
		for(var i = 0; i < aSubCrvSlices.length - 1; i++)
		{
			var startIdx = getKnotVectorIdx(aKnots, aSubCrvSlices[i]);
			var endIdx = getKnotVectorIdx(aKnots, aSubCrvSlices[i + 1]);
			
			// Points
			var aPointsSlice = aPoints.slice(startIdx * 4, (endIdx + 1) * 4);	// x,y,z,w

			// Knots
			var aKnotsSlice = aKnots.slice(startIdx, endIdx + degree);

			// Write this Slice to the CurveList data.
			aAllPoints = aAllPoints.concat(aPointsSlice);
			aAllNumPoints[numAllSubcurves] = aPointsSlice.length / 4;
			aAllKnots = aAllKnots.concat(aKnotsSlice);
			aAllNumKnots[numAllSubcurves] = aKnotsSlice.length;
			aAllIsClosed[numAllSubcurves] = isClosed;	// Subcurve Slices are never closed
			aAllDegree[numAllSubcurves] = degree;
			aAllParameterization[numAllSubcurves] = parameterization;

			numAllSubcurves++;

		} // end for i

	} // end for subCrv


	// Debug
/*	LogMessage("New CurveList:");
	LogMessage("numAllSubcurves: " + numAllSubcurves);
	logControlPointsArray("aAllPoints: ", aAllPoints, 100);
	LogMessage("aAllPoints.length/4:  " + aAllPoints.length/4);
	LogMessage("aAllNumPoints:        " + aAllNumPoints);
	logKnotsArray("aAllKnots: ", aAllKnots, 100);
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

function getKnotVectorIdx(aKnots, knot)
{
	if(knot < 0)
		return -1;

	var idx = -1;	

	for(var i = 0; i < aKnots.length; i++)
	{
		if(aKnots[i] != aKnots[i - 1])
			idx++;

		if(idx == knot)
			return i;

	}

	return -1;

}


function shiftNurbsCurve(aPoints, aKnots, knot)
{
	var startIdx = getKnotVectorIdx(aKnots, knot);

	// Shift Points array.
	var aPoints0 = aPoints.slice(0, startIdx * 4);
	var aPoints1 = aPoints.slice(startIdx * 4);

	aPoints = aPoints1.concat(aPoints0);

	// Shift Knots array.
	for(var i = 1; i <= startIdx; i++)
		aKnots.push( aKnots[aKnots.length - 1] + aKnots[i] - aKnots[i - 1] );

	aKnots = aKnots.slice(startIdx);

	return {aPoints:aPoints,
			aKnots:aKnots};

}


function openNurbsCurve(aPoints, aKnots, degree, openWithGap)
{
	if(!openWithGap)
	{
		// Overlap after opening:
		// -> Duplicate first Point to the end
		for(var i = 0; i < 4; i++)	aPoints.push(aPoints[i]);
	}

	// Set first Knot to full multiplicity (Bezier).
	var ret = getKnotMult(aKnots, 0);
	var mult0 = ret.multiplicity;
	//var startOffset = 0;
	
	for(var i = 0; i < degree - mult0; i++)
	{
		aKnots.unshift(aKnots[0]);
		//startOffset++;
	}
	
	// Set length of Knot vector to K = P + degree - 1
	aKnots.length = aPoints.length / 4 + degree - 1;	// /4? x,y,z,w
	if(degree > 1)
	{
		// Set last Knot to full Mult:
		// Look at KnotVector[length-degree],
		// if this is the first index of a Knot (mult. 1,2 or 3), set it to full mult.,
		// otherwise take the following Knot, set it to full mult., reduce the previous Knot's mult. accordingy.
		var lastKnotIdx = aKnots.length - degree;

		var ret = getKnotMult( aKnots, lastKnotIdx);
		var lastKnot = ret.knot;
		var mult = ret.multiplicity;
		var startIdx = ret.startIdx;

		if(startIdx < lastKnotIdx)
		{
			lastKnot = aKnots[startIdx + mult]; // get following Knot
		}
			
		for(var i = 1; i <= degree; i++)
			aKnots[aKnots.length - i] = lastKnot;
	}

	return {aPoints:aPoints,
			aKnots:aKnots
			/*startOffset:startOffset*/};
}


function getKnotMult(aKnots, knotIdx)
{
	// [0,0,0,1,2,3,3,4,5,5,5]
	//  0,1,2,3,4,5,6,7,8,9,10
	// Example: knotIdx 9 returns startIdx 8, mult. 3

	var multiplicity = 0;
	var startIdx = knotIdx;

	// Get start of Knot.
	while( aKnots[startIdx - 1] == aKnots[knotIdx] )
		startIdx--;

	var nextKnotIdx = startIdx;

	// Get multiplicity.
	while(nextKnotIdx < aKnots.length)
	{
		if( aKnots[startIdx] == aKnots[nextKnotIdx] )
		{
			multiplicity++;
			nextKnotIdx++;
		}
		else break;
	}

	if(multiplicity)
		var knot = aKnots[startIdx];

	// Out of array bounds: mult. 0 is returned
	return {knot:knot,
			multiplicity:multiplicity,
			startIdx:startIdx};
}


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