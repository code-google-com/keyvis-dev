// BoxOpPlugin
// 2010.04 by Eugen Sares
// www.keyvis.at
// last revision: 2010.04.28
//
// Creates a Box "Primitive" by applying a Custom Topology Operator to an empty Polygon Mesh.
//
// Params:
// Length, Width, Height

function XSILoadPlugin( in_reg )
{
	in_reg.Author = "Eugen Sares";
	in_reg.Name = "BoxOpPlugin";
	in_reg.Major = 1;
	in_reg.Minor = 0;

	in_reg.RegisterOperator("BoxOp");
	in_reg.RegisterCommand("ApplyBoxOp","ApplyBoxOp");
	//RegistrationInsertionPoint - do not remove this line
	in_reg.RegisterMenu(siMenuAnchorPoints.siMenuTbGetPrimitivePolygonMeshID,'Box_Menu', false, true)

	return true;
}


/////////////////////////////////////////////////////////////////////////////////////////////////////
function XSIUnloadPlugin( in_reg )
{
	var strPluginName;
	strPluginName = in_reg.Name;
	Application.LogMessage(strPluginName + " has been unloaded.",siVerbose);
	return true;
}


/////////////////////////////////////////////////////////////////////////////////////////////////////
function ApplyBoxOp_Init( in_ctxt )
{
	var oCmd;
	oCmd = in_ctxt.Source;
	oCmd.Description = "Create an instance of BoxOp operator";
	oCmd.SetFlag(siNoLogging,false);

	// TODO: You may want to add some arguments to this command so that the operator
	// can be applied to objects without depending on their specific names.
	// Tip: the Collection ArgumentHandler is very useful
	return true;
}


/////////////////////////////////////////////////////////////////////////////////////////////////////
function ApplyBoxOp_Execute(  )
{

	Application.LogMessage("ApplyBox_Execute called",siVerbose);

	var oRoot = Application.ActiveSceneRoot;
	oBox = oRoot.AddPolygonMesh();
	oBox.Name = "box";
	

	var newOp = XSIFactory.CreateObject("BoxOp");
	//newOp.AddOutputPort("Box");
	newOp.AddOutputPort(oBox.ActivePrimitive, "outputGeom");
	newOp.Connect();
	
	SelectObj(oBox);
	InspectObj(newOp);
	return newOp;
}


/////////////////////////////////////////////////////////////////////////////////////////////////////
function BoxOp_Define( in_ctxt )
{
	var oCustomOperator;
	var oPDef;
	oCustomOperator = in_ctxt.Source;
	
	// CreateParamDef Params:
	// ScriptName, Type, [Classification], [Capabilities], [Name], [Description], [DefaultValue], [Min], [Max], [SuggestedMin], [SuggestedMax]
	oPDef = XSIFactory.CreateParamDef("Length",siDouble,siClassifUnknown,siPersistable | siKeyable,"","",1,-1E+100,1E+100,-10,10);
	oCustomOperator.AddParameter(oPDef);
	oPDef = XSIFactory.CreateParamDef("Width",siDouble,siClassifUnknown,siPersistable | siKeyable,"","",1,-1E+100,1E+100,-10,10);
	oCustomOperator.AddParameter(oPDef);
	oPDef = XSIFactory.CreateParamDef("Height",siDouble,siClassifUnknown,siPersistable | siKeyable,"","",1,-1E+100,1E+100,-10,10);
	oCustomOperator.AddParameter(oPDef);

	oCustomOperator.AlwaysEvaluate = false;
	oCustomOperator.Debug = 1;
	return true;
}


/////////////////////////////////////////////////////////////////////////////////////////////////////
function BoxOp_Init( in_ctxt )
{
	Application.LogMessage("Box_Init called",siVerboseMsg);
	return true;
}


/////////////////////////////////////////////////////////////////////////////////////////////////////
function BoxOp_Term( in_ctxt )
{
	Application.LogMessage("Box_Term called",siVerboseMsg);
	return true;
}


