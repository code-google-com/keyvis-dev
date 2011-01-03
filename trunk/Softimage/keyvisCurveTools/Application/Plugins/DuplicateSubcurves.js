//______________________________________________________________________________
// DuplicateSubcurvesPlugin
// 2009/11 by Eugen Sares
// last update: 2010/12/07
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


		// BUG: added Subcurves are unselectable
		//ApplyTopoOp("CrvReparam", oParent, 3, siPersistentOperation, null);	// WORKING
		
		var cleanOp = ApplyTopoOp("CrvClean", oParent, 3, siPersistentOperation, null);
		SetValue(oParent + ".crvlist.cleancrv.cleantol", 0, null);	// WORKING

		//var inCrvList = oParent.ActivePrimitive;
//LogMessage("inCrvList.Type: " + inCrvList.Type);	// crvlist
		//AddCustomOp( "PassThrough", inCrvList, inCrvList, "PassThrough" ) ;


		var newOp = XSIFactory.CreateObject("DuplicateSubcurves");
		
		//newOp.AddOutputPort(oParent.ActivePrimitive, "OutCurvePort");
		//newOp.AddInputPort(oParent.ActivePrimitive, "InCurvePort");
		newOp.AddIOPort(oParent.ActivePrimitive, "CurvePort");	// autom: OutCurvePort, InCurvePort
		//newOp.AddOutputPort(oParent.Name + ".crvlist", "OutCurvePort");	// also working
		//newOp.AddInputPort(oParent.Name + ".crvlist", "InCurvePort");	// also working
		newOp.AddInputPort(oCluster, "duplicateClusterPort");	// params: PortTarget, [PortName]

		newOp.Connect();

		// ToDo: The new Subcurves will be selected
		//DeselectAllUsingFilter("SubCurve");
		
		//InspectObj(newOp);
		AutoInspect(newOp); // CTRL-Click does not open PPG

LogMessage("end of execute callback");
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
	oPDef = XSIFactory.CreateParamDef("offsetX",siFloat,siClassifUnknown,siPersistable | siKeyable,"Offset X","",0,null,null,null,null);
	oCustomOperator.AddParameter(oPDef);
	oPDef = XSIFactory.CreateParamDef("offsetY",siFloat,siClassifUnknown,siPersistable | siKeyable,"Offset Y","",0,null,null,null,null);
	oCustomOperator.AddParameter(oPDef);
	oPDef = XSIFactory.CreateParamDef("offsetZ",siFloat,siClassifUnknown,siPersistable | siKeyable,"Offset Z","",1,null,null,null,null);
	oCustomOperator.AddParameter(oPDef);
	
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


	// Get Params
	var offsetX = in_ctxt.GetParameterValue("offsetX");
	var offsetY = in_ctxt.GetParameterValue("offsetY");
	var offsetZ = in_ctxt.GetParameterValue("offsetZ");


	// Get Port connections
	var outCrvListGeom = in_ctxt.OutputTarget.Geometry;
	var oSubcurveCluster = in_ctxt.GetInputValue("duplicateClusterPort");
	var cInCurves = in_ctxt.GetInputValue("InCurvePort").Geometry.Curves;
LogMessage(cInCurves.Type);
LogMessage(ClassName(cInCurves));

	// Create empty arrays to hold the new CurveList data
	// http://softimage.wiki.softimage.com/index.php/Creating_a_merge_curve_SCOP
	var numAllSubcurves = 0;
	var aAllPoints = new Array();
	var aAllNumPoints = new Array();
	var aAllKnots = new Array();
	var aAllNumKnots = new Array();
	var aAllIsClosed = new Array();
	var aAllDegree = new Array();
	var aAllParameterization = new Array();


	// Array to store new indices of duplicated Subcurves
	var aNewSubcurves = new Array();


	//debug curve
