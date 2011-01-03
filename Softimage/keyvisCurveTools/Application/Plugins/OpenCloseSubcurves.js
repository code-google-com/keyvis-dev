//______________________________________________________________________________
// OpenCloseSubcurvesPlugin
// 2010/04 by Eugen Sares
// last update: 2010/12/05
//
// Usage:
// - Select Subcurves
// - Model > Modify > Curve > Open/Close Subcurve
// The open/closed status of the of the selected Subcurves will be toggled.
// 
// Info: this Op has the parameter "OpenWithGap".
// When checked, the last Segment (between the next to last and first Point) will be deleted when opening.
// (what the factory OpenClose Op does).
// When unchecked, the last Segment will persist.
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

	try
	{
		var bPick, bNoCluster;
		var oSel;
	
		if(args == "")
		{
		// Nothing is selected
			bPick = true;
			bNoCluster = true;
			
		}
		else if(args(0).Type == "subcrv" && ClassName(args(0)) == "Cluster" )
		{
		// Subcurve Cluster is selected
			var oCluster = args(0);
			var oParent = oCluster.Parent3DObject;
			bPick = false;
			bNoCluster = false;
			
		} else if(args(0).Type == "subcrvSubComponent")
		{
		// Subcurves are selected
			oSel = args(0);
			bPick = false;
			bNoCluster = true;
			
		} else
		{
		// Anything else is selected
			// oSel is set after picking
			bPick = true;
			bNoCluster = true;
			
		}


		if(bPick)
		{
			do
			{
			// Start Subcurve Pick Session
				var subcurves, button;	// useless but needed in JScript
				// PickElement() manages to select a CurveList first, then a Subcurve
				var rtn = PickElement( "SubCurve", "subcurves", "", subcurves, button, 0 );
				button = rtn.Value( "ButtonPressed" );
				if(!button) throw "Argument must be Subcurves.";
				
				oSel = rtn.Value( "PickedElement" );
				//var modifier = rtn.Value( "ModifierPressed" );

			} while (oSel.Type != "subcrvSubComponent");
			
		}

		if(bNoCluster)
		{
			var oSubComponent = oSel.SubComponent;
			var oParent = oSubComponent.Parent3DObject;
			var oComponentCollection = oSubComponent.ComponentCollection;
			// LogMessage("No. of Subcurves: " + oComponentCollection	// OK
			
			// create an index Array from the Subcurve collection
			var idxArray = new Array();
			for(i = 0; i < oComponentCollection.Count; i++)
			{
				var subcrv = oComponentCollection.item(i);
				// Logmessage("Subcurve [" + subcrv.Index + "] selected");
				idxArray[i] = subcrv.Index;
			}
			
			// create Cluster with Subcurves to delete
			var oCluster = oParent.ActivePrimitive.Geometry.AddCluster( siSubCurveCluster, "Subcurve_AUTO", idxArray );

		}
		

		var newOp = XSIFactory.CreateObject("OpenCloseSubcurves");	// known to the system through XSILoadPlugin callback
		
		newOp.AddOutputPort(oParent.ActivePrimitive, "outputCurve");	// working
		newOp.AddInputPort(oParent.ActivePrimitive, "inputCurve");	// working
		newOp.AddInputPort(oCluster, "openCloseClusterPort");	// params: PortTarget, [PortName]

		newOp.Connect();
		
		//DeselectAllUsingFilter("SubCurve");
		
		InspectObj(newOp);
		
		return newOp;

	} catch(e)
	{
		LogMessage(e, siWarning);
		return false;
	};
	
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
	
	
	var outCrvListGeom = in_ctxt.OutputTarget.Geometry;	// Type: NurbsCurveCollection, ClassName: ""

	var inputClusterElements = in_ctxt.GetInputValue("openCloseClusterPort").Elements;	// ClassName: ClusterElementCollection
	var clusterCount = inputClusterElements.Count;

	var inputCrvColl = in_ctxt.GetInputValue("inputCurve").Geometry.Curves;

	// for quicker checking which Subcurve is marked/selected:
	// "flagArray" is a boolean array which is true at the index of each selected Subcurve.
	// inputClusterElements.FindIndex() can be used as well, but this should be faster at higher Subcurve counts.
	var flagArray = new Array(inputCrvColl.Count);
	for(i = 0; i < inputCrvColl.Count; i++) flagArray[i] = false;	// init
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
		VBdata = new VBArray(subCrv.Get2(siSINurbs)); var subCrvData = VBdata.toArray();


		// Get Point data
		var vbArg0 = new VBArray(subCrvData[0]); var aPoints = vbArg0.toArray();
		aNumAllPoints[subCrvIdx] = aPoints.length/4;	// /4? x,y,z,weight

		// check if the first and last Point coincide
		var bFirstOnLast = false;
		if(	Math.abs(aPoints[0] - aPoints[aPoints.length - 4]) < tol &&
			Math.abs(aPoints[1] - aPoints[aPoints.length - 3]) < tol &&
			Math.abs(aPoints[2] - aPoints[aPoints.length - 2]) < tol)
				bFirstOnLast = true;
//LogMessage("firstOnLast: " + firstOnLast);

		// Get Knot data
		var vbArg1 = new VBArray(subCrvData[1]); var aKnots = vbArg1.toArray();
		aNumAllKnots[subCrvIdx] = aKnots.length;

		// Get other data
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
				var ret = closeNurbsCurve(aPoints, aKnots, aDegree[subCrvIdx]);
				aPoints = ret.aPoints;
				aKnots = ret.aKnots;
			
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
	oMenu.AddCommandItem("Open/Close Subcurves","ApplyOpenCloseSubcurves");
	return true;
}

//______________________________________________________________________________
