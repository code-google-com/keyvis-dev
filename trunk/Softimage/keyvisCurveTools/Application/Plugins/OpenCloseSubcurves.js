//______________________________________________________________________________
// OpenCloseSubcurvesPlugin
// 2010/04 by Eugen Sares
// last update: 2011/02/20
//
// Usage:
// - Select Subcurves
// - Model > Modify > Curve > Open/Close Subcurve
// The open/closed status of the of the selected Subcurves will be toggled.
// 
// Info: this Op has the parameter "openingMode".
// When checked, the last Segment (between the next to last and first Point) will be deleted when opening.
// (same as in the factory OpenClose).
// When unchecked, the last Segment will remain.
//
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

	// TODO: You may want to add some arguments to this command so that the operator
	// can be applied to objects without depending on their specific names.
	// Tip: the Collection ArgumentHandler is very useful

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
		var cSel = Selection;

		// Filter a Collection of Subcurve Clusters out of the Selection.
		var cSubcurveClusters = new ActiveXObject("XSI.Collection");
		var cCurveLists = new ActiveXObject("XSI.Collection");

		// Filter the Selection for Clusters and Subcurves.
		for(var i = 0; i < cSel.Count; i++)
		{
			if( cSel(i).Type == "subcrv" && ClassName(cSel(i)) == "Cluster")
			{
				cSubcurveClusters.Add(cSel(i));
				cCurveLists.Add( cSel(i).Parent3DObject );
				
			}

			if( cSel(i).Type == "subcrvSubComponent" )
			{
				var oObject = cSel(i).SubComponent.Parent3DObject;
				var elementIndices = cSel(i).SubComponent.ElementArray.toArray();
				var oCluster = oObject.ActivePrimitive.Geometry.AddCluster( siSubCurveCluster, "Subcurve_AUTO", elementIndices );

				cSubcurveClusters.Add( oCluster );
				cCurveLists.Add( oObject );
			}
			
/*			if( cSel(i).Type == "crvlist")
			{
				// Problem: PickElement does not bother if CurveLists is already selected.
				// Otherwise, we could iterate through all selected CurveLists and start a pick session for each.
				SetSelFilter("SubCurve");
				
				var ret = pickElements("SubCurve");
				var oObject = ret.oObject;
				var elementIndices = ret.elementIndices;
			}
*/
			
		}

		// If nothing usable was selected, start a Pick Session.
		if(cSubcurveClusters.Count == 0)
		{
			var ret = pickElements("SubCurve");
			var oObject = ret.oObject;
			var elementIndices = ret.elementIndices;
		
			var oCluster = oObject.ActivePrimitive.Geometry.AddCluster( siSubCurveCluster, "Subcurve_AUTO", elementIndices );

			cSubcurveClusters.Add(oCluster);
			cCurveLists.Add( oObject );

		}

/*		for(var i = 0; i < cSubcurveClusters.Count; i++)
		{
			LogMessage("cSubcurveClusters(" + i + "): " + cSubcurveClusters(i));
			LogMessage("cCurveLists(" + i + "): " + cCurveLists(i));
		}
*/
		DeselectAllUsingFilter("SubCurve");

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

function pickElements(selFilter)
{

	var subcurves, button;	// useless, but needed in JScript.
	// Tip: PickElement() automatically manages to select a CurveList first, then a Subcurve!
	var rtn = PickElement( selFilter, selFilter, selFilter, subcurves, button, 0 );
	button = rtn.Value( "ButtonPressed" );
	if(!button) throw "Argument must be Subcurves.";
	element = rtn.Value( "PickedElement" );
	//var modifier = rtn.Value( "ModifierPressed" );
	
	// element.Type: subcrvSubComponent
	// ClassName(element): CollectionItem

	var oObject = element.SubComponent.Parent3DObject;
	var elementIndices = element.SubComponent.ElementArray.toArray();

	return {oObject: oObject, elementIndices: elementIndices};
	
}


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


// debug
/*		LogMessage("");
		LogMessage("Old Subcurve:");
		LogMessage("allSubcurvesCnt: " + allSubcurvesCnt);
		LogMessage("aAllPoints[" + allSubcurvesCnt + "]: " + aPoints.toString() );
		LogMessage("aAllNumPoints[" + allSubcurvesCnt + "]: " + aAllNumPoints[allSubcurvesCnt]);
		LogMessage("aAllKnots[" + allSubcurvesCnt + "]: " + aKnots.toString() );
		LogMessage("aAllNumKnots[" + allSubcurvesCnt + "]: " + aAllNumKnots[allSubcurvesCnt] );
		LogMessage("aAllIsClosed: " + aAllIsClosed[allSubcurvesCnt]);
		LogMessage("aAllDegree[" + allSubcurvesCnt + "]: " + aAllDegree[allSubcurvesCnt] );
		LogMessage("aAllParameterization[" + allSubcurvesCnt + "]: " + aAllParameterization[allSubcurvesCnt] );
		LogMessage("");
*/

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
//logControlPointsArray("aAllPoints after closing: ", aAllPoints, 100);
//logKnotsArray("aAllKnots after closing: " + aAllKnots, 100);

	}

	// Debug
/*	LogMessage("New CurveList:");
	LogMessage("allSubcurvesCnt:      " + allSubcurvesCnt);
	logControlPointsArray("aAllPoints: ", aAllPoints, 100);
	LogMessage("aAllPoints.length/4:  " + aAllPoints.length/4);
	LogMessage("aAllNumPoints:        " + aAllNumPoints);
	logKnotsArray("aAllKnots: " + aAllKnots, 100);
	LogMessage("aAllKnots.length:     " + aAllKnots.length);
	LogMessage("aAllNumKnots:         " + aAllNumKnots);
	LogMessage("aAllIsClosed:         " + aAllIsClosed);
	LogMessage("aAllDegree:           " + aAllDegree);
	LogMessage("aAllParameterization: " + aAllParameterization);
*/

	// overwrite this CurveList using Set
	outCrvListGeom.Set(
		allSubcurvesCnt,			// 0. number of Subcurves in the Curvelist
		aAllPoints, 		// 1. Array
		aAllNumPoints, 		// 2. Array, number of Control Points per Subcurve
		aAllKnots,			// 3. Array
		aAllNumKnots,		// 4. Array
		aAllIsClosed, 			// 5. Array
		aAllDegree, 			// 6. Array
		aAllParameterization, 	// 7. Array
		0) ;				// 8. NurbsFormat: 0 = siSINurbs, 1 = siIGESNurbs
		
	return true;

}


//______________________________________________________________________________

// [0,0,0,1,2,3,3,4,5,5,5]
//  0,1,2,3,4,5,6,7,8,9,10
// Example: knotIdx 9 returns startIdx 8, mult. 3
function getKnotMult(aKnots, knotIdx)
{
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
//logKnotsArray("aKnots before opening: ", aKnots, 100);
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
	oLayout.AddGroup("Opening Method");
	//oLayout.AddItem("openingMode", "Open with gap");
	var aRadioItems = ["With gap (standard)", true, "Coincide first and last Point", false];
	oLayout.AddEnumControl("openingMode", aRadioItems, " ", siControlRadio);
	oLayout.EndGroup();
	oLayout.AddGroup("Closing Method");
	var aRadioItems = ["Curved (standard)", true, "Linear", false];
	oLayout.AddEnumControl("closingMode", aRadioItems, " ", siControlRadio);
	oLayout.EndGroup();
	return true;
}


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


function ApplyOpenCloseSubcurves_Menu_Init( in_ctxt )
{
	var oMenu;
	oMenu = in_ctxt.Source;
	oMenu.AddCommandItem("Open/Close Subcurves","ApplyOpenCloseSubcurves");
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
