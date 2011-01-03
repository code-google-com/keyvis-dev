//______________________________________________________________________________
// DeleteSubcurvesPlugin
// 10/2009 by Eugen Sares
// last update: 2010/10/26
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


//______________________________________________________________________________

function XSIUnloadPlugin( in_reg )
{
	var strPluginName;
	strPluginName = in_reg.Name;
	Application.LogMessage(strPluginName + " has been unloaded.",siVerbose);
	return true;
}


//______________________________________________________________________________

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
//______________________________________________________________________________

function ApplyDeleteSubcurves_Execute(data)
{
	Application.LogMessage("ApplyDeleteSubcurves_Execute called",siVerbose);

	try
	{
		var bPick, bNoCluster;
		var oSel;
	
		if(data == "")
		{
		// Nothing is selected
			bPick = true;
			bNoCluster = true;
			
		}
		else if(data(0).Type == "subcrv" && ClassName(data(0)) == "Cluster" )
		{
		// Subcurve Cluster is selected
			var oCluster = data(0);
			var oParent = oCluster.Parent3DObject;
			bPick = false;
			bNoCluster = false;
			
		} else if(data(0).Type == "subcrvSubComponent")
		{
		// Subcurves are selected
			oSel = data(0);
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

		// Clear the Subcurve Selection, otherwise some other Subcurves get selected.
		DeselectAllUsingFilter("SubCurve");

		
		var newOp = XSIFactory.CreateObject("DeleteSubcurves");	// known to the system through XSILoadPlugin callback
		// DeleteSubcurves_Init and
		// DeleteSubcurves_Define are called...
		
		newOp.AddOutputPort(oParent.ActivePrimitive, "outputCurve");	// working
		newOp.AddInputPort(oParent.ActivePrimitive, "inputCurve");	// working

		// newOp.AddOutputPort(oParent.Name + ".crvlist", "outputCurve");	// also working
		// newOp.AddInputPort(oParent.Name + ".crvlist", "inputCurve");	// also working
		newOp.AddInputPort(oCluster, "deleteCluster");	// params: PortTarget, [PortName]

		newOp.Connect();
		return newOp;

	} catch(e)
	{
		LogMessage(e, siWarning);
	}
	
	return false;
	
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
	
	// Get output target
	var geomOut = in_ctxt.OutputTarget.Geometry;	// Type: NurbsCurveCollection, ClassName: ""

	// Get input Cluster
	var inputClusterElements = in_ctxt.GetInputValue("deleteCluster").Elements;	// ClassName: ClusterElementCollection
	var clusterCount = inputClusterElements.Count;

	// Get input CurveList
	var cInputCurves = in_ctxt.GetInputValue("inputCurve").Geometry.Curves;


	// Create boolean array which Subcurve to delete
	var flagArray = new Array(cInputCurves.Count);
	for(i = 0; i < clusterCount; i++) flagArray[inputClusterElements(i)] = true;


	var numAllSubcurves = 0;
	var aAllPoints = new Array();
	var aAllNumPoints = new Array();
	var aAllKnots = new Array();
	var aAllNumKnots = new Array();
	var aAllIsClosed = new Array();
	var aAllDegree = new Array();
	var aAllParameterization = new Array();

	if(cInputCurves.Count > clusterCount)
	{
	// When not all Subcurves have to be deleted:
		for(i = 0; i < cInputCurves.Count; i++)
		{
			if(flagArray[i]) continue;

			// Get NurbsCurve data
			var subcrv = cInputCurves.item(i);	// get input Subcurve. Type: NurbsCurve, ClassName: NurbsCurve			
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
	// When all Subcurves are deleted:
	
	// Smallest possible CurveList: 1 Point
	// var oEmpty = SICreateCurve("emptyCurve", 3, 1);
		numAllSubcurves = 1;
		ctrlPoints = [0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1];	// 4 Points, each 0,0,0,1 (x,y,z,weight)
		numCtrlPoints = [4];
		knots = [0,0,0,1,1,1];	// 6 Knots
		numKnots = [6];
		isClosed = [false];
		degree = [3];
		parameterization = [siNonUniformParameterization];	// 1
	}
	// ToDo: minimal Curve for degree 1 and 2


	// overwrite the existing CurveList
	geomOut.Set(
		numAllSubcurves,		// 0. number of Subcurves in the Curvelist
		aAllPoints, 			// 1. Array
		aAllNumPoints, 			// 2. Array, number of Control Points per Subcurve
		aAllKnots, 				// 3. Array
		aAllNumKnots, 			// 4. Array
		aAllIsClosed, 			// 5. Array
		aAllDegree, 			// 6. Array
		aAllParameterization, 	// 7. Array
		siSINurbs) ;		// 8. NurbsFormat: 0 = siSINurbs, 1 = siIGESNurbs
		
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
