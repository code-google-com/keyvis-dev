//______________________________________________________________________________
// MergeSubcurvesPlugin
// 10/2010 by Eugen Sares
// 
//______________________________________________________________________________

function XSILoadPlugin( in_reg )
{
	in_reg.Author = "Gene";
	in_reg.Name = "MergeSubcurvesPlugin";
	in_reg.Major = 1;
	in_reg.Minor = 0;

	in_reg.RegisterOperator("MergeSubcurves");
	in_reg.RegisterCommand("ApplyMergeSubcurves","ApplyMergeSubcurves");
	in_reg.RegisterMenu(siMenuTbModelModifyCurveID,"ApplyMergeSubcurves_Menu",false,false);
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

function ApplyMergeSubcurves_Init( in_ctxt )
{
	var oCmd;
	oCmd = in_ctxt.Source;
	oCmd.Description = "Create an instance of MergeSubcurves operator";
	oCmd.SetFlag(siNoLogging,false);

	// TODO: You may want to add some arguments to this command so that the operator
	// can be applied to objects without depending on their specific names.
	// Tip: the Collection ArgumentHandler is very useful
	
	var oArgs = oCmd.Arguments;
	// To get a collection of subcomponents, or the current selection of subcomponents: 
	oArgs.AddWithHandler("args", "Collection");	// ArgumentName, ArgumentHandler, DefaultValue
	
	return true;
}




//______________________________________________________________________________

function ApplyMergeSubcurves_Execute( args )
{

	Application.LogMessage("ApplyMergeSubcurves_Execute called",siVerbose);
	// TODO: This generated code works by hardcoding the exact names of the
	// input and output objects.
	// If you want to operator to be applied to objects with different names
	// you way want to generalise this code to determine the objects
	// based on the Selection or the arguments to this command
	// 
	// Note: The AddCustomOp command is an alternative way to build the operator

	do{
		if(args(0) == null || args(0).Type != "crvbndrySubComponent") break;
		
		
		var oCrvListObj = args(0).SubComponent.Parent3DObject;
		var oCrvList = oCrvListObj.ActivePrimitive.Geometry;

		// get the Array of selected Curve Boundaries
		//var aCrvBndIndices = Selection(0).SubComponent.ElementArray.toArray();
		var oSubComponent = Selection(0).SubComponent;
//LogMessage(oSubComponent.Count);
//LogMessage("ok1");

		// TODO:
		// check if Subcurves to be connected have the same degree
		// raise it if necessary. Only the whole CurveList can be raised!
		
		
		// create the Curve Boundary Cluster
		var oCluster = oSubComponent.CreateCluster("MergeSubCrvBndrys");
		//var oCluster = oCrvList.AddCluster( siBoundaryCluster, "MergeCurveBoundaries", aCrvBndIndices);	// Type, [Name], [Indices]
// logCluster(oCluster);


		// create the Operator
		var newOp = XSIFactory.CreateObject("MergeSubcurves");	// known to the system through XSILoadPlugin callback
		// DisconnectKnots_Init and
		// DisconnectKnots_Define are called...

		// connect the ports
		newOp.AddOutputPort(oCrvListObj.ActivePrimitive, "outputCurve");
		newOp.AddInputPort(oCrvListObj.ActivePrimitive, "inputCurve");
		newOp.AddInputPort(oCluster, "mergeCluster");	// params: PortTarget, [PortName]
		
		newOp.Connect();
		return newOp;
	
	} while(true);
	LogMessage("Please select at least 2 Curve Boundaries first.", siError);
}

//______________________________________________________________________________

function logCluster(oCluster)	// OK
{
	LogMessage("Cluster.Name: " + oCluster.Name);
	LogMessage("Cluster.Type: " + oCluster.Type);
	for(var i = 0; i < oCluster.Elements.Count; i++)
	{
		oElement = oCluster.Elements(i);
		LogMessage("i = " + i + ": " + oElement);
	}
}

//______________________________________________________________________________

function MergeSubcurves_Define( in_ctxt )
{
	var oCustomOperator;
	var oPDef;
	oCustomOperator = in_ctxt.Source;
	oPDef = XSIFactory.CreateParamDef("cont",siInt4,siClassifUnknown,siPersistable | siKeyable,"","",0,0,2,0,3);
	oCustomOperator.AddParameter(oPDef);
	oPDef = XSIFactory.CreateParamDef("seam",siInt4,siClassifUnknown,siPersistable | siKeyable,"","",0,0,3,0,3);
	oCustomOperator.AddParameter(oPDef);
	oPDef = XSIFactory.CreateParamDef("modifytan",siInt4,siClassifUnknown,siPersistable | siKeyable,"","",0,0,3,0,3);
	oCustomOperator.AddParameter(oPDef);
	oPDef = XSIFactory.CreateParamDef("weldradius",siDouble,siClassifUnknown,siPersistable | siKeyable,"","",1,0,100000,0,100000);
	oCustomOperator.AddParameter(oPDef);

	oCustomOperator.AlwaysEvaluate = false;
	oCustomOperator.Debug = 1;
	return true;
}

//______________________________________________________________________________

function MergeSubcurves_Init( in_ctxt )
{
	Application.LogMessage("MergeSubcurves_Init called",siVerboseMsg);
	return true;
}

//______________________________________________________________________________

function MergeSubcurves_Term( in_ctxt )
{
	Application.LogMessage("MergeSubcurves_Term called",siVerboseMsg);
	return true;
}

//______________________________________________________________________________

function MergeSubcurves_Update( in_ctxt )
{
	var input0 = in_ctxt.GetInputValue(0);

	var cont = in_ctxt.GetParameterValue("cont");
	var seam = in_ctxt.GetParameterValue("seam");
	var modifytan = in_ctxt.GetParameterValue("modifytan");
	var weldradius = in_ctxt.GetParameterValue("weldradius");

	Application.LogMessage("MergeSubcurves_Update called",siVerboseMsg);

	var geomOut = in_ctxt.OutputTarget.Geometry;	// Type: NurbsCurveCollection, ClassName: ""
	
	var oMergeCluster = in_ctxt.GetInputValue("mergeCluster");

	var inputCrvColl = in_ctxt.GetInputValue("inputCurve").Geometry.Curves;

// create empty arrays to hold the new CurveList data
// http://softimage.wiki.softimage.com/index.php/Creating_a_merge_curve_SCOP

	var numSubcurves = 0;
	var aAllPoints = new Array();
	var aAllNumPoints = new Array();
	var aAllKnots = new Array();
	var aAllNumKnots = new Array();
	var aAllIsClosed = new Array();
	var aAllDegree = new Array();
	var aAllParameterization = new Array();


	// tip: the SubCrv index can be derived from the Bndry index:
	// Bndry 0,1: SubCrv 0
	// Bndry 2,3: Subcrv 1 ...
	
	// get complete CurveList


	// create list of all Subcurves:
	// var isSubCrvUsed = array of bool, length = number of Subcurves, fill it with "false"
	
	
	
	// create list of all BoundaryPoints of all Subcurves:
	// var selBndryList = CreateObject( "XSI.Collection" );		
	// fill selPointList with Coordinates from CurveList
		// selPointList:
		// PointIdx 0: [x,y,z,w, SubCrv, BndryIdx, isSelected, isUsed]
		// PointIdx 1: [x,y,z,w, SubCrv, BndryIdx, isSelected, isUsed]
		// ... 




	// var mergeList = empty array of arrays
	// var newSubCrvsCounter = 0
		// example: 4 Subcurves
		// 0: [count: 1, subCrvList: [0], close: false ]	// no Bndry was selected
		// 1: [count: 2, subCrvList: [1, 2], close: false ]	// last Bndry of SubCrv 1 and first Bndry of SubCrv 2 was selected
		// 2: [count: 1,  subCrvList: [0], close: false ]	//

	// var appendLeftRight = false;	// left = false, right = true
	// var subCrvIdx = -1


	///////////////////////////////////////////////////
	// SEARCH LOOP
	// loop:
	// 1) find all Subcurves that do not participate in welding
		// get next unused Subcurve in all SubCurves:
		// loop n through isSubCrvUsed
			// if isSubCrvUsed[n] -> subCrvIdx = isSubCrvUsed[n]
		// end loop n
		// if subCrvIdx == -1 -> no more Subcurves left, exit search loop

		// put SubCrv in new MergeList row
		
		// if endPoint on SubCrv is selected:
			// nextSubCrv = findClosestPointInRadius()
			// if nextSubCrv was found:
				// mark end Boundary in selPointList as used
				// append found Subcurve at end of mergeList, row [newSubCrvsCounter]
				
		
	// end loop



	///////////////////////////////////////////////////
	// MERGE LOOP
	// loop n through all rows in MergeList:
		// var newSubcurve = empty
		// loop m through all Subcurve-Snippets in a row:
			// get Subcurve Snippet
			// is the reverse flag set? -> reverseSubcurve

			// concat this Subcurve to newSubcurve:
				// if this is not the first Snippet:
					// get coords of last and first Point
					// combine last/first Point, according to Params "cont"(C0,C1,C2) and "seam"(First, Second, Average)
					// adapt Knot Vector
				
				// if this is last Snippet && closeFlag is set
					// adapt last Point and Knot
					// set 
				
			// end concat
		// end loop m
		// put merged Subcurve to 
	// end loop n


	// overwrite this CurveList using Set
/*
	geomOut.Set(
		numSubcurves,				// 0. number of Subcurves in the Curvelist
		aAllPoints, 			// 1. Array
		aAllNumPoints, 			// 2. Array, number of Control Points per Subcurve
		aAllKnots,				// 3. Array
		aAllNumKnots,			// 4. Array
		aAllIsClosed, 			// 5. Array
		aAllDegree, 			// 6. Array
		aAllParameterization, 	// 7. Array
		0) ;					// 8. NurbsFormat: 0 = siSINurbs, 1 = siIGESNurbs			// 8. NurbsFormat: 0 = siSINurbs, 1 = siIGESNurbs
*/
	//output = in_ctxt.OutputTarget;
	return true;
}



//______________________________________________________________________________

function findClosestPointInRadius(point, radius)
{
	// var nearPointList;	// [[PntIdx0, distance0], [PntIdx1, distance1], ...]
	// loop n through selPointList:
		// var nearPoint = selBndPointList(n);
		// var distance = Math.distance(point - nearPoint);
		// if distance < radius
			// put nearPoint in nearPointList
	// end loop n
	
	// if nearPointList empty:
	return -1;

	// var minDistance = nearPointList[0].PntIdx;
	// var minIdx = 0;
	// loop n = 1 through nearPointList:
		// if nearPointList[n].Distance < minDistance:
			// minDistance = nearPointList[n].Distance
			// minIdx = n
	// end loop n
	
	// return nearPointList[minIdx]

}



//______________________________________________________________________________

function MergeSubcurves_DefineLayout( in_ctxt )
{
	var oLayout,oItem;
	oLayout = in_ctxt.Source;
	oLayout.Clear();
	oLayout.AddItem("cont");
	oLayout.AddItem("seam");
	oLayout.AddItem("modifytan");
	oLayout.AddItem("weldradius");
	return true;
}

//______________________________________________________________________________

function MergeSubcurves_OnInit( )
{
	Application.LogMessage("MergeSubcurves_OnInit called",siVerbose);
}

//______________________________________________________________________________

function MergeSubcurves_OnClosed( )
{
	Application.LogMessage("MergeSubcurves_OnClosed called",siVerbose);
}

//______________________________________________________________________________

function MergeSubcurves_cont_OnChanged( )
{
	Application.LogMessage("MergeSubcurves_cont_OnChanged called",siVerbose);
	var oParam;
	oParam = PPG.cont;
	var paramVal;
	paramVal = oParam.Value;
	Application.LogMessage("New value: " + paramVal,siVerbose);
}

//______________________________________________________________________________

function MergeSubcurves_seam_OnChanged( )
{
	Application.LogMessage("MergeSubcurves_seam_OnChanged called",siVerbose);
	var oParam;
	oParam = PPG.seam;
	var paramVal;
	paramVal = oParam.Value;
	Application.LogMessage("New value: " + paramVal,siVerbose);
}

//______________________________________________________________________________

function MergeSubcurves_modifytan_OnChanged( )
{
	Application.LogMessage("MergeSubcurves_modifytan_OnChanged called",siVerbose);
	var oParam;
	oParam = PPG.modifytan;
	var paramVal;
	paramVal = oParam.Value;
	Application.LogMessage("New value: " + paramVal,siVerbose);
}

//______________________________________________________________________________

function MergeSubcurves_weldradius_OnChanged( )
{
	Application.LogMessage("MergeSubcurves_weldradius_OnChanged called",siVerbose);
	var oParam;
	oParam = PPG.weldradius;
	var paramVal;
	paramVal = oParam.Value;
	Application.LogMessage("New value: " + paramVal,siVerbose);
}

//______________________________________________________________________________

function ApplyMergeSubcurves_Menu_Init( in_ctxt )
{
	var oMenu;
	oMenu = in_ctxt.Source;
	oMenu.AddCommandItem("MergeSubcurves","ApplyMergeSubcurves");
	return true;
}

//______________________________________________________________________________
