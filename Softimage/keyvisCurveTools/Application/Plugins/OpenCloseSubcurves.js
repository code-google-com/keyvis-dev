//______________________________________________________________________________
// OpenCloseSubcurvesPlugin
// 04/2010 by Eugen Sares
// last revision: 25/04/2010
//
// Usage:
// Select a NurbsCurveList with one or more Subcurves.
// Switch to selection filter "Subcurve" > select some Subcurves > ApplyOpenCloseSubcurves.
// The open/closedness of the selected Subcurves will be toggled.
// 
// Other than the factory OpenClose Operator, there's a parameter "OpenWithGap".
// When checked, the last Segment (between the next to last and first Point) will be deleted when opening.
// (what the factory OpenClose Op does)
// When unchecked, the last Segment will remain.
//
//______________________________________________________________________________

function XSILoadPlugin( in_reg )
{
	in_reg.Author = "Gene";
	in_reg.Name = "OpenCloseSubcurvesPlugin";
	in_reg.Major = 1;
	in_reg.Minor = 0;

	in_reg.RegisterOperator("OpenCloseSubcurves");
	in_reg.RegisterCommand("ApplyOpenCloseSubcurves","ApplyOpenCloseSubcurves");
	in_reg.RegisterMenu(siMenuTbModelModifyCurveID,"ApplyOpenCloseSubcurves_Menu",false,false);
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

	do{
		if(args == "") break;
		if(args(0).Type != "subcrvSubComponent") break;
		// var oSubcurves = args(0);
		// LogMessage(oSubcurves);														// "text.subcrv[3-LAST]"
		// LogMessage(oSubcurves.Type);													// "subcrvSubComponent"
// ToDo: Support for multiple Objects
		var oSubComponent = args(0).SubComponent;
		var oParent = oSubComponent.Parent3DObject;
		var oComponentCollection = oSubComponent.ComponentCollection;
		
// create an index Array from the Subcurve collection
		var idxArray = new Array();
		for(i = 0; i < oComponentCollection.Count; i++)
		{
			var subcrv = oComponentCollection.item(i);
			// Logmessage("Subcurve [" + subcrv.Index + "] selected");
			idxArray[i] = subcrv.Index;
		}
		
// create Cluster with Subcurves to delete
		oCluster = oParent.ActivePrimitive.Geometry.AddCluster( siSubcurveCluster, "OpenCloseSubcurves", idxArray );
		
		DeselectAllUsingFilter("Subcurve");
		

		var newOp = XSIFactory.CreateObject("OpenCloseSubcurves");	// known to the system through XSILoadPlugin callback
// OpenCloseSubcurves_Init and
// OpenCloseSubcurves_Define are called...
		
		newOp.AddOutputPort(oParent.ActivePrimitive, "outputCurve");	// working
		newOp.AddInputPort(oParent.ActivePrimitive, "inputCurve");	// working

//		newOp.AddOutputPort(oParent.Name + ".crvlist", "outputCurve");	// also working
//		newOp.AddInputPort(oParent.Name + ".crvlist", "inputCurve");	// also working
		newOp.AddInputPort(oCluster, "deleteCluster");	// params: PortTarget, [PortName]

		newOp.Connect();
		InspectObj(newOp);
		return newOp;

	} while(false);	// block is left in case of an error.

	LogMessage("Please select some Subcurves first.");
	return false;
	
}


//______________________________________________________________________________

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


//______________________________________________________________________________

// User data can be stored in the operator context of the Init callback
// and then retrieved later in the Update and Term callbacks.
function OpenCloseSubcurves_Init( in_ctxt )
{
	Application.LogMessage("OpenCloseSubcurves_Init called",siVerboseMsg);
	return true;
}


