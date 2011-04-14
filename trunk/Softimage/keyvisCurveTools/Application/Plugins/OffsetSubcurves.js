//______________________________________________________________________________
// OffsetSubcurvesPlugin
// 2009/11 by Eugen Sares
// last update: 2011/02/18
//______________________________________________________________________________

function XSILoadPlugin( in_reg )
{
	in_reg.Author = "Eugen Sares";
	in_reg.Name = "OffsetSubcurvesPlugin";
	in_reg.Major = 1;
	in_reg.Minor = 0;

	in_reg.RegisterOperator("OffsetSubcurves");
	in_reg.RegisterCommand("ApplyOffsetSubcurves","ApplyOffsetSubcurves");
	in_reg.RegisterMenu(siMenuTbModelModifyCurveID,"ApplyOffsetSubcurves_Menu",false,false);
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



function ApplyOffsetSubcurves_Init( in_ctxt )
{
	var oCmd;
	oCmd = in_ctxt.Source;	// source object that is the cause of the callback being fired
	oCmd.Description = "Create an instance of OffsetSubcurves operator";
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

function ApplyOffsetSubcurves_Execute(args)
{
	Application.LogMessage("ApplyOffsetSubcurves_Execute called",siVerbose);

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
//LogMessage("ok1");
		var operationMode = Preferences.GetPreferenceValue( "xsiprivate_unclassified.OperationMode" );
//LogMessage("ok2");
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
				var newOp = AddCustomOp("OffsetSubcurves", oOutput, [oInput1, oInput2], "OffsetSubcurves");

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
				var oOutput1 = cCurveLists(i).ActivePrimitive;
				var oInput1 = cCurveLists(i).ActivePrimitive;
				var oInput2 = cSubcurveClusters(i);
				var newOp = AddCustomOp("OffsetSubcurves", oOutput1, [oInput1, oInput2], "OffsetSubcurves");

				createdOperators.Add(newOp);
				
			}
			
			if(createdOperators.Count != 0 && bAutoinspect && Application.Interactive)
				AutoInspect(createdOperators); // Multi-PPG

		}

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
function OffsetSubcurves_Define( in_ctxt )
{
	Application.LogMessage("OffsetSubcurves_Define called",siVerboseMsg);
	
	var oCustomOperator;
	var oPDef;
	oCustomOperator = in_ctxt.Source;
	// ScriptName, Type, [Classification], [Capabilities], [Name], [Description], [DefaultValue], [Min], [Max], [SuggestedMin], [SuggestedMax]
	oPDef = XSIFactory.CreateParamDef("offset",siFloat,siClassifUnknown,siPersistable | siKeyable,"Offset","",0.3,null,null,-10,10);
	oCustomOperator.AddParameter(oPDef);
	oPDef = XSIFactory.CreateParamDef("center",siBool,siClassifUnknown,siPersistable | siKeyable,"Center","",false,null,null,null,null);
	oCustomOperator.AddParameter(oPDef);
	oPDef = XSIFactory.CreateParamDef("closeStart",siBool,siClassifUnknown,siPersistable | siKeyable,"Close start","",true,null,null,null,null);
	oCustomOperator.AddParameter(oPDef);
	oPDef = XSIFactory.CreateParamDef("closeEnd",siBool,siClassifUnknown,siPersistable | siKeyable,"Close end","",true,null,null,null,null);
	oCustomOperator.AddParameter(oPDef);
	oPDef = XSIFactory.CreateParamDef("curvePlane",siUByte,siClassifUnknown,siPersistable | siKeyable,"Curve Plane","",0,null,null,null,null);
	oCustomOperator.AddParameter(oPDef);

	oCustomOperator.AlwaysEvaluate = false;
	oCustomOperator.Debug = 0;	// When the value is not zero Softimage will log extra information about the operator's evaluation.

	return true;
}



// User data can be stored in the operator context of the Init callback
// and then retrieved later in the Update and Term callbacks.
function OffsetSubcurves_Init( in_ctxt )
{
	Application.LogMessage("OffsetSubcurves_Init called",siVerboseMsg);
	return true;
}



function OffsetSubcurves_Term( in_ctxt )
{
	Application.LogMessage("OffsetSubcurves_Term called",siVerboseMsg);

	return true;
}


//______________________________________________________________________________

function OffsetSubcurves_Update( in_ctxt )
{
	Application.LogMessage("OffsetSubcurves_Update called",siVerboseMsg);


	// Get Params.
	var offset = in_ctxt.GetParameterValue("offset");
	var center = in_ctxt.GetParameterValue("center");
	var closeStart = in_ctxt.GetParameterValue("closeStart");
	var closeEnd = in_ctxt.GetParameterValue("closeEnd");
	var curvePlane = in_ctxt.GetParameterValue("curvePlane");
	
	var tol = 10E-10; // as Param?

	
	// Get input Port connections.
	var inCrvListGeom = in_ctxt.GetInputValue(0).Geometry; // See SDK Explorer for Port Indices.
	var cInCurves = inCrvListGeom.Curves;
	var oSubcurveCluster = in_ctxt.GetInputValue(1);

	var oOutTarget = in_ctxt.OutputTarget;

	var outCrvListGeom = oOutTarget.Geometry;


	var allSubcurvesCnt = 0;
	var aAllPoints = new Array();
	var aAllNumPoints = new Array();
	var aAllKnots = new Array();
	var aAllNumKnots = new Array();
	var aAllIsClosed = new Array();
	var aAllDegree = new Array();
	var aAllParameterization = new Array();

	// Create boolean array which Subcurves to offset.
	var aSel = new Array(cInCurves.Count);

	for(var i = 0; i < cInCurves.Count; i++)
		aSel[i] = false;	// init

	for(var i = 0; i < oSubcurveCluster.Elements.Count; i++)
		aSel[oSubcurveCluster.Elements(i)] = true;


	for(var subCrv = 0; subCrv < cInCurves.Count; subCrv++)
	{
		// Get input Subcurve.
		var oSubCrv = cInCurves.item(subCrv);
		VBdata = new VBArray(oSubCrv.Get2(siSINurbs));
		var aSubCrvData = VBdata.toArray();

		// Get Point data.
		var VBdata0 = new VBArray(aSubCrvData[0]);
		var aPoints = VBdata0.toArray();
		//var subCrvPntCnt = aPoints.length;

		// Ignore Curves with only one Point.
		if(aPoints.length < 8)
			continue;

		// Get Knot data.
		var VBdata1 = new VBArray(aSubCrvData[1]);
		var aKnots = VBdata1.toArray();
		
		// Get other data
		isClosed = aSubCrvData[2];
		degree = aSubCrvData[3];
		parameterization = aSubCrvData[4];


		// Set Curve Plane/Up-Vector.
		var vP = XSIMath.CreateVector3();
		var vNextPP = XSIMath.CreateVector3();
		var vNextPPn = XSIMath.CreateVector3();
		var vPrevPP = XSIMath.CreateVector3();
		var vPrevPPn = XSIMath.CreateVector3();
		var vLast = XSIMath.CreateVector3();
		var vUp = XSIMath.CreateVector3();
		var vUp1 = XSIMath.CreateVector3();
		var vUp2 = XSIMath.CreateVector3();
		
		switch(curvePlane)
		{
		case 1: // XY
			vUp.Set(0,0,1);
			break;
		case 2: // YZ
			vUp.Set(1,0,0);
			break;
		case 3: // XZ
			vUp.Set(0,1,0);
			break;
		default:
			// Find next non-0 vector.
			//var found = false;
			var len = aPoints.length;
			for(var i = 4; i < len; i += 4)
			{
				vP.Set( aPoints[i], aPoints[i + 1], aPoints[i + 2] );
				vPrevPP.Set( aPoints[i - 4], aPoints[i - 3], aPoints[i - 2] );
				vPrevPP.Sub(vP, vPrevPP);
				if(vPrevPP.X != 0 || vPrevPP.Y != 0 || vPrevPP.Z != 0)
				{
					//found = true;
					break;
				}

			}

			if(i == len)
			{
				// No non-zero vector Point->Point found, assume y as up.
				vUp.Set(0,1,0);

			} else
			{
				// Non-zero vector found.
				if(len == 8)
				{
					vUp = getAnyNormal(vPrevPP);

				} else
				{
					// Find next non-0 vector.
					vLast.Copy(vPrevPP);

					for(; i < len - 4; i += 4)
					{
						vP.Set( aPoints[i], aPoints[i + 1], aPoints[i + 2] );
						vNextPP.Set( aPoints[i + 4], aPoints[i + 5], aPoints[i + 6] );
						vNextPP.Sub(vP, vNextPP);
						vUp.Cross(vLast, vNextPP);
						vUp.Normalize(vUp);
						if(vUp.X != 0 || vUp.Y != 0 || vUp.Z != 0)
							break;
						
					}
				
					if(i == len)
					{
						// No other non-0 vector found.
						vLast.Normalize(vLast);
						//vUp.Set(vLast.Z, vLast.X, vLast.Y);
					}

				}
			
			}

		}

		var MUp = getMatrix4FromVector(vUp);
		

		if(aSel[subCrv]) // && offset > 0)
		{
			// Copy this Subcurve for offsetting.
			var aPointsOffset = aPoints.slice(0); // copy by value
			//var aPointsProj = aPoints.slice(0); // projected to Curve Plane
			var aKnotsOffset = aKnots.slice(0);
			var bAddCurve = true;

			var vPP = XSIMath.CreateVector3();
			var vPN = XSIMath.CreateVector3();
			var vPNPrev = XSIMath.CreateVector3();
			var vNN = XSIMath.CreateVector3();			
			var vN = XSIMath.CreateVector3();
			var vNm = XSIMath.CreateVector3();
			var vNPrev = XSIMath.CreateVector3();
			var corr = 1;

			var aVP = new Array();
			
			// Project all Points to Curve Plane.
			for(var i = 0; i < aPoints.length; i+= 4)
			{
				var vP = XSIMath.CreateVector3();
				vP.Set( aPoints[i], aPoints[i + 1], aPoints[i + 2] );
				vP = pointToPlane(vP, MUp);
				aVP.push(vP);

			}

			var len = aVP.length;

			// Prepare vector arrays.
			var vDiff = XSIMath.CreateVector3();
			var aVNextPP = new Array();
			var aVPrevPP = new Array();



			// Array of Vectors next Point -> Point.
			// If length = 0, store next non-0 (using object pointers).
			for(var i = 0; i < len - 1; i++)
			{
				aVNextPP.push(vNextPP);
				vDiff.Sub( aVP[i], aVP[i + 1] );
				
				if(vDiff.Length() > 0)
				{
					vNextPP.Copy(vDiff);
					vLast.Copy(vNextPP);
					var vNextPP = XSIMath.CreateVector3();
					vNextPP.Copy(vLast);
					
				}

			}

			// Array of Vectors previous Point -> Point.
			for(var i = 1; i < len; i++)
			{
				aVPrevPP.push(vPrevPP);
				vDiff.Sub( aVP[i], aVP[i - 1] );
				
				if(vDiff.Length() > 0)
				{
					vPrevPP.Copy(vDiff);
					vLast.Copy(vPrevPP);
					var vPrevPP = XSIMath.CreateVector3();
					vPrevPP.Copy(vLast);
					
				}
				
			}

			if(isClosed)
			{
				vDiff.Sub( aVP[len - 1], aVP[0] );

				if(vDiff.Length() > 0)
				{
					var vNextPP = XSIMath.CreateVector3();
					vNextPP.Copy(vDiff);
					aVNextPP.push(vNextPP);
					
					vDiff.Negate(vDiff);
					var vPrevPP = XSIMath.CreateVector3();
					vPrevPP.Copy(vDiff);
					aVPrevPP.unshift(vPrevPP);
					
				} else
				{
					aVNextPP.push(aVNextPP[0]);
					aVPrevPP.unshift( aVPrevPP[aVPrevPP.length - 1] );
					
				}

			} else
			{
				// Duplicate first/last Vectors.
				aVNextPP.push( aVNextPP[aVNextPP.length - 1] );
				aVPrevPP.unshift( aVPrevPP[0] );
			}

			
			// MAIN LOOP: offset all Points.
			for(var i = 0; i < len; i++)
			{
				vP.Copy(aVP[i]);

				// Calculate mean Vector.
				vNextPPn.Normalize(aVNextPP[i]);
				vPrevPPn.Normalize(aVPrevPP[i]);
				vN.Add( vNextPPn, vPrevPPn );
				vN.Normalize(vN);

				if(vN.Length() < tol)
				{
					vN.Cross(vUp, aVPrevPP[i]);
					vN.Normalize(vN);
					vN.Scale(offset, vN);

				} else
				{
					// correction factor
					var div = Math.sin( vPrevPPn.Angle(vNextPPn) / 2 );
					if(div == 0) div = 1; // = tol?
					var corr = offset / div;
					vN.Scale(corr, vN);
					
				}

				// Side check
				if(i > 0)
				{
					vPN.Add(vP, vN);
					vPNPrev.Add( aVP[i - 1], vNPrev);
					vNN.Sub(vPN, vPNPrev);
					vNN.Normalize(vNN);
					if(vNN.Length() > tol)
					{
						if( Math.abs( Math.abs(vPrevPPn.X) - Math.abs(vNN.X) ) > tol ||
							 Math.abs( Math.abs(vPrevPPn.Y) - Math.abs(vNN.Y) ) > tol ||
							 Math.abs( Math.abs(vPrevPPn.Z) - Math.abs(vNN.Z) ) > tol )
						{
							vN.Negate(vN);
						}
					}
				}

				vNPrev.Copy(vN);

				if(center)
				{
					vN.Scale(0.5, vN);
					vNm.Negate(vN);
					aPoints[i * 4] += vNm.X;
					aPoints[i * 4 + 1] += vNm.Y;
					aPoints[i * 4 + 2] += vNm.Z;
					
				}
				
				aPointsOffset[i * 4] += vN.X;
				aPointsOffset[i * 4 + 1] += vN.Y;
				aPointsOffset[i * 4 + 2] += vN.Z;
				
			}


			// Connect starts and ends.
			if(!isClosed)
			{
				if(closeStart && !closeEnd)
				{
					// Invert Offset Curve.
					var ret = invertNurbsCurve(aPointsOffset, aKnotsOffset, isClosed);
					aPointsOffset = ret.aPoints;
					aKnotsOffset = ret.aKnots;
					
					// Blend Subcurves at start.
					var ret = blendNurbsCurves(aPointsOffset, aPoints, aKnotsOffset, aKnots, degree, true); // true: linear blend
					aPoints = ret.aPoints;
					aKnots = ret.aKnots;
					bAddCurve = false;
					
				} else if(!closeStart && closeEnd)
				{
					// Invert Offset Curve.
					var ret = invertNurbsCurve(aPoints, aKnots, isClosed);
					aPoints = ret.aPoints;
					aKnots = ret.aKnots;

					// Blend Subcurves at end.
					var ret = blendNurbsCurves(aPointsOffset, aPoints, aKnotsOffset, aKnots, degree, true); // true: linear blend
					aPoints = ret.aPoints;
					aKnots = ret.aKnots;
					bAddCurve = false;

				} else if(closeStart && closeEnd)
				{
					// Invert Offset Curve.
					var ret = invertNurbsCurve(aPointsOffset, aKnotsOffset, isClosed);
					aPointsOffset = ret.aPoints;
					aKnotsOffset = ret.aKnots;
					
					// Blend Subcurves at start.
					var ret = blendNurbsCurves(aPointsOffset, aPoints, aKnotsOffset, aKnots, degree, true); // true: linear blend
					aPoints = ret.aPoints;
					aKnots = ret.aKnots;

					var ret = closeNurbsCurve(aPoints, aKnots, degree, false); // false: close with line
					aPoints = ret.aPoints;
					aKnots = ret.aKnots;
					isClosed = true;
					bAddCurve = false;
				}

			}

		}

	
		// Add Subcurve.
		aAllPoints = aAllPoints.concat(aPoints);
		aAllNumPoints.push(aPoints.length / 4);
		aAllKnots = aAllKnots.concat(aKnots);
		aAllNumKnots.push(aKnots.length);
		aAllIsClosed.push(isClosed);
		aAllDegree.push(degree);
		aAllParameterization.push(parameterization);
		allSubcurvesCnt++;

		if(bAddCurve)
		{
			aAllPoints = aAllPoints.concat(aPointsOffset);
			aAllNumPoints.push(aPointsOffset.length / 4);
			aAllKnots = aAllKnots.concat(aKnotsOffset);
			aAllNumKnots.push(aKnotsOffset.length);
			aAllIsClosed.push(isClosed);
			aAllDegree.push(degree);
			aAllParameterization.push(parameterization);
			allSubcurvesCnt++;
		}

	} // end for subCrv


	// Debug
/*	LogMessage("Setting CurveList -");
	LogMessage("allSubcurvesCnt:      " + allSubcurvesCnt);
	logControlPointsArray("aAllPoints: ", aAllPoints, 100);
	LogMessage("aAllPoints.length/4:  " + aAllPoints.length/4);
	LogMessage("aAllNumPoints:        " + aAllNumPoints);
	logKnotsArray("aAllKnots: " + aAllKnots, 100);
	LogMessage("aAllKnots.length:     " + aAllKnots.length);
	LogMessage("aAllNumKnots:         " + aAllNumKnots);
	LogMessage("aAllIsClosed:         " + aAllIsClosed);
	LogMessage("aAllDegree:           " + aAllDegree);
	LogMessage("aAllParameterization: " + aAllParameterization);
*/

	// Set output CurveList.
	outCrvListGeom.Set(
		allSubcurvesCnt,		// 0. number of Subcurves in the Curvelist
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


function getAnyNormal(v)
{
	var vN = XSIMath.CreateVector3();

	if(v.X == 0 && v.Y == 1 && v.Z == 0)
		vN.Set(-1,0,0);
	else
		vN.Set(0,1,0);
		
	vN.Cross(v, vN);
	vN.Normalize(vN);
	
	return vN;
	
}


function getMatrix4FromVector(v)
{
	// Create an (arbitrary) Matrix with vUp as Y.
	var v1 = getAnyNormal(v);
	var v2 = XSIMath.CreateVector3();
	var M = XSIMath.CreateMatrix4();
	var MUp = XSIMath.CreateMatrix4();

	v2.Cross(v, v1); // normal to vUp
	v2.Normalize(v2);
	// v, v1, v2 are now orthonormal.
	M.Set(	v1.X, v1.Y, v1.Z, 0,
			v.X, v.Y, v.Z, 0,
			v2.X, v2.Y, v2.Z, 0,
			0, 0, 0, 1);

	return M;

}


function pointToPlane(v, M)
{
	// Project Point on Curve Plane.
/*	if(vUp.X)
		v.X = 0;
	else if(vUp.Y)
		v.Y = 0;
	else
		v.Z = 0;
*/
	var MInv = XSIMath.CreateMatrix4();
	MInv.Invert(M);
	v.MulByMatrix4(v, MInv);
	v.Y = 0; // project Point to XZ
	v.MulByMatrix4(v, M);

	return v;

}


function blendNurbsCurves(aPoints0, aPoints1, aKnots0, aKnots1, degree, bStyle)
{
	// This function blends only open Subcurves!
	// Curve 1 is appended to Curve 0.
//logControlPointsArray("aPoints0 in blend:", aPoints0, 100);
//logKnotsArray("aKnots0 in blend:", aKnots0, 100);
//logControlPointsArray("aPoints1 in blend:", aPoints1, 100);
//logKnotsArray("aKnots1 in blend:", aKnots1, 100);

	if(bStyle == true)
	{
		// Linear blend

		// Points
		// Begin
		var vb = XSIMath.CreateVector3();
		vb.X = aPoints0[aPoints0.length - 4];
		vb.Y = aPoints0[aPoints0.length - 3];
		vb.Z = aPoints0[aPoints0.length - 2];
		// End
		var ve = XSIMath.CreateVector3();
		ve.X = aPoints1[0];
		ve.Y = aPoints1[1];
		ve.Z = aPoints1[2];

		var v = XSIMath.CreateVector3();
		v.Sub(ve, vb);

		switch(degree)
		{
			case 1:
				break;

			case 2:
				v.Scale(0.5, v);
				ve.Sub(ve, v);
				aPoints0.push(ve.X);
				aPoints0.push(ve.Y);
				aPoints0.push(ve.Z);
				aPoints0.push(1); // weight
				break;

			default:
				v.Scale(1/3, v);
				// 2nd last Point
				ve.Sub(ve, v);
				aPoints0.push(ve.X);
				aPoints0.push(ve.Y);
				aPoints0.push(ve.Z);
				aPoints0.push(1); // weight
				// Last Point
				vb.Add(vb, v);
				aPoints0.push(vb.X);
				aPoints0.push(vb.Y);
				aPoints0.push(vb.Z);
				aPoints0.push(1); // weight

		}

		aPoints0 = aPoints0.concat(aPoints1);

		// Knots
//logKnotsArray("aKnots0: ", aKnots0, 100);
//logKnotsArray("aKnots1: ", aKnots0, 100);
		var offset = aKnots0[aKnots0.length - 1] - aKnots1[0] + 1;
//LogMessage("offset: " + offset);
		for(var i = 0; i < aKnots1.length; i++)
			aKnots1[i] += offset;

		aKnots0 = aKnots0.concat(aKnots1);

	} else
	{
		// Curved blend
		
		// Points
		
		// Knots

	}
//logControlPointsArray("aPoints0 after blend:", aPoints0, 100);
//logKnotsArray("aKnots0 after blend:", aKnots0, 100);
		

	return {aPoints:aPoints0,
			aKnots:aKnots0};
}


function closeNurbsCurve(aPoints, aKnots, degree, closingMode)
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
		
			if(closingMode)
			{
				// Standard close, Point array does not change.
				
				// Adapt Knot Vector length: on closed Curves: K = P + 1
				// degree 1: one Knot more
				// degree 2: same length
				// degree 3: one Knot less
				aKnots.length = aPoints.length / 4 + 1;	// /4: x,y,z,w
				
				// Set first Knot(s)
				// degree 1: [0,1,...]
				// degree 2: [-1,0,1,...]
				// degree 3: [-2,-1,0,1,...]
				for(var i = degree - 2; i >= 0; i--)
					aKnots[i] = aKnots[i + 1] - 1;
				
				// Set last Knot = 2nd last + 1
				aKnots[aKnots.length - 1] = aKnots[aKnots.length - 2] + 1;				
			} else
			{
				// Close with connecting line.

				// Begin
				var vb = XSIMath.CreateVector3();
				vb.X = aPoints[0];
				vb.Y = aPoints[1];
				vb.Z = aPoints[2];
				// End
				var ve = XSIMath.CreateVector3();
				ve.X = aPoints[aPoints.length - 4];
				ve.Y = aPoints[aPoints.length - 3];
				ve.Z = aPoints[aPoints.length - 2];

				var v = XSIMath.CreateVector3();				
				v.Sub(ve, vb);

				switch(degree)
				{
					case 1:
						break;

					case 2:
						v.Scale(0.5, v);
						ve.Sub(ve, v);
						aPoints.push(ve.X);
						aPoints.push(ve.Y);
						aPoints.push(ve.Z);
						aPoints.push(1); // weight
						break;

					default:
						v.Scale(1/3, v);
						// 2nd last Point
						ve.Sub(ve, v);
						aPoints.push(ve.X);
						aPoints.push(ve.Y);
						aPoints.push(ve.Z);
						aPoints.push(1); // weight
						// Last Point
						vb.Add(vb, v);
						aPoints.push(vb.X);
						aPoints.push(vb.Y);
						aPoints.push(vb.Z);
						aPoints.push(1); // weight

				}
				
				// Knots
				aKnots.push( aKnots[aKnots.length - 1] + 1 );
			
			}

		}

	}
//logControlPointsArray(aPoints);
//logKnotsArray(aKnots);
	return {aPoints:aPoints,
			aKnots:aKnots};
}