/*	var testCrvPoints = [0,0,0,1, 1,0,0,1];
	var testCrvKnots = [0,1];
	var testCrvIsClosed = false;
	var testCrvDegree = 1;
	var testCrvParameterization = siNonUniformParameterization;
*/

	// Create boolean array which Subcurve to duplicate
	var flagArray = new Array(cInCurves.Count);
	for(var i = 0; i < cInCurves.Count; i++) flagArray[i] = false;	// init
	for(var i = 0; i < oSubcurveCluster.Elements.Count; i++)  flagArray[oSubcurveCluster.Elements(i)] = true;
	// debug:
	//for(var i = 0; i < cInCurves.Count; i++) LogMessage( flagArray[i] );

	// Test: every Subcurve's Knot Vector starts with the last value of the previous Subcurve
	// -> does not make a difference!
	//var knotOffset = 0;

	// Add Subcurves to duplicate
	for(var subCrvIdx = 0; subCrvIdx < cInCurves.Count; subCrvIdx++)
	//for(var subCrvIdx = 0; subCrvIdx < 4; subCrvIdx++)
	{
		if(flagArray[subCrvIdx]) var dup = 2; else var dup = 1;
		// Add Subcurve once or twice
		for (var i = 0; i < dup; i++)
		{
			// Get input Subcurve
			var subCrv = cInCurves.item(subCrvIdx);
//LogMessage(subCrv.Type);
//LogMessage(ClassName(subCrv));
			VBdata = new VBArray(subCrv.Get2(siSINurbs)); var aSubCrvData = VBdata.toArray();

			// Get Point data
			var VBdata0 = new VBArray(aSubCrvData[0]); var aPoints = VBdata0.toArray();
			// Add Offset
			if(i == 1)
				{
				for(var j = 0; j < aPoints.length; j+= 4)
				{
					aPoints[j] += offsetX;
					aPoints[j+1] += offsetY;
					aPoints[j+2] += offsetZ;
				}
			}
			// Get Knot data
 			var VBdata1 = new VBArray(aSubCrvData[1]); var aKnots = VBdata1.toArray();
			//for(var j = 0; j < aKnots.length; j++) aKnots[j] += knotOffset;
			//knotOffset = aKnots[aKnots.length - 1];
//LogMessage("aKnots: " + aKnots);


			// testCurve
/*			aAllPoints = aAllPoints.concat(testCrvPoints);
			aAllNumPoints[numAllSubcurves] = testCrvPoints.length / 4;
			aAllKnots = aAllKnots.concat(testCrvKnots);
			aAllNumKnots[numAllSubcurves] = testCrvKnots.length;
			aAllIsClosed[numAllSubcurves] = testCrvIsClosed
			aAllDegree[numAllSubcurves] = testCrvDegree;
			aAllParameterization[numAllSubcurves] = testCrvParameterization;
*/			
				
			aAllPoints = aAllPoints.concat(aPoints);
			aAllNumPoints[numAllSubcurves] = aPoints.length / 4;	//x,y,z,w
			aAllKnots = aAllKnots.concat(aKnots);
			aAllNumKnots[numAllSubcurves] = aKnots.length;
			aAllIsClosed[numAllSubcurves] = aSubCrvData[2];
			aAllDegree[numAllSubcurves] = aSubCrvData[3];
			aAllParameterization[numAllSubcurves] = aSubCrvData[4];


			// For later selection:
			// If this is a duplicated Subcurve, remember it's index
			if(i > 0) aNewSubcurves = aNewSubcurves.concat(numAllSubcurves);

			numAllSubcurves++;

/*	
		var aPoints = data[0];
		var aKnots = data[1];
		var bIsclosed = data[2];
		var lDegree = data[3];
		var eParameterization = data[4];

		inCrvListGeom.AddCurve( aPoints, aKnots, bIsclosed, lDegree, eParameterization );
*/
		}
	}

//LogMessage("aNewSubcurves: " + aNewSubcurves);

	// Get inCrvListGeom (NurbsCurveList)
/*	var VBdata = inCrvListGeom.Get2( siSINurbs ); var data = VBdata.toArray();

	var numAllSubcurves = data[0];
	var VBdata1 = new VBArray(data[1]); var aAllPoints = VBdata1.toArray();
	var VBdata2 = new VBArray(data[2]); var aAllNumPoints =  VBdata2.toArray();
	var VBdata3 = new VBArray(data[3]); var aAllKnots= VBdata3.toArray();
	aAllKnots = removeUndefinedElementsFromArray(aAllKnots);
	var VBdata4 = new VBArray(data[4]); var aAllNumKnots = VBdata4.toArray();
	var VBdata5 = new VBArray(data[5]); var aAllIsClosed = VBdata5.toArray();
	var VBdata6 = new VBArray(data[6]); var aAllDegree = VBdata6.toArray();
	var VBdata7 = new VBArray(data[7]); var aAllParameterization = VBdata7.toArray();
*/

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


	// ToDo:
	// Add newly created Subcurves to Cluster(s)
	// ? SIAddToCluster()
	// ? SubComponent.AddElement( Element )
	
	//var oCrvList = in_ctxt.Source.Parent3DObject;
	//SelectGeometryComponents( oCrvList + ".subcrv[" + aNewSubcurves + "]" );
	// All:
	//SelectGeometryComponents( "text.subcrv[*]" );

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



function ApplyDuplicateSubcurves_Menu_Init( in_ctxt )
{
	var oMenu;
	oMenu = in_ctxt.Source;
	oMenu.AddCommandItem("Duplicate Subcurves","ApplyDuplicateSubcurves");
	return true;
}

