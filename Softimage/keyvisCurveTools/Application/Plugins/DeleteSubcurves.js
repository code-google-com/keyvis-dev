//______________________________________________________________________________
// DeleteSubcurvesPlugin
// 2009/10 by Eugen Sares
// last update: 2011/02/01
//______________________________________________________________________________

function XSILoadPlugin( in_reg )
{
	in_reg.Author = "Eugen Sares";
	in_reg.Name = "DeleteSubcurvesPlugin";
	in_reg.Major = 1;
	in_reg.Minor = 0;

	in_reg.RegisterOperator("DeleteSubcurves");
	in_reg.RegisterCommand("ApplyDeleteSubcurves","ApplyDeleteSubcurves");
	in_reg.RegisterMenu(siMenuTbModelModifyCurveID,"ApplyDeleteSubcurves_Menu",false,false);	
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


function ApplyDeleteSubcurves_Init( in_ctxt )	// called before ApplyDeleteSubcurves_Execute
{
	Application.LogMessage("ApplyDeleteSubcurves_Init called",siVerbose);
	
	var oCmd;
	oCmd = in_ctxt.Source;	// source object that is the cause of the callback being fired
	oCmd.Description = "Create an instance of DeleteSubcurves operator";
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

function ApplyDeleteSubcurves_Execute(args)
{
	Application.LogMessage("ApplyDeleteSubcurves_Execute called",siVerbose);

	try
	{
		var cSel = args; //Selection;

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


			} else if( cSel(i).Type == "subcrvSubComponent" )
			{
				var oObject = cSel(i).SubComponent.Parent3DObject;
				var aElements = cSel(i).SubComponent.ElementArray.toArray();
				var oCluster = oObject.ActivePrimitive.Geometry.AddCluster( siSubCurveCluster, "Subcurve_AUTO", aElements );
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

		DeselectAllUsingFilter(siSubcomponentFilter); // ("SubCurve");
		DeselectAllUsingFilter(siClusterFilter);


		// Construction mode automatic updating.
		var constructionModeAutoUpdate = GetValue("preferences.modeling.constructionmodeautoupdate");
		if(constructionModeAutoUpdate) SetValue("context.constructionmode", siConstructionModeModeling);

	
		var operationMode = Preferences.GetPreferenceValue( "xsiprivate_unclassified.OperationMode" );
		var bAutoinspect = Preferences.GetPreferenceValue("Interaction.autoinspect");
		
		var createdOperators = new ActiveXObject("XSI.Collection");

		// Apply Operator to all CurveLists a Cluster is on, with respect to Immediate Mode.
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
				var newOp = AddCustomOp("DeleteSubcurves", oOutput, [oInput1, oInput2], "DeleteSubcurves");

				/*				
				var rtn = GetKeyboardState();
				modifier = rtn(1);
				var bCtrlDown = false;
				if(modifier == 2) bCtrlDown = true;

				if(Application.Interactive && bAutoinspect && !bCtrlDown)
					InspectObj(newOp, "", "", siModal, true);
				*/

				// FreezeModeling( [InputObjs], [Time], [PropagationType] )
				FreezeModeling(cCurveLists(i), null, siUnspecified);
				
				//createdOperators.Add(newOp);
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
				//var cleanOp = ApplyTopoOp("CrvClean", cCurveLists(i), 3, siPersistentOperation, null);
				//SetValue(cleanOp + ".cleantol", 0, null);

				var newOp = AddCustomOp("DeleteSubcurves", oOutput, [oInput1, oInput2], "DeleteSubcurves");

				//createdOperators.Add(newOp);
				
			}

		}

		return true;

	} catch(e)
	{
		LogMessage(e, siWarning);
		return false;
	}
	
}


//______________________________________________________________________________

// Use this callback to build a set of parameters that will appear in the property page.
function DeleteSubcurves_Define( in_ctxt )
{
	Application.LogMessage("DeleteSubcurves_Define called",siVerboseMsg);
	
	var oCustomOperator;
	//var oPDef;
	oCustomOperator = in_ctxt.Source;
	oCustomOperator.AlwaysEvaluate = false;
	oCustomOperator.Debug = 0;
	return true;
}


// User data can be stored in the operator context of the Init callback
// and then retrieved later in the Update and Term callbacks.
function DeleteSubcurves_Init( in_ctxt )
{
	Application.LogMessage("DeleteSubcurves_Init called",siVerboseMsg);
	
	//var inputCluster = in_ctxt.GetInputValue("deleteCluster");	// ERROR : 2162 - Port deleteCluster not found

	return true;
}


