//______________________________________________________________________________
// InverseSubcurvePlugin
// 2009/11 by Eugen Sares
// last update: 2010/12/07
//______________________________________________________________________________

function XSILoadPlugin( in_reg )
{
	in_reg.Author = "Eugen Sares";
	in_reg.Name = "InverseSubcurvePlugin";
	in_reg.Major = 1;
	in_reg.Minor = 0;

	in_reg.RegisterOperator("InverseSubcurve");
	in_reg.RegisterCommand("ApplyInverseSubcurve","ApplyInverseSubcurve");
	in_reg.RegisterMenu(siMenuTbModelModifyCurveID,"ApplyInverseSubcurve_Menu",false,false);
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

function ApplyInverseSubcurve_Init( in_ctxt )
{
	var oCmd;
	oCmd = in_ctxt.Source;	// source object that is the cause of the callback being fired
	oCmd.Description = "Create an instance of InverseSubcurve operator";
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

function ApplyInverseSubcurve_Execute(args)
{
	Application.LogMessage("ApplyInverseSubcurve_Execute called",siVerbose);

	try
	{
		var bPick
		var bNoCluster;
		var oSel;
		var oParent;
	
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
			oParent = oCluster.Parent3DObject;
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
//LogMessage("oSubComponent: " + oSubComponent);	// crvlist.subcrv[0,2]
			oParent = oSubComponent.Parent3DObject;
			var cComponents = oSubComponent.ComponentCollection;
//LogMessage("No. of Subcurves: " + oComponentCollection.Count);	// OK
			
			// create an index Array from the Subcurve collection
			var idxArray = new Array();
			for(i = 0; i < cComponents.Count; i++)
			{
				var subcrv = cComponents.item(i);
				// Logmessage("Subcurve [" + subcrv.Index + "] selected");
				idxArray[i] = subcrv.Index;
			}
			
			// create Cluster with Subcurves to delete
			var oCluster = oParent.ActivePrimitive.Geometry.AddCluster( siSubCurveCluster, "Subcurve_AUTO", idxArray );

		}


		var newOp = XSIFactory.CreateObject("InverseSubcurve");
		
		//newOp.AddOutputPort(oParent.ActivePrimitive, "OutCurvePort");
		//newOp.AddInputPort(oParent.ActivePrimitive, "InCurvePort");
		newOp.AddIOPort(oParent.ActivePrimitive, "CurvePort");	// autom: OutCurvePort, InCurvePort
		//newOp.AddOutputPort(oParent.Name + ".crvlist", "OutCurvePort");	// also working
		//newOp.AddInputPort(oParent.Name + ".crvlist", "InCurvePort");	// also working
		newOp.AddInputPort(oCluster, "inverseClusterPort");	// params: PortTarget, [PortName]

		newOp.Connect();

		//DeselectAllUsingFilter("SubCurve");
		
		//InspectObj(newOp);

//LogMessage("end of execute callback");
		//return true;
		return newOp;

	} catch(e)
	{
		LogMessage(e, siWarning);
		return false;
	};
	
}


//______________________________________________________________________________

// Use this callback to build a set of parameters that will appear in the property page.
function InverseSubcurve_Define( in_ctxt )
{
	Application.LogMessage("InverseSubcurve_Define called",siVerboseMsg);
	
	var oCustomOperator;
	var oPDef;
	oCustomOperator = in_ctxt.Source;
	
/*	oPDef = XSIFactory.CreateParamDef("offsetX",siFloat,siClassifUnknown,siPersistable | siKeyable,"Offset X","",0,null,null,null,null);
	oCustomOperator.AddParameter(oPDef);
	oPDef = XSIFactory.CreateParamDef("offsetY",siFloat,siClassifUnknown,siPersistable | siKeyable,"Offset Y","",0,null,null,null,null);
	oCustomOperator.AddParameter(oPDef);
	oPDef = XSIFactory.CreateParamDef("offsetZ",siFloat,siClassifUnknown,siPersistable | siKeyable,"Offset Z","",1,null,null,null,null);
	oCustomOperator.AddParameter(oPDef);
*/
	oCustomOperator.AlwaysEvaluate = false;
	oCustomOperator.Debug = 0;	// When the value is not zero Softimage will log extra information about the operator's evaluation.

	return true;
}


//______________________________________________________________________________

// User data can be stored in the operator context of the Init callback
// and then retrieved later in the Update and Term callbacks.
function InverseSubcurve_Init( in_ctxt )
{
	Application.LogMessage("InverseSubcurve_Init called",siVerboseMsg);
	return true;
}


//______________________________________________________________________________

function InverseSubcurve_Term( in_ctxt )
{
	Application.LogMessage("InverseSubcurve_Term called",siVerboseMsg);
	return true;
}



//______________________________________________________________________________
//______________________________________________________________________________

function InverseSubcurve_Update( in_ctxt )
{
	Application.LogMessage("InverseSubcurve_Update called",siVerboseMsg);

	// Get Port connections
	var outCrvListGeom = in_ctxt.OutputTarget.Geometry;
	var oSubcurveCluster = in_ctxt.GetInputValue("inverseClusterPort");
	var cInCurves = in_ctxt.GetInputValue("InCurvePort").Geometry.Curves;


	// Create empty arrays to hold the new CurveList data
	// http://softimage.wiki.softimage.com/index.php/Creating_a_merge_curve_SCOP
	//var numAllSubcurves = 0;
	var aAllPoints = new Array();
	var aAllNumPoints = new Array();
	var aAllKnots = new Array();
	var aAllNumKnots = new Array();
	var aAllIsClosed = new Array();
	var aAllDegree = new Array();
	var aAllParameterization = new Array();


	// Array to store new indices of inverted Subcurves
	var aNewSubcurves = new Array();


	// Create boolean array which Subcurve to invert
	var flagArray = new Array(cInCurves.Count);
	for(var i = 0; i < cInCurves.Count; i++) flagArray[i] = false;	// init
	for(var i = 0; i < oSubcurveCluster.Elements.Count; i++)  flagArray[oSubcurveCluster.Elements(i)] = true;
	// debug:
	//for(var i = 0; i < cInCurves.Count; i++) LogMessage( flagArray[i] );


	// Add Subcurves to invert
	for(numAllSubcurves = 0; numAllSubcurves < cInCurves.Count; numAllSubcurves++)
	{
		// Get input Subcurve
		var subCrv = cInCurves.item(numAllSubcurves);
		VBdata = new VBArray(subCrv.Get2(siSINurbs)); var aSubCrvData = VBdata.toArray();
		
		// Get Point data
		var VBdata0 = new VBArray(aSubCrvData[0]); var aPoints = VBdata0.toArray();

		// Get Knot data
		var VBdata1 = new VBArray(aSubCrvData[1]); var aKnots = VBdata1.toArray();
		
		// Get other data
		isClosed = aSubCrvData[2];
		degree = aSubCrvData[3];
		parameterization = aSubCrvData[4];

		if( flagArray[numAllSubcurves] )
		{
			// Invert Point and Knot arrays
			var ret = invertNurbsCurve(aPoints, aKnots, isClosed, degree); //, parameterization);
			aPoints = ret.aPoints;
			aKnots = ret.aKnots;
		}
		

		// Concat Curve data to CurveList data
		aAllPoints = aAllPoints.concat(aPoints);
		aAllNumPoints[numAllSubcurves] = aPoints.length / 4;	//x,y,z,w
		aAllKnots = aAllKnots.concat(aKnots);
		aAllNumKnots[numAllSubcurves] = aKnots.length;
		aAllIsClosed[numAllSubcurves] = aSubCrvData[2];
		aAllDegree[numAllSubcurves] = aSubCrvData[3];
		aAllParameterization[numAllSubcurves] = aSubCrvData[4];

	}


	// Set output CurveList
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


	return true;
}


//______________________________________________________________________________
//______________________________________________________________________________

function invertNurbsCurve(aPoints, aKnots, isClosed, degree/*, parameterization*/)
{
	// Invert Point array
	var pLen = aPoints.length;
	var aPointsInv = new Array(pLen);

//logControlPointsArray(aPoints, 1000);
	for(var i = 0; i < aPoints.length; i += 4)
	{
		aPointsInv[i] = aPoints[aPoints.length - i - 4];
		aPointsInv[i + 1] = aPoints[aPoints.length - i - 3];
		aPointsInv[i + 2] = aPoints[aPoints.length - i - 2];
		aPointsInv[i + 3] = aPoints[aPoints.length - i - 1];
	}

//logControlPointsArray(aPointsInv, 1000);

	// 
	if(isClosed)
	{
		// "Rotate" Point array right, so the former first Points is first again.
		// original:	0,1,2,3,4
		// reverse:		4,3,2,1,0
		// correct: 	0,4,3,2,1
		aPointsInv = ( aPointsInv.slice(pLen - 4) ).concat( aPointsInv.slice( 0, pLen - 4) );

	}

//logControlPointsArray(aPointsInv, 1000);

	// Invert Knot array
	var kLen = aKnots.length;
	var aKnotsInv = new Array();
	var prevKnot = aKnots[kLen - 1];	// last Knot
	var prevInvKnot = 0;
	
	for(var i = 0; i < kLen; i++)
	{
		var knot = aKnots[kLen - 1 - i];
		// Difference of neighboring Knots in aKnots and aKnotsInv is the same,
		// but in reverse order.
		aKnotsInv[i] =  prevKnot - knot + prevInvKnot;
		prevKnot = knot;
		prevInvKnot = aKnotsInv[i];
	}

	
	return {aPoints:aPointsInv,
			aKnots:aKnotsInv};

}


//______________________________________________________________________________

function logControlPointsArray(aPoints, dp)
{
	for ( var i = 0; i < aPoints.length; i += 4 )
	{
		var x = aPoints[i];
		var y = aPoints[i + 1];
		var z = aPoints[i + 2];
		var w = aPoints[i + 3]; 
		LogMessage( "[" + i/4 + "]: x = " + Math.round(x*dp)/dp + "; y = " + Math.round(y*dp)/dp + "; z = " + Math.round(z*dp)/dp + "; w = " + Math.round(w*dp)/dp );

	}
	
	LogMessage("");
}


//______________________________________________________________________________

function logKnotsArray(aKnots, dp)
{
	var sKnotArray = "";
	for ( var j = 0; j < aKnots.length; j++ )
	{
		var knotValue = Math.round(aKnots[j]*dp)/dp;
		if ( j == 0 ) sKnotArray = "Knot Vector: " + knotValue.toString(10);
		else sKnotArray = sKnotArray + ", " + knotValue.toString(10);
	}
	
	LogMessage( sKnotArray );
	LogMessage("");
	
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

function ApplyInverseSubcurve_Menu_Init( in_ctxt )
{
	var oMenu;
	oMenu = in_ctxt.Source;
	oMenu.AddCommandItem("Inverse Subcurves","ApplyInverseSubcurve");
	return true;
}

//______________________________________________________________________________
