//______________________________________________________________________________
// DeleteSubcurvesPlugin
// 10/2009 by Eugen Sares
// last update: 2011/02/01
//
// Usage:
// - Select Subcurves
// - Model > Modify > Curve > DeleteSubcurves
//______________________________________________________________________________

function XSILoadPlugin( in_reg )
{
	in_reg.Author = "Eugen";
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

	// TODO: You may want to add some arguments to this command so that the operator
	// can be applied to objects without depending on their specific names.
	// Tip: the Collection ArgumentHandler is very useful

	var oArgs = oCmd.Arguments;
	// To get a collection of subcomponents, or the current selection of subcomponents: 
	oArgs.AddWithHandler("data", "Collection");
	
	return true;
}


//______________________________________________________________________________

function ApplyDeleteSubcurves_Execute(data)
{
	Application.LogMessage("ApplyDeleteSubcurves_Execute called",siVerbose);

	try
	{
		//var app = Application;

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


		DeselectAllUsingFilter("SubCurve");

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
function DeleteSubcurves_Define( in_ctxt )
{
	Application.LogMessage("DeleteSubcurves_Define called",siVerboseMsg);
	
	var oCustomOperator;
	//var oPDef;
	oCustomOperator = in_ctxt.Source;
/*
	oPDef = XSIFactory.CreateParamDef2("DeleteTheseSubcurves",siString,"",null,null);
	oCustomOperator.AddParameter(oPDef);
*/
	oCustomOperator.AlwaysEvaluate = false;
	oCustomOperator.Debug = 1;
	return true;
}


//______________________________________________________________________________

// User data can be stored in the operator context of the Init callback
// and then retrieved later in the Update and Term callbacks.
function DeleteSubcurves_Init( in_ctxt )
{
	Application.LogMessage("DeleteSubcurves_Init called",siVerboseMsg);
	
	//var inputCluster = in_ctxt.GetInputValue("deleteCluster");	// ERROR : 2162 - Port deleteCluster not found

	return true;
}


//______________________________________________________________________________

function DeleteSubcurves_Term( in_ctxt )
{
	Application.LogMessage("DeleteSubcurves_Term called",siVerboseMsg);

	return true;


}


//______________________________________________________________________________
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
	var flagArray = new Array(cInCurves.Count);
	for(var i = 0; i < cInCurves.Count; i++) flagArray[i] = false;	// init
	for(var i = 0; i < clusterCount; i++)  flagArray[oSubcurveCluster.Elements(i)] = true;


	var numAllSubcurves = 0;
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
	// When not all Subcurves have to be deleted:
		for(i = 0; i < cInCurves.Count; i++)
		{
			if(flagArray[i]) continue;

			// Get NurbsCurve data
			var subcrv = cInCurves.item(i);	// get input Subcurve. Type: NurbsCurve, ClassName: NurbsCurve			
			VBdata = subcrv.Get2(siSINurbs); var data = VBdata.toArray();

			// Get Point data
			var VBdata0 = new VBArray(data[0]); var aPoints = VBdata0.toArray();
			aAllPoints = aAllPoints.concat(aPoints);
			aAllNumPoints[numAllSubcurves] = aPoints.length/4;	// x,y,z,weight
			
			// Get Knot data
			var VBdata1 = new VBArray(data[1]); var aKnots = VBdata1.toArray();
			aAllKnots = aAllKnots.concat(aKnots);
			aAllNumKnots[numAllSubcurves] = aKnots.length;

			// Get other data
			aAllIsClosed[numAllSubcurves] = data[2];
			aAllDegree[numAllSubcurves] = data[3];
			aAllParameterization[numAllSubcurves] = data[4];
			
			numAllSubcurves++;
		}

	} else
	{
	// When all Subcurves are deleted, set the CurveList to the smallest possible.
	// Same as: var oEmpty = SICreateCurve("emptyCurve", degree, 1);
		numAllSubcurves = 1;

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


	// overwrite the existing CurveList
	outCrvListGeom.Set(
		numAllSubcurves,		// 0. number of Subcurves in the Curvelist
		aAllPoints, 			// 1. Array
		aAllNumPoints, 			// 2. Array, number of Control Points per Subcurve
		aAllKnots, 				// 3. Array
		aAllNumKnots, 			// 4. Array
		aAllIsClosed, 			// 5. Array
		aAllDegree, 			// 6. Array
		aAllParameterization, 	// 7. Array
		siSINurbs) ;		// 8. NurbsFormat: 0 = siSINurbs, 1 = siIGESNurbs

	
	// Update Clusters
	// var oSubComp = oSubcurveCluster.CreateSubComponent();	// ERROR : 2009 - Access denied
	// oSubComp.RemoveElement(...);
	// SIRemoveFromCluster( oSubcurveCluster, oSubComp);

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


//______________________________________________________________________________
