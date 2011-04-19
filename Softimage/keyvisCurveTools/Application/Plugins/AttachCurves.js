//______________________________________________________________________________
// AttachCurvesPlugin
// 11/2010 by Eugen Sares
// last update: 03.02.2011
//
// Thanks to Guillaume Laforge for the C++ sourcecode!!
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



function XSIUnloadPlugin( in_reg )
{
	var strPluginName;
	strPluginName = in_reg.Name;
	Application.LogMessage(strPluginName + " has been unloaded.",siVerbose);
	return true;
}



function ApplyAttachCurves_Init( in_ctxt )
{
	var oCmd;
	oCmd = in_ctxt.Source;
	oCmd.Description = "Create an instance of AttachCurves operator";
	oCmd.SetFlag(siNoLogging,false);
	
	var oArgs = oCmd.Arguments;
	oArgs.AddWithHandler("args", "Collection");
	
	return true;
}


//______________________________________________________________________________

function ApplyAttachCurves_Execute(args)
{
	Application.LogMessage("ApplyAttachCurves_Execute called",siVerbose);
	
	try
	{	
		cSel = args;
		if(cSel == "") throw "Select a Nurbs Curve first.";
		
		//var cCurveLists = args.Filter("crvlist");
		var cCurveLists = SIFilter(cSel, siCurveFilter);
		if(!cCurveLists) throw "Selection must be of type Curve.";
		
		var oCurve0 = cCurveLists(0);

		if(cCurveLists.Count < 2)
		{
			do
			{
				// PickObject( LeftMessage, MiddleMessage, [PickedElement], [ButtonPressed], [ModifierPressed] )
				var ret = PickObject("NurbsCurveList Object");
				var buttonChoice = ret.Value( "ButtonPressed" );
				var oItem = ret.Value( "PickedElement" );

				if(buttonChoice == 0) break;
				else if(oItem.Type == "crvlist")
				{
					cCurveLists.Add(oItem);
					Selection.Add(oItem);
				}
					
			} while(true);

		}

		// No additional Curves picked? Cancel.
		if(cCurveLists.Count < 2) throw("Cancelled.");


		// Workaround for unselectable added Subcurves problem.
		var cleanOp = ApplyTopoOp("CrvClean", cCurveLists(0), 3, siPersistentOperation, null);
		SetValue(cleanOp + ".cleantol", 0, null);


		// Create Operator
		var newOp = XSIFactory.CreateObject("AttachCurves");


		// OUTPUT Port and Group, GroupIdx: 0
		// first Curve
		// CustomOperator.AddPortGroup( Name, [Min], [Max], [Filter], [PickPrompt], [Flags] )
		var oOutPortGroup = newOp.AddPortGroup("OutPortGroup");
		// CustomOperator.AddOutputPortByClassID( TargetClassID, [PortName], [PortGroup], [Flags] )
		newOp.AddOutputPortByClassID(siNurbsCurveID, "OUTPUT_PORT", oOutPortGroup.Index);
		
		// INPUT Port and Group, GroupIdx: 1
		// Curve0
		var oInCurve0PortGroup = newOp.AddPortGroup("InCurve0PortGroup", 1, 1, "", "", siOptionalInputPort);
		newOp.AddInputPortByClassID(siNurbsCurveID, "IN_CURVE0_PORT", oInCurve0PortGroup.Index, siOptionalInputPort);

		// INPUT Port and Group, GroupIdx: 2
		// all other Curves
		var oInCurvesPortGroup = newOp.AddPortGroup("InCurvesPortGroup", 1, 65535, "", "", siOptionalInputPort);
		newOp.AddInputPortByClassID(siNurbsCurveID, "IN_CURVES_PORT", oInCurvesPortGroup.Index, siOptionalInputPort);

		// INPUT Port and Group for Kine, GroupIdx: 3
		// Curve0
		var oInCurve0KinePortGroup = newOp.AddPortGroup("InCurve0KinePortGroup", 1, 1, "", "", siOptionalInputPort);
		newOp.AddInputPortByClassID(siNurbsCurveID, "IN_CURVE0_KINE_PORT", oInCurve0KinePortGroup.Index, siOptionalInputPort);

		// INPUT Port and Group for Kine, GroupIdx: 4
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
		for(var i = 1; i < cCurveLists.Count; i++)
		{
			var oCurve = cCurveLists(i);	// skipping Curve0!
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
	oCustomOperator.Debug = 0;
	return true;
}


function AttachCurves_Init( in_ctxt )
{
	Application.LogMessage("AttachCurves_Init called",siVerboseMsg);
	return true;
}


function AttachCurves_Term( in_ctxt )
{
	Application.LogMessage("AttachCurves_Term called",siVerboseMsg);
	return true;
}


//______________________________________________________________________________

function AttachCurves_Update( in_ctxt )
{
	//var input0 = in_ctxt.GetInputValue(0);
	Application.LogMessage("AttachCurves_Update called",siVerboseMsg);

	
	// Get output CurveList target
	var outCrvList0Geom = in_ctxt.OutputTarget.Geometry;

	var updateWithInputTransforms = in_ctxt.GetParameterValue("updateWithInputTransforms");
	var updateWithObjectTransform = in_ctxt.GetParameterValue("updateWithObjectTransform");

	var oAttachOp = in_ctxt.Source;

	// Get input CurveList
	var inCrvList0Geom = in_ctxt.GetInputValue("IN_CURVE0_PORT", "InCurve0PortGroup", 0).Geometry;

// TODO: compensate Curve0 Kine.Global
	var oCurve0Kine = in_ctxt.GetInputValue("IN_CURVE0_KINE_PORT", "InCurve0KinePortGroup", 0);
	var KINEGLOBAL0 = oCurve0Kine.Transform.Matrix4;
	KINEGLOBAL0.Invert(KINEGLOBAL0);


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


		// Loop through all SubCurves of this CurveList, add the data to Curve0
		for(var j = 0; j < oCurves.Count; j++)
		{
			// Get NurbsCurve data
			var oSubCrv = oCurves(j);	// Type: NurbsCurve
			VBdata = new VBArray(oSubCrv.Get2(siSINurbs)); aSubCrvData = VBdata.toArray();

			// Get Point data
			var aPoints = aSubCrvData[0];	// can be 1 oder 2 dimensional for AddCurve
			
			if(updateWithInputTransforms || updateWithObjectTransform)
			{
				var VBdata0 = new VBArray(aPoints);
				var aPoints = VBdata0.toArray();

				for(var k = 0; k < aPoints.length; k += 4)
				{
					var vec = XSIMath.CreateVector3();
					vec.X = aPoints[k];
					vec.Y = aPoints[k + 1];
					vec.Z = aPoints[k + 2];

					if(updateWithInputTransforms)
						vec.MulByMatrix4(vec, KINEGLOBAL);

					if(updateWithObjectTransform)
						vec.MulByMatrix4(vec, KINEGLOBAL0);
					
					aPoints[k] = vec.X;
					aPoints[k + 1] = vec.Y;
					aPoints[k + 2] = vec.Z;

				}
			}
			
			// Add Subcurve to CurveList0
			inCrvList0Geom.AddCurve(	aPoints,
										aSubCrvData[1], // Knots
										aSubCrvData[2], // isClosed
										aSubCrvData[3], // degree
										aSubCrvData[4]); // parameterization

		}
		
	}

	// Get inCrvList0Geom (NurbsCurveList)
	var VBdata = inCrvList0Geom.Get2( siSINurbs ); var data = VBdata.toArray();

	var allSubcurvesCnt = data[0];
	var VBdata1 = new VBArray(data[1]); var aAllPoints = VBdata1.toArray();
	var VBdata2 = new VBArray(data[2]); var aAllNumPoints =  VBdata2.toArray();
	var VBdata3 = new VBArray(data[3]); var aAllKnots= VBdata3.toArray();
	aAllKnots = removeUndefinedElementsFromArray(aAllKnots);
	var VBdata4 = new VBArray(data[4]); var aAllNumKnots = VBdata4.toArray();
	var VBdata5 = new VBArray(data[5]); var aAllIsClosed = VBdata5.toArray();
	var VBdata6 = new VBArray(data[6]); var aAllDegree = VBdata6.toArray();
	var VBdata7 = new VBArray(data[7]); var aAllParameterization = VBdata7.toArray();


	outCrvList0Geom.Set(
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


// Tip: Use the "Refresh" option on the Property Page context menu to 
// reload your script changes and re-execute the DefineLayout callback.
function AttachCurves_DefineLayout( in_ctxt )
{
	var oLayout,oItem;
	oLayout = in_ctxt.Source;
	oLayout.Clear();
	//oLayout.AddRow();
	oLayout.AddGroup( "Inputs", true);
	oLayout.AddButton("HideUnhide", "Hide/Unhide");
	oLayout.AddButton("Delete");
	oLayout.AddItem("updateWithInputTransforms", "Update with input transforms");
	oLayout.AddItem("updateWithObjectTransform", "Update with object transform");
	oLayout.EndGroup();
	//var text = "\nNote: Clusters/Cluster Properties are ignored\ndue to SDK limitations.";
	//oLayout.AddStaticText( text );
	//oLayout.EndRow();
	return true;
}

/*
function AttachCurves_OnInit( )
{
	Application.LogMessage("AttachCurves_OnInit called",siVerbose);
}


function AttachCurves_OnClosed( )
{
	Application.LogMessage("AttachCurves_OnClosed called",siVerbose);
}


function AttachCurves_updateWithInputTransforms_OnChanged( )
{
	Application.LogMessage("AttachCurves_updateWithInputTransforms_OnChanged called",siVerbose);
	var oParam;
	oParam = PPG.updateWithInputTransforms;
	var paramVal;
	paramVal = oParam.Value;
	Application.LogMessage("New value: " + paramVal,siVerbose);
}


function AttachCurves_updateWithObjectTransform_OnChanged( )
{
	Application.LogMessage("AttachCurves_updateWithObjectTransform_OnChanged called",siVerbose);
	var oParam;
	oParam = PPG.updateWithObjectTransform;
	var paramVal;
	paramVal = oParam.Value;
	Application.LogMessage("New value: " + paramVal,siVerbose);
}
*/

function AttachCurves_HideUnhide_OnClicked( )
{
	Application.LogMessage("AttachCurves_Hide/Unhide_OnClicked called",siVerbose);

	var op = PPG.Inspected.Item(0);

	var cInputCurves = new ActiveXObject("XSI.Collection");
	for( var i = 0; i < op.PortGroups(2).InstanceCount; i++)
	{
		var port = op.PortAt( 0, 2, i ); // PortIndex, PortGroupIndex, PortGroupInstance
		var oCrvList = port.Target2.Parent;
		ToggleVisibility(oCrvList, null, null);
	}
	
	
}


function AttachCurves_Delete_OnClicked( )
{
	Application.LogMessage("AttachCurves_Delete_OnClicked called",siVerbose);

	var op = PPG.Inspected.Item(0);

	var cInputCurves = new ActiveXObject("XSI.Collection");
	for( var i = 0; i < op.PortGroups(2).InstanceCount; i++)
	{
		var port = op.PortAt( 0, 2, i ); // PortIndex, PortGroupIndex, PortGroupInstance
		var oCrvList = port.Target2.Parent;
		cInputCurves.Add(oCrvList);
	}

	FreezeModeling(op, null, siUnspecified);
	PPG.Close();
	DeleteObj(cInputCurves);

}


function ApplyAttachCurves_Menu_Init( in_ctxt )
{
	var oMenu;
	oMenu = in_ctxt.Source;
	oMenu.AddCommandItem("Attach Curves","ApplyAttachCurves");
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
		LogMessage( "[" + i/4 + "]: x = " + Math.round(x*dp)/dp + "; y = " + Math.round(y*dp)/dp + "; z = " + Math.round(z*dp)/dp ); // + "; w = " + Math.round(w*dp)/dp );

	}

}
*/
