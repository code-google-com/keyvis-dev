//______________________________________________________________________________
// OpenCloseSubcurvesPlugin
// 2010/04 by Eugen Sares
// last update: 2011/02/20
//______________________________________________________________________________

function XSILoadPlugin( in_reg )
{
	in_reg.Author = "Eugen Sares";
	in_reg.Name = "OpenCloseSubcurvesPlugin";
	in_reg.Major = 1;
	in_reg.Minor = 0;

	in_reg.RegisterOperator("OpenCloseSubcurves");
	in_reg.RegisterCommand("ApplyOpenCloseSubcurves","ApplyOpenCloseSubcurves");
	in_reg.RegisterMenu(siMenuTbModelModifyCurveID,"ApplyOpenCloseSubcurves_Menu",false,false);
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


function ApplyOpenCloseSubcurves_Init( in_ctxt )	// called after _Execute
{
	var oCmd;
	oCmd = in_ctxt.Source;	// source object that is the cause of the callback being fired
	oCmd.Description = "Create an instance of OpenCloseSubcurves operator";
	oCmd.SetFlag(siNoLogging,false);

	var oArgs = oCmd.Arguments;
	// To get a collection of subcomponents, or the current selection of subcomponents: 
	oArgs.AddWithHandler("args", "Collection");
	
	return true;
}


//______________________________________________________________________________

function ApplyOpenCloseSubcurves_Execute(args)
{
	Application.LogMessage("ApplyOpenCloseSubcurves_Execute called",siVerbose);

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
				// Object selected? Open/Close all Subcurves.
				var oObject = cSel(i);
				var oCluster = oObject.ActivePrimitive.Geometry.AddCluster( siSubCurveCluster, "Subcurve_AUTO"/*, elementIndices*/ );
				cSubcurveClusters.Add( oCluster );
				cCurveLists.Add( oObject );


			} else if( cSel(i).Type == "subcrv" && ClassName(cSel(i)) == "Cluster")
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
				var newOp = AddCustomOp("OpenCloseSubcurves", oOutput, [oInput1, oInput2], "OpenCloseSubcurves");

				var rtn = GetKeyboardState();
				modifier = rtn(1);
				var bCtrlDown = false;
				if(modifier == 2) bCtrlDown = true;

				if(Application.Interactive && bAutoinspect && !bCtrlDown)
					// BUG: AutoInspect() does not work with Custom Ops?
					// So we need to check CTRL key manually.
					//AutoInspect(newOp);
					InspectObj(newOp, "", "", siModal, true);

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
				
				// Workaround for unselectable added Subcurves problem.
				var cleanOp = ApplyTopoOp("CrvClean", cCurveLists(i), 3, siPersistentOperation, null);
				SetValue(cleanOp + ".cleantol", 0, null);
				//AddCustomOp("EmptyOp", oOutput, oInput1); // Does not help.

				var newOp = AddCustomOp("OpenCloseSubcurves", oOutput, [oInput1, oInput2], "OpenCloseSubcurves");

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

// Use this callback to build a set of parameters that will appear in the property page.
function OpenCloseSubcurves_Define( in_ctxt )
{
	Application.LogMessage("OpenCloseSubcurves_Define called",siVerboseMsg);
	
	var oCustomOperator;
	var oPDef;
	oCustomOperator = in_ctxt.Source;

	oPDef = XSIFactory.CreateParamDef("openingMode",siBool,siClassifUnknown,siPersistable | siKeyable,"Opening mode","",true,null,null,null,null);
	oCustomOperator.AddParameter(oPDef);
	oPDef = XSIFactory.CreateParamDef("closingMode",siBool,siClassifUnknown,siPersistable | siKeyable,"Closing mode","",true,null,null,null,null);
	oCustomOperator.AddParameter(oPDef);

	oCustomOperator.AlwaysEvaluate = false;
	oCustomOperator.Debug = 0;
	return true;
}


// User data can be stored in the operator context of the Init callback
// and then retrieved later in the Update and Term callbacks.
function OpenCloseSubcurves_Init( in_ctxt )
{
	Application.LogMessage("OpenCloseSubcurves_Init called",siVerboseMsg);
	return true;
}


function OpenCloseSubcurves_Term( in_ctxt )
{
	Application.LogMessage("OpenCloseSubcurves_Term called",siVerboseMsg);
	// var cluster = in_ctxt.GetInputValue("deleteCluster");	// ERROR : 21000 - Unspecified failure
	// DeleteObj(cluster);
	return true;
}

//______________________________________________________________________________

function OpenCloseSubcurves_Update( in_ctxt )
{
	Application.LogMessage("OpenCloseSubcurves_Update called",siVerboseMsg);


	// Get Params.
	var openingMode = in_ctxt.GetParameterValue("openingMode");
	var closingMode = in_ctxt.GetParameterValue("closingMode");
	

	// Get Port connections.
	var outCrvListGeom = in_ctxt.OutputTarget.Geometry;
	var inCrvListGeom = in_ctxt.GetInputValue(0).Geometry; // Port 0: "Incrvlist"
	var oSubcurveCluster = in_ctxt.GetInputValue(1); // Port 1: "InSubcurve_AUTO"
	var cInCurves = inCrvListGeom.Curves;


	// Create boolean array which Subcurves to open/close.
	var aSel = new Array(cInCurves.Count);
	for(i = 0; i < cInCurves.Count; i++)
		aSel[i] = false;	// init
	for(var i = 0; i < oSubcurveCluster.Elements.Count; i++)
		aSel[oSubcurveCluster.Elements(i)] = true;


	// Create empty arrays to hold the new CurveList data.
	var aAllPoints = new Array();
	var aAllNumPoints = new Array();
	var aAllKnots = new Array();
	var aAllNumKnots = new Array();
	var aAllIsClosed = new Array();
	var aAllDegree = new Array();
	var aAllParameterization = new Array();

	var tol = 10e-10;
	
	
	// Loop through all Subcurves.
	for(var allSubcurvesCnt = 0; allSubcurvesCnt < cInCurves.Count; allSubcurvesCnt++)
	{
		// Get input Subcurve.
		var subCrv = cInCurves.item(allSubcurvesCnt);	// Type: NurbsCurve, ClassName: NurbsCurve
		VBdata = new VBArray(subCrv.Get2(siSINurbs)); var subCrvData = VBdata.toArray();

		// Get Point data.
		var vbArg0 = new VBArray(subCrvData[0]); var aPoints = vbArg0.toArray();
		aAllNumPoints[allSubcurvesCnt] = aPoints.length/4;	// /4? x,y,z,weight

		// Check if the first and last Point coincide.
		var bFirstOnLast = false;
		if(	Math.abs(aPoints[0] - aPoints[aPoints.length - 4]) < tol &&
			Math.abs(aPoints[1] - aPoints[aPoints.length - 3]) < tol &&
			Math.abs(aPoints[2] - aPoints[aPoints.length - 2]) < tol)
				bFirstOnLast = true;

		// Get Knot data.
		var vbArg1 = new VBArray(subCrvData[1]); var aKnots = vbArg1.toArray();
		aAllNumKnots[allSubcurvesCnt] = aKnots.length;

		// Get other data.
		aAllIsClosed[allSubcurvesCnt] = subCrvData[2];
		aAllDegree[allSubcurvesCnt] = subCrvData[3];
		aAllParameterization[allSubcurvesCnt] = subCrvData[4];


		if(aSel[allSubcurvesCnt])
		{
		// Subcurve was selected and will be opened/closed
		// Only the Point and Knot data need to be changed, rest is already set.

			// This Operator works as a toggle:
			// Open Curves that were closed, and vice versa.
			if(aAllIsClosed[allSubcurvesCnt] == true)
			{
			// OPEN the Subcurve		
			// openingMode: first and last Point of opened Curve will overlap or not?
				var ret = openNurbsCurve(aPoints, aKnots, aAllDegree[allSubcurvesCnt], openingMode);
				aPoints = ret.aPoints;
				aKnots = ret.aKnots;

				aAllIsClosed[allSubcurvesCnt] = false;
				
			} else
			{
			// CLOSE the Subcurve
				var ret = closeNurbsCurve(aPoints, aKnots, aAllDegree[allSubcurvesCnt], closingMode, 10e-10);
				aPoints = ret.aPoints;
				aKnots = ret.aKnots;

				aAllIsClosed[allSubcurvesCnt] = true;
				
			}

		aAllNumPoints[allSubcurvesCnt] = aPoints.length/4;
		aAllNumKnots[allSubcurvesCnt] = aKnots.length;
		
		}

		// Concatenate the Points and Knots arrays to get the complete CurveList data.
		aAllPoints = aAllPoints.concat(aPoints);
		aAllKnots = aAllKnots.concat(aKnots);

	}


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

function getKnotMult(aKnots, knotIdx)
{
	//  0,1,2,3,4,5,6,7,8,9,10
	// [0,0,0,1,2,3,3,4,5,5,5]
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


function openNurbsCurve(aPoints, aKnots, degree, openingMode)
{
	if(!openingMode)
	{
		// Overlap after opening:
		// -> Duplicate first Point to the end
		for(var i = 0; i < 4; i++)	aPoints.push(aPoints[i]);
	}

	// Set first Knot to full multiplicity (Bezier).
	var ret = getKnotMult(aKnots, 0);
	var mult0 = ret.multiplicity;

	for(var i = 0; i < degree - mult0; i++)
		aKnots.unshift(aKnots[0]);

	// Set length of Knot vector to K = P + degree - 1
	aKnots.length = aPoints.length / 4 + degree - 1;	// /4? x,y,z,w
	if(degree > 1)
	{
		// Set last Knot to full Mult:
		// Look at Knot [length-degree],
		// if this is the start index of a Knot (mult. 1,2 or 3), set it to full mult., otherwise
		// take the following Knot, set it to full mult., reduce the previous Knot's mult. accordingy.
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
			aKnots:aKnots};
}


// This functions mimics the factory CrvOpenClose Op exactly.
function openNurbsCurveFactory(aPoints, aKnots, degree, openingMode)
{
	if(!openingMode)
	{
		// Overlap after opening:
		// -> Duplicate first Point to the end
		for(var i = 0; i < 4; i++)	aPoints.push(aPoints[i]);
	}

	// Set first Knot to full multiplicity (Bezier).
	var ret = getKnotMult(aKnots, 0);
	var mult0 = ret.multiplicity;

	for(var i = 0; i < degree - mult0; i++)
		aKnots.unshift(aKnots[0]);

	// Set length of Knot vector to K = P + degree - 1
	aKnots.length = aPoints.length / 4 + degree - 1;	// /4? x,y,z,w
	if(degree > 1)
	{
		// Set last Knot to full Mult:
		// Look at Knot [length-degree],
		// if this is the start index of a Knot (mult. 1,2 or 3), set it to full mult., otherwise
		// take the following Knot, set it to full mult., reduce the previous Knot's mult. accordingy.
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
			aKnots:aKnots};
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
		
			if(closingMode)
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
				// Close with connecting line.

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


function OpenCloseSubcurves_DefineLayout( in_ctxt )
{
	var oLayout,oItem;
	oLayout = in_ctxt.Source;
	oLayout.Clear();
	oLayout.AddGroup("When opening, keep last Segment?");
	//oLayout.AddItem("openingMode", "Open with gap");
	var aRadioItems = ["No (standard)", true, "Yes", false];
	var oOpeningMode = oLayout.AddEnumControl("openingMode", aRadioItems, "", siControlRadio);
	oOpeningMode.SetAttribute(siUINoLabel, true);
	oLayout.EndGroup();
	oLayout.AddGroup("When closing, make last Segment");
	var aRadioItems = ["Curved (standard)", true, "Linear", false];
	var oClosingMode = oLayout.AddEnumControl("closingMode", aRadioItems, "", siControlRadio);
	oClosingMode.SetAttribute(siUINoLabel, true);
	oLayout.EndGroup();
	return true;
}

/*
function OpenCloseSubcurves_OnInit( )
{
	Application.LogMessage("OpenCloseSubcurves_OnInit called",siVerbose);
}


function OpenCloseSubcurves_OnClosed( )
{
	Application.LogMessage("OpenCloseSubcurves_OnClosed called",siVerbose);
}


function OpenCloseSubcurves_openingMode_OnChanged( )
{
	Application.LogMessage("OpenCloseSubcurves_openingMode_OnChanged called",siVerbose);
	var oParam;
	oParam = PPG.openingMode;
	var paramVal;
	paramVal = oParam.Value;
	Application.LogMessage("New value: " + paramVal,siVerbose);
}
*/

function ApplyOpenCloseSubcurves_Menu_Init( in_ctxt )
{
	var oMenu;
	oMenu = in_ctxt.Source;
	oMenu.AddCommandItem("Open/Close (Sub)Curves","ApplyOpenCloseSubcurves");
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
		if ( j == 0 ) sKnotArray = sKnotArray + knotValue;//.toString(10);
		else sKnotArray = sKnotArray + ", " + knotValue;
	}
	
	LogMessage( sKnotArray );
	
}
*/
