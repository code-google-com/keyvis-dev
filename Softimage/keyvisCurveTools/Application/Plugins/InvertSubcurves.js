//______________________________________________________________________________
// InvertSubcurvesPlugin
// 2009/11 by Eugen Sares
// last update: 2011/02/12
//______________________________________________________________________________

function XSILoadPlugin( in_reg )
{
	in_reg.Author = "Eugen Sares";
	in_reg.Name = "InvertSubcurvesPlugin";
	in_reg.Major = 1;
	in_reg.Minor = 0;

	in_reg.RegisterOperator("InvertSubcurves");
	in_reg.RegisterCommand("ApplyInvertSubcurves","ApplyInvertSubcurves");
	in_reg.RegisterMenu(siMenuTbModelModifyCurveID,"ApplyInvertSubcurves_Menu",false,false);
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


function ApplyInvertSubcurves_Init( in_ctxt )
{
	var oCmd;
	oCmd = in_ctxt.Source;	// source object that is the cause of the callback being fired
	oCmd.Description = "Create an instance of InvertSubcurves operator";
	oCmd.SetFlag(siNoLogging,false);
	var oArgs = oCmd.Arguments;
	// To get a collection of subcomponents, or the current selection of subcomponents: 
	oArgs.AddWithHandler("args", "Collection");

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

function ApplyInvertSubcurves_Execute(args)
{
	Application.LogMessage("ApplyInvertSubcurves_Execute called",siVerbose);

	try
	{
		var cSel = args;

		// Filter a Collection of Subcurve Clusters out of the Selection.
		var cSubcurveClusters = new ActiveXObject("XSI.Collection");
		var cCurveLists = new ActiveXObject("XSI.Collection");

		// Filter the Selection for Clusters and Subcurves.
		for(var i = 0; i < cSel.Count; i++)
		{
			if( cSel(i).Type == "crvlist")
			{
				// Object selected? Invert all Subcurves.
				var oObject = cSel(i);
				var oCluster = oObject.ActivePrimitive.Geometry.AddCluster( siSubCurveCluster, "Subcurve_AUTO");
				cSubcurveClusters.Add( oCluster );
				cCurveLists.Add( oObject );

			}

			if( cSel(i).Type == "subcrv" && ClassName(cSel(i)) == "Cluster")
			{
				cSubcurveClusters.Add(cSel(i));
				cCurveLists.Add( cSel(i).Parent3DObject );


			} else if( cSel(i).Type == "subcrvSubComponent" )
			{
				var oObject = cSel(i).SubComponent.Parent3DObject;
				var elementIndices = cSel(i).SubComponent.ElementArray.toArray();
				var oCluster = oObject.ActivePrimitive.Geometry.AddCluster( siSubCurveCluster, "Subcurve_AUTO", elementIndices );

				cSubcurveClusters.Add( oCluster );
				cCurveLists.Add( oObject );
			}
			
		}

		//DeselectAllUsingFilter(siSubcomponentFilter);
		//DeselectAllUsingFilter(siClusterFilter);
		

		// If nothing usable was selected, start a Pick Session.
		if(cSubcurveClusters.Count == 0)
		{
			SetSelFilter("SubCurve");
			do{
				var components, button;	// useless, but needed in JScript.
				var rtn = PickElement( "SubCurve", "Subcurve", "Subcurve", components, button, 0 );
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
			} while (aElements.length < 1);
		
			var oCluster = oObject.ActivePrimitive.Geometry.AddCluster( siSubCurveCluster, "Subcurve_AUTO", aElements );
			cSubcurveClusters.Add(oCluster);
			cCurveLists.Add( oObject );

		}

		//DeselectAllUsingFilter("SubCurve");

		// Construction mode automatic updating.
		var constructionModeAutoUpdate = GetValue("preferences.modeling.constructionmodeautoupdate");
		if(constructionModeAutoUpdate) SetValue("context.constructionmode", siConstructionModeModeling);

	
		var operationMode = Preferences.GetPreferenceValue( "xsiprivate_unclassified.OperationMode" );
		var bAutoinspect = Preferences.GetPreferenceValue("Interaction.autoinspect");
		
		var createdOperators = new ActiveXObject("XSI.Collection");
		
		if(operationMode == siImmediateOperation)
		{
			// Loop through all selected/created Clusters and apply the Operator.
			for(var i = 0; i < cSubcurveClusters.Count; i++)
			{
				// Add the Operator
				var oOutput = cCurveLists(i).ActivePrimitive;
				var oInput1 = cCurveLists(i).ActivePrimitive;
				var oInput2 = cSubcurveClusters(i);
				
				// Workaround for unselectable added Subcurves problem.
				//var cleanOp = ApplyTopoOp("CrvClean", cCurveLists(i), 3, siPersistentOperation, null);
				//SetValue(cleanOp + ".cleantol", 0, null);
				
				//AddCustomOp( Type, OutputObjs, [InputObjs], [Name], [ConstructionMode] )
				// Port names will be generated automatically!
				var newOp = AddCustomOp("InvertSubcurves", oOutput, [oInput1, oInput2], "InvertSubcurves");

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
			for(var i = 0; i < cSubcurveClusters.Count; i++)
			{
				// Define Outputs and Inputs.
				var oOutput = cCurveLists(i).ActivePrimitive;
				var oInput1 = cCurveLists(i).ActivePrimitive;
				var oInput2 = cSubcurveClusters(i);
				
				// Workaround for unselectable added Subcurves problem... not needed here?
				//var cleanOp = ApplyTopoOp("CrvClean", cCurveLists(i), 3, siPersistentOperation, null);
				//SetValue(cleanOp + ".cleantol", 0, null);
				//AddCustomOp("EmptyOp", oOutput, oInput1); // Does not help.

				var newOp = AddCustomOp("InvertSubcurves", oOutput, [oInput1, oInput2], "InvertSubcurves");

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


// Use this callback to build a set of parameters that will appear in the property page.
function InvertSubcurves_Define( in_ctxt )
{
	Application.LogMessage("InvertSubcurves_Define called",siVerboseMsg);
	
	var oCustomOperator;
	var oPDef;
	oCustomOperator = in_ctxt.Source;
	oCustomOperator.AlwaysEvaluate = false;
	oCustomOperator.Debug = 0;

	return true;
}


// User data can be stored in the operator context of the Init callback
// and then retrieved later in the Update and Term callbacks.
function InvertSubcurves_Init( in_ctxt )
{
	Application.LogMessage("InvertSubcurves_Init called",siVerboseMsg);
	return true;
}


function InvertSubcurves_Term( in_ctxt )
{
	Application.LogMessage("InvertSubcurves_Term called",siVerboseMsg);
	return true;
}


//______________________________________________________________________________

function InvertSubcurves_Update( in_ctxt )
{
	Application.LogMessage("InvertSubcurves_Update called",siVerboseMsg);


	// Get Port connections
	var outCrvListGeom = in_ctxt.OutputTarget.Geometry;
	//var oSubcurveCluster = in_ctxt.GetInputValue("inverseClusterPort");
	//var cInCurves = in_ctxt.GetInputValue("InCurvePort").Geometry.Curves;
	var inCrvListGeom = in_ctxt.GetInputValue(0).Geometry; // Port 0: "Incrvlist"
	var oSubcurveCluster = in_ctxt.GetInputValue(1); // Port 1: "InSubcurve_AUTO"
	var cInCurves = inCrvListGeom.Curves;


	// Create empty arrays to hold the new CurveList data.
	var aAllPoints = new Array();
	var aAllNumPoints = new Array();
	var aAllKnots = new Array();
	var aAllNumKnots = new Array();
	var aAllIsClosed = new Array();
	var aAllDegree = new Array();
	var aAllParameterization = new Array();


	// Create boolean array which Subcurve to invert.
	var aSel = new Array(cInCurves.Count);
	for(var i = 0; i < cInCurves.Count; i++)
		aSel[i] = false;	// init
	for(var i = 0; i < oSubcurveCluster.Elements.Count; i++)
		aSel[oSubcurveCluster.Elements(i)] = true;
	// debug:
	//for(var i = 0; i < cInCurves.Count; i++) LogMessage( aSel[i] );


	// Add Subcurves to invert
	for(numAllSubcurves = 0; numAllSubcurves < cInCurves.Count; numAllSubcurves++)
	{
		// Get input Subcurve
		var subCrv = cInCurves.item(numAllSubcurves);
		VBdata = new VBArray(subCrv.Get2(siSINurbs)); var aSubCrvData = VBdata.toArray();
		
		// Get Point data
		var VBdata0 = new VBArray(aSubCrvData[0]); var aPoints = VBdata0.toArray();

		// Get Knot data
		var VBdata1 = new VBArray(aSubCrvData[1]); var aKnots = VBdata1.toArray();
		
		// Get other data
		isClosed = aSubCrvData[2];
		degree = aSubCrvData[3];
		parameterization = aSubCrvData[4];

		if( aSel[numAllSubcurves] )
		{
			// Invert Point and Knot arrays
			var ret = invertNurbsCurve(aPoints, aKnots, isClosed); // , degree, parameterization);
			aPoints = ret.aPoints;
			aKnots = ret.aKnots;
		}
		

		// Concat Curve data to CurveList data
		aAllPoints = aAllPoints.concat(aPoints);
		aAllNumPoints[numAllSubcurves] = aPoints.length / 4;	//x,y,z,w
		aAllKnots = aAllKnots.concat(aKnots);
		aAllNumKnots[numAllSubcurves] = aKnots.length;
		aAllIsClosed[numAllSubcurves] = aSubCrvData[2];
		aAllDegree[numAllSubcurves] = aSubCrvData[3];
		aAllParameterization[numAllSubcurves] = aSubCrvData[4];

	}


	outCrvListGeom.Set(
		numAllSubcurves,
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

function invertNurbsCurve(aPoints, aKnots, isClosed) //, degree, parameterization)
{
	// Invert Point array.
	var pLen = aPoints.length;
	var aPointsInv = new Array(pLen);

	for(var i = 0; i < aPoints.length; i += 4)
	{
		aPointsInv[i] = aPoints[aPoints.length - i - 4];
		aPointsInv[i + 1] = aPoints[aPoints.length - i - 3];
		aPointsInv[i + 2] = aPoints[aPoints.length - i - 2];
		aPointsInv[i + 3] = aPoints[aPoints.length - i - 1];
	}
 
	if(isClosed)
	{
		// Shift Point array right, so the former first Points is first again.
		// original:	0,1,2,3,4
		// reverse:		4,3,2,1,0
		// correct: 	0,4,3,2,1
		aPointsInv = ( aPointsInv.slice(pLen - 4) ).concat( aPointsInv.slice( 0, pLen - 4) );

	}

	// Invert Knot array.
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

// Function to remove empty items from a JScript Array
// e.g. NurbsCurveList.Get2 returns "dirty" Knot Arrays
function removeUndefinedElementsFromArray(dirtyArr)
{
	var arr = new Array();
	for(var i = 0; i < dirtyArr.length; i++)
	{
		if(dirtyArr[i] != undefined) arr.push( dirtyArr[i] );
	}
	return arr;
}


function ApplyInvertSubcurves_Menu_Init( in_ctxt )
{
	var oMenu;
	oMenu = in_ctxt.Source;
	oMenu.AddCommandItem("Invert (Sub)Curves","ApplyInvertSubcurves");
	return true;
}


function InvertSubcurves_DefineLayout( in_ctxt )
{
	var oLayout,oItem;
	oLayout = in_ctxt.Source;
	oLayout.Clear();
	//oLayout.AddItem("xxx");
	return true;
}