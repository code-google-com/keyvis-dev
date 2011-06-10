//______________________________________________________________________________
// SplitSubcurvesPlugin
// 2010/05 by Eugen Sares
// last update: 2011/05/31
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


function XSIUnloadPlugin( in_reg )
{
	var strPluginName;
	strPluginName = in_reg.Name;
	Application.LogMessage(strPluginName + " has been unloaded.",siVerbose);
	return true;
}


function ApplySplitSubcurves_Init( in_ctxt )
{
	var oCmd;
	oCmd = in_ctxt.Source;
	oCmd.Description = "Create an instance of SplitSubcurves operator";
	oCmd.SetFlag(siNoLogging,false);
	
	var oArgs = oCmd.Arguments;
	// To get a collection of subcomponents, or the current selection of subcomponents: 
	oArgs.AddWithHandler("args", "Collection");	// ArgumentName, ArgumentHandler, DefaultValue
	
	return true;
}


//______________________________________________________________________________

function ApplySplitSubcurves_Execute( args )
{
	Application.LogMessage("ApplySplitSubcurves_Execute called",siVerbose);

	try
	{
		var cSel = Selection;

		// Filter a Collection of Subcurve Clusters out of the Selection.
		var cKnotClusters = new ActiveXObject("XSI.Collection");
		var cCurveLists = new ActiveXObject("XSI.Collection");

		// Filter the Selection for Knot Clusters / Isopoints / Knots.
		for(var i = 0; i < cSel.Count; i++)
		{
			if( cSel(i).Type == "knot" && ClassName(cSel(i)) == "Cluster")
			{
				// Knot Cluster selected.
				cKnotClusters.Add(cSel(i));
				cCurveLists.Add( cSel(i).Parent3DObject );


			} else if( cSel(i).Type == "isopntSubComponent")
			{
				// Isopoints selected.

				// Insert Bezier-Knots at selected Isopoints using InsertCurveKnot().
				// To create a Cluster of these new Knots, their indices have to be
				// calculated first.

				var oObject = cSel(i).SubComponent.Parent3DObject;

				var aElements = cSel(i).SubElements.toArray();
				// [SubCrv, Value(0.0 - 1.0), SubCrv, Value, ...]
				// The value is correct even if the Knot vector does not start with 0.

				// Create percentage arrays for all Subcurves.
				var aAllPercentages = [];

				for(var j = 0; j < aElements.length; j+=2)
				{
					var subCrv = aElements[j];
					var percentage = aElements[j + 1];
					
					if(aAllPercentages[subCrv] == undefined)
						aAllPercentages[subCrv] = [];
						
					aAllPercentages[subCrv].push(percentage);
				
				}

				// Sort them.
				// Note: SubElements object does not sort Isopoints.
				for(var j = 0; j < aAllPercentages.length; j++)
				{
					if(aAllPercentages[j] != undefined)
						aAllPercentages[j] = aAllPercentages[j].sort();

				}


				var aAllKnotCounts = [];
				var aSubCrvKnotMin = [];
				var aAllNewKnots = [];
				var cCurves = oObject.ActivePrimitive.Geometry.Curves;
				var dp = 1E6;
				var prevKnotCntAll = 0;
				
				for(var subCrv = 0; subCrv < cCurves.Count; subCrv++)
				{
					// Get Subcurve.
					var oSubCrv = cCurves.item(subCrv);
					VBdata = new VBArray(oSubCrv.Get2(siSINurbs));								
					var aSubCrvData = VBdata.toArray();

					var vbArg1 = new VBArray(aSubCrvData[1]);
					var aKnots = vbArg1.toArray();

					aKnots = allKnotsToMultiplicity1(aKnots);
					var knotCnt = aKnots.length;
					var knotInterval = aKnots[knotCnt - 1] - aKnots[0];
					var addedKnotsOnSubCrv = 0;

					if(aAllPercentages[subCrv] != undefined)
					{
						//Isopoints are selected on this SubCrv.
						var aPercentages = aAllPercentages[subCrv];
						var newKnot = 0;

						for(var p = 0; p < aPercentages.length; p++)
						{
							var U = aPercentages[p] * knotInterval + aKnots[0];
							// This is the exact U value as shown during selection.
							// Note: multiply by Knot interval, not Knot count!!!

							// Get corresponding Knot index.
							for(; newKnot < knotCnt; newKnot++)
							{
								if( Math.abs(U - aKnots[newKnot]) < 1/dp )
								{
									// U is on an existing Knot.
									aAllNewKnots.push( newKnot + addedKnotsOnSubCrv + prevKnotCntAll );
									break;

								} else if(U < aKnots[newKnot])
								{
									// U is between two Knots.
							 		aAllNewKnots.push( newKnot + addedKnotsOnSubCrv + prevKnotCntAll );
									addedKnotsOnSubCrv++; // one more Knot on this SubCrv
									//prevKnotCntAll++; // ...on the previous SubCrv.
									break;

								}
									
							}

						}
						
					}
					
					prevKnotCntAll = prevKnotCntAll + knotCnt + addedKnotsOnSubCrv;

				}


				// Create ConnectionSet string with precise values,
				// instead of just using cSel(i).
				var sCnx = oObject + ".isopnt[";

				for(var subCrv = 0; subCrv < aAllPercentages.length; subCrv++)
				{
					var aPercentages = aAllPercentages[subCrv];
					if(aPercentages == undefined)
						continue;

					for(var k = 0; k < aPercentages.length; k++)
					{
						sCnx = sCnx + "(" + subCrv + "," + aPercentages[k] + ")";

						if(k < aPercentages.length - 1)
							sCnx += ",";

					}

					if(subCrv < aAllPercentages.length - 1)
						sCnx += ",";

				}
				
				sCnx += "]";

				// Insert Knots at Isopoints.
				var cOps = InsertCurveKnot(sCnx, 3, siPersistentOperation); //( cSel(i), 3, siPersistentOperation );

				var oCluster = oObject.ActivePrimitive.Geometry.AddCluster( siKnotCluster, "Knot_AUTO", aAllNewKnots );
				cKnotClusters.Add(oCluster);
				cCurveLists.Add(oObject);


			} else if( cSel(i).Type == "knotSubComponent" )
			{
				// Knots selected.
				var oObject = cSel(i).SubComponent.Parent3DObject;
				var aElementIndices = cSel(i).SubComponent.ElementArray.toArray();
				var oCluster = oObject.ActivePrimitive.Geometry.AddCluster( siKnotCluster, "Knot_AUTO", aElementIndices );
/*				var sCnx = oObject + ".knot[" + aElementIndices + "]";
				var cClusters = CreateCluster(sCnx);
				var oCluster = cClusters.item(0);
*/
				cKnotClusters.Add(oCluster);
				cCurveLists.Add(oObject);
				
			}

		}


		//SetSelFilter(siKnotFilter);

		// If nothing usable was selected, start a Pick Session.
		if(cKnotClusters.Count == 0)
		{
			do{
				var components, button;	// useless, but needed in JScript.
				var rtn = PickElement( "Knot", "Knots", "Knots", components, button, 0 );
				button = rtn.Value( "ButtonPressed" );
				if(button == 0)
					throw "Cancelled.";

				var modifier = rtn.Value( "ModifierPressed" );
				var element = rtn.Value( "PickedElement" ); // e.crvlist.crvbndry[(0,1),(1,1)]
				SelectGeometryComponents(element);
				var cSel = Selection;
				var oSubComponent = cSel(0).SubComponent;
				var oObject = oSubComponent.Parent3DObject;
				var aElements = oSubComponent.ElementArray.toArray();
			} while (aElements.length < 1);

			var oCluster = oObject.ActivePrimitive.Geometry.AddCluster( siKnotCluster, "Knot_AUTO", aElements );
			cKnotClusters.Add(oCluster);
			cCurveLists.Add(oObject);
			
		}

		DeselectAllUsingFilter(siSubcomponentFilter);
		DeselectAllUsingFilter(siClusterFilter);


		// Construction mode automatic updating.
		var constructionModeAutoUpdate = GetValue("preferences.modeling.constructionmodeautoupdate");
		if(constructionModeAutoUpdate) SetValue("context.constructionmode", siConstructionModeModeling);

	
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

		}

		return true;

	} catch(e)
	{
		LogMessage(e, siWarning);
		return false;
	};

}