/////////////////////////////////////////////////////////////////////////////////////////////////////
function BoxOp_Update( in_ctxt )
{

	var Length = in_ctxt.GetParameterValue("Length");
	var LengthNeg = 0;
	var Width = in_ctxt.GetParameterValue("Width");
	var WidthNeg = 0;
	var Height = in_ctxt.GetParameterValue("Height");
	var HeightNeg = 0;
	

	Application.LogMessage("Box_Update called",siVerboseMsg);

	output = in_ctxt.OutputTarget;
	var geomOut = output.Geometry;
	//var vbArgs = new VBArray(geomOut.Get2());
	
	if(Length < 0)	{ LengthNeg = Length;	Length = 0; }
	if(Width < 0)	{ WidthNeg = Width;		Width = 0; }
	if(Height < 0)	{ HeightNeg = Height;	Height = 0; }

	// create Vertex data
	//var aVertices = new Array(0,0,0, 1,0,0, 0,1,0, 1,1,0, 0,0,1, 1,0,1, 0,1,1, 1,1,1);
	var aVertices = new Array();
	aVertices.push(LengthNeg); 		aVertices.push(HeightNeg); 	aVertices.push(WidthNeg);	// 0
	aVertices.push(Length); 		aVertices.push(HeightNeg); 	aVertices.push(WidthNeg);	// 1
	aVertices.push(LengthNeg); 		aVertices.push(Height); 	aVertices.push(WidthNeg);	// 2
	aVertices.push(Length); 		aVertices.push(Height); 	aVertices.push(WidthNeg);	// 3
	aVertices.push(LengthNeg); 		aVertices.push(HeightNeg); 	aVertices.push(Width);		// 4
	aVertices.push(Length); 		aVertices.push(HeightNeg); 	aVertices.push(Width);		// 5
	aVertices.push(LengthNeg); 		aVertices.push(Height); 	aVertices.push(Width);		// 6
	aVertices.push(Length); 		aVertices.push(Height); 	aVertices.push(Width);		// 7
	
	// create Polygon data
	var aPolygons = new Array(4,0,2,3,1, 4,0,1,5,4, 4,0,4,6,2, 4,1,3,7,5, 4,2,6,7,3, 4,4,5,7,6);
	
	// write out polymsh data
	geomOut.Set(aVertices, aPolygons);
	return true;
}


/////////////////////////////////////////////////////////////////////////////////////////////////////
function BoxOp_DefineLayout( in_ctxt )
{
	var oLayout,oItem;
	oLayout = in_ctxt.Source;
	oLayout.Clear();
	oLayout.AddItem("Length");
	oLayout.AddItem("Width");
	oLayout.AddItem("Height");
	return true;
}


/////////////////////////////////////////////////////////////////////////////////////////////////////
function BoxOp_OnInit( )
{
	Application.LogMessage("Box_OnInit called",siVerbose);
}


/////////////////////////////////////////////////////////////////////////////////////////////////////
function BoxOp_OnClosed( )
{
	Application.LogMessage("Box_OnClosed called",siVerbose);
}


/////////////////////////////////////////////////////////////////////////////////////////////////////
function BoxOp_Length_OnChanged( )
{
	Application.LogMessage("Box_Length_OnChanged called",siVerbose);
	var oParam;
	oParam = PPG.Length;
	var paramVal;
	paramVal = oParam.Value;
	Application.LogMessage("New value: " + paramVal,siVerbose);
}


/////////////////////////////////////////////////////////////////////////////////////////////////////
function BoxOp_Width_OnChanged( )
{
	Application.LogMessage("Box_Width_OnChanged called",siVerbose);
	var oParam;
	oParam = PPG.Width;
	var paramVal;
	paramVal = oParam.Value;
	Application.LogMessage("New value: " + paramVal,siVerbose);
}


/////////////////////////////////////////////////////////////////////////////////////////////////////
function BoxOp_Height_OnChanged( )
{
	Application.LogMessage("Box_Height_OnChanged called",siVerbose);
	var oParam;
	oParam = PPG.Height;
	var paramVal;
	paramVal = oParam.Value;
	Application.LogMessage("New value: " + paramVal,siVerbose);
}


/////////////////////////////////////////////////////////////////////////////////////////////////////
function Box_Menu_Init( in_ctxt )
{
	oMenu = in_ctxt.Source;
    oMenu.AddCommandItem("Box","ApplyBoxOp");
    return true;
}