//______________________________________________________________________________

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
	var OpenWithGap = in_ctxt.GetParameterValue("OpenWithGap");
	
	Application.LogMessage("OpenCloseSubcurves_Update called",siVerboseMsg);
	
	var geomOut = in_ctxt.OutputTarget.Geometry;	// Type: NurbsCurveCollection, ClassName: ""

	var inputClusterElements = in_ctxt.GetInputValue("deleteCluster").Elements;	// ClassName: ClusterElementCollection
	var clusterCount = inputClusterElements.Count;

	var inputCrvColl = in_ctxt.GetInputValue("inputCurve").Geometry.Curves;

	// for quicker checking which Subcurve is marked/selected:
	// "flagArray" is a boolean array which is true at the index of each selected Subcurve.
	// inputClusterElements.FindIndex() can be used as well, but this should be faster at higher Subcurve counts.
	var flagArray = new Array(inputCrvColl.Count);
	for(i = 0; i < inputCrvColl.Count; i++) flagArray[i] = false;	// initialize?
	for(i = 0; i < clusterCount; i++) flagArray[inputClusterElements(i)] = true;

	// create empty arrays to hold the new CurveList data
	// http://softimage.wiki.softimage.com/index.php/Creating_a_merge_curve_SCOP
	var aAllPoints = new Array();
	var aNumAllPoints = new Array();
	var aAllKnots = new Array();
	var aNumAllKnots = new Array();
	var aIsClosed = new Array();
	var aDegree = new Array();
	var aParameterization = new Array();

	var tol = 10e-10;

	// loop through all Subcurves
	for(var subCrvIdx = 0; subCrvIdx < inputCrvColl.Count; subCrvIdx++)
	{
		// get input Subcurve
		var subCrv = inputCrvColl.item(subCrvIdx);	// Type: NurbsCurve, ClassName: NurbsCurve
		VBdata = new VBArray(subCrv.Get2(siSINurbs));	// NurbsCurve.Get2 returns a complete data description of the Nurbs Curve as VBArray.										
		var subCrvData = VBdata.toArray();	// convert to native JScript array. Note: "toArray", NOT "ToArray"!


		// 1. get Control Points array
		var vbArg0 = new VBArray(subCrvData[0]);
		var aPoints = vbArg0.toArray();

		// 2. get Number of Control Points
		aNumAllPoints[subCrvIdx] = aPoints.length/4;	// /4? x,y,z,weight

		// check if the first and last Point coincide
		var bFirstOnLast = false;
		if(	Math.abs(aPoints[0] - aPoints[aPoints.length - 4]) < tol &&
			Math.abs(aPoints[1] - aPoints[aPoints.length - 3]) < tol &&
			Math.abs(aPoints[2] - aPoints[aPoints.length - 2]) < tol)
				bFirstOnLast = true;
//LogMessage("firstOnLast: " + firstOnLast);

		// 3. get aAllKnots array
		var vbArg1 = new VBArray(subCrvData[1]);
		var aKnots = vbArg1.toArray();

		// 4. get Number of AllKnots	
		aNumAllKnots[subCrvIdx] = aKnots.length;

		// 5. get OpenClose flag
		aIsClosed[subCrvIdx] = subCrvData[2];

		// 6. get Curve Degree
		aDegree[subCrvIdx] = subCrvData[3];

		// 7. get Parameterization
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
		
			// Calculate only the Point array and Knot Vector, all other Curve params are already set

			// This Operator works as a toggle:
			// Open Curves that were closed, and vice versa.
			if(aIsClosed[subCrvIdx] == true)
			{
			// OPEN the Subcurve		
			// Note: Param. OpenWithGap defines whether the opened Curve's first and last Point will overlap or not.
				if(!OpenWithGap)
				{
				// first and last Point will overlap after opening
				// -> duplicate first Point to the end
					for(var i = 0; i < 4; i++)	aPoints.push(aPoints[i]);
				}
				
				// remember last Knot value
				var lastKnot = aKnots[aKnots.length - 1];
//LogMessage("lastKnot: " + lastKnot);
//LogMessage("aKnots.length: " + aKnots.length);

				// adapt Knot vector length: In open Curves: K = P + degree - 1
				aKnots.length = aPoints.length / 4 + aDegree[subCrvIdx] - 1;	// /4? x,y,z,w
				
				// set first Knot to full Mult.
				for(var i = 0; i < aDegree[subCrvIdx] - 1; i++)	aKnots[i] = aKnots[aDegree[subCrvIdx] - 1];
				
				// set last Knot to full Mult.
				for(var i = aDegree[subCrvIdx]; i > 0; i--)	aKnots[aKnots.length - i] = lastKnot;

				aIsClosed[subCrvIdx] = false;
				
			} else
			{
			// CLOSE the Subcurve
				if(bFirstOnLast)
				{
				// first and last Point were overlapping
				// -> remove last Point
					for(var i = 0; i < 4; i++) aPoints.pop();
					
					// truncate Knot Vector
					// on closed Curves: K = P + 1
					aKnots = aKnots.slice(0, aPoints.length + 1);

				} else
				{
				// first and last Point were apart
					// Point list does not change
					// adapt Knot Vector length: on closed Curves: K = P + 1
					// on degr. 1 Curves: one Knot more // degr. 2: same length // degr. 3: one Knot less
					aKnots.length = aPoints.length / 4 + 1;	// /4? x,y,z,w

					// first Knot(s)
					// e.g. on a degree 3 Curve: [-2,-1,0,...]
					for(var i = aDegree[subCrvIdx] - 2; i >= 0; i--)	aKnots[i] = aKnots[i + 1] - 1;

					// last Knot
					aKnots[aKnots.length - 1] = aKnots[aKnots.length - 2] + 1;
					
				}
				aIsClosed[subCrvIdx] = true;		
				
			}	// end else
		aNumAllPoints[subCrvIdx] = aPoints.length/4;
		aNumAllKnots[subCrvIdx] = aKnots.length;
		
		}	// end if

		// concatenate the Points and Knots arrays to get the complete CurveList data
		aAllPoints = aAllPoints.concat(aPoints);
		aAllKnots = aAllKnots.concat(aKnots);

	}	// end of loop through all Subcurves


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
	geomOut.Set(
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

function OpenCloseSubcurves_DefineLayout( in_ctxt )
{
	var oLayout,oItem;
	oLayout = in_ctxt.Source;
	oLayout.Clear();
	//oLayout.AddGroup("When opening Subcurve:");
	oLayout.AddItem("OpenWithGap");
	//oLayout.EndGroup();
	return true;
}


//______________________________________________________________________________

function OpenCloseSubcurves_OnInit( )
{
	Application.LogMessage("OpenCloseSubcurves_OnInit called",siVerbose);
}


//______________________________________________________________________________

function OpenCloseSubcurves_OnClosed( )
{
	Application.LogMessage("OpenCloseSubcurves_OnClosed called",siVerbose);
}


//______________________________________________________________________________

function OpenCloseSubcurves_OpenWithGap_OnChanged( )
{
	Application.LogMessage("OpenCloseSubcurves_OpenWithGap_OnChanged called",siVerbose);
	var oParam;
	oParam = PPG.OpenWithGap;
	var paramVal;
	paramVal = oParam.Value;
	Application.LogMessage("New value: " + paramVal,siVerbose);
}

//______________________________________________________________________________

function ApplyOpenCloseSubcurves_Menu_Init( in_ctxt )
{
	var oMenu;
	oMenu = in_ctxt.Source;
	oMenu.AddCommandItem("OpenCloseSubcurves","ApplyOpenCloseSubcurves");
	return true;
}

//______________________________________________________________________________
