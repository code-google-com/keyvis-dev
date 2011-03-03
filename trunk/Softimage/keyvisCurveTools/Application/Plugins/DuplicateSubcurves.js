//______________________________________________________________________________
// DuplicateSubcurvesPlugin
// 2009/11 by Eugen Sares
// last update: 2011/02/18
//______________________________________________________________________________

function XSILoadPlugin( in_reg )
{
	in_reg.Author = "Eugen Sares";
	in_reg.Name = "DuplicateSubcurvesPlugin";
	in_reg.Major = 1;
	in_reg.Minor = 0;

	in_reg.RegisterOperator("DuplicateSubcurves");
	in_reg.RegisterCommand("ApplyDuplicateSubcurves","ApplyDuplicateSubcurves");
	in_reg.RegisterMenu(siMenuTbModelModifyCurveID,"ApplyDuplicateSubcurves_Menu",false,false);
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



function ApplyDuplicateSubcurves_Init( in_ctxt )
{
	var oCmd;
	oCmd = in_ctxt.Source;	// source object that is the cause of the callback being fired
	oCmd.Description = "Create an instance of DuplicateSubcurves operator";
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

function ApplyDuplicateSubcurves_Execute(args)
{
	Application.LogMessage("ApplyDuplicateSubcurves_Execute called",siVerbose);

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
				var cleanOp = ApplyTopoOp("CrvClean", cCurveLists(i), 3, siPersistentOperation, null);
				SetValue(cleanOp + ".cleantol", 0, null);
				
				// Create Operator.
				// Port names will be generated automatically!
				var newOp = AddCustomOp("DuplicateSubcurves", oOutput, [oInput1, oInput2], "DuplicateSubcurves");

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
				// Workaround for unselectable added Subcurves problem.
				var cleanOp = ApplyTopoOp("CrvClean", cCurveLists(i), 3, siPersistentOperation, null);
				SetValue(cleanOp + ".cleantol", 0, null);

				// Create Operator.

				// Method 1: AddCustomOp()
				// Port Groups cannot be defined this way!

				// Define Outputs and Inputs.
				var oOutput1 = cCurveLists(i).ActivePrimitive;
				//var oOutput2 = cSubcurveClusters(i);
				var oInput1 = cCurveLists(i).ActivePrimitive;
				var oInput2 = cSubcurveClusters(i);
				
				var newOp = AddCustomOp("DuplicateSubcurves", oOutput1, [oInput1, oInput2], "DuplicateSubcurves");
				// var newOp = AddCustomOp("DuplicateSubcurves", [oOutput1, oOutput2], [oInput1, oInput2], "DuplicateSubcurves");

/*				// Method 2: adding Ports/Groups manually.

				var newOp = XSIFactory.CreateObject("DuplicateSubcurves");

				// Geometry Port Group
				//var oPortGroup0 = newOp.AddPortGroup("Group_0"); // crvlist in/out
				// Cluster Port Group
				//var oPortGroup1 = newOp.AddPortGroup("Group_1"); // crvlist.cls.Subcurve in/out

				newOp.AddOutputPort(cCurveLists(i).ActivePrimitive); //, "", oPortGroup0.Index);

				// Connecting an Output Port to a Cluster does not work yet - ignored.
				newOp.AddOutputPort(cSubcurveClusters(i)); //, "", oPortGroup1.Index);

				newOp.AddInputPort(cCurveLists(i).ActivePrimitive); //, "", oPortGroup0.Index);
				newOp.AddInputPort(cSubcurveClusters(i)); //, "", oPortGroup1.Index);

				newOp.Connect();
*/
				createdOperators.Add(newOp);
				
			}
			
			if(createdOperators.Count != 0 && bAutoinspect && Application.Interactive)
				AutoInspect(createdOperators); // Multi-PPG

		}
LogMessage("returning from execute callback");
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
function DuplicateSubcurves_Define( in_ctxt )
{
	Application.LogMessage("DuplicateSubcurves_Define called",siVerboseMsg);
	
	var oCustomOperator;
	var oPDef;
	oCustomOperator = in_ctxt.Source;
/*
	oPDef = XSIFactory.CreateParamDef2("DeleteTheseSubcurves",siString,"",null,null);
	oCustomOperator.AddParameter(oPDef);
*/
	oPDef = XSIFactory.CreateParamDef("offsetX",siFloat,siClassifUnknown,siPersistable | siKeyable,"Offset X","",0,null,null,-100,100);
	oCustomOperator.AddParameter(oPDef);
	oPDef = XSIFactory.CreateParamDef("offsetY",siFloat,siClassifUnknown,siPersistable | siKeyable,"Offset Y","",0,null,null,-100,100);
	oCustomOperator.AddParameter(oPDef);
	oPDef = XSIFactory.CreateParamDef("offsetZ",siFloat,siClassifUnknown,siPersistable | siKeyable,"Offset Z","",0,null,null,-100,100);
	oCustomOperator.AddParameter(oPDef);
	//oPDef = XSIFactory.CreateParamDef("duplicates",siInt4,siClassifUnknown,siPersistable | siKeyable,"Duplicates","",1,null,null,0,10);
	//oCustomOperator.AddParameter(oPDef);
	//oPDef = XSIFactory.CreateParamDef("distribution",siInt4,siClassifUnknown,siPersistable | siKeyable,"Incremental/Total","",1,null,null,0,10);
	//oCustomOperator.AddParameter(oPDef);
	
// ToDo: "updateSelectionOnEval" instead of OperatorContext.UserData
// to store if new Subcurves were selected once

	oCustomOperator.AlwaysEvaluate = false;
	oCustomOperator.Debug = 0;	// When the value is not zero Softimage will log extra information about the operator's evaluation.

	return true;
}



// User data can be stored in the operator context of the Init callback
// and then retrieved later in the Update and Term callbacks.
function DuplicateSubcurves_Init( in_ctxt )
{
	Application.LogMessage("DuplicateSubcurves_Init called",siVerboseMsg);
	return true;
}



function DuplicateSubcurves_Term( in_ctxt )
{
	Application.LogMessage("DuplicateSubcurves_Term called",siVerboseMsg);
	// var cluster = in_ctxt.GetInputValue("duplicateClusterPort");	// ERROR : 21000 - Unspecified failure
	// DeleteObj(cluster);
	return true;
}


//______________________________________________________________________________

function DuplicateSubcurves_Update( in_ctxt )
{
	Application.LogMessage("DuplicateSubcurves_Update called",siVerboseMsg);


	// Get Params.
	var offsetX = in_ctxt.GetParameterValue("offsetX");
	var offsetY = in_ctxt.GetParameterValue("offsetY");
	var offsetZ = in_ctxt.GetParameterValue("offsetZ");
	//var duplicates = in_ctxt.GetParameterValue("duplicates");
	//var distribution = in_ctxt.GetParameterValue("distribution");

	// Get input Port connections.
	var inCrvListGeom = in_ctxt.GetInputValue(0).Geometry; // See SDK Explorer for Port Indices.
	var cInCurves = inCrvListGeom.Curves;
	var oSubcurveCluster = in_ctxt.GetInputValue(1);
	
	// Get output Port connections.
	// OutputTarget (OperatorContext):
	// In the case of a multi-output operator the operator is called once per output,
	// and this property will return the currently evaluating target.
	// In this case it may be necessary to also call OperatorContext.OutputPort
	// to determine the name of the current output port, in order to know which output
	// is being evaluated.
	
	// Note: Clusters as output target are unsupported (ignored).
	var oOutTarget = in_ctxt.OutputTarget;
/*LogMessage("in_ctxt.OutputTarget: " + oOutTarget);
	var oOutPort = in_ctxt.OutputPort;
LogMessage("in_ctxt.OutputPort: " + oOutPort);
return;
*/
	var outCrvListGeom = oOutTarget.Geometry;
		

	// Get complete data description of input CurveList.
	var VBdata = inCrvListGeom.Get2( siSINurbs ); var data = VBdata.toArray();

	var numAllSubcurves = data[0];
	var VBdata1 = new VBArray(data[1]); var aAllPoints = VBdata1.toArray();
	var VBdata2 = new VBArray(data[2]); var aAllNumPoints =  VBdata2.toArray();
	var VBdata3 = new VBArray(data[3]); var aAllKnots= VBdata3.toArray();
	aAllKnots = removeUndefinedElementsFromArray(aAllKnots);
	var VBdata4 = new VBArray(data[4]); var aAllNumKnots = VBdata4.toArray();
	var VBdata5 = new VBArray(data[5]); var aAllIsClosed = VBdata5.toArray();
	var VBdata6 = new VBArray(data[6]); var aAllDegree = VBdata6.toArray();
	var VBdata7 = new VBArray(data[7]); var aAllParameterization = VBdata7.toArray();


	// Array to store the indices of new/duplicated Subcurves, for later selection.
	var aNewSubcurves = new Array();
	var oldCount = numAllSubcurves;

	// Create boolean array which Subcurves to duplicate.
	var flagArray = new Array(cInCurves.Count);
	for(var i = 0; i < cInCurves.Count; i++) flagArray[i] = false;	// init
	for(var i = 0; i < oSubcurveCluster.Elements.Count; i++)  flagArray[oSubcurveCluster.Elements(i)] = true;


	// Main loop: add Subcurves to duplicate.

	for(var subCrvIdx = 0; subCrvIdx < cInCurves.Count; subCrvIdx++)
	{
		// Skip all untagged Subcurves.
		if(!flagArray[subCrvIdx]) continue;

		// Get input Subcurve.
		var subCrv = cInCurves.item(subCrvIdx);
		VBdata = new VBArray(subCrv.Get2(siSINurbs));
		var aSubCrvData = VBdata.toArray();

		// Get Point data.
		var VBdata0 = new VBArray(aSubCrvData[0]);
		var aPoints = VBdata0.toArray();

		// Get Knot data.
		var VBdata1 = new VBArray(aSubCrvData[1]);
		var aKnots = VBdata1.toArray();

		for(var n = 0; n < 1; n++) // n < duplicates
		{
			// Add Offset.
			for(var j = 0; j < aPoints.length; j+= 4)
			{
				aPoints[j] = aPoints[j] + offsetX;
				aPoints[j+1] = aPoints[j+1] + offsetY;
				aPoints[j+2] = aPoints[j+2] + offsetZ;
			}

			// Add Subcurve at the array ends.
			aAllPoints = aAllPoints.concat(aPoints);
			aAllNumPoints[numAllSubcurves] = aPoints.length / 4;	//x,y,z,w
			aAllKnots = aAllKnots.concat(aKnots);
			aAllNumKnots[numAllSubcurves] = aKnots.length;
			aAllIsClosed[numAllSubcurves] = aSubCrvData[2];
			aAllDegree[numAllSubcurves] = aSubCrvData[3];
			aAllParameterization[numAllSubcurves] = aSubCrvData[4];

			// For later selection: store the index of this duplicated Subcurve.
			aNewSubcurves = aNewSubcurves.concat(numAllSubcurves);
			numAllSubcurves++;

		}
	}

	// Debug info
/*	LogMessage("New CurveList:");
	LogMessage("numAllSubcurves:      " + numAllSubcurves);
	LogMessage("aAllPoints:           " + aAllPoints);
	LogMessage("aAllPoints.length/4:  " + aAllPoints.length/4);
	LogMessage("aAllNumPoints:        " + aAllNumPoints);
	LogMessage("aAllKnots:            " + aAllKnots);
	LogMessage("aAllKnots.length:     " + aAllKnots.length);
	LogMessage("aAllNumKnots:         " + aAllNumKnots);
	LogMessage("aAllIsClosed:         " + aAllIsClosed);
	LogMessage("aAllDegree:           " + aAllDegree);
	LogMessage("aAllParameterization: " + aAllParameterization);
*/

	// Set output CurveList.
	outCrvListGeom.Set(
		numAllSubcurves,		// 0. number of Subcurves in the Curvelist
		aAllPoints, 			// 1. Array
		aAllNumPoints, 			// 2. Array, number of Control Points per Subcurve
		aAllKnots, 				// 3. Array
		aAllNumKnots, 			// 4. Array
		aAllIsClosed, 			// 5. Array
		aAllDegree, 			// 6. Array
		aAllParameterization, 	// 7. Array
		siSINurbs) ;			// 8. NurbsFormat: 0 = siSINurbs, 1 = siIGESNurbs


	// Add new Subcurves to input Clusters - not yet possible!
	// var oSubComp = oSubcurveCluster.CreateSubComponent();	// ERROR : 2009 - Access denied
	// oSubComp.RemoveElement(...);
	// SIRemoveFromCluster( oSubcurveCluster, oSubComp);
	
	// Select newly created Subcurves, but only when the Op was newly created!
	if(numAllSubcurves > oldCount && in_ctxt.UserData == undefined)
	{
		var oCrvList = in_ctxt.Source.Parent3DObject;
		var selString = oCrvList + ".subcrv[" + oldCount + "-LAST]";
		//var selString = oCrvList + ".subcrv[" + aNewSubcurves + "]" );
		SelectGeometryComponents(selString);
//		ToggleSelection(selString);

		in_ctxt.UserData = true;
	}

	return true;
}


//______________________________________________________________________________

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


function DuplicateSubcurves_DefineLayout( in_ctxt )
{
	var oLayout,oItem;
	oLayout = in_ctxt.Source;
	oLayout.Clear();
	//oLayout.AddRow();
	//oLayout.AddItem("duplicates", "Duplicates");
// ToDo: Radio Button for param "distribution"
	//oLayout.AddGroup("Translation", true);
	oLayout.AddItem("offsetX", "Offset X");
	oLayout.AddItem("offsetY", "Offset Y");
	oLayout.AddItem("offsetZ", "Offset Z");
	//oLayout.EndGroup();
	//oLayout.EndRow();
	return true;
}


function ApplyDuplicateSubcurves_Menu_Init( in_ctxt )
{
	var oMenu;
	oMenu = in_ctxt.Source;
	oMenu.AddCommandItem("Duplicate Subcurves","ApplyDuplicateSubcurves");
	return true;
}


/*function DuplicateSubcurves_offsetX_OnChanged( )
{
	Application.LogMessage("DuplicateSubcurves_offsetX_OnChanged called",siVerbose);
	var oParam;
	oParam = PPG.offsetX;
	var paramVal;
	paramVal = oParam.Value;
	Application.LogMessage("New value: " + paramVal,siVerbose);
}
*/


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
