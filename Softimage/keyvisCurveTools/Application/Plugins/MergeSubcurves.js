//______________________________________________________________________________
// MergeSubcurvesPlugin
// 2010/10 by Eugen Sares
// last update: 2011/03/03
//______________________________________________________________________________

function XSILoadPlugin( in_reg )
{
	in_reg.Author = "Eugen Sares";
	in_reg.Name = "MergeSubcurvesPlugin";
	in_reg.Major = 1;
	in_reg.Minor = 0;

	in_reg.RegisterOperator("MergeSubcurves");
	in_reg.RegisterCommand("ApplyMergeSubcurves","ApplyMergeSubcurves");
	in_reg.RegisterMenu(siMenuTbModelModifyCurveID,"ApplyMergeSubcurves_Menu",false,false);
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


function ApplyMergeSubcurves_Init( in_ctxt )
{
	var oCmd;
	oCmd = in_ctxt.Source;
	oCmd.Description = "Create an instance of MergeSubcurves operator";
	oCmd.SetFlag(siNoLogging,false);
	
	var oArgs = oCmd.Arguments;
	// To get a collection of subcomponents, or the current selection of subcomponents: 
	oArgs.AddWithHandler("args", "Collection");	// ArgumentName, ArgumentHandler, DefaultValue
	
	return true;
}


//______________________________________________________________________________

function ApplyMergeSubcurves_Execute( args )
{

	Application.LogMessage("ApplyMergeSubcurves_Execute called",siVerbose);

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
			// Curve Boundary Cluster selected.
			if( cSel(i).Type == "crvbndry" && ClassName(cSel(i)) == "Cluster")
			{
				if(cSel(i).Elements.Count > 1)
				{
					cCrvBndryClusters.Add(cSel(i));
					cCurveLists.Add( cSel(i).Parent3DObject );
				}


			} else if( cSel(i).Type == "crvbndrySubComponent" )
			{
				// Curve Boundaries selected.
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
				var rtn = PickElement( "CurveBoundary", "Curve Boundaries.", "Curve Boundaries.", components, button, 0 );
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
		if(constructionModeAutoUpdate) SetValue("context.constructionmode", siConstructionModeModeling);
	
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
				var newOp = AddCustomOp("MergeSubcurves", oOutput, [oInput1, oInput2], "MergeSubcurves");

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

				var newOp = AddCustomOp("MergeSubcurves", oOutput, [oInput1, oInput2], "MergeSubcurves");

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


function MergeSubcurves_Define( in_ctxt )
{
	var oCustomOperator;
	var oPDef;
	oCustomOperator = in_ctxt.Source;

	//oPDef = XSIFactory.CreateParamDef("cont",siInt4,siClassifUnknown,siPersistable | siKeyable,"Continuity","",0,0,2,0,3);
	//oCustomOperator.AddParameter(oPDef);
	//oPDef = XSIFactory.CreateParamDef("seam",siInt4,siClassifUnknown,siPersistable | siKeyable,"Seam Mode","",0,0,3,0,3);
	//oCustomOperator.AddParameter(oPDef);
	//oPDef = XSIFactory.CreateParamDef("modifytan",siInt4,siClassifUnknown,siPersistable | siKeyable,"Modify Tangent","",0,0,3,0,3);
	//oCustomOperator.AddParameter(oPDef);
	oPDef = XSIFactory.CreateParamDef("distance",siDouble,siClassifUnknown,siPersistable | siKeyable,"Merge Radius","",0.33,0,1E+100,0,10);
	oCustomOperator.AddParameter(oPDef);

	oCustomOperator.AlwaysEvaluate = false;
	oCustomOperator.Debug = 0;
	return true;
}


function MergeSubcurves_Init( in_ctxt )
{
	Application.LogMessage("MergeSubcurves_Init called",siVerboseMsg);
	return true;
}


function MergeSubcurves_Term( in_ctxt )
{
	Application.LogMessage("MergeSubcurves_Term called",siVerboseMsg);
	return true;
}


//______________________________________________________________________________

function MergeSubcurves_Update( in_ctxt )
{
	Application.LogMessage("MergeSubcurves_Update called",siVerboseMsg);


	// Get Params.
	//var input0 = in_ctxt.GetInputValue(0);
	//var cont = in_ctxt.GetParameterValue("cont");
	//var seam = in_ctxt.GetParameterValue("seam");
	//var modifytan = in_ctxt.GetParameterValue("modifytan");
	var distance = in_ctxt.GetParameterValue("distance");


	// Get Port connections.
	var outCrvListGeom = in_ctxt.OutputTarget.Geometry;	// Type: NurbsCurveCollection, ClassName: ""
	var cInCurves = in_ctxt.GetInputValue(0).Geometry.Curves; // Port 0: "Incrvlist"
	var oMergeCluster = in_ctxt.GetInputValue(1); // Port 1: "InCurve_Boundary_AUTO"


	// 1) PREPARE ARRAYS AND OBJECTS.

	// Array to store the indices of the merged Curve Boundaries, for later selection.
	var aNewSubcurves = new Array();


	// aBnds:
	// Array of all Boundaries
	//
	// Idx	selected	coords
	// -----------------------
	// 0	false		x,y,z
	// 1	true		x,y,z	
	// 2	true		x,y,z
	// 3	false		x,y,z
	// ...

	// Note: which Subcurve is a Boundary on?
	// Bnd 0/1: begin/end on Subcurve 0
	// Bnd 2/3: begin/end on Subcurve 1 ...
	
	var aBnds = new Array(cInCurves.Count * 2);
	
	// Initialize it.
	for(var i = 0; i < cInCurves.Count * 2; i++)
	{
		aBnds[i] = new Object();
		var bnd = aBnds[i];
		// Properties:
		bnd.selected = false;
		bnd.x = 0;
		bnd.y = 0;
		bnd.z = 0;
		//bnd.nearestBnd = -1;

	}
	
	// Mark all selected Boundaries.
	for(var i = 0; i < oMergeCluster.Elements.Count; i++)
		aBnds[ oMergeCluster.Elements(i) ].selected = true;


	// aSubcurveUsed:
	// Is a Subcurve used?
	// A "used" Subcurve will be ignored when creating aMergedCrvs (see below).
	//
	// Idx	used
	// ----------
	// 0	false
	// 1	false
	// 2	true
	// ...

	var aSubcurveUsed = new Array(cInCurves.Count);

	for(var subCrv = 0; subCrv < cInCurves.Count; subCrv++)
	{
		//aSubcurveUsed[subCrvIdx] = new Object();
		//var subcurveInfo = aSubcurveUsed[subCrvIdx];
		aSubcurveUsed[subCrv] = false;
		
		// Get Subcurve data.
		var oSubCrv = cInCurves.item(subCrv);
		VBdata = new VBArray(oSubCrv.Get2(siSINurbs)); var subCrvData = VBdata.toArray();
		// Get Point data
		var VBdata0 = new VBArray(subCrvData[0]); var aPoints = VBdata0.toArray();

		var isClosed = subCrvData[2];

		if(isClosed)
		{
		// Closed Subcurves will be ignored furthermore.
			aBnds[subCrv * 2].selected = false;
			aBnds[subCrv * 2 + 1].selected = false;

		} else
		{
		// Init aBnds with Boundary positions
			aBnds[subCrv * 2].x = aPoints[0];
			aBnds[subCrv * 2].y = aPoints[1];
			aBnds[subCrv * 2].z = aPoints[2];

			aBnds[subCrv * 2 + 1].x = aPoints[aPoints.length - 4];
			aBnds[subCrv * 2 + 1].y = aPoints[aPoints.length - 3];
			aBnds[subCrv * 2 + 1].z = aPoints[aPoints.length - 2];

		}
		
	}


// Debug
/*
	LogMessage("aSubcurveUsed: ");
	for(var i = 0; i < aSubcurveUsed.length; i++)
	{
		LogMessage(aSubcurveUsed[i]);
	}

	LogMessage("");
	LogMessage("aBnds: ");
	for(var i = 0; i < aBnds.length; i++)
	{
		var bnd = aBnds[i];
		LogMessage("aBnd[" + i + "].selected: " + bnd.selected);
		//LogMessage("aBnd[" + i + "].x: " + bnd.x);
		//LogMessage("aBnd[" + i + "].y: " + bnd.y);
		//LogMessage("aBnd[" + i + "].z: " + bnd.z);
	}

	return true;
*/


	// 2) SEARCH LOOP
	
	// aMergedCrvs:
	// Array of Objects containing Subcurve merge arrays.
	// Example:
	// Idx	aSubCrvs	aInvert					close
	// ----------------------------------------------
	// 0	3,7			false, true				false
	// 1	8,11,15,2	true,true,false,false	false
	// 2	1			false					false
	// ...

	var aMergedCrvs = new Array();
	var mergedCrvsCnt = 0;	// number of "rows" in aMergedCrvs

	for(var subCrv = 0; subCrv < cInCurves.Count; subCrv++)
	{
		// If this Subcurve is used, skip it.
		if(aSubcurveUsed[subCrv]) continue;
		
		// Add a new "row" to aMergedCrvs.
		aMergedCrvs[mergedCrvsCnt] = new Object();
		var oMergedCrv = aMergedCrvs[mergedCrvsCnt];
		mergedCrvsCnt++;
		
		// Define Properties for Object "oMergedCrv":
		// Property "aSubCrvs":
		// Array of indices which Subcurves to merge.
		oMergedCrv.aSubCrvs = new Array();  // [subCrv];
		var aSubCrvs = oMergedCrv.aSubCrvs;
		aSubCrvs.push(subCrv);

		// Mark this Subcurve as used
		aSubcurveUsed[subCrv] = true;
		
		// Property "aInvert":
		// Array of booleans indicating if a Subcurve must be reversed before merging.
		oMergedCrv.aInvert = [false];
		var aInvert = oMergedCrv.aInvert;
		
		// Property "close":
		// aSubCrvs will be a closed loop, because first and last Bnds merge.
		oMergedCrv.close = false;


		// BOUNDARY SEARCH LOOP
		// Take leftmost Subcurve in aSubCrvs, check if it's left Border is selected,
		// if yes, find closest Boundary inside the WeldRadius,
		// if any, add the found Subcurve to array "aSubCrvs" before,
		// continue until no more Boundaries are found to the left,
		// then repeat on the right array side.
		while(true)
		{
			// Get first Boundary index of first Subcurve in aSubCrvs.
			var firstSubCrv = aSubCrvs[0];
			if( aInvert[0] )
				var firstBnd = firstSubCrv * 2 + 1;
			else
				var firstBnd = firstSubCrv * 2;
	
			// Get last Boundary index of last Subcurve in sSubCrvs.
			var lastSubCrv = aSubCrvs[aSubCrvs.length - 1];
			if( aInvert[aInvert.length - 1] )
				var lastBnd = lastSubCrv * 2;
			else
				var lastBnd = lastSubCrv * 2 + 1;

			var oFirstBnd = aBnds[firstBnd];
			var oLastBnd = aBnds[lastBnd];


			// First Boundary is selected?
			if(oFirstBnd.selected == true)
			{
				// Deselect it, so it won't find itself.
				oFirstBnd.selected = false;

				// Find nearby Boundary!
				var foundBnd = findBoundary( oFirstBnd.x, oFirstBnd.y, oFirstBnd.z, distance, aBnds );

				if(foundBnd != -1)
				{
				// Nearby Boundary was found!

					// Deselect found Boundary.
					aBnds[foundBnd].selected = false;
					
					// Closed loop?
					if(foundBnd == lastBnd)
					{
						// Set close flag.
						oMergedCrv.close = true;

						// Deselect last Boundary.
						oLastBnd.selected = false;

						break; // Leave while loop, continue with for loop.
					}

					// Not a closed loop.
					// Calculate Subcurve index.
					var foundSubCrv = Math.floor(foundBnd / 2);
					// Add it to array at beginning.
					aSubCrvs.unshift(foundSubCrv);
					//aSubCrvs = [foundSubCrv].concat(aSubCrvs); // This does not work, because aSubCrvs would point to a new array then!! (tricky bug...)

					// Begin Bnd found? -> invert
					if( foundBnd % 2 == 1 )
						aInvert.unshift(false); // %: modulus
					else
						aInvert.unshift(true);
					
					// Mark it as used.
					aSubcurveUsed[foundSubCrv] = true;

				}	// end if, continue with while loop
				

			// Last Boundary is selected?
			} else if(oLastBnd.selected == true)
			{
				// Deselect it, so it won't find itself.
				oLastBnd.selected = false;

				// Find nearby Boundary!
				var foundBnd = findBoundary( oLastBnd.x, oLastBnd.y, oLastBnd.z, distance, aBnds );

				if(foundBnd != -1)
				{
				// Nearby Boundary was found!

					// Deselect found Boundary.
					aBnds[foundBnd].selected = false;
					
					// Closed loop?
					if(foundBnd == firstBnd)
					{
						// Set close flag.
						oMergedCrv.close = true;

						// Deselect first Boundary.
						aBnds[firstBnd].selected = false;

						break; // Leave while loop, continue with for loop.
					}

					// Not a closed loop.
					// Calculate Subcurve index.
					var foundSubCrv = Math.floor(foundBnd / 2);
					// Add it to array at end.
					aSubCrvs.push(foundSubCrv);

					// End Bnd found? -> invert
					if( foundBnd % 2 == 1 )
						aInvert.push(true);
					else
						aInvert.push(false);
					
					// Mark it as used.
					aSubcurveUsed[foundSubCrv] = true;

				}	// end if, continue with while loop
				
			} else break; // Neither begin Bnd nor end Bnd was selected -> continue with for loop.

		} // end while

	} 	// end for

// Debug
/*
	LogMessage("-------------");
	LogMessage("aMergedCrvs.length: " + aMergedCrvs.length);
	LogMessage("mergedCrvsCnt:" + mergedCrvsCnt);
	//LogMessage("aMergedCrvs:");
	for(var i = 0; i < mergedCrvsCnt; i++)
	{
		LogMessage("aMergedCrvs[" + i + "].aSubCrvs: " + aMergedCrvs[i].aSubCrvs + "   close: " + aMergedCrvs[i].close);
		LogMessage("aInvert: " + aMergedCrvs[i].aInvert);
	}
	LogMessage("-------------");

	return true;
*/


	// 3) MERGE LOOP

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
	var aMergedPoints = new Array();
	var aMergedKnots = new Array();

	// Loop through all "rows" in aMergedCrvs.
	for(var allSubCrvsCnt = 0; allSubCrvsCnt < mergedCrvsCnt; allSubCrvsCnt++)
	{
		// Get Subcurve list to merge.
		var aSubCrvs = aMergedCrvs[allSubCrvsCnt].aSubCrvs;
		var aInvert = aMergedCrvs[allSubCrvsCnt].aInvert;

		// Loop through all Subcurves.
		for(var i = 0; i < aSubCrvs.length; i++)
		{
			// Get next Subcurve in array
			var oSubCrv = cInCurves.item( aSubCrvs[i] );
			VBdata = new VBArray(oSubCrv.Get2(siSINurbs));
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
				var ret = invertNurbsCurve(aPoints, aKnots, isClosed);
				aPoints = ret.aPoints;
				aKnots = ret.aKnots;

			}

			// First Subcurve piece in array?
			if(i == 0)
			{
				aMergedPoints = aPoints;
				aMergedKnots = aKnots;

				// Get other data
				var isClosed = aSubCrvData[2];
				// It is assured in the _Execute callback that all Subcurves have same degree!
				var degree = aSubCrvData[3];
				var parameterization = aSubCrvData[4];

			} else
			{
			// Merge(concat) other Subcurve pieces - this is what it's all about...
			// All Subcurve pieces are open - closed ones were skipped firsthand.
		
				// POINTS
				// Calc geom. average of last Point and first Point of next piece.
				// SIVector3 ?
				var len = aMergedPoints.length;
				aMergedPoints[len - 4] = ( aMergedPoints[len - 4] + aPoints[0] ) / 2; // x
				aMergedPoints[len - 3] = ( aMergedPoints[len - 3] + aPoints[1] ) / 2; // y
				aMergedPoints[len - 2] = ( aMergedPoints[len - 2] + aPoints[2] ) / 2; // z
				aMergedPoints[len - 1] = ( aMergedPoints[len - 1] + aPoints[3] ) / 2; // w?

				// Discard first Point of next Curve piece.
				aPoints = aPoints.slice(4);	// 4: x,y,z,w
				
				// Concatenate.
				aMergedPoints = aMergedPoints.concat(aPoints);
				
				// KNOTS
				// Let's simplify the NURBS math here and assume a Knot interval of 1.
				var offset = aMergedKnots[aMergedKnots.length - 1] + 1;
				
				// Discard first Knot of next Curve piece.
				// degree 1: 0,1,2,...
				// degree 2: 0,0,1,1,2,2,...
				// degree 3: 0,0,0,1,2,3,...
				aKnots = aKnots.slice(degree);
				
				offset -= aKnots[0];
				
				// Add the offset to all Knots.
				for(var n = 0; n < aKnots.length; n++) aKnots[n] += offset;
				
				// Concatenate.
				aMergedKnots = aMergedKnots.concat(aKnots);
				
			}

		} // end for i

		if(aMergedCrvs[allSubCrvsCnt].close)
		{
		// Close the merged Subcurves.
			var ret = closeNurbsCurve(aMergedPoints, aMergedKnots, degree);
			aMergedPoints = ret.aPoints;
			aMergedKnots = ret.aKnots;

			var isClosed = true;

		}

		// Add merged Subcurve data to CurveList.
		aAllPoints = aAllPoints.concat(aMergedPoints);
		aAllNumPoints[allSubCrvsCnt] = aMergedPoints.length / 4;	//x,y,z,w
		aAllKnots = aAllKnots.concat(aMergedKnots);
		aAllNumKnots[allSubCrvsCnt] = aMergedKnots.length;
		aAllIsClosed[allSubCrvsCnt] = isClosed; //aSubCrvData[2];
		aAllDegree[allSubCrvsCnt] = degree; //aSubCrvData[3];
		aAllParameterization[allSubCrvsCnt] = parameterization; //aSubCrvData[4];

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

	//output = in_ctxt.OutputTarget;
	
	// ToDo:
	// Select unmerged Curve Boundaries.
/*	if(in_ctxt.UserData == undefined)
	{
		var oCrvList = in_ctxt.Source.Parent3DObject;
		ToggleSelection( oCrvList + ".subcrv[" + aNewSubcurves + "]" );
		in_ctxt.UserData = true;
	}
*/
	return true;
}

//______________________________________________________________________________


function closeNurbsCurve(aPoints, aKnots, degree)
{
	// At least 4 Points are needed to close a Curve.
	if(aPoints.length >= 16)
	{
		// Move first Point to geom. average of first and last.
		aPoints[0] = (aPoints[0] + aPoints[aPoints.length - 4] ) / 2; // x
		aPoints[1] = (aPoints[1] + aPoints[aPoints.length - 3] ) / 2; // x
		aPoints[2] = (aPoints[2] + aPoints[aPoints.length - 2] ) / 2; // x

		// Truncate last Point.
		aPoints.length = aPoints.length - 4;
		
		// Truncate Knot Vector.
		// On closed Curves: K = P + 1 (numKnots = numPoints + 1)
		aKnots.length = aPoints.length / 4 + 1;	// /4: x,y,z,w

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
	// Only open Subcurves get inverted in MergeSubcurves.
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


function findBoundary(x, y, z, distance, aBnds)
{
	var nearestBnd = -1;
	var nearestDist = -1;
	
	// Loop through all Boundaries
	for(var i = 0; i < aBnds.length; i++)
	{
		// Deselected Bnds are ignored.
		var bnd = aBnds[i]; // object
		if(!bnd.selected) continue;

		// Calculate distance/diagonal.
		var dx = x - bnd.x;
		var dy = y - bnd.y;
		var dz = z - bnd.z;
		var dist = Math.sqrt(dx*dx + dy*dy + dz*dz);	// Math.pow(xxx, 2);

		if(dist < distance)
		{
			if(dist < nearestDist || nearestDist == -1)
			{
				nearestDist = dist;
				nearestBnd = i;

			}

		}
		
	}

	// If no Boundary in radius was found, -1 is returned.
	return nearestBnd;
}


function MergeSubcurves_DefineLayout( in_ctxt )
{
	var oLayout,oItem;
	oLayout = in_ctxt.Source;
	oLayout.Clear();
	//oLayout.AddItem("cont");
	//oLayout.AddItem("seam");
	//oLayout.AddItem("modifytan");
	oLayout.AddItem("distance", "Distance");
	return true;
}

/*
function MergeSubcurves_OnInit( )
{
	Application.LogMessage("MergeSubcurves_OnInit called",siVerbose);
}


function MergeSubcurves_OnClosed( )
{
	Application.LogMessage("MergeSubcurves_OnClosed called",siVerbose);
}


function MergeSubcurves_distance_OnChanged( )
{
	Application.LogMessage("MergeSubcurves_distance_OnChanged called",siVerbose);
	var oParam;
	oParam = PPG.distance;
	var paramVal;
	paramVal = oParam.Value;
	Application.LogMessage("New value: " + paramVal,siVerbose);
}
*/

function ApplyMergeSubcurves_Menu_Init( in_ctxt )
{
	var oMenu;
	oMenu = in_ctxt.Source;
	oMenu.AddCommandItem("Merge Subcurves","ApplyMergeSubcurves");
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