function invertNurbsCurve(aPoints, aKnots, isClosed)
{
	// Invert Point array.
	var pLen = aPoints.length;
	var aPointsInv = new Array(pLen);

	for(var i = 0; i < aPoints.length; i += 4)
	{
		aPointsInv[i] = aPoints[aPoints.length - i - 4];
		aPointsInv[i + 1] = aPoints[aPoints.length - i - 3];
		aPointsInv[i + 2] = aPoints[aPoints.length - i - 2];
		aPointsInv[i + 3] = aPoints[aPoints.length - i - 1];
	}
 
	if(isClosed)
	{
		// Shift Point array right, so the former first Points is first again.
		// original:	0,1,2,3,4
		// reverse:		4,3,2,1,0
		// correct: 	0,4,3,2,1
		aPointsInv = ( aPointsInv.slice(pLen - 4) ).concat( aPointsInv.slice( 0, pLen - 4) );

	}

	// Invert Knot array.
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


// Function to remove empty items from a JScript Array
// e.g. NurbsCurveList.Get2 returns "dirty" Knot Arrays
/*function removeUndefinedElementsFromArray(dirtyArr)
{
	var arr = new Array();
	for(var i = 0; i < dirtyArr.length; i++)
	{
		if(dirtyArr[i] != undefined) arr.push( dirtyArr[i] );
	}
	return arr;
}
*/

function OffsetSubcurves_DefineLayout( in_ctxt )
{
	var oLayout,oItem;
	oLayout = in_ctxt.Source;
	oLayout.Clear();
	//oLayout.AddRow();
	//oLayout.AddItem("duplicates", "Duplicates");
// ToDo: Radio Button for param "distribution"
	//oLayout.AddGroup("Translation", true);
	oLayout.AddItem("offset", "Offset");
	oLayout.AddItem("center", "Center");
	
	oLayout.AddGroup("On open Curves", true);
	oLayout.AddItem("closeStart", "Connect at start");
	oLayout.AddItem("closeEnd", "Connect at end");
	oLayout.EndGroup();
	
	var aRadioItems = ["Automatic", 0, "XY", 1, "XZ", 2, "YZ", 3];
	oLayout.AddEnumControl("curvePlane", aRadioItems, "Curve Plane", siControlRadio);
	//oLayout.EndGroup();
	//oLayout.EndRow();
	return true;
}


function ApplyOffsetSubcurves_Menu_Init( in_ctxt )
{
	var oMenu;
	oMenu = in_ctxt.Source;
	oMenu.AddCommandItem("Offset Subcurves","ApplyOffsetSubcurves");
	return true;
}


function OffsetSubcurves_offset_OnChanged( )
{
	Application.LogMessage("OffsetSubcurves_offset_OnChanged called",siVerbose);
	var oParam;
	oParam = PPG.offset;
	var paramVal;
	paramVal = oParam.Value;
	Application.LogMessage("New value: " + paramVal,siVerbose);
}



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


function logControlPointsArray(sLog, aPoints, dp)
{
	LogMessage(sLog);
	
	for ( var i = 0; i < aPoints.length; i += 4 )
	{
		var x = aPoints[i];
		var y = aPoints[i + 1];
		var z = aPoints[i + 2];
		var w = aPoints[i + 3]; 
		LogMessage( "[" + i/4 + "]: x = " + Math.round(x*dp)/dp +
									"; y = " + Math.round(y*dp)/dp +
									"; z = " + Math.round(z*dp)/dp );
									// + "; w = " + Math.round(w*dp)/dp );

	}

}


function logKnotsArray(sLog, aKnots, dp)
{
	//LogMessage(sLog);
	var sKnotArray = sLog;
	for ( var j = 0; j < aKnots.length; j++ )
	{
		var knotValue = Math.round(aKnots[j]*dp)/dp;
		if ( j == 0 ) sKnotArray = sKnotArray + /*"Knot Vector: " + */knotValue;//.toString(10);
		else sKnotArray = sKnotArray + ", " + knotValue;
	}
	
	LogMessage( sKnotArray );

}


function logNormalArray(sLog, aNormals, dp)
{
	LogMessage(sLog);

	for(var i = 0; i < aNormals.length; i += 3)
	{
		var x = aNormals[i];
		var y = aNormals[i + 1];
		var z = aNormals[i + 2];
		//var w = aPoints[i + 3]; 
		LogMessage( "[" + i/3 + "]: x = " + Math.round(x*dp)/dp +
									"; y = " + Math.round(y*dp)/dp +
									"; z = " + Math.round(z*dp)/dp );
	}
	
}


function logVector3(sLog, v, dp)
{
	sLog += "x = " + Math.round(v.X*dp)/dp +
			"; y = " + Math.round(v.Y*dp)/dp +
			"; z = " + Math.round(v.Z*dp)/dp;
	LogMessage(sLog);
	
}