//______________________________________________________________________________
// MergeSubcurvesPlugin
// 2010/10 by Eugen Sares
// last update: 2010/12/17
//
// Usage:
// - Select at least 2 Curve Boundaries on a NurbsCurveList
// - Model > Modify > Curve > MergeSubcurves
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

//______________________________________________________________________________

function XSIUnloadPlugin( in_reg )
{
	var strPluginName;
	strPluginName = in_reg.Name;
	Application.LogMessage(strPluginName + " has been unloaded.",siVerbose);
	return true;
}

//______________________________________________________________________________

function ApplyMergeSubcurves_Init( in_ctxt )
{
	var oCmd;
	oCmd = in_ctxt.Source;
	oCmd.Description = "Create an instance of MergeSubcurves operator";
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

function ApplyMergeSubcurves_Execute( args )
{

	Application.LogMessage("ApplyMergeSubcurves_Execute called",siVerbose);


// TODO:
	// More than one Curvelist is selected.
	// Loop through Selection.
	try
	{
		// For clarity's sake:
		var bPick
		var bNoCluster;
		var oSel;
		var oCluster;
		var oParent;
	
		if(args == "")
		{
		// Nothing is selected
			bPick = true;
			bNoCluster = true;
			
		}
		else if(args(0).Type == "crvbndry" && ClassName(args(0)) == "Cluster" )
		{
		// Curve Boundary Cluster is selected
			oCluster = args(0);
			oParent = oCluster.Parent3DObject;
			bPick = false;
			bNoCluster = false;
			
		} else if(args(0).Type == "crvbndrySubComponent")
		{
		// Curve Boundaries are selected
			oSel = args(0);
			bPick = false;
			bNoCluster = true;
			
		} else
		{
		// Anything else is selected
			// oSel is set after picking
			bPick = true;
			bNoCluster = true;
			
		}


		if(bPick)
		{
			do
			{
			// Start Subcurve Pick Session
				var crvBounaries, button;	// useless but needed in JScript
				// PickElement() manages to select a CurveList first, then a Subcurve:
				var rtn = PickElement( "CurveBoundary", "Curve Boundary", "", crvBounaries, button, 0 );
				button = rtn.Value( "ButtonPressed" );
				if(!button) throw "Argument must be Curve Boundary.";
				
				oSel = rtn.Value( "PickedElement" );
				//var modifier = rtn.Value( "ModifierPressed" );

			} while (oSel.Type != "crvbndrySubComponent");
			
		}

		if(bNoCluster)
		{
			var oSubComponent = oSel.SubComponent;
			oCluster = oSubComponent.CreateCluster("Curve_Boundary_AUTO");
			oParent = oSubComponent.Parent3DObject;
			// var cComponents =  Selection(0).SubComponent.ComponentCollection;	// not working with Boundaries
			// var cComponents = oSubComponent.ComponentCollection;
			// var aBndryIndices = oSubComponent.ElementArray.toArray();
			//var oCrvList = oParent.ActivePrimitive.Geometry;
			// var oCluster = oCrvList.AddCluster( siBoundaryCluster, "Curve_Boundary_AUTO"); //, aBndryIndices );

		}


		// ToDo:
		// check if all Subcurves have same degree
		// if not, RaiseDegree


		// Create the Operator
		var newOp = XSIFactory.CreateObject("MergeSubcurves");	// known to the system through XSILoadPlugin callback

		// Connect the ports
		newOp.AddIOPort(oParent.ActivePrimitive, "CurvePort");	// autom: OutCurvePort, InCurvePort
		newOp.AddInputPort(oCluster, "mergeClusterPort");	// params: PortTarget, [PortName]

		newOp.Connect();

		var immed = Preferences.GetPreferenceValue( "xsiprivate_unclassified.OperationMode" );
		// ApplyTopoOp( PresetObj, [ConnectionSet], [ConnectType], [ImmediateMode], [OutputObjs], [ConstructionMode] )
		//var cNewOps = ApplyTopoOp("MergeSubcurves" );
		
		//InspectObj(newOp);
		AutoInspect(newOp);
		
		return newOp;

	
	} catch(e)
	{
		LogMessage(e, siWarning);
		return false;
	};
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

//______________________________________________________________________________

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
	oPDef = XSIFactory.CreateParamDef("mergeRadius",siDouble,siClassifUnknown,siPersistable | siKeyable,"Merge Radius","",0.3,0,1E+100,0,10);
	oCustomOperator.AddParameter(oPDef);

	oCustomOperator.AlwaysEvaluate = false;
	oCustomOperator.Debug = 0;
	return true;
}

//______________________________________________________________________________

function MergeSubcurves_Init( in_ctxt )
{
	Application.LogMessage("MergeSubcurves_Init called",siVerboseMsg);
	return true;
}

//______________________________________________________________________________

function MergeSubcurves_Term( in_ctxt )
{
	Application.LogMessage("MergeSubcurves_Term called",siVerboseMsg);
	return true;
}


//______________________________________________________________________________
//______________________________________________________________________________

function MergeSubcurves_Update( in_ctxt )
{
	Application.LogMessage("MergeSubcurves_Update called",siVerboseMsg);


	// Get Params.
	//var input0 = in_ctxt.GetInputValue(0);
	//var cont = in_ctxt.GetParameterValue("cont");
	//var seam = in_ctxt.GetParameterValue("seam");
	//var modifytan = in_ctxt.GetParameterValue("modifytan");
	var mergeRadius = in_ctxt.GetParameterValue("mergeRadius");


	// Get Port connections.
	var outCrvListGeom = in_ctxt.OutputTarget.Geometry;	// Type: NurbsCurveCollection, ClassName: ""
	var oMergeCluster = in_ctxt.GetInputValue("mergeClusterPort");
	var cInCurves = in_ctxt.GetInputValue("InCurvePort").Geometry.Curves;


	// 1) PREPARE ARRAYS AND OBJECTS

	// aBnds: array of all Boundaries
	// Idx	selected?
	// --------------
	// 0	false
	// 1	true
	// 2	true
	// 3	false
	// ...
	
	// Bnd 0,1: begin, end on Subcurve 0
	// Bnd 2,3: begin, end on Subcurve 1 ...
	
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


	// aSubcurveUsed: is a Subcurve used?
	// Idx	used
	// ----------
	// 0	false
	// 1	false
	// 2	true
	// ...

	var aSubcurveUsed = new Array(cInCurves.Count);
	
	// Loop through all input Subcurves.
	for(var i = 0; i < cInCurves.Count; i++)
	{
		//aSubcurveUsed[subCrvIdx] = new Object();
		//var subcurveInfo = aSubcurveUsed[subCrvIdx];
		aSubcurveUsed[i] = false;
		
		// Get Subcurve data.
		var subCrv = cInCurves.item(i);
		VBdata = new VBArray(subCrv.Get2(siSINurbs)); var subCrvData = VBdata.toArray();
		// Get Point data
		var VBdata0 = new VBArray(subCrvData[0]); var aPoints = VBdata0.toArray();

		// Exclude Boundaries of closed Subcurves!
		var isClosed = subCrvData[2];

		if(isClosed)
		{
			aBnds[i * 2].selected = false;
			aBnds[i * 2 + 1].selected = false;

		} else
		{
		// Init aBnds with Boundary positions
			aBnds[i * 2].x = aPoints[0];
			aBnds[i * 2].y = aPoints[1];
			aBnds[i * 2].z = aPoints[2];

			aBnds[i * 2 + 1].x = aPoints[aPoints.length - 4];
			aBnds[i * 2 + 1].y = aPoints[aPoints.length - 3];
			aBnds[i * 2 + 1].z = aPoints[aPoints.length - 2];

		}
		
	}

// TODO?
	// For each Boundary, find nearest.



// debug
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

	// 2) MAIN LOOP
//LogMessage("MAIN LOOP -------------");
	
	// aMergedCrvs: Array of Objects containing Subcurve merge arrays.
	// Example:
	// Idx	aSubCrvs	aInvert					close
	// ----------------------------------------------
	// 0	3,7			false, true				false
	// 1	8,11,15,2	true,true,false,false	false
	// 2	1			false					false
	// ...

	var aMergedCrvs = new Array();
	var mergedCrvCnt = 0;	// number of "rows" in aMergedCrvs


	// Loop through all input Subcurves.
	// Skip the "used" ones = those already in a merge arrays.
	for(var inCrvCnt = 0; inCrvCnt < cInCurves.Count; inCrvCnt++)
	{
		// If this Subcurve is used, skip it
		if(aSubcurveUsed[inCrvCnt])
		{
//LogMessage("Subcurve " + inCrvCnt + " used. Skipping.");
			continue;
		}
		
//LogMessage("Subcurve " + inCrvCnt + " unused. Adding...");
		// Add a new "row" to aMergedCrvs.
		aMergedCrvs[mergedCrvCnt] = new Object();
		var oMergedCrv = aMergedCrvs[mergedCrvCnt];
		mergedCrvCnt++;
		
		// Define Properties of Object "oMergedCrv":
		// Property "aSubCrvs": array of indices which Subcurves to merge.
		oMergedCrv.aSubCrvs = new Array();  // [inCrvCnt]; // 
		var aSubCrvs = oMergedCrv.aSubCrvs;
		aSubCrvs.push(inCrvCnt);
		//aSubCrvs.push(123);
		//aSubCrvs.push(456);
//LogMessage("aMergedCrvs[" + (mergedCrvCnt-1) + "].aSubCrvs: " + aMergedCrvs[mergedCrvCnt-1].aSubCrvs);
		// Mark this Subcurve as used
		aSubcurveUsed[inCrvCnt] = true;
		
		// Property "aInvert": array of flags indicating if a Subcurve must be reversed before merging
		oMergedCrv.aInvert = [false];
		var aInvert = oMergedCrv.aInvert;
		
		// Property "close": aSubCrvs will be a closed loop.
		oMergedCrv.close = false;



		// BOUNDARY SEARCH LOOP
		while(true)
		{
//LogMessage("SEARCH LOOP");
			// If Subcurve array "aSubCrvs" has selected Boundaries at begin or end,
			// find nearby Boundaries within mergeRadius and add them before or after.

			// Get first Subcurve in array.
			var firstSubCrv = aSubCrvs[0];
//LogMessage("firstSubCrv: " + firstSubCrv);
			// Get first Boundary.
			if( aInvert[0] )
				var firstBnd = firstSubCrv * 2 + 1;
			else
				var firstBnd = firstSubCrv * 2;
	
			// Get last Subcurve in array.
			var lastSubCrv = aSubCrvs[aSubCrvs.length - 1];
//LogMessage("lastSubCrv: " + lastSubCrv);
			// Get last Boundary.
			if( aInvert[aInvert.length - 1] )
				var lastBnd = lastSubCrv * 2;
			else
				var lastBnd = lastSubCrv * 2 + 1;

//LogMessage("firstBnd: " + firstBnd);
//LogMessage("lastBnd: " + lastBnd);
			var oFirstBnd = aBnds[firstBnd];
			var oLastBnd = aBnds[lastBnd];

			// Check if first Bnd is selected.
			if(oFirstBnd.selected == true)
			{
				// Deselect this Boundary first, so it won't find itself.
				oFirstBnd.selected = false;

				// Find nearby Subcurve Bnd.
				var foundBnd = findBoundary( oFirstBnd.x, oFirstBnd.y, oFirstBnd.z, mergeRadius, aBnds );
//LogMessage("begin foundBnd: " + foundBnd);
				if(foundBnd != -1)
				{
				// Nearby Boundary was found.

					// Deselect found Boundary.
					aBnds[foundBnd].selected = false;
					
					// Check for closed loop.
					if(foundBnd == lastBnd)
					{
						// Mark this Subcurve array for later closing.
						oMergedCrv.close = true;

						// Deselect last Boundary.
						oLastBnd.selected = false;

						break; // Continue with for loop
					}

					// Not a closed loop...
					// Calculate Subcurve index.
					var foundSubCrv = Math.floor(foundBnd / 2);
					// Add it to array at first.
					//aSubCrvs = [foundSubCrv].concat(aSubCrvs); // This does not work, because aSubCrvs points to a new array then.
					aSubCrvs.unshift(foundSubCrv);
//LogMessage("aSubCrvs: " + aSubCrvs);
					
					// Begin Bnd found? -> invert
					if( foundBnd % 2 == 1 ) aInvert.unshift(false);
					else aInvert.unshift(true);
					
					// Mark it as used
					aSubcurveUsed[foundSubCrv] = true;

				}	// end if, continue with do loop


			} else if(oLastBnd.selected == true)	// Check if last Bnd is selected.
			{
			// Deselect this Boundary first, so it won't find itself.
				oLastBnd.selected = false;

				// Find nearby Subcurve Bnd.
				var foundBnd = findBoundary( oLastBnd.x, oLastBnd.y, oLastBnd.z, mergeRadius, aBnds );
//LogMessage("end foundBnd: " + foundBnd);			
				if(foundBnd != -1)
				{
				// Nearby Boundary was found.

					// Deselect found Boundary.
					aBnds[foundBnd].selected = false;
					
					// Check for closed loop.
					if(foundBnd == firstBnd)
					{
						// Mark this Subcurve array for later closing.
						oMergedCrv.close = true;

						// Deselect first Boundary.
						aBnds[firstBnd].selected = false;

						break; // Continue with for loop
					}

					// Not a closed loop...
					// Calculate Subcurve index.
					var foundSubCrv = Math.floor(foundBnd / 2);
					// Add it to array at last.
					aSubCrvs.push(foundSubCrv);
//LogMessage("pushed aSubCrvs: " + aSubCrvs);
					// End Bnd found? -> invert
					if( foundBnd % 2 == 1 ) aInvert.push(true);
					else aInvert.push(false);
					
					// Mark it as used
					aSubcurveUsed[foundSubCrv] = true;

				}	// end if, continue with do loop
				
			} else break;	// Neither begin Bnd nor end Bnd was selected -> continue with for loop.

		} // end while
//LogMessage("aSubCrvs: " + aSubCrvs);
//LogMessage("aMergedCrvs[" + (mergedCrvCnt-1) + "].aSubCrvs: " + aMergedCrvs[mergedCrvCnt-1].aSubCrvs);
//LogMessage("--------------");
	} 	// end for
/*
LogMessage("-------------");
//LogMessage("aMergedCrvs.length: " + aMergedCrvs.length);
LogMessage("mergedCrvCnt:" + mergedCrvCnt);
LogMessage("aMergedCrvs:");
for(var i = 0; i < mergedCrvCnt; i++)
{
	LogMessage("aMergedCrvs[" + i + "].aSubCrvs: " + aMergedCrvs[i].aSubCrvs + "   close: " + aMergedCrvs[i].close);
	LogMessage("aInvert: " + aMergedCrvs[i].aInvert);
}
LogMessage("-------------");
*/
//return true;




	// 3) MERGE LOOP
//LogMessage("MERGE");
	// All Subcurves must have same degree.
	// This has to be made sure in the _Execute callback.

	// Create arrays for complete CurveList data
	//var allSubcurvesCnt = 0;
	var aAllPoints = new Array();
	var aAllNumPoints = new Array();
	var aAllKnots = new Array();
	var aAllNumKnots = new Array();
	var aAllIsClosed = new Array();
	var aAllDegree = new Array();
	var aAllParameterization = new Array();

	// Create arrays for Subcurve data
	var aMergedPoints = new Array();
	//var mergedNumPoints;
	var aMergedKnots = new Array();
	//var mergedNumKnots;
	//var mergedIsClosed;
	//var mergedDegree;
	//var mergedParameterization;


//LogMessage("mergedCrvCnt: " + mergedCrvCnt);
	// Loop through all "rows" in aMergedCrvs
	for(var allSubcurvesCnt = 0; allSubcurvesCnt < mergedCrvCnt; allSubcurvesCnt++)
	{
//LogMessage("");
//LogMessage( "new Subcurve [" + allSubcurvesCnt + "]:" );
		// var newSubcurve = empty
		var aSubCrvs = aMergedCrvs[allSubcurvesCnt].aSubCrvs;
		var aInvert = aMergedCrvs[allSubcurvesCnt].aInvert;
		// Loop through all Subcurves in array, merge them
		for(var i = 0; i < aSubCrvs.length; i++)
		{
//LogMessage("aSubCrvs[i]: " + aSubCrvs[i]);
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
				var ret = invertNurbsCurve(aPoints, aKnots, isClosed, degree);
				// Param "isClosed" is actually irrelevant here, since closed Subcurves don't get merged anyway.
				aPoints = ret.aPoints;
				aKnots = ret.aKnots;
			}

			if(i == 0)
			{
			// First Subcurve piece in array
				// Get other data
				var isClosed = aSubCrvData[2];
				// It is assured in the _Execute callback that all Subcurves have same degree!
				var degree = aSubCrvData[3];
				var parameterization = aSubCrvData[4];

				aMergedPoints = aPoints;
				//mergedNumPoints = aPoints.length // 4: x,y,z,w
				aMergedKnots = aKnots;
				//mergedNumKnots = aKnots.length;
				//mergedIsClosed = isClosed;
				//mergedDegree = degree;
				//mergedParameterization = parameterization;
//LogMessage("i=0");
//logControlPointsArray("aMergedPoints: ", aMergedPoints, 1000);
//logKnotsArray("aMergedKnots: ", aMergedKnots, 1000);
			} else
			{
			// Concatenate other Subcurve pieces - this is what it's all about...
			// Subcurve pieces are never closed here.
				
				// POINTS
				// Calc geom. average of last Point and first Point of next piece.
				// SIVector3 ?
				aMergedPoints[aMergedPoints.length - 4] = ( aMergedPoints[aMergedPoints.length - 4] + aPoints[0] ) / 2;
				aMergedPoints[aMergedPoints.length - 3] = ( aMergedPoints[aMergedPoints.length - 3] + aPoints[1] ) / 2;
				aMergedPoints[aMergedPoints.length - 2] = ( aMergedPoints[aMergedPoints.length - 2] + aPoints[2] ) / 2;

				// Discard first Point of next Curve piece.
				aPoints = aPoints.slice(4);	// 4: x,y,z,w
				
				// Concatenate.
				aMergedPoints = aMergedPoints.concat(aPoints);
				
				// KNOTS

				// We simplify the NURBS math here and assume a Knot interval of 1.
				var offset = aMergedKnots[aMergedKnots.length - 1] + 1;
				
				// Discard first Knot of next Curve piece.
				// degree 1: 0,1,2,...
				// degree 2: 0,0,1,1,2,2,...
				// degree 3: 0,0,0,1,2,3,...
				aKnots = aKnots.slice(degree);
				
				offset = offset - aKnots[0];
				
				// Add the offset.
				for(var n = 0; n < aKnots.length; n++) aKnots[n] += offset;
				
				// Concatenate.
				aMergedKnots = aMergedKnots.concat(aKnots);
				
			}

		} // end for i
//LogMessage("merged!");
//logControlPointsArray("aMergedPoints: ", aMergedPoints, 1000);
//logKnotsArray("aMergedKnots: ", aMergedKnots, 1000);
		if(aMergedCrvs[allSubcurvesCnt].close)
		{
		// Close the merged Subcurves
			var ret = closeNurbsCurve(aMergedPoints, aMergedKnots, degree);
			aMergedPoints = ret.aPoints;
			aMergedKnots = ret.aKnots;

			var isClosed = true;
//logControlPointsArray("aPoints closed: ", aPoints, 1000);
//logKnotsArray("aKnots closed: ", aKnots, 1000);
		}


		// Put merged Subcurve data in CurveList
		aAllPoints = aAllPoints.concat(aMergedPoints);
		aAllNumPoints[allSubcurvesCnt] = aMergedPoints.length / 4;	//x,y,z,w
		aAllKnots = aAllKnots.concat(aMergedKnots);
		aAllNumKnots[allSubcurvesCnt] = aMergedKnots.length;
		aAllIsClosed[allSubcurvesCnt] = isClosed; //aSubCrvData[2];
		aAllDegree[allSubcurvesCnt] = degree; //aSubCrvData[3];
		aAllParameterization[allSubcurvesCnt] = parameterization; //aSubCrvData[4];

	} // end for allSubcurvesCnt


	// Debug info
/*	LogMessage("New CurveList:");
	LogMessage("allSubcurvesCnt:      ");
	logControlPointsArray("aAllPoints: ", aAllPoints, 1000);
	//LogMessage("aAllPoints:           " + aAllPoints);
	LogMessage("aAllPoints.length/4:  " + aAllPoints.length/4);
	//LogMessage("aAllNumPoints:        " + aAllNumPoints);
	//LogMessage("aAllKnots:            " + aAllKnots);
	logKnotsArray(aAllKnots, 1000);
	LogMessage("aAllKnots.length:     " + aAllKnots.length);
	LogMessage("aAllNumKnots:         " + aAllNumKnots);
	LogMessage("aAllIsClosed:         " + aAllIsClosed);
	LogMessage("aAllDegree:           " + aAllDegree);
	LogMessage("aAllParameterization: " + aAllParameterization);
*/

	// overwrite this CurveList using Set

	outCrvListGeom.Set(
		allSubcurvesCnt,		// 0. number of Subcurves in the Curvelist
		aAllPoints, 			// 1. Array
		aAllNumPoints, 			// 2. Array, number of Control Points per Subcurve
		aAllKnots,				// 3. Array
		aAllNumKnots,			// 4. Array
		aAllIsClosed, 			// 5. Array
		aAllDegree, 			// 6. Array
		aAllParameterization, 	// 7. Array
		0) ;					// 8. NurbsFormat: 0 = siSINurbs, 1 = siIGESNurbs			// 8. NurbsFormat: 0 = siSINurbs, 1 = siIGESNurbs

	//output = in_ctxt.OutputTarget;
	return true;
}






//______________________________________________________________________________
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


//______________________________________________________________________________

function invertNurbsCurve(aPoints, aKnots, isClosed, degree/*, parameterization*/)
{
	// Invert Point array
	var pLen = aPoints.length;
	var aPointsInv = new Array(pLen);

//logControlPointsArray("aPoints: ", aPoints, 1000);
	for(var i = 0; i < aPoints.length; i += 4)
	{
		aPointsInv[i] = aPoints[aPoints.length - i - 4];
		aPointsInv[i + 1] = aPoints[aPoints.length - i - 3];
		aPointsInv[i + 2] = aPoints[aPoints.length - i - 2];
		aPointsInv[i + 3] = aPoints[aPoints.length - i - 1];
	}

//logControlPointsArray("aPointsInv:" , aPointsInv, 1000);

	// 
	if(isClosed)
	{
		// "Rotate" Point array right, so the former first Points is first again.
		// original:	0,1,2,3,4
		// reverse:		4,3,2,1,0
		// correct: 	0,4,3,2,1
		aPointsInv = ( aPointsInv.slice(pLen - 4) ).concat( aPointsInv.slice( 0, pLen - 4) );

	}

//logControlPointsArray("aPointsInv: ", aPointsInv, 1000);

	// Invert Knot array
	var kLen = aKnots.length;
	var aKnotsInv = new Array();
	var prevKnot = aKnots[kLen - 1];	// last Knot
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


//______________________________________________________________________________

function findBoundary(x, y, z, mergeRadius, aBnds)
{
	var nearestBnd = -1;
	var nearestDist = -1;
	
	// Loop through all Boundaries
	for(var i = 0; i < aBnds.length; i++)
	{
		var bnd = aBnds[i];
		// Deselected Bnds are ignored.
		if(!bnd.selected) continue;

		// Calculate body diagonal.
		var dx = x - bnd.x;
		var dy = y - bnd.y;
		var dz = z - bnd.z;
		var dist = Math.sqrt(dx*dx + dy*dy + dz*dz);	// or: Math.pow(xxx, 2);
//LogMessage("dist to Point " + i + ": " + dist);
		if(dist < mergeRadius)
		{
			if(dist < nearestDist || nearestDist == -1)
			{
				nearestDist = dist;
				nearestBnd = i;

			}

		}
		
	}
//LogMessage("nearestDist: " + nearestDist);
//LogMessage("nearestBnd: " + nearestBnd);
	// If no Boundary in radius was found, return -1.
	return nearestBnd;
}


//______________________________________________________________________________

function MergeSubcurves_DefineLayout( in_ctxt )
{
	var oLayout,oItem;
	oLayout = in_ctxt.Source;
	oLayout.Clear();
	oLayout.AddItem("cont");
	oLayout.AddItem("seam");
	oLayout.AddItem("modifytan");
	oLayout.AddItem("mergeRadius");
	return true;
}

//______________________________________________________________________________

function MergeSubcurves_OnInit( )
{
	Application.LogMessage("MergeSubcurves_OnInit called",siVerbose);
}

//______________________________________________________________________________

function MergeSubcurves_OnClosed( )
{
	Application.LogMessage("MergeSubcurves_OnClosed called",siVerbose);
}

//______________________________________________________________________________
/*
function MergeSubcurves_cont_OnChanged( )
{
	Application.LogMessage("MergeSubcurves_cont_OnChanged called",siVerbose);
	var oParam;
	oParam = PPG.cont;
	var paramVal;
	paramVal = oParam.Value;
	Application.LogMessage("New value: " + paramVal,siVerbose);
}
*/

//______________________________________________________________________________
/*
function MergeSubcurves_seam_OnChanged( )
{
	Application.LogMessage("MergeSubcurves_seam_OnChanged called",siVerbose);
	var oParam;
	oParam = PPG.seam;
	var paramVal;
	paramVal = oParam.Value;
	Application.LogMessage("New value: " + paramVal,siVerbose);
}
*/

//______________________________________________________________________________
/*
function MergeSubcurves_modifytan_OnChanged( )
{
	Application.LogMessage("MergeSubcurves_modifytan_OnChanged called",siVerbose);
	var oParam;
	oParam = PPG.modifytan;
	var paramVal;
	paramVal = oParam.Value;
	Application.LogMessage("New value: " + paramVal,siVerbose);
}
*/

//______________________________________________________________________________

function MergeSubcurves_mergeRadius_OnChanged( )
{
	Application.LogMessage("MergeSubcurves_mergeRadius_OnChanged called",siVerbose);
	var oParam;
	oParam = PPG.mergeRadius;
	var paramVal;
	paramVal = oParam.Value;
	Application.LogMessage("New value: " + paramVal,siVerbose);
}

//______________________________________________________________________________

function ApplyMergeSubcurves_Menu_Init( in_ctxt )
{
	var oMenu;
	oMenu = in_ctxt.Source;
	oMenu.AddCommandItem("Merge Subcurves","ApplyMergeSubcurves");
	return true;
}

//______________________________________________________________________________

function logControlPointsArray(logString, aPoints, dp)
{
	LogMessage(logString);
	
	for ( var i = 0; i < aPoints.length; i += 4 )
	{
		var x = aPoints[i];
		var y = aPoints[i + 1];
		var z = aPoints[i + 2];
		var w = aPoints[i + 3]; 
		LogMessage( "[" + i/4 + "]: x = " + Math.round(x*dp)/dp + "; y = " + Math.round(y*dp)/dp + "; z = " + Math.round(z*dp)/dp ); // + "; w = " + Math.round(w*dp)/dp );

	}
	
	//LogMessage("");
}



function logKnotsArray(logString, aKnots, dp)
{
	//LogMessage(logString);
	var sKnotArray = logString; //"";
	for ( var j = 0; j < aKnots.length; j++ )
	{
		var knotValue = Math.round(aKnots[j]*dp)/dp;
		if ( j == 0 ) sKnotArray = sKnotArray + /*"Knot Vector: " + */knotValue;//.toString(10);
		else sKnotArray = sKnotArray + ", " + knotValue;//.toString(10);
	}
	
	LogMessage( sKnotArray );
	//LogMessage("");
	
}