function DeleteSubcurves_Term( in_ctxt )
{
	Application.LogMessage("DeleteSubcurves_Term called",siVerboseMsg);

	return true;


}


//______________________________________________________________________________

function DeleteSubcurves_Update( in_ctxt )
{
	Application.LogMessage("DeleteSubcurves_Update called",siVerboseMsg);
	
	
	// Get Port connections.
	var outCrvListGeom = in_ctxt.OutputTarget.Geometry;
	var oSubcurveCluster = in_ctxt.GetInputValue(1); // Port 1: "InSubcurve_AUTO"
	var inCrvListGeom = in_ctxt.GetInputValue(0).Geometry; // Port 0: "Incrvlist"
	var cInCurves = inCrvListGeom.Curves;
	var inCurve0Degree = cInCurves(0).Degree;

	var clusterCount = oSubcurveCluster.Elements.Count;

	// Create boolean array which Subcurve to delete.
	var aSel = new Array(cInCurves.Count);
	for(var i = 0; i < cInCurves.Count; i++)
		aSel[i] = false;	// init
	for(var i = 0; i < clusterCount; i++)
		aSel[oSubcurveCluster.Elements(i)] = true;


	var allSubcurvesCnt = 0;
	var aAllPoints = new Array();
	var aAllNumPoints = new Array();
	var aAllKnots = new Array();
	var aAllNumKnots = new Array();
	var aAllIsClosed = new Array();
	var aAllDegree = new Array();
	var aAllParameterization = new Array();

	// Main loop
	if(cInCurves.Count > clusterCount)
	{
		// Not all Subcurves are deleted.
		for(i = 0; i < cInCurves.Count; i++)
		{
			if(aSel[i]) continue;

			// Get NurbsCurve data
			var subcrv = cInCurves.item(i);	// get input Subcurve. Type: NurbsCurve, ClassName: NurbsCurve			
			VBdata = subcrv.Get2(siSINurbs); var data = VBdata.toArray();

			// Get Point data
			var VBdata0 = new VBArray(data[0]); var aPoints = VBdata0.toArray();
			aAllPoints = aAllPoints.concat(aPoints);
			aAllNumPoints[allSubcurvesCnt] = aPoints.length/4;	// x,y,z,weight
			
			// Get Knot data
			var VBdata1 = new VBArray(data[1]); var aKnots = VBdata1.toArray();
			aAllKnots = aAllKnots.concat(aKnots);
			aAllNumKnots[allSubcurvesCnt] = aKnots.length;

			// Get other data
			aAllIsClosed[allSubcurvesCnt] = data[2];
			aAllDegree[allSubcurvesCnt] = data[3];
			aAllParameterization[allSubcurvesCnt] = data[4];
			
			allSubcurvesCnt++;
		}

	} else
	{
		// All Subcurves are deleted.
		// Set the CurveList to the smalles possible,
		// like SICreateCurve( [Name], [Degree], [CurveType] )
		allSubcurvesCnt = 1;

		switch(inCurve0Degree)
		{
			case 1:
				aAllPoints = [0,0,0,1,0,0,0,1];	// x,y,z,weight
				aAllNumPoints = [2];
				aAllKnots = [0,1];
				aAllNumKnots = [2];
				aAllIsClosed = [false];
				aAllDegree = [1];
				aAllParameterization = [siNonUniformParameterization]; // 1
				break;

			case 2:
				aAllPoints = [0,0,0,1,0,0,0,1,0,0,0,1];
				aAllNumPoints = [3];
				aAllKnots = [0,0,1,1];
				aAllNumKnots = [4];
				aAllIsClosed = [false];
				aAllDegree = [2];
				aAllParameterization = [siNonUniformParameterization];
				break;

			default:
				aAllPoints = [0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1];
				aAllNumPoints = [4];
				aAllKnots = [0,0,0,1,1,1];
				aAllNumKnots = [6];
				aAllIsClosed = [false];
				aAllDegree = [3];
				aAllParameterization = [siNonUniformParameterization];
		
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

function ApplyDeleteSubcurves_Menu_Init( in_ctxt )
{
	var oMenu;
	oMenu = in_ctxt.Source;
	oMenu.AddCommandItem("Delete Subcurves","ApplyDeleteSubcurves");
	return true;
}


