//______________________________________________________________________________
// BlendSubcurvesPlugin
// 2011/03/03 by Eugen Sares
// last updates: 2011/08/24
//______________________________________________________________________________

function XSILoadPlugin( in_reg )
{
	in_reg.Author = "Eugen Sares";
	in_reg.Name = "BlendSubcurvesPlugin";
	in_reg.Major = 1;
	in_reg.Minor = 0;

	in_reg.RegisterOperator("BlendSubcurves");
	in_reg.RegisterCommand("ApplyBlendSubcurves","ApplyBlendSubcurves");
	in_reg.RegisterMenu(siMenuTbModelModifyCurveID,"ApplyBlendSubcurves_Menu",false,false);
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


function ApplyBlendSubcurves_Init( in_ctxt )
{
	var oCmd;
	oCmd = in_ctxt.Source;
	oCmd.Description = "Create an instance of BlendSubcurves operator";
	oCmd.SetFlag(siNoLogging,false);
	
	var oArgs = oCmd.Arguments;
	// To get a collection of subcomponents, or the current selection of subcomponents: 
	oArgs.AddWithHandler("args", "Collection");	// ArgumentName, ArgumentHandler, DefaultValue

	// Make sure the Immediate Mode Preference exists.
	try
	{
		var ImmediateMode = Application.Preferences.GetPreferenceValue("xsiprivate_unclassified.OperationMode");
	} catch (e)
	{
		Application.SetUserPref("OperationMode", false);
	}
	
	return true;
}


//______________________________________________________________________________

function ApplyBlendSubcurves_Execute( args )
{
	Application.LogMessage("ApplyBlendSubcurves_Execute called",siVerbose);

	try
	{
		var cSel = args;

		// Filter a Collection of Subcurve Clusters out of the Selection.
		var cCrvBndryClusters = new ActiveXObject("XSI.Collection");
		var cCurveLists = new ActiveXObject("XSI.Collection");

		// Filter the Selection.
		// Loop through all selected items.
		for(var i = 0; i < cSel.Count; i++)
		{
			if( cSel(i).Type == "crvbndry" && ClassName(cSel(i)) == "Cluster")
			{
				if(cSel(i).Elements.Count > 1)
				{
					cCrvBndryClusters.Add(cSel(i));
					cCurveLists.Add( cSel(i).Parent3DObject );
				}


			} else if( cSel(i).Type == "crvbndrySubComponent" )
			{
				var oSubComponent = cSel(i).SubComponent;
				if(oSubComponent.ElementArray.toArray().length > 1)
				{
					var oCluster = oSubComponent.CreateCluster("Curve_Boundary_AUTO");
					cCrvBndryClusters.Add( oCluster );
					cCurveLists.Add( cSel(i).SubComponent.Parent3DObject );
				}
			}

		}

		// If nothing usable was selected, start a Pick Session.
		if(cCrvBndryClusters.Count == 0)
		{
			SetSelFilter(siBoundaryFilter);
			do{
				var components, button;	// useless, but needed in JScript.
				var rtn = PickElement( "CurveBoundary", "Curve Boundaries", "Curve Boundaries", components, button, 0 );
				button = rtn.Value( "ButtonPressed" );
				if(button == 0)
					throw "Cancelled.";
					
				var modifier = rtn.Value( "ModifierPressed" );
				var element = rtn.Value( "PickedElement" ); // e.crvlist.crvbndry[(0,1),(1,1)]
				AddToSelection(element);
				var cSel = Selection;
				var oSubComponent = cSel(0).SubComponent;
				var oObject = oSubComponent.Parent3DObject;
				var aElements = oSubComponent.ElementArray.toArray();
			} while (aElements.length < 2);

			var oCluster = oSubComponent.CreateCluster("Curve_Boundary_AUTO");
			// oObject.ActivePrimitive.Geometry.AddCluster(...) is not working here...

			cCrvBndryClusters.Add(oCluster);
			cCurveLists.Add(oObject);

		}

		DeselectAllUsingFilter(siSubcomponentFilter);
		DeselectAllUsingFilter(siClusterFilter);


		// Construction mode automatic updating.
		var constructionModeAutoUpdate = GetValue("preferences.modeling.constructionmodeautoupdate");
		if(constructionModeAutoUpdate)
			SetValue("context.constructionmode", siConstructionModeModeling);
	
		// If this is not working: has the pref been written? Turn on Immed once if not.
		var operationMode = Preferences.GetPreferenceValue( "xsiprivate_unclassified.OperationMode" );
		var bAutoinspect = Preferences.GetPreferenceValue("Interaction.autoinspect");
		
		var createdOperators = new ActiveXObject("XSI.Collection");
		
		if(operationMode == siImmediateOperation)
		{
			// Loop through all selected/created Clusters and apply the Operator.
			for(var i = 0; i < cCrvBndryClusters.Count; i++)
			{
				// Add the Operator
				var oOutput = cCurveLists(i).ActivePrimitive;
				var oInput1 = cCurveLists(i).ActivePrimitive;
				var oInput2 = cCrvBndryClusters(i);

				// Make sure degree is the same for all Subcurves,
				// apply Clean Op (fix for selection problem).
				prepareCurveList(cCurveLists(i));
				
				//AddCustomOp( Type, OutputObjs, [InputObjs], [Name], [ConstructionMode] )
				// Port names will be generated automatically!
				var newOp = AddCustomOp("BlendSubcurves", oOutput, [oInput1, oInput2], "BlendSubcurves");

				var rtn = GetKeyboardState();
				modifier = rtn(1);
				var bCtrlDown = false;
				if(modifier == 2) bCtrlDown = true;

				if(Application.Interactive && bAutoinspect && !bCtrlDown)
					//AutoInspect(newOp); // BUG: does not work with Custom Ops(?)
					InspectObj(newOp, "", "", siModal, true);

				// FreezeModeling( [InputObjs], [Time], [PropagationType] )
				FreezeModeling(cCurveLists(i), null, siUnspecified);
				
				createdOperators.Add(newOp);
			}
			
		} else
		{
			// Loop through all selected/created Clusters and apply the Operator.
			for(var i = 0; i < cCrvBndryClusters.Count; i++)
			{
				// Define Outputs and Inputs.
				var oOutput = cCurveLists(i).ActivePrimitive;
				var oInput1 = cCurveLists(i).ActivePrimitive;
				var oInput2 = cCrvBndryClusters(i);

				// Make sure degree is the same for all Subcurves,
				// apply Clean Op (fix for selection problem).
				prepareCurveList(cCurveLists(i));

				var newOp = AddCustomOp("BlendSubcurves", oOutput, [oInput1, oInput2], "BlendSubcurves");

				createdOperators.Add(newOp);
				
			}
			
			if(createdOperators.Count != 0 && bAutoinspect && Application.Interactive)
				AutoInspect(createdOperators); // Multi-PPG

		}

		return true;

	} catch(e)
	{
		LogMessage(e, siWarning);
		return false;
	};
}

//______________________________________________________________________________


function prepareCurveList(oCrvList)
{
	// Check if all Subcurves have same degree, raise degree if not.
	var cCurves = oCrvList.ActivePrimitive.Geometry.Curves;

	var minDegree = 3;
	var maxDegree = 1;

	for(var i = 0; i < cCurves.Count; i++)
	{
		if(cCurves(i).Degree > maxDegree) maxDegree = cCurves(i).Degree;
		if(cCurves(i).Degree < minDegree) minDegree = cCurves(i).Degree;

	}

	if(minDegree < maxDegree)
	{
		ApplyTopoOp("RaiseNurbsCrvDegree", oCrvList, maxDegree, siPersistentOperation, null);

	} else
	{
		// Workaround for unselectable added Subcurves problem.
		var cleanOp = ApplyTopoOp("CrvClean", oCrvList, 3, siPersistentOperation, null);
		SetValue(cleanOp + ".cleantol", 0, null);
		
	}

}


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


function BlendSubcurves_Define( in_ctxt )
{
	var oCustomOperator;
	var oPDef;
	oCustomOperator = in_ctxt.Source;

	oPDef = XSIFactory.CreateParamDef("blendStyle",siInt4,siClassifUnknown,siPersistable | siKeyable,"Blend Style","",0,0,2,0,2);
	oCustomOperator.AddParameter(oPDef);

	oCustomOperator.AlwaysEvaluate = false;
	oCustomOperator.Debug = 0;
	return true;
}


function BlendSubcurves_Init( in_ctxt )
{
	Application.LogMessage("BlendSubcurves_Init called",siVerboseMsg);
	return true;
}


function BlendSubcurves_Term( in_ctxt )
{
	Application.LogMessage("BlendSubcurves_Term called",siVerboseMsg);
	return true;
}


//______________________________________________________________________________

function BlendSubcurves_Update( in_ctxt )
{
	Application.LogMessage("BlendSubcurves_Update called",siVerboseMsg);

	// Get Params.
	//var input0 = in_ctxt.GetInputValue(0);
	var blendStyle = in_ctxt.GetParameterValue("blendStyle");

	// Get Port connections.
	var outCrvListGeom = in_ctxt.OutputTarget.Geometry;	// Type: NurbsCurveCollection, ClassName: ""
	var cInCurves = in_ctxt.GetInputValue(0).Geometry.Curves; // Port 0: "Incrvlist"
	var oBlendCluster = in_ctxt.GetInputValue(1); // Port 1: "InCurve_Boundary_AUTO"
	var blendClsCnt = oBlendCluster.Elements.Count;

	// Only consider Boundary pairs.
	if(blendClsCnt % 2 == 1)
		blendClsCnt -= 1;

	if(blendClsCnt < 2)
		return;


	// 1) PREPARE ARRAYS AND OBJECTS.

	var aNewSubCrvs = new Array();
	// Example:
	// Idx	aSubCrvs	aInvert		close?
	// -----------------------------------
	// init:
	// 0	[0]			[f]			f
	// 1	[1]			[f]			f
	// 2	[2]			[f]			f
	// 3	[3]			[f]			f
	
	// after sorting:
	// 0	[]			[f]			-
	// 1	[0,1,2]		[f, f, t]	t
	// 2	[]			[f]			-
	// 3	[3]			[t]			f


	// Helper arrays to indicate where a SubCrv has been sorted into aNewSubCrvs.
	// Index
	var aSubCrvHasIdx = new Array(cInCurves.Count);
	// Side. false = left, true = right
	var aSubCrvAtBegin = new Array(cInCurves.Count);


	// Initialize aNewSubCrvs.
	for(var i = 0; i < cInCurves.Count; i++)
	{
		// Add "row" to aNewSubCrvs.
		aNewSubCrvs[i] = new Object();
		var oNewSubCrv = aNewSubCrvs[i];
		
		// Object properties:
		oNewSubCrv.aSubCrvs = new Array();
		oNewSubCrv.aInvert = new Array();
		oNewSubCrv.close = false;

		var aSubCrvs = oNewSubCrv.aSubCrvs;
		aSubCrvs.push(i);
		
		var aInvert = oNewSubCrv.aInvert;
		aInvert.push(false);

		// For quickly finding SubCrvs in aNewSubCrvs.
		aSubCrvHasIdx[i] = i; // new SubCrv index, "row"
		aSubCrvAtBegin[i] = true; // begin or end
		
	}


	// 2) SORT LOOP

	// Loop through all Boundaries.
	for(var i = 0; i < blendClsCnt; i += 2)
	{
		// Take a Boundary pair and sort aNewSubCrvs accordingly.
		// Note: the elements in the Boundary Cluster are sorted as they were selected.

		var selBnd0 = oBlendCluster.Elements(i);
		var subCrv0 = Math.floor(selBnd0 / 2);

		// Is Bnd on a closed SubCrv? Skip if yes.
		var subCrv = cInCurves.item(subCrv0);
		VBdata = new VBArray(subCrv.Get2(siSINurbs));
		var aSubCrvData = VBdata.toArray();
		if(aSubCrvData[2] == true)
			continue;

		var selBnd1 = oBlendCluster.Elements(i + 1);
		var subCrv1 = Math.floor(selBnd1 / 2);

		// Is Bnd on a closed SubCrv? Skip if yes.
		var subCrv = cInCurves.item(subCrv1);
		VBdata = new VBArray(subCrv.Get2(siSINurbs));
		var aSubCrvData = VBdata.toArray();
		if(aSubCrvData[2] == true)
			continue;

		var bnd0AtBegin = true;
		if(selBnd0 % 2 == 1)
			bnd0AtBegin = false;

		var subCrv0NewIdx = aSubCrvHasIdx[subCrv0];
		var bnd1AtBegin = true;
		if(selBnd1 % 2 == 1)
			bnd1AtBegin = false;

		var subCrv1NewIdx = aSubCrvHasIdx[subCrv1];
		var oNewSubCrv0 = aNewSubCrvs[subCrv0NewIdx];
		var aSubCrvs0 = oNewSubCrv0.aSubCrvs;
		var aInvert0 = oNewSubCrv0.aInvert;

		// Both Boundaries on same new Subcurve idx? -> close Curve.
		if(subCrv0NewIdx == subCrv1NewIdx)
		{
			oNewSubCrv0.close = true;
			continue;
			
		}

		// Concat Arrays.
		var oNewSubCrv1 = aNewSubCrvs[subCrv1NewIdx];
		var aSubCrvs1 = oNewSubCrv1.aSubCrvs;
		var aInvert1 = oNewSubCrv1.aInvert;

		// If a new Subcurve array has only one SubCrv yet,
		// the blend side is taken from the side of the selected Boundary,
		// otherwise it can be taken from aSubCrvAtBegin.
		if(aSubCrvs0.length > 1)
			var bnd0AtBegin = aSubCrvAtBegin[subCrv0];
			
		if(aSubCrvs1.length > 1)
			var bnd1AtBegin = aSubCrvAtBegin[subCrv1];


		if(!bnd0AtBegin && bnd1AtBegin)
		{
			// arr0 concat arr1
			var aSubCrvs = aSubCrvs0.concat(aSubCrvs1); // note: concat creates new object!
			var aInvert = aInvert0.concat(aInvert1);

		} else if(bnd0AtBegin && !bnd1AtBegin)
		{
			// arr1 concat arr0
			var aSubCrvs = aSubCrvs1.concat(aSubCrvs0);
			var aInvert = aInvert1.concat(aInvert0);

		} else if(bnd0AtBegin && bnd1AtBegin)
		{
			// -arr0 concat arr1
			aSubCrvs0.reverse();
			aInvert0.reverse();
			for(var j = 0; j < aInvert0.length; j++)
				aInvert0[j] = !aInvert0[j];

			var aSubCrvs = aSubCrvs0.concat(aSubCrvs1);
			var aInvert = aInvert0.concat(aInvert1);
		
		} else
		{
			// arr1 concat -arr0
			aSubCrvs1.reverse();
			aInvert1.reverse();
			for(var j = 0; j < aInvert1.length; j++)
				aInvert1[j] = !aInvert1[j];

			var aSubCrvs = aSubCrvs0.concat(aSubCrvs1);
			var aInvert = aInvert0.concat(aInvert1);

		}

		aNewSubCrvs[subCrv0NewIdx].aSubCrvs = aSubCrvs;
		aNewSubCrvs[subCrv0NewIdx].aInvert = aInvert;
		aSubCrvs1.length = 0;
		aInvert1.length = 0;

		// Update aSubCrvHasIdx and aSubCrvAtBegin.
		aSubCrvHasIdx[ aSubCrvs[0] ] = subCrv0NewIdx;
		aSubCrvHasIdx[ aSubCrvs[aSubCrvs.length - 1] ] = subCrv0NewIdx;
		aSubCrvAtBegin[ aSubCrvs[0] ] = true;
		aSubCrvAtBegin[ aSubCrvs[aSubCrvs.length - 1] ] = false;

	}

// Debug sort algorithm
/*	LogMessage("aNewSubCrvs:");
	LogMessage("length: " + aNewSubCrvs.length);
	//LogMessage("blendedCrvCnt:" + blendedCrvCnt);
	for(var j = 0; j < aNewSubCrvs.length; j++)
	{
		LogMessage("aNewSubCrvs[" + j + "].aSubCrvs: " + aNewSubCrvs[j].aSubCrvs);
		LogMessage("aNewSubCrvs[" + j + "].aInvert " + aNewSubCrvs[j].aInvert);
		LogMessage("aNewSubCrvs[" + j + "].close " + aNewSubCrvs[j].close);
		LogMessage("");
	}
	LogMessage("aSubCrvHasIdx: " + aSubCrvHasIdx);
	LogMessage("aSubCrvAtBegin: " + aSubCrvAtBegin);
*/
//return true;



	// 3) BLEND LOOP

	// Create arrays for complete CurveList data.
	//var allSubCrvsCnt = 0;
	var aAllPoints = new Array();
	var aAllNumPoints = new Array();
	var aAllKnots = new Array();
	var aAllNumKnots = new Array();
	var aAllIsClosed = new Array();
	var aAllDegree = new Array();
	var aAllParameterization = new Array();


	// Create arrays for Subcurve data
	var aBlendedPoints = new Array();
	var aBlendedKnots = new Array();

	var allSubCrvsCnt = 0;

	// Loop through all "rows" in aNewSubCrvs.
	for(var subCrvsCnt = 0; subCrvsCnt < aNewSubCrvs.length; subCrvsCnt++)
	{
		// Get Subcurve list to blend.
		var aSubCrvs = aNewSubCrvs[subCrvsCnt].aSubCrvs;
		if(aSubCrvs.length == 0)
			continue;

		var aInvert = aNewSubCrvs[subCrvsCnt].aInvert;

		// Loop through all Subcurves.
		for(var i = 0; i < aSubCrvs.length; i++)
		{
			// Get next Subcurve in array
			var subCrv = cInCurves.item( aSubCrvs[i] );
			VBdata = new VBArray(subCrv.Get2(siSINurbs));
			var aSubCrvData = VBdata.toArray();
			
			// Get Point data
			var VBdata0 = new VBArray(aSubCrvData[0]);
			var aPoints = VBdata0.toArray();
			
			// Get Knot data
			var VBdata1 = new VBArray(aSubCrvData[1]);
			var aKnots = VBdata1.toArray();
			
			// Invert if necessary
			if(aInvert[i])
			{
				var ret = invertNurbsCurve(aPoints, aKnots, false); // isClosed = false
				// Closed Subcurves were skipped, so this SubCrv must be open.
				aPoints = ret.aPoints;
				aKnots = ret.aKnots;

			}

			// First Subcurve piece in array?
			if(i == 0)
			{
				aBlendedPoints = aPoints;
				aBlendedKnots = aKnots;

				// Get other data
				var isClosed = aSubCrvData[2];
				// It is assured in the _Execute callback that all Subcurves have same degree!
				var degree = aSubCrvData[3];
				var parameterization = aSubCrvData[4];

			} else
			{
				var ret = blendNurbsCurves(aBlendedPoints, aPoints, aBlendedKnots, aKnots, degree, blendStyle); // true: linear blend
				aBlendedPoints = ret.aPoints;
				aBlendedKnots = ret.aKnots;
		
			}

		} // end for i


		// Close the merged Subcurves?
		if(aNewSubCrvs[subCrvsCnt].close)
		{
			var ret = closeNurbsCurve(aBlendedPoints, aBlendedKnots, degree, blendStyle, 10e-12); // closingMode: false = 
			aBlendedPoints = ret.aPoints;
			aBlendedKnots = ret.aKnots;
			var isClosed = true;

		}

		// Add merged Subcurve data to CurveList.
		aAllPoints = aAllPoints.concat(aBlendedPoints);
		aAllNumPoints[allSubCrvsCnt] = aBlendedPoints.length / 4;	//x,y,z,w
		aAllKnots = aAllKnots.concat(aBlendedKnots);
		aAllNumKnots[allSubCrvsCnt] = aBlendedKnots.length;
		aAllIsClosed[allSubCrvsCnt] = isClosed; //aSubCrvData[2];
		aAllDegree[allSubCrvsCnt] = degree; //aSubCrvData[3];
		aAllParameterization[allSubCrvsCnt] = parameterization; //aSubCrvData[4];

		allSubCrvsCnt++;

	} // end for allSubCrvsCnt


	outCrvListGeom.Set(
		allSubCrvsCnt,
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


function blendNurbsCurves(aPoints0, aPoints1, aKnots0, aKnots1, degree, blendStyle)
{
	// This function blends only open Subcurves!
	// Curve 1 is appended to Curve 0.
	if(blendStyle == 0)
	{
		// Linear blend

		// Points
		// Begin, last Point of Curve 0
		var vb = XSIMath.CreateVector3();
		vb.X = aPoints0[aPoints0.length - 4];
		vb.Y = aPoints0[aPoints0.length - 3];
		vb.Z = aPoints0[aPoints0.length - 2];
		// End, first Point of Curve 1
		var ve = XSIMath.CreateVector3();
		ve.X = aPoints1[0];
		ve.Y = aPoints1[1];
		ve.Z = aPoints1[2];

		// Difference Vector
		var v = XSIMath.CreateVector3();
		v.Sub(ve, vb);

		switch(degree)
		{
			case 3:
				v.Scale(1/3, v);
				// Point at 1/3 v
				vb.Add(vb, v);
				aPoints0.push(vb.X);
				aPoints0.push(vb.Y);
				aPoints0.push(vb.Z);
				aPoints0.push(1); // weight
				// Point at 2/3 v
				ve.Sub(ve, v);
				aPoints0.push(ve.X);
				aPoints0.push(ve.Y);
				aPoints0.push(ve.Z);
				aPoints0.push(1); // weight
				break;

			case 2:
				v.Scale(0.5, v);
				ve.Sub(ve, v);
				aPoints0.push(ve.X);
				aPoints0.push(ve.Y);
				aPoints0.push(ve.Z);
				aPoints0.push(1); // weight
				break;

		}

		aPoints0 = aPoints0.concat(aPoints1);

		// Knots
		var offset = aKnots0[aKnots0.length - 1] - aKnots1[0] + 1;
		for(var i = 0; i < aKnots1.length; i++)
			aKnots1[i] += offset;

		aKnots0 = aKnots0.concat(aKnots1);

	} else
	{
		// Curved blend
		
		// Points
		aPoints0 = aPoints0.concat(aPoints1);

		// Knots
		switch(degree)
		{
			case 1:
				var offset = aKnots0[aKnots0.length - 1] - aKnots1[0] + 1;
				for(var i = 0; i < aKnots1.length; i++)
				aKnots1[i] += offset;
				break;

			default:
				aKnots0 = aKnots0.slice( 0, -(degree - 1) );
				aKnots1 = aKnots1.slice( degree - 1 );
				var offset = aKnots0[aKnots0.length - 1] - aKnots1[0] + degree;
				for(var i = 0; i < degree - 1; i++)
					aKnots0.push( aKnots0[aKnots0.length - 1] + 1);

				for(var i = 0; i < aKnots1.length; i++)
					aKnots1[i] += offset;
			
		}

		aKnots0 = aKnots0.concat(aKnots1);

	}

	return {aPoints:aPoints0,
			aKnots:aKnots0};
}


function closeNurbsCurve(aPoints, aKnots, degree, closingMode, tol)
{
	if(aPoints.length > 8)
	{
	// Curve has more than 2 Points, can be closed.
	
		//var tol = 10e-10;
	
		// Check if the first and last Point coincide
		if(	Math.abs(aPoints[0] - aPoints[aPoints.length - 4]) < tol &&
			Math.abs(aPoints[1] - aPoints[aPoints.length - 3]) < tol &&
			Math.abs(aPoints[2] - aPoints[aPoints.length - 2]) < tol)
			bFirstOnLast = true;
		else bFirstOnLast = false;


		if(bFirstOnLast)
		{
			// First and last Point were overlapping
			// Remove last Point
			aPoints = aPoints.slice(0, aPoints.length - 4);
			
			// Truncate Knot Vector
			// On closed Curves: K = P + 1 (numKnots = numPoints + 1)
			aKnots.length = aPoints.length / 4 + 1;	// /4: x,y,z,w

		} else
		{
			// First and last Point were apart
		
			if(closingMode == 1)
			{
				// Standard close, Point array does not change.
				
				// Adapt Knot Vector length: on closed Curves: K = P + 1
				// degree 1: one Knot more
				// degree 2: same length
				// degree 3: one Knot less
				aKnots.length = aPoints.length / 4 + 1;	// /4: x,y,z,w
				
				// Set first Knot(s)
				// degree 1: [0,1,...]
				// degree 2: [-1,0,1,...]
				// degree 3: [-2,-1,0,1,...]
				for(var i = degree - 2; i >= 0; i--)
					aKnots[i] = aKnots[i + 1] - 1;
				
				// Set last Knot = 2nd last + 1
				aKnots[aKnots.length - 1] = aKnots[aKnots.length - 2] + 1;				
			} else
			{
				// Close with connecting line = linear blend.

				// Begin
				var vb = XSIMath.CreateVector3();
				vb.X = aPoints[0];
				vb.Y = aPoints[1];
				vb.Z = aPoints[2];
				// End
				var ve = XSIMath.CreateVector3();
				ve.X = aPoints[aPoints.length - 4];
				ve.Y = aPoints[aPoints.length - 3];
				ve.Z = aPoints[aPoints.length - 2];

				var v = XSIMath.CreateVector3();				
				v.Sub(ve, vb);

				switch(degree)
				{
					case 1:
						break;

					case 2:
						v.Scale(0.5, v);
						ve.Sub(ve, v);
						aPoints.push(ve.X);
						aPoints.push(ve.Y);
						aPoints.push(ve.Z);
						aPoints.push(1); // weight
						break;

					default:
						v.Scale(1/3, v);
						// 2nd last Point
						ve.Sub(ve, v);
						aPoints.push(ve.X);
						aPoints.push(ve.Y);
						aPoints.push(ve.Z);
						aPoints.push(1); // weight
						// Last Point
						vb.Add(vb, v);
						aPoints.push(vb.X);
						aPoints.push(vb.Y);
						aPoints.push(vb.Z);
						aPoints.push(1); // weight

				}
				
				// Knots
				aKnots.push( aKnots[aKnots.length - 1] + 1 );
			
			}

		}

	}

	return {aPoints:aPoints,
			aKnots:aKnots};
}


function invertNurbsCurve(aPoints, aKnots, isClosed)
{
	// Invert Point array
	var pLen = aPoints.length;
	var aPointsInv = new Array(); //pLen);

	for(var i = 0; i < aPoints.length; i += 4)
	{
		aPointsInv[i] = aPoints[aPoints.length - i - 4];
		aPointsInv[i + 1] = aPoints[aPoints.length - i - 3];
		aPointsInv[i + 2] = aPoints[aPoints.length - i - 2];
		aPointsInv[i + 3] = aPoints[aPoints.length - i - 1];
	}

	// Do not check this here!! (like in InvertSubcurves)
	// Only open Subcurves get inverted in BlendSubcurves.
/*	if(isClosed)
	{
		// Shift Point array right, so the former first Points is first again.
		// original:	0,1,2,3,4
		// reverse:		4,3,2,1,0
		// correct: 	0,4,3,2,1
		aPointsInv = ( aPointsInv.slice(pLen - 4) ).concat( aPointsInv.slice( 0, pLen - 4) );

	}
*/

	// Invert Knot array
	var kLen = aKnots.length;
	var aKnotsInv = new Array();
	var prevKnot = aKnots[kLen - 1]; // last Knot
	var prevInvKnot = 0;
	
	for(var i = 0; i < kLen; i++)
	{
		var knot = aKnots[kLen - 1 - i];
		// Difference of neighboring Knots in aKnots and aKnotsInv is the same,
		// but in reverse order.
		aKnotsInv[i] =  prevKnot - knot + prevInvKnot;
		prevKnot = knot;
		prevInvKnot = aKnotsInv[i];
	}

	return {aPoints:aPointsInv,
			aKnots:aKnotsInv};

}


function BlendSubcurves_DefineLayout( in_ctxt )
{
	var oLayout,oItem;
	oLayout = in_ctxt.Source;
	oLayout.Clear();

	//oLayout.AddItem("blendStyle");
	oLayout.AddGroup("Blend Style (Degree 2 and 3)");
	var aRadioItems = ["Linear", 0, "Curved", 1];
	var oBlendStyle = oLayout.AddEnumControl("blendStyle", aRadioItems, " ", siControlRadio);
	oBlendStyle.SetAttribute(siUINoLabel, true);
	oLayout.EndGroup();

	return true;
}

/*
function BlendSubcurves_OnInit( )
{
	Application.LogMessage("BlendSubcurves_OnInit called",siVerbose);
}


function BlendSubcurves_OnClosed( )
{
	Application.LogMessage("BlendSubcurves_OnClosed called",siVerbose);
}



function BlendSubcurves_blendStyle_OnChanged( )
{
	Application.LogMessage("BlendSubcurves_blendStyle_OnChanged called",siVerbose);
	var oParam;
	oParam = PPG.blendStyle;
	var paramVal;
	paramVal = oParam.Value;
	Application.LogMessage("New value: " + paramVal,siVerbose);
}
*/


function ApplyBlendSubcurves_Menu_Init( in_ctxt )
{
	var oMenu;
	oMenu = in_ctxt.Source;
	oMenu.AddCommandItem("Blend Subcurves","ApplyBlendSubcurves");
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
									"; z = " + Math.round(z*dp)/dp );
									// + "; w = " + Math.round(w*dp)/dp );

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
*/
