//______________________________________________________________________________
// OpenCloseSubcurvesPlugin
// 2010/04 by Eugen Sares
// last update: 2011/02/12
//
// Usage:
// - Select Subcurves
// - Model > Modify > Curve > Open/Close Subcurve
// The open/closed status of the of the selected Subcurves will be toggled.
// 
// Info: this Op has the parameter "OpenWithGap".
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
					//AutoInspect(newOp); // BUG: does not work with Custom Ops(?)
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

	oPDef = XSIFactory.CreateParamDef("OpenWithGap",siBool,siClassifUnknown,siPersistable | siKeyable,"","",true,null,null,null,null);
	oCustomOperator.AddParameter(oPDef);

	oCustomOperator.AlwaysEvaluate = false;
	oCustomOperator.Debug = 1;
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
	var OpenWithGap = in_ctxt.GetParameterValue("OpenWithGap");
	

	// Get Port connections.
	var outCrvListGeom = in_ctxt.OutputTarget.Geometry;
	var inCrvListGeom = in_ctxt.GetInputValue(0).Geometry; // Port 0: "Incrvlist"
	var oSubcurveCluster = in_ctxt.GetInputValue(1); // Port 1: "InSubcurve_AUTO"
	var cInCurves = inCrvListGeom.Curves;


	// Create boolean array which Subcurves to open/close.
	var flagArray = new Array(cInCurves.Count);
	for(i = 0; i < cInCurves.Count; i++) flagArray[i] = false;	// init
	for(var i = 0; i < oSubcurveCluster.Elements.Count; i++)  flagArray[oSubcurveCluster.Elements(i)] = true;


	// Create empty arrays to hold the new CurveList data.
	var aAllPoints = new Array();
	var aNumAllPoints = new Array();
	var aAllKnots = new Array();
	var aNumAllKnots = new Array();
	var aIsClosed = new Array();
	var aDegree = new Array();
	var aParameterization = new Array();

	var tol = 10e-10;
	
	
	// Loop through all Subcurves.
	for(var subCrvIdx = 0; subCrvIdx < cInCurves.Count; subCrvIdx++)
	{
		// Get input Subcurve.
		var subCrv = cInCurves.item(subCrvIdx);	// Type: NurbsCurve, ClassName: NurbsCurve
		VBdata = new VBArray(subCrv.Get2(siSINurbs)); var subCrvData = VBdata.toArray();

		// Get Point data.
		var vbArg0 = new VBArray(subCrvData[0]); var aPoints = vbArg0.toArray();
		aNumAllPoints[subCrvIdx] = aPoints.length/4;	// /4? x,y,z,weight

		// Check if the first and last Point coincide.
		var bFirstOnLast = false;
		if(	Math.abs(aPoints[0] - aPoints[aPoints.length - 4]) < tol &&
			Math.abs(aPoints[1] - aPoints[aPoints.length - 3]) < tol &&
			Math.abs(aPoints[2] - aPoints[aPoints.length - 2]) < tol)
				bFirstOnLast = true;

		// Get Knot data.
		var vbArg1 = new VBArray(subCrvData[1]); var aKnots = vbArg1.toArray();
		aNumAllKnots[subCrvIdx] = aKnots.length;

		// Get other data.
		aIsClosed[subCrvIdx] = subCrvData[2];
		aDegree[subCrvIdx] = subCrvData[3];
		aParameterization[subCrvIdx] = subCrvData[4];


// debug
/*		LogMessage("");
		LogMessage("Old Subcurve:");
		LogMessage("subCrvIdx: " + subCrvIdx);
		LogMessage("aAllPoints[" + subCrvIdx + "]: " + aPoints.toString() );
		LogMessage("aNumAllPoints[" + subCrvIdx + "]: " + aNumAllPoints[subCrvIdx]);
		LogMessage("aAllKnots[" + subCrvIdx + "]: " + aKnots.toString() );
		LogMessage("aNumAllKnots[" + subCrvIdx + "]: " + aNumAllKnots[subCrvIdx] );
		LogMessage("aIsClosed: " + aIsClosed[subCrvIdx]);
		LogMessage("aDegree[" + subCrvIdx + "]: " + aDegree[subCrvIdx] );
		LogMessage("aParameterization[" + subCrvIdx + "]: " + aParameterization[subCrvIdx] );
		LogMessage("");
*/

		if(flagArray[subCrvIdx])
		{
		// Subcurve was selected and will be opened/closed
		// Only the Point and Knot data need to be changed, rest is already set.

			// This Operator works as a toggle:
			// Open Curves that were closed, and vice versa.
			if(aIsClosed[subCrvIdx] == true)
			{
			// OPEN the Subcurve		
			// OpenWithGap: first and last Point of opened Curve will overlap or not?
				if(!OpenWithGap)
				{
				// Overlap after opening:
				// -> Duplicate first Point to the end
					for(var i = 0; i < 4; i++)	aPoints.push(aPoints[i]);
				}
				
				// Remember last Knot value.
				var lastKnot = aKnots[aKnots.length - 1];

				// Adapt Knot vector length: In open Curves: K = P + degree - 1
				aKnots.length = aPoints.length / 4 + aDegree[subCrvIdx] - 1;	// /4? x,y,z,w
				
				// Set first Knot to full Mult.
				for(var i = 0; i < aDegree[subCrvIdx] - 1; i++)	aKnots[i] = aKnots[aDegree[subCrvIdx] - 1];
				
				// Set last Knot to full Mult.
				for(var i = aDegree[subCrvIdx]; i > 0; i--)	aKnots[aKnots.length - i] = lastKnot;

				aIsClosed[subCrvIdx] = false;
				
			} else
			{
			// CLOSE the Subcurve
				var ret = closeNurbsCurve(aPoints, aKnots, aDegree[subCrvIdx]);
				aPoints = ret.aPoints;
				aKnots = ret.aKnots;
			
				aIsClosed[subCrvIdx] = true;
				
			}

		aNumAllPoints[subCrvIdx] = aPoints.length/4;
		aNumAllKnots[subCrvIdx] = aKnots.length;
		
		}

		// Concatenate the Points and Knots arrays to get the complete CurveList data.
		aAllPoints = aAllPoints.concat(aPoints);
		aAllKnots = aAllKnots.concat(aKnots);

	}


// debug

/*	LogMessage("--------------------------------------"); 
	LogMessage("New Curvelist:");
	LogMessage("Number of Subcurves: " + numSubcurves);
	LogMessage("aAllPoints: " + aAllPoints);
	LogMessage("aNumAllPoints: " + aAllNumPoints);
	LogMessage("aAllKnots: " + aAllKnots);
	LogMessage("aNumAllKnots: " + aAllNumKnots);
	LogMessage("aIsClosed: " + aAllIsClosed);
	LogMessage("aDegree: " + aAllDegree);
	LogMessage("aParameterization: " + aAllParameterization);
*/

	// overwrite this CurveList using Set
	outCrvListGeom.Set(
		subCrvIdx,			// 0. number of Subcurves in the Curvelist
		aAllPoints, 		// 1. Array
		aNumAllPoints, 		// 2. Array, number of Control Points per Subcurve
		aAllKnots,			// 3. Array
		aNumAllKnots,		// 4. Array
		aIsClosed, 			// 5. Array
		aDegree, 			// 6. Array
		aParameterization, 	// 7. Array
		0) ;				// 8. NurbsFormat: 0 = siSINurbs, 1 = siIGESNurbs
		
	return true;

}


//______________________________________________________________________________

function closeNurbsCurve(aPoints, aKnots, degree)
{
	if(aPoints.length > 8)
	{
	// Curve has more than 2 Points, can be closed.
	
		var tol = 10e-10;
	
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
			// Point array does not change!
			
			// Adapt Knot Vector length: on closed Curves: K = P + 1
			// degree 1: one Knot more
			// degree 2: same length
			// degree 3: one Knot less
			aKnots.length = aPoints.length / 4 + 1;	// /4: x,y,z,w
			
			// Set first Knot(s)
			// degree 1: [0,1,...]
			// degree 2: [-1,0,1,...]
			// degree 3: [-2,-1,0,1,...]
			for(var i = degree - 2; i >= 0; i--)	aKnots[i] = aKnots[i + 1] - 1;
			
			// Set last Knot = 2nd last + 1
			aKnots[aKnots.length - 1] = aKnots[aKnots.length - 2] + 1;

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
	//oLayout.AddGroup("When opening Subcurve:");
	oLayout.AddItem("OpenWithGap", "Open with gap");
	//oLayout.EndGroup();
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


function OpenCloseSubcurves_OpenWithGap_OnChanged( )
{
	Application.LogMessage("OpenCloseSubcurves_OpenWithGap_OnChanged called",siVerbose);
	var oParam;
	oParam = PPG.OpenWithGap;
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