//______________________________________________________________________________


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


	// 1) PREPARE ARRAYS.

	// for CurveList data
	var allSubcurvesCnt = 0;
	var aAllPoints = new Array();
	var aAllNumPoints = new Array();
	var aAllKnots = new Array();
	var aAllNumKnots = new Array();
	var aAllIsClosed = new Array();
	var aAllDegree = new Array();
	var aAllParameterization = new Array();


	// Main slice array. Holds arrays of indices where to split each Subcurve.
	var aAllSubCrvSlices = new Array();
	// Example:
	// Subcurve   0           1    2   3
	//         [ [0, 5, 10], [7], [], [2,4] ]

	// Some helper arrays
	var aKnotIsOnSubCrv = new Array();
	var aLastKnots = new Array();
	var aKnotIndices = new Array();

	// Explanation 
	// Example CurveList, one open and one closed Subcurve
	// Knots 3 and 12 were selected (one on each Subcurve):

	// oKnotCluster =		[               3,                                            12            ]
	// aSubCrvSlices =		[0,             3,             6      ],[0,                   5,          7 ] 
	// aKnots =				[0, 0, 0, 1, 2, 3, 3, 3, 4, 5, 6, 6, 6] [0, 0, 0, 1, 2, 3, 4, 5, 5, 5, 6, 7 ]
	// aKnotIsOnSubCrv =	[0,       0, 0, 0,       0, 0, 0,		 1,       1, 1, 1, 1, 1,       1,  1]
	// aLastKnots =			[                             10,										  11]
	// aKnotIndices =	    [0,       1, 2, 3,       4, 5, 6,        0,       1, 2, 3, 4, 5        6, 7 ]

	// Note:
	// To make sure the curvature remains unchanged after splitting, all selected Knots are first raised
	// to full multiplicity (Bezier) in the Execute Callback.


	// Loop through all Subcurves.
	for(var subCrv = 0; subCrv < cInCurves.Count; subCrv++)
	{
		// Get input Subcurve.
		var oSubCrv = cInCurves.item(subCrv);
		VBdata = new VBArray(oSubCrv.Get2(siSINurbs));
		var aSubCrvData = VBdata.toArray();
		
		// Get Control Points array.
		var VBdata0 = new VBArray(aSubCrvData[0]);
		var aPoints = VBdata0.toArray();
		
		// Get KnotVector.
		var VBdata1 = new VBArray(aSubCrvData[1]);
		var aKnots = VBdata1.toArray();

		// First Point in the KnotVector
		aKnotIsOnSubCrv.push(subCrv);
		aLastKnots[subCrv] = 0;

		var knot = 0;
		aKnotIndices.push(knot++);

		// Loop through all Knots in the Vector.
		for(var i = 1; i < aKnots.length; i++)
		{
			// Eliminate Multiplicity.
			if(aKnots[i] != aKnots[i - 1]) // also works when out of array bounds
			{
				aKnotIsOnSubCrv.push(subCrv);
				aLastKnots[subCrv] += 1;
				aKnotIndices.push(knot++);

			}
			
		}
		
	}


	// Initialize.
	for(var i = 0; i < cInCurves.Count; i++)
		aAllSubCrvSlices[i] = new Array();

	// Loop through all Knots in the input Cluster, splice them into aAllSubCrvSlices.
	for(var i = 0; i < oKnotCluster.Elements.Count; i++)
	{
		var knot = oKnotCluster.Elements(i);
		var subCrv = aKnotIsOnSubCrv[knot];
		var knotIdx = aKnotIndices[knot];
		var aSubCrvSlices = aAllSubCrvSlices[subCrv];
		var length = aSubCrvSlices.length;

		if(length == 0)
			aSubCrvSlices.push(knotIdx);
		else
		{
			for(var j = 0; j < length; j++)
			{
				if(knotIdx < aSubCrvSlices[j])
				{
					aSubCrvSlices.splice(j, 0, knotIdx);
					break;

				} else if(j == length - 1)
					aSubCrvSlices.push(knotIdx);

			}

		}

	}


	// 2) CREATE SLICES.
	
	// Loop through all Subcurves.
	for(var subCrv = 0; subCrv < cInCurves.Count; subCrv++)
	{
		// Get input Subcurve.
		var oSubCrv = cInCurves.item(subCrv);
		VBdata = new VBArray(oSubCrv.Get2(siSINurbs));									
		var aSubCrvData = VBdata.toArray();

		// Get Point data.
		var vbArg0 = new VBArray(aSubCrvData[0]);
		var aPoints = vbArg0.toArray();
		var numPoints = aPoints.length/4;	// /4? x,y,z,weight

		// Get Knot data.
		var vbArg1 = new VBArray(aSubCrvData[1]);
		var aKnots = vbArg1.toArray();
		var numKnots = aKnots.length;

		// Get other data.
		var isClosed = aSubCrvData[2];
		var degree = aSubCrvData[3];
		var parameterization = aSubCrvData[4];


		// Get slice array for this Subcurve.
		var aSubCrvSlices = aAllSubCrvSlices[subCrv];

		// aSubCrvSlices is empty:
		// Copy the Subcurve with no changes.
		if(aSubCrvSlices.length == 0)
		{
			aAllPoints = aAllPoints.concat(aPoints);
			aAllNumPoints[allSubcurvesCnt] = aPoints.length / 4;	// x,y,z,w
			aAllKnots = aAllKnots.concat(aKnots);
			aAllNumKnots[allSubcurvesCnt] = aKnots.length;
			aAllIsClosed[allSubcurvesCnt] = isClosed;
			aAllDegree[allSubcurvesCnt] = degree;
			aAllParameterization[allSubcurvesCnt] = parameterization;
				
			allSubcurvesCnt++;
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
				// Subcurve is closed, first/last Knot was not selected.

				// SHIFT the Subcurve to the first selected Knot.
				var ret = shiftNurbsCurve(aPoints, aKnots, firstKnot);
				aPoints = ret.aPoints;
				aKnots = ret.aKnots;

				// Shift slice array indices as well.
				for(var i = 0; i < aSubCrvSlices.length; i++)
					aSubCrvSlices[i] -= firstKnot;

			}
			
			if( lastKnot != aLastKnots[subCrv] )
				aSubCrvSlices.push( aLastKnots[subCrv] );

			// OPEN the Subcurve.
			var ret = openNurbsCurve(aPoints, aKnots, degree, false);
			aPoints = ret.aPoints;
			aKnots = ret.aKnots;
			isClosed = false;

		}

		// Subcurve is always open here.


		// 3) SLICE LOOP
		// Concat all Slices to the CurveList data arrays.

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
			aAllNumPoints[allSubcurvesCnt] = aPointsSlice.length / 4;
			aAllKnots = aAllKnots.concat(aKnotsSlice);
			aAllNumKnots[allSubcurvesCnt] = aKnotsSlice.length;
			aAllIsClosed[allSubcurvesCnt] = isClosed;	// Subcurve Slices are never closed
			aAllDegree[allSubcurvesCnt] = degree;
			aAllParameterization[allSubcurvesCnt] = parameterization;

			allSubcurvesCnt++;

		}

	}


	// Set output CurveList.
	outCrvListGeom.Set(
		allSubcurvesCnt,
		aAllPoints,
		aAllNumPoints,
		aAllKnots,
		aAllNumKnots,
		aAllIsClosed,
		aAllDegree,
		aAllParameterization,
		siSINurbs);

	return true;
}


//______________________________________________________________________________


function allKnotsToMultiplicity1(aKnots)
{
	var aKnots1 = [];
	
	for(var i = 0; i < aKnots.length; i++)
	{
		if(aKnots[i] != aKnots[i - 1])
			aKnots1.push(aKnots[i]);
	}
	
	return aKnots1;

}

/*
function getKnotCount(aKnots)
{
	if(aKnots.length == 0)
		return 0;

	var knotCount = 1;

	for(var i = 1; i < aKnots.length; i++)
	{
		if(aKnots[i - 1] < aKnots[i])
			knotCount += 1;
	}
	
	return knotCount;

}
*/

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
	return true;
}


function ApplySplitSubcurves_Menu_Init( in_ctxt )
{
	var oMenu;
	oMenu = in_ctxt.Source;
	oMenu.AddCommandItem("Split Subcurves","ApplySplitSubcurves");
	return true;
}

/*
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
		if ( j == 0 ) sKnotArray = sKnotArray + knotValue;
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
*/