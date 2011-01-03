//______________________________________________________________________________
// AttachCurvesPlugin
// 11/2010 by Eugen Sares
// last update: 25.11.2010
//
// Credits to Guillaume Laforge for the C++ sourcecode!!
//______________________________________________________________________________

function XSILoadPlugin( in_reg )
{
	in_reg.Author = "Eugen Sare";
	in_reg.Name = "AttachCurvesPlugin";
	in_reg.Major = 1;
	in_reg.Minor = 0;

	in_reg.RegisterOperator("AttachCurves");
	in_reg.RegisterCommand("ApplyAttachCurves","ApplyAttachCurves");
	in_reg.RegisterMenu(siMenuTbModelModifyCurveID,"ApplyAttachCurves_Menu",false,false);
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

function ApplyAttachCurves_Init( in_ctxt )
{
	var oCmd;
	oCmd = in_ctxt.Source;
	oCmd.Description = "Create an instance of AttachCurves operator";
	oCmd.SetFlag(siNoLogging,false);

	// TODO: You may want to add some arguments to this command so that the operator
	// can be applied to objects without depending on their specific names.
	// Tip: the Collection ArgumentHandler is very useful
	
	var oArgs = oCmd.Arguments;
	oArgs.AddWithHandler("args", "Collection");
	
	return true;
}






//______________________________________________________________________________
//______________________________________________________________________________

function ApplyAttachCurves_Execute(args)
{

	Application.LogMessage("ApplyAttachCurves_Execute called",siVerbose);
	// TODO: This generated code works by hardcoding the exact names of the
	// input and output objects.
	// If you want to operator to be applied to objects with different names
	// you way want to generalise this code to determine the objects
	// based on the Selection or the arguments to this command
	// 
	// Note: The AddCustomOp command is an alternative way to build the operator
	
	try
	{
		// ToDo:
		// If just one CurveList is selected, start a Pick Session	
	
		cSel = args;
		if(cSel == "") throw "Select at least 2 Nurbs Curves first.";
		
		//var cSelCurves = args.Filter("crvlist");
		cSelCurves = SIFilter(cSel, siCurveFilter);
		if(!cSelCurves) throw "Selection must be of type Curve.";
		
		var oCurve0 = cSelCurves(0);
		var selCurvesCount = cSelCurves.Count;
		//LogMessage(cSelCurves);
		
		if(selCurvesCount < 2) throw "Nothing to attach.";



		// create Operator
		var newOp = XSIFactory.CreateObject("AttachCurves");


		// OUTPUT Port and Group, Idx: 0
		// first Curve
		// CustomOperator.AddPortGroup( Name, [Min], [Max], [Filter], [PickPrompt], [Flags] )
		var oOutPortGroup = newOp.AddPortGroup("OutPortGroup");
		// CustomOperator.AddOutputPortByClassID( TargetClassID, [PortName], [PortGroup], [Flags] )
		newOp.AddOutputPortByClassID(siNurbsCurveID, "OUTPUT_PORT", oOutPortGroup.Index);
		
		// INPUT Port and Group, Idx: 1
		// Curve0
		var oInCurve0PortGroup = newOp.AddPortGroup("InCurve0PortGroup", 1, 1, "", "", siOptionalInputPort);
		newOp.AddInputPortByClassID(siNurbsCurveID, "IN_CURVE0_PORT", oInCurve0PortGroup.Index, siOptionalInputPort);

		// INPUT Port and Group, Idx: 2
		// all other Curves
		var oInCurvesPortGroup = newOp.AddPortGroup("InCurvesPortGroup", 1, 65535, "", "", siOptionalInputPort);
		newOp.AddInputPortByClassID(siNurbsCurveID, "IN_CURVES_PORT", oInCurvesPortGroup.Index, siOptionalInputPort);

		// INPUT Port and Group for Kine, Idx: 3
		// Curve0
		var oInCurve0KinePortGroup = newOp.AddPortGroup("InCurve0KinePortGroup", 1, 1, "", "", siOptionalInputPort);
		newOp.AddInputPortByClassID(siNurbsCurveID, "IN_CURVE0_KINE_PORT", oInCurve0KinePortGroup.Index, siOptionalInputPort);

		// INPUT Port and Group for Kine, Idx: 4
		// all other Curves
		var oInCurvesKinePortGroup = newOp.AddPortGroup("InCurvesKinePortGroup", 1, 65535, "", "", siOptionalInputPort);
		newOp.AddInputPortByClassID(siNurbsCurveID, "IN_CURVES_KINE_PORT", oInCurvesKinePortGroup.Index, siOptionalInputPort);


		// OUTPUT connection
		// oOutPortGroup
		newOp.ConnectToGroup(oOutPortGroup.Index, oCurve0.ActivePrimitive);

		// INPUT connection
		// oInCurve0PortGroup, oInCurve0KinePortGroup
		newOp.ConnectToGroup(oInCurve0PortGroup.Index, oCurve0.ActivePrimitive);
		newOp.ConnectToGroup(oInCurve0KinePortGroup.Index, oCurve0.Kinematics.Global);

		// INPUT connection
		// oInCurvesPortGroup, oInCurvesKinePortGroup
		for(var i = 1; i < selCurvesCount; i++)
		{
			var oCurve = cSelCurves(i);	// skipping Curve0!
			newOp.ConnectToGroup(oInCurvesPortGroup.Index, oCurve.ActivePrimitive);
			newOp.ConnectToGroup(oInCurvesKinePortGroup.Index, oCurve.Kinematics.Global);
		}
		
		
		// Select only the first Curve
		SelectObj(oCurve0);
		
		InspectObj(newOp);

		return newOp;
		
	} catch(e)
	{
		LogMessage(e, siWarning);
	}
	
}







//______________________________________________________________________________

function AttachCurves_Define( in_ctxt )
{
	var oCustomOperator;
	var oPDef;
	oCustomOperator = in_ctxt.Source;
	oPDef = XSIFactory.CreateParamDef("updateWithInputTransforms",siBool,siClassifUnknown,siPersistable | siKeyable,"","",true,null,null,null,null);
	oCustomOperator.AddParameter(oPDef);
	oPDef = XSIFactory.CreateParamDef("updateWithObjectTransform",siBool,siClassifUnknown,siPersistable | siKeyable,"","",true,null,null,null,null);
	oCustomOperator.AddParameter(oPDef);

	oCustomOperator.AlwaysEvaluate = false;
	oCustomOperator.Debug = 1;
	return true;
}


//______________________________________________________________________________

function AttachCurves_Init( in_ctxt )
{
	Application.LogMessage("AttachCurves_Init called",siVerboseMsg);
	return true;
}


//______________________________________________________________________________

function AttachCurves_Term( in_ctxt )
{
	Application.LogMessage("AttachCurves_Term called",siVerboseMsg);
	return true;
}







//______________________________________________________________________________
//______________________________________________________________________________

function AttachCurves_Update( in_ctxt )
{
	//var input0 = in_ctxt.GetInputValue(0);
	Application.LogMessage("AttachCurves_Update called",siVerboseMsg);

	
	// Get output CurveList target
	var outCrvList0Geom = in_ctxt.OutputTarget.Geometry;

// TODO: show PPG
	//var updateWithInputTransforms = in_ctxt.GetParameterValue("updateWithInputTransforms");
	//var updateWithObjectTransform = in_ctxt.GetParameterValue("updateWithObjectTransform");

	var oAttachOp = in_ctxt.Source;

	// Get input CurveList
	var inCrvList0Geom = in_ctxt.GetInputValue("IN_CURVE0_PORT", "InCurve0PortGroup", 0).Geometry;

// TODO: compensate Curve0 Kine.Global
	var oCurve0Kine = in_ctxt.GetInputValue("IN_CURVE0_KINE_PORT", "InCurve0KinePortGroup", 0);
	var KINEGLOBAL0 = oCurve0Kine.Transform.Matrix4;


	// Loop through all additional Curves, add them to Curve0
	for(var i = 0; i < oAttachOp.GetNumInstancesInGroup( 2 ); i++)	// PortIdx 2: InCurvesPortGroup
	{
		// Get CurveList geometry
		var oCrvList = in_ctxt.GetInputValue("IN_CURVES_PORT", "InCurvesPortGroup", i);
		var oGeomCurve = oCrvList.Geometry;	// Type: NurbsCurveList
		var oCurves = oCrvList.Geometry.Curves;	// Type: NurbsCurve

		// Get CurveLists's kine.global matrix
		var oKine = in_ctxt.GetInputValue("IN_CURVES_KINE_PORT", "InCurvesKinePortGroup", i);
		var KINEGLOBAL = oKine.Transform.Matrix4;
		

		// Loop through all SubCurves of this CurveList,
		// add the data to Curve0
		for(var j = 0; j < oCurves.Count; j++)
		{
			// Get NurbsCurve data
			var oSubCrv = oCurves(j);	// Type: NurbsCurve
			VBdata = new VBArray(oSubCrv.Get2(siSINurbs)); data = VBdata.toArray();

			var subCrvCtrlPoints = data[0];	// can be 1 oder 2 dimensional for AddCurve
// TODO: compensate Curves Kine.Global
			var subCrvKnots = data[1];
			var isClosed = data[2];
			var degree = data[3];
			var parameterization = data[4];

			// Add Subcurve to CurveList 0
			inCrvList0Geom.AddCurve( subCrvCtrlPoints, subCrvKnots, isClosed, degree, parameterization, siSINurbs);
			
		}
		
	}


	// Get inCrvList0Geom (NurbsCurveList)
	var VBdata = inCrvList0Geom.Get2( siSINurbs ); var data = VBdata.toArray();

	var numAllSubcurves = data[0];
	var VBdata1 = new VBArray(data[1]); var aAllPoints = VBdata1.toArray();
// ToDo: compensate Kine.Global
	var VBdata2 = new VBArray(data[2]); var aAllNumPoints =  VBdata2.toArray();
	var VBdata3 = new VBArray(data[3]); var aAllKnots= VBdata3.toArray();
	aAllKnots = removeUndefinedElementsFromArray(aAllKnots);
	var VBdata4 = new VBArray(data[4]); var aAllNumKnots = VBdata4.toArray();
	var VBdata5 = new VBArray(data[5]); var aAllIsClosed = VBdata5.toArray();
	var VBdata6 = new VBArray(data[6]); var aAllDegree = VBdata6.toArray();
	var VBdata7 = new VBArray(data[7]); var aAllParameterization = VBdata7.toArray();
	
	
	// Debug info
/*	LogMessage("--------------------------------------");
	LogMessage("New CurveList:");
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


	// Set output CurveList
	outCrvList0Geom.Set(
		numAllSubcurves,		// 0. number of Subcurves in the Curvelist
		aAllPoints, 			// 1. Array
		aAllNumPoints, 			// 2. Array, number of Control Points per Subcurve
		aAllKnots, 				// 3. Array
		aAllNumKnots, 			// 4. Array
		aAllIsClosed, 			// 5. Array
		aAllDegree, 			// 6. Array
		aAllParameterization, 	// 7. Array
		siSINurbs) ;			// 8. NurbsFormat: 0 = siSINurbs, 1 = siIGESNurbs

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


//______________________________________________________________________________
// Function to remove empty items from a JScript Array
// e.g. NurbsCurveList.Get2 returns "dirty" Knot Arrays
function cleanArray(dirtyArr)
{
	var arr = new Array();
	for(var i = 0; i < dirtyArr.length; i++)
	{
		if(dirtyArr[i] != undefined) arr.push( dirtyArr[i] );
	}
	return arr;
}


//______________________________________________________________________________
// Tip: Use the "Refresh" option on the Property Page context menu to 
// reload your script changes and re-execute the DefineLayout callback.
function AttachCurves_DefineLayout( in_ctxt )
{
	var oLayout,oItem;
	oLayout = in_ctxt.Source;
	oLayout.Clear();
	oLayout.AddItem("updateWithInputTransforms");
	oLayout.AddItem("updateWithObjectTransform");
	return true;
}


//______________________________________________________________________________

function AttachCurves_OnInit( )
{
	Application.LogMessage("AttachCurves_OnInit called",siVerbose);
}


//______________________________________________________________________________

function AttachCurves_OnClosed( )
{
	Application.LogMessage("AttachCurves_OnClosed called",siVerbose);
}


//______________________________________________________________________________

function AttachCurves_updateWithInputTransforms_OnChanged( )
{
	Application.LogMessage("AttachCurves_updateWithInputTransforms_OnChanged called",siVerbose);
	var oParam;
	oParam = PPG.updateWithInputTransforms;
	var paramVal;
	paramVal = oParam.Value;
	Application.LogMessage("New value: " + paramVal,siVerbose);
}


//______________________________________________________________________________

function AttachCurves_updateWithObjectTransform_OnChanged( )
{
	Application.LogMessage("AttachCurves_updateWithObjectTransform_OnChanged called",siVerbose);
	var oParam;
	oParam = PPG.updateWithObjectTransform;
	var paramVal;
	paramVal = oParam.Value;
	Application.LogMessage("New value: " + paramVal,siVerbose);
}


//______________________________________________________________________________

function ApplyAttachCurves_Menu_Init( in_ctxt )
{
	var oMenu;
	oMenu = in_ctxt.Source;
	oMenu.AddCommandItem("Attach Curves","ApplyAttachCurves");
	return true;
}

//______________________________________________________________________________
