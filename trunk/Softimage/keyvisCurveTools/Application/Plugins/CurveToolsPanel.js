//______________________________________________________________________________
// CurveToolsPanelPlugin
// 2011/06 by Eugen Sares
// last update: 2011/08/29
//______________________________________________________________________________

function XSILoadPlugin( in_reg )
{
	in_reg.Author = "Eugen Sares";
	in_reg.Name = "CurveToolsPanelPlugin";
	in_reg.Major = 1;
	in_reg.Minor = 0;

	in_reg.RegisterProperty("CurveToolsPanel");
	in_reg.RegisterMenu(siMenuTbModelModifyCurveID,"CurveToolsPanel_Menu",false,false);
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


function CurveToolsPanel_Define( in_ctxt )
{
	var oCustomProperty;
	oCustomProperty = in_ctxt.Source;
	var oGridParam = oCustomProperty.AddGridParameter("CrvGrid");
	// To change the contents of the grid via scripting use the GridData object,
	// which is accessible via the Parameter.Value property.
	var oCrvGrid = oGridParam.Value;
	oCrvGrid.RowCount = 0;
	oCrvGrid.ColumnCount = 9;
	//oCrvGrid.SetColumnLabel(0, "Curve");
	oCrvGrid.SetColumnLabel(1, "NurbsCurveList.Name");
	oCrvGrid.SetColumnLabel(2, "SubCrv");
	oCrvGrid.SetColumnLabel(3, "Get"); // flag: Subcurve gets Isopoints
	oCrvGrid.SetColumnType(3, siColumnBool);
	oCrvGrid.SetColumnLabel(4, "Set"); // flag: Subcurve sets Isopoints
	oCrvGrid.SetColumnType(4, siColumnBool);
	oCrvGrid.SetColumnLabel(5, "Self"); // flag: Subcurve is checked for self-intersections
	oCrvGrid.SetColumnType(5, siColumnBool);
	//oCrvGrid.SetColumnLabel(6, "SubD data");
	//oCrvGrid.SetColumnLabel(7, "BBox");
	//oCrvGrid.SetColumnLabel(8, "isClosed");
	oCrvGrid.SetColumnType(8, siColumnBool);
		
	oCustomProperty.AddParameter2("Approximation",siInt4,6,1,20,1,10,siClassifUnknown,siPersistable | siKeyable);
	oCustomProperty.AddParameter2("Tolerance",siInt4,-8,-20,20,-20,1,siClassifUnknown,siPersistable | siKeyable);
	oCustomProperty.AddParameter2("Divisions",siInt4,5,1,100,1,10,siClassifUnknown,siPersistable | siKeyable);
	oCustomProperty.AddParameter2("ApproximationDiv",siInt4,20,1,100,1,40,siClassifUnknown,siPersistable | siKeyable);
	oCustomProperty.AddParameter2("SelectOverStartEnd",siBool,false,"","","","",siClassifUnknown,siPersistable);
	oCustomProperty.AddParameter2("SelectStartEnd",siBool,false,"","","","",siClassifUnknown,siPersistable);
	//oCustomProperty.AddParameter2("IsopointHelp",siInt4,1,0,100,0,100,siClassifUnknown,siPersistable/* | siKeyable*/);
	oCustomProperty.AddParameter2("CmdLogging",siBool,false,"","","","",siClassifUnknown,siPersistable);
	oCustomProperty.AddParameter2("DivisionMethod",siBool,true,"","","","",siClassifUnknown,siPersistable);
	return true;
}


// Tip: Use the "Reload" option on the Property Page context menu to 
// reload your script changes and re-execute the DefineLayout callback.
function CurveToolsPanel_DefineLayout( in_ctxt )
{
	var oLayout,oItem;
	oLayout = in_ctxt.Source;
	oLayout.Clear();
	//oLayout.SetAttribute(siUIHelpFile, "http://www.keyvis.at/?page_id=68");

	oLayout.AddGroup("CurveLists, Subcurves");
		oLayout.AddGroup("Select");
			oLayout.AddRow();
			oLayout.AddButton("SetSelFilterObject", "Object");
			oLayout.AddButton("SetSelFilterSubcurve", "Subcurve");
			oLayout.AddButton("Deselect", "Deselect All");
			oLayout.EndRow();
		oLayout.EndGroup();

		oLayout.AddGroup("Edit");
			oLayout.AddRow();
			oLayout.AddButton("AttachCurves", "AttachCurves");
			oLayout.AddButton("ExtractAllSubcurves", "Extract All Subcurves");
			oLayout.EndRow();
			oLayout.AddRow();
			oLayout.AddButton("DeleteSubcurves", "Delete Subcurves");
			oLayout.AddButton("DuplicateSubcurves", "Duplicate Subcurves");
			oLayout.AddButton("InvertSubcurves", "Invert (Sub)Curves");
			oLayout.AddButton("OpenCloseSubcurves", "Open/Close (Sub)Curves");
			oLayout.AddButton("OffsetSubcurves", "Offset (Sub)Curves");
			oLayout.EndRow();	
		oLayout.EndGroup();
	oLayout.EndGroup();
	
	//oLayout.AddSpacer();

	oLayout.AddGroup("Isopoints, Knots");
		oLayout.AddGroup("Select");
			oLayout.AddRow();
			oLayout.AddButton("SetSelFilterIsopoint", "Isopoint");
			oLayout.AddButton("SetSelFilterKnot", "Knot");
			oLayout.AddButton("Deselect", "Deselect All");
			oLayout.EndRow();
			

			oLayout.AddGroup("Intersections");
				oLayout.AddRow();
				oLayout.AddButton("Reload", "(Re)Load from Selection");
				//oLayout.AddButton("AddCurves", "Add sel. Curves");
				oLayout.AddButton("RemoveCurves", "Remove sel. Rows");
				oLayout.EndRow();
				oPPGItem = oLayout.AddItem("CrvGrid", siControlGrid);
				oPPGItem.SetAttribute(siUINoLabel, true);
				//oPPGItem.SetAttribute(siUIValueOnly,true);
				//oPPGItem.SetAttribute(siUICX, 330);
				oPPGItem.SetAttribute(siUICY, 103);
				//oPPGItem.SetAttribute(siUIGridHideRowHeader, true);
				oPPGItem.SetAttribute("ColumnWidths", "14:0:148:44:24:24:24:0:0:0"); // first entry: row label

				var oItem = oLayout.AddItem("Approximation", "Approx. Steps");
				oItem.SetAttribute(siUICX, 200);
				oTolerance = oLayout.AddItem("Tolerance", "Tolerance, 10^");
				oTolerance.SetAttribute(siUICX, 200);
				oLayout.AddRow();
				oLayout.AddButton("SelectIntersectionIsopoints", "Select Intersection Isopoints");
				oLayout.AddButton("HelpOnIntersectionIsopoints", "Help");
				oLayout.EndRow();
				//oLayout.AddItem("CmdLogging", "Command Logging");
				//oLayout.EndGroup();
			oLayout.EndGroup();

			oLayout.AddGroup("Divisions");
				var oItem = oLayout.AddItem("Divisions", "Divisions");
				oItem.SetAttribute(siUICX, 220);
				var aRadioItems = ["Percentage", true, "Length (uses 'Approx. Steps')", false];
				var oItem = oLayout.AddEnumControl("DivisionMethod", aRadioItems, "Divs get equal", siControlRadio);
				oItem.SetAttribute(siUICX, 220);
				var oItem = oLayout.AddItem("ApproximationDiv", "Approx. Steps");
				oItem.SetAttribute(siUICX, 220);
				oLayout.AddItem("SelectStartEnd", "Also select Isopoints at Start & End");
				oLayout.AddItem("SelectOverStartEnd", "On closed Curves, select over Start/End");
				oLayout.AddRow();
				oLayout.AddButton("SelectDivisionIsopoints", "Select Division Isopoints");
				oLayout.AddButton("HelpOnEquidistantIsopoints", "Help");
				oLayout.EndRow();
			oLayout.EndGroup();
		oLayout.EndGroup();
	
		oLayout.AddGroup("Edit");
			oLayout.AddRow();
			oLayout.AddButton("InsertKnots1", "Insert Knot");
			oLayout.AddButton("InsertKnots2", "Insert Mult. 2 Knot");
			oLayout.AddButton("InsertKnots3", "Insert Bezier-Knot");
			oLayout.EndRow();
			oLayout.AddButton("Scissor", "Scissor");
		oLayout.EndGroup();
	oLayout.EndGroup();

	oLayout.AddGroup("Curve Boundaries");
		oLayout.AddGroup("Select");
			oLayout.AddRow();
			oLayout.AddButton("SetSelFilterCurveBoundary", "Curve Boundary");
			oLayout.AddButton("Deselect", "Deselect All");
			oLayout.EndRow();
		oLayout.EndGroup();
		oLayout.AddGroup("Edit");
			oLayout.AddRow();
			oLayout.AddButton("MergeSubcurves", "Merge Subcurves");
			oLayout.AddButton("BlendSubcurves", "Blend Subcurves");
			oLayout.EndRow();
		oLayout.EndGroup();
	oLayout.EndGroup();

	return true;
}


function getImagesPath()
{
	var sImagesPath = "";
	var cPlugins = Application.Plugins;
	for(var i = 0; i < cPlugins.Count; i++)
	{
		if(cPlugins(i).Name == "CurveToolsPanelPlugin")
		{
			sImagesPath = cPlugins(i).OriginPath;
			sImagesPath = sImagesPath.substr(0, sImagesPath.length - 20) + "Data\\Images";
			break;
		}
	}
	return sImagesPath;
}


function CurveToolsPanel_OnInit( )
{
	Application.LogMessage("CurveToolsPanel_OnInit called",siVerbose);
	var oGridData = PPG.CrvGrid.Value;
	oGridData.RowCount = 0;
	initGridData(oGridData);
	return true;
}


function CurveToolsPanel_OnClosed( )
{
	Application.LogMessage("CurveToolsPanel_OnClosed called",siVerbose);
}


function CurveToolsPanel_Reload_OnClicked( )
{
	Application.LogMessage("CurveToolsPanel_Reload_OnClicked called",siVerbose);
	var oGridData = PPG.CrvGrid.Value;
	oGridData.RowCount = 0;
	initGridData(oGridData);
	PPG.Refresh();
}


function CurveToolsPanel_AddCurves_OnClicked( )
{
	Application.LogMessage("CurveToolsPanel_AddCurves_OnClicked called",siVerbose);
	var oGridData = PPG.CrvGrid.Value;
	//oGridData.RowCount = 0;
	initGridData(oGridData);
	PPG.Refresh();
}


function CurveToolsPanel_RemoveCurves_OnClicked( )
{
	Application.LogMessage("CurveToolsPanel_RemoveCurves_OnClicked called",siVerbose);
	var oGridData = PPG.CrvGrid.Value;
	deleteRow(oGridData);
	var oGridData = PPG.CrvGrid.Value;
	PPG.Refresh();
}


//______________________________________________________________________________

// Select Isopoints at Subcurve intersections.
function CurveToolsPanel_SelectIntersectionIsopoints_OnClicked( )
{
	Application.LogMessage("CurveToolsPanel_SelectDivisionIsopoints_OnClicked called",siVerbose);

	// Disable command logging
	var prefs = Application.Preferences;
	var origSetting = prefs.GetPreferenceValue("scripting.cmdlog"); // .cmdlog or .msglog
	if(origSetting && !PPG.CmdLogging.Value)
		prefs.SetPreferenceValue("scripting.cmdlog", false);

	// Combine all Isopoint selection Commands to one undo.	
	Application.OpenUndo("SelectIntersectionIsopoints");

	try
	{
		SetSelFilter(siIsopointFilter);
		oCrvGrid = PPG.CrvGrid.Value;

		var tol = Math.pow(10, PPG.Tolerance);

		// Loop through all rows in the GridData object.
		// Check each Subcurve against all following.
		for(var crv0 = 0; crv0 < oCrvGrid.RowCount; crv0++)
		{
			// Ignore Subcurve if it's neither an Isopoint getter nor a setter.
			if(!oCrvGrid.GetCell(3, crv0) && !oCrvGrid.GetCell(4, crv0) )
				continue; 

			createCrvSubDsAndBBox(oCrvGrid, crv0);
			var aSubDs0 = oCrvGrid.GetCell(6, crv0);


		// SELF-INTERSECTION CHECK
			if(oCrvGrid.GetCell(5, crv0) == true)
			{
				// If the Subcurve is Closed, skip checking against the last SubD.
				//var len = aSubDs0.length;
				//if(oCrvGrid.GetCell(8, crv0)) // closed Subcurve?
					//len--;

				for(var i = 0; i < aSubDs0.length; i++)
				{
					var oSubD0 = aSubDs0[i];
					var len = aSubDs0.length;
					// If Subcurve is closed, skip checking first and last SubD - they always intersect.
					if(i == 0)
						if(oCrvGrid.GetCell(8, crv0))
							len--;

					for(var j = i + 2; j < len; j++) // Skipt checking neighbouring SubDs - they always intersect.
					{
						var oSubD1 = aSubDs0[j];
						selectIntersectionIsopoints(oSubD0, oSubD1, crv0, crv0, tol);
					}
				}
			}


		// INTERSECTION CHECK
			for(var crv1 = crv0 + 1; crv1 < oCrvGrid.RowCount; crv1++)
			{
				// Ignore Subcurve if it's neither an Isopoint getter nor a setter.
				if(!oCrvGrid.GetCell(3, crv1) && !oCrvGrid.GetCell(4, crv1) )
					continue; 

				createCrvSubDsAndBBox(oCrvGrid, crv1);
				var aSubDs1 = oCrvGrid.GetCell(6, crv1);

				// Skip Subcurve j if Curve BBoxes do not intersect.
				if(!checkBBoxIntersection( oCrvGrid.GetCell(7, crv0), oCrvGrid.GetCell(7, crv1), tol ) )
					continue;

				for(var i = 0; i < aSubDs0.length; i++)
				{
					var oSubD0 = aSubDs0[i];

					for(var j = 0; j < aSubDs1.length; j++)
					{
						var oSubD1 = aSubDs1[j];
						selectIntersectionIsopoints(oSubD0, oSubD1, crv0, crv1, tol);
					}
				}
			}
		}
	} catch(e)
	{
		//LogMessage(e, siWarning);
		LogMessage("Curves do not exist. Use '(Re)Load from Selection' first.", siWarning);
		Application.CloseUndo();
		prefs.SetPreferenceValue("scripting.cmdlog", origSetting);
		return false;
	};

	Application.CloseUndo();
	// Restore logging setting to the way it was.
	prefs.SetPreferenceValue("scripting.cmdlog", origSetting);
	return true;
}


//______________________________________________________________________________

// Prepare data for intersection check.
function createCrvSubDsAndBBox(oCrvGrid, crv) // Params: GridData object, row index of GridData
{
	var aSubDs = []; // array of linear Subdivisions of a Subcurve
			
	// Get input Subcurve.
	var oCrv = oCrvGrid.GetCell(0, crv); // Column 0: NurbsCurveList object
	var subCrv = oCrvGrid.GetCell(2, crv);
	var cCurves = oCrv.ActivePrimitive.Geometry.Curves;
	var oSubCrv = cCurves.item(subCrv);
	VBdata = new VBArray(oSubCrv.Get2(siSINurbs));
	var aSubCrvData = VBdata.toArray();

	// Get Point data.
	var vbArg0 = new VBArray(aSubCrvData[0]);
	var aPoints = vbArg0.toArray();

	// Compensate object transforms.
	var KINEGLOBAL = oCrv.Kinematics.Global.Transform.Matrix4;

	for(var i = 0; i < aPoints.length; i += 4)
	{
		var vP = XSIMath.CreateVector3();
		vP.X = aPoints[i];
		vP.Y = aPoints[i + 1];
		vP.Z = aPoints[i + 2];
		vP.MulByMatrix4(vP, KINEGLOBAL);		
		aPoints[i] = vP.X;
		aPoints[i + 1] = vP.Y;
		aPoints[i + 2] = vP.Z;
	}

	// Get Knot data.
	var vbArg1 = new VBArray(aSubCrvData[1]);
	var aKnots = vbArg1.toArray();
	aKnots = allKnotsToMultiplicity1(aKnots);
	var knotCnt = aKnots.length;

	// Get other data.
	var degree = aSubCrvData[3];
	if(degree == 1)
		var numSubDs = 1;
	else
	{
		// Get approx. steps from OGL settings.
		//sParam = oCrv.Name + ".geomapprox.gapproxvwcustep";
		//var numSubDs = GetValue(sParam);
			
		// Get approx. steps from PPG.
		numSubDs = PPG.Approximation;
	}
	var isClosed = aSubCrvData[2];
	oCrvGrid.SetCell(8, crv, isClosed);


	// CREATE SUBDIVISIONS.

	// First SubD, start vector = first point on curve
	var aRet = oSubCrv.EvaluatePosition(aKnots[0]).toArray();
	var vP = aRet[0];
	vP.MulByMatrix4(vP, KINEGLOBAL); // compensate object transforms
	var x = vP.x;
	var y = vP.y;
	var z = vP.z;

	// start and end u
	var u0 = 0;
	var u1 = aKnots[0]; // Knot vectors not always start with 0!

	for(var seg = 0; seg < knotCnt - 1; seg++) // segment: between two neighboring Knots
	{
		// KnotInterval / number of SubDs per interval
		var subDLength = (aKnots[seg + 1] - aKnots[seg]) / numSubDs;

		for(var subD = 1; subD <= numSubDs; subD++) // subDs: linear pieces of a segment
		{
			var oSubD = new Object(); // object containing data of one subD
			oSubD.uStart = aKnots[0];
			oSubD.uEnd = aKnots[knotCnt - 1];
			// start u of subD = previous
			u0 = u1;
			oSubD.u0 = u0;
			// end u of subD
			u1 = aKnots[seg] + subD * subDLength;
			oSubD.u1 = u1;
				
			// start Point vector = previous
			oSubD.vP0 = XSIMath.CreateVector3(x, y, z);

			// end Point vector
			//var aRet = cCurves(subCrv).EvaluatePosition(u1).toArray(); // end Vector
			var aRet = oSubCrv.EvaluatePosition(u1).toArray(); // end Vector
			var vP = aRet[0];
			vP.MulByMatrix4(vP, KINEGLOBAL);
			x = vP.x;
			y = vP.y;
			z = vP.z;
			oSubD.vP1 = XSIMath.CreateVector3(x, y, z);
			aSubDs.push(oSubD);
		}
	}
		
	oCrvGrid.SetCell(6, crv, aSubDs);

	// Create BoundingBox.
	var oBBox = createBBoxFromPointArray(aPoints);
	oCrvGrid.SetCell(7, crv, oBBox);
}


function selectIntersectionIsopoints(oSubD0, oSubD1, crv0, crv1, tol)
{
	// Create and check BBox of the two SubDs.
	var oBBox0 = createBBoxFromSegment(oSubD0.vP0, oSubD0.vP1);
	var oBBox1 = createBBoxFromSegment(oSubD1.vP0, oSubD1.vP1)
	if( !checkBBoxIntersection(oBBox0, oBBox1, tol) )
		return;

	// Get closest distance of SubDs.
	var oRet = dist3DSegToSeg(oSubD0.vP0, oSubD0.vP1, oSubD1.vP0, oSubD1.vP1/*, tol*/);
	var vDP = oRet.vDP;
	var sc = oRet.sc;
	var tc = oRet.tc;

	if(Math.abs(vDP.X) < tol && Math.abs(vDP.Y) < tol && Math.abs(vDP.Z) < tol)
	{
		// Select Isopoint on first Subcurve if it's a getter and the other a setter.
		if(oCrvGrid.GetCell(3, crv0) && oCrvGrid.GetCell(4, crv1)) // 3: bGet, 4: bSet
		{
			var u = oSubD0.u0 + sc * (oSubD0.u1 - oSubD0.u0);
			var p = (u - oSubD0.uStart) / (oSubD0.uEnd - oSubD0.uStart);
			var sCnx = oCrvGrid.GetCell(1, crv0) + ".isopnt[("; // 1: Name
			sCnx = sCnx + oCrvGrid.GetCell(2, crv0) + "," + p + ")]"; // 2: subCrvIdx
			AddToSelection(sCnx, null, null);
		}

		// Select Isopoint on second Subcurve if it's a getter and the other a setter.
		if(oCrvGrid.GetCell(3, crv1) && oCrvGrid.GetCell(4, crv0)) // 3: bGet, 4: bSet
		{
			var u = oSubD1.u0 + tc * (oSubD1.u1 - oSubD1.u0);
			var p = (u - oSubD1.uStart) / (oSubD1.uEnd - oSubD1.uStart);
			var sCnx = oCrvGrid.GetCell(1, crv1) + ".isopnt[("; // 1: Name
			sCnx = sCnx + oCrvGrid.GetCell(2, crv1) + "," + p + ")]"; // 2: subCrv
			AddToSelection(sCnx, null, null);
		}
	}
}


function createBBoxFromPointArray(aPoints) 
{
	var oBBox = new Object();
	oBBox.xmin = aPoints[0];
	oBBox.ymin = aPoints[1];
	oBBox.zmin = aPoints[2];
	oBBox.xmax = aPoints[0];
	oBBox.ymax = aPoints[1];
	oBBox.zmax = aPoints[2];

	for(var i = 0; i < aPoints.length; i += 4)
	{
		x = aPoints[i];
		y = aPoints[i + 1];
		z = aPoints[i + 2];

		if(x < oBBox.xmin)
			oBBox.xmin = x;
		else if(x > oBBox.xmax)
			oBBox.xmax = x;
		if(y < oBBox.ymin)
			oBBox.ymin = y;
		else if(y > oBBox.ymax)
			oBBox.ymax = y;
		if(z < oBBox.zmin)
			oBBox.zmin = z;
		else if(z > oBBox.zmax)
			oBBox.zmax = z;
	}

	return oBBox;
}


function createBBoxFromSegment(v0, v1)
{
	var oBBox = new Object();
	if(v0.X < v1.X)
	{
		oBBox.xmin = v0.X;
		oBBox.xmax = v1.X;
	} else
	{
		oBBox.xmin = v1.X;
		oBBox.xmax = v0.X;
	}

	if(v0.Y < v1.Y)
	{
		oBBox.ymin = v0.Y;
		oBBox.ymax = v1.Y;
	} else
	{
		oBBox.ymin = v1.Y;
		oBBox.ymax = v0.Y;
	}

	if(v0.Z < v1.Z)
	{
		oBBox.zmin = v0.Z;
		oBBox.zmax = v1.Z;
	} else
	{
		oBBox.zmin = v1.Z;
		oBBox.zmax = v0.Z;
	}

	return oBBox;
}


function checkBBoxIntersection(oBBox0, oBBox1, tol)
{
	if(oBBox1.xmin < oBBox0.xmin - tol && oBBox1.xmax < oBBox0.xmin - tol)
		return false;
	else if(oBBox1.xmin > oBBox0.xmax + tol && oBBox1.xmax > oBBox0.xmax + tol)
		return false;
	else if(oBBox1.ymin < oBBox0.ymin - tol && oBBox1.ymax < oBBox0.ymin - tol)
		return false;
	else if(oBBox1.ymin > oBBox0.ymax + tol && oBBox1.ymax > oBBox0.ymax + tol)
		return false;
	else if(oBBox1.zmin < oBBox0.zmin - tol && oBBox1.zmax < oBBox0.zmin - tol)
		return false;
	else if(oBBox1.zmin > oBBox0.zmax + tol && oBBox1.zmax > oBBox0.zmax + tol)
		return false;

	return true;
}


// http://softsurfer.com/Archive/algorithm_0106/algorithm_0106.htm
function dist3DSegToSeg(vS0P0, vS0P1, vS1P0, vS1P1/*, tol*/)
{
	var tol = 10E-15;
	var vU = XSIMath.CreateVector3(); // segment 0
	var vV = XSIMath.CreateVector3(); // segment 1
	var vW = XSIMath.CreateVector3(); // begin S0 to begin S1
	var vDP = XSIMath.CreateVector3(); // difference vector of the two closest points
	vU.Sub(vS0P1, vS0P0);
	vV.Sub(vS1P1, vS1P0);
	vW.Sub(vS0P0, vS1P0);

	var a = vU.Dot(vU);  // always >= 0
	var b = vU.Dot(vV);
	var c = vV.Dot(vV); // always >= 0
	var d = vU.Dot(vW);
	var e = vV.Dot(vW);
	var D = a*c - b*b; // always >= 0
	var sc = D; // sc = sN / sD, default sD = D >= 0
	var sN = D;
	var sD = D;
	var tc = D; // tc = tN / tD, default tD = D >= 0
	var tN = D;
	var tD = D;

	// compute the line parameters of the two closest points
	if(D < tol)
	{
		// the lines are almost parallel
		sN = 0.0; // force using point P0 on segment S1
		sD = 1.0; // to prevent possible division by 0.0 later
		tN = e;
		tD = c;
	} else
	{	// get the closest points on the infinite lines
		sN = (b*e - c*d);
		tN = (a*e - b*d);
		if (sN < 0.0)
		{	// sc < 0 => the s=0 edge is visible
			sN = 0.0;
			tN = e;
			tD = c;
		} else if(sN > sD)
		{	// sc > 1 => the s=1 edge is visible
			sN = sD;
			tN = e + b;
			tD = c;
		}
	}

	if(tN < 0.0)
	{	// tc < 0 => the t=0 edge is visible
		tN = 0.0;
		// recompute sc for this edge
		if (-d < 0.0)
			sN = 0.0;
		else if(-d > a)
			sN = sD;
		else
		{
			sN = -d;
			sD = a;
		}
	}
	else if(tN > tD)
	{	// tc > 1 => the t=1 edge is visible
		tN = tD;
		// recompute sc for this edge
		if((-d + b) < 0.0)
			sN = 0;
		else if((-d + b) > a)
			sN = sD;
		else
		{
			sN = (-d + b);
			sD = a;
		}
	}
	// finally do the division to get sc and tc
	sc = (Math.abs(sN) < tol ? 0.0 : sN / sD);
	tc = (Math.abs(tN) < tol ? 0.0 : tN / tD);

	// get the difference of the two closest points
	// vDP = w + (sc * u) - (tc * v);  // = S1(sc) - S2(tc)
	vDP.Add(vDP, vW);
	vU.Scale(sc, vU);
	vDP.Add(vDP, vU);
	vV.Scale(tc, vV);
	vDP.Sub(vDP, vV);

	//return norm(dP);   // return the closest distance
	return {vDP:vDP, sc:sc, tc:tc};
 }
 

//______________________________________________________________________________

function CurveToolsPanel_Divisions_OnChanged( )
{
	Application.LogMessage("CurveToolsPanel_Divisions_OnChanged called",siVerbose);
	var oParam;
	oParam = PPG.Divisions;
	var paramVal;
	paramVal = oParam.Value;
	Application.LogMessage("New value: " + paramVal,siVerbose);
}


function CurveToolsPanel_SelectDivisionIsopoints_OnClicked( )
{
	Application.LogMessage("CurveToolsPanel_SelectIntersectionIsopoints_OnClicked called",siVerbose);
	// Disable command logging
	var prefs = Application.Preferences;
	var origSetting = prefs.GetPreferenceValue("scripting.cmdlog"); // .cmdlog or .msglog
	if(origSetting && !PPG.CmdLogging.Value)
		prefs.SetPreferenceValue("scripting.cmdlog", false);

	// Combine all Isopoint selection Commands to one undo.
	SetSelFilter("Knot");
	Application.OpenUndo("SelectDivisionIsopoints");

	var cSel = Selection;

	for(var i = 0; i < cSel.Count; i++)
	{
		if(cSel(i).Type == "crvlist")
		{
			// CurveLists selected.
		
		} else if(cSel(i).Type == "subcrvSubComponent")
		{
			// Subcurves selected.
		
		} else if(cSel(i).Type == "isopntSubComponent")
		{
			// Isopoints selected.
			// Segments with Isopoints get selected!


		} else if(cSel(i).Type == "knotSubComponent")
		{
			// Knots selected.

			var oObject = cSel(i).SubComponent.Parent3DObject;

			// Sorted array of selected Knot indices, consecutive over all Subcurves.
			var aElements = cSel(i).SubElements.toArray();
			// This also works:
			//var aElements = cSel(i).SubComponent.ElementArray.toArray();

	// PREPARE ARRAYS

			var cCurves = oObject.ActivePrimitive.Geometry.Curves;
			var aKnotIsOnSubCrv = []; // e.g. [0,0,0,1,1,1,1,1,1,2,2,2,2]
			var aKnotIndices = []; // 	 e.g. [0,1,2,0,1,2,3,4,5,0,1,2,3]
			var aAllKnots = []; // for quicker access of Knot data

			for(var subCrv = 0; subCrv < cCurves.Count; subCrv++)
			{
				// Get Subcurve data.
				var oSubCrv = cCurves.item(subCrv);
				VBdata = new VBArray(oSubCrv.Get2(siSINurbs));
				var aSubCrvData = VBdata.toArray();

				// Get Knot data.
				var vbArg1 = new VBArray(aSubCrvData[1]);
				var aKnots = vbArg1.toArray();
				aKnots = allKnotsToMultiplicity1(aKnots);
				// Keep the Knot arrays for quick later access. Uses more memory, but is faster.
				aAllKnots.push(aKnots);

				var knot = 0;
				for(var j = 0; j < aKnots.length; j++)
				{
					aKnotIsOnSubCrv.push(subCrv);
					aKnotIndices.push(knot++);
				}
			}

			// Create array of arrays of percentages of all selected Knots.
			// [ [], [1.23, 5.67], [], [0.00, 1.00], ...]
			var aAllPercentages = [];
			var aAllUValues = []; // U value is the Knot's value.
			for(var j = 0; j < aElements.length; j++)
			{
				var knotIdxCont = aElements[j];
				var subCrv = aKnotIsOnSubCrv[knotIdxCont];

				var aKnots = aAllKnots[subCrv];
				var knotIdx = aKnotIndices[knotIdxCont];
				var percentage = (aKnots[knotIdx] - aKnots[0]) / (aKnots[aKnots.length - 1] - aKnots[0]);

				// Store all percentages of selected Knots.
				if(aAllPercentages[subCrv] == undefined)
					aAllPercentages[subCrv] = [];
						
				aAllPercentages[subCrv].push(percentage);

				// Store all knot values (U) of selected Knots.
				if(aAllUValues[subCrv] == undefined)
					aAllUValues[subCrv] = [];

				aAllUValues[subCrv].push(aKnots[knotIdx] );
			}

	// SELECT DIVISION ISOPOINTS.

			SetSelFilter(siIsopointFilter);

			for(var subCrv = 0; subCrv < aAllPercentages.length; subCrv++)
			{
				// More than 2 Knots per Subcurve need to be selected.
				if(aAllPercentages[subCrv] == undefined || aAllPercentages[subCrv].length < 2)
					continue;
				
				var aPercentages = aAllPercentages[subCrv];

				// Get Subcurve data.
				var oSubCrv = cCurves.item(subCrv);
				VBdata = new VBArray(oSubCrv.Get2(siSINurbs));
				var aSubCrvData = VBdata.toArray();

				// Get Point data.
				var vbArg0 = new VBArray(aSubCrvData[0]);
				var aPoints = vbArg0.toArray();
	
				// Get Knot data.
				var aKnots = aAllKnots[subCrv];
				var knotInterval = aKnots[aKnots.length - 1] - aKnots[0];

				// Get other data.
				var isClosed = aSubCrvData[2];
				var degree = aSubCrvData[3];

				if(isClosed)
				{
					// On closed Curves, there's the problem that the first and last Knot can only be
					// selected together.
					if(aPercentages.length > 2)
					{
						if(aPercentages[0] == 0.0 && aPercentages[aPercentages.length - 1] == 1.0)
							aPercentages.pop();
					}

					// Select over start/end (on closed Curves)?
					if(PPG.SelectOverStartEnd.Value)
					{
						// 'Rotate' array
						var p = aPercentages.shift();
						p += 1;
						aPercentages.push(p);
					}
				}
				
				// More than 2 Knots selected... for now, only the first and last is considered.
				//for(var k = 0; k < aPercentages.length - 1; k++)
				//{
					//var p0 = aPercentages[k];
					//var p1 = aPercentages[k + 1];
					var pStart = aPercentages[0];
					var pEnd = aPercentages[aPercentages.length - 1];
					var pStep = (pEnd - pStart) / (PPG.Divisions + 1);

					// Correct p for equidistancy?
					if(!PPG.DivisionMethod.Value && degree > 1)
					{
						// Create interpolation arrays.
						// Array of SubD percentages (PPG.ApproximationDiv)
						var aSubDPerc = [];
						for(var j = 0.0; j <= 1.0; j+= 1/PPG.ApproximationDiv)
							aSubDPerc.push(j);

						// Array of SubD lengths (PPG.ApproximationDiv)
						var aSubDLengths = [0];
						
						// Get first Vector.
						var p = pStart;
						var u = aKnots[0] + p * knotInterval;
						var aRet = oSubCrv.EvaluatePosition(u).toArray();
						var vPPrev = aRet[0];
						
						var vSubD = XSIMath.CreateVector3();
						var subDLength = 0;

						var pSubDStep = (pEnd - pStart) / PPG.ApproximationDiv;

						for(var subD = 1; subD <= PPG.ApproximationDiv; subD++)
						{
							p += pSubDStep;
							if(p > 1 && isClosed) // for selecting over closed curves start/end
								p -= 1;
							// This function returns strange values:
							//var aRet = cCurves(subCrv).EvaluatePositionFromPercentage(p * 100).toArray();
							// This works correctly:
							u = aKnots[0] + p * knotInterval;
							var aRet = cCurves(subCrv).EvaluatePosition(u).toArray();// end Vector
							var vP = aRet[0];
							vSubD.Sub(vP, vPPrev);
							subDLength += vSubD.Length();
							aSubDLengths.push(subDLength);
							vPPrev = vP;
						}

						// 0.0 - 1.0
						var subDLengthsInterval = aSubDLengths[aSubDLengths.length - 1] - aSubDLengths[0];
						for(var j = 0; j < aSubDLengths.length; j++)
						{
							aSubDLengths[j] = (aSubDLengths[j] - aSubDLengths[0]) / subDLengthsInterval;
						}
					}


					// Selection loop
					
					// Also select Isopoints also at start and end Knots?
					// May be useful when scissoring the resulting Isopoints.
					if(PPG.SelectStartEnd.Value)
					{
						start = 0;
						end = PPG.Divisions + 1;
					} else
					{
						start = 1;
						end = PPG.Divisions;
					}

					for(var subD = start; subD <= end; subD++)
					{
						var p = pStart + subD * pStep;

						// "Equal length" flag set: compensate percentage.
						// Makes only sense on degree > 1 Curves.
						if(!PPG.DivisionMethod.Value  && degree > 1)
						{
							var pDiv = (p - pStart) / (pEnd - pStart); // 0.0 - 1.0

							for(var j = 1; j < aSubDLengths.length; j++)
							{
								if(pDiv >= aSubDLengths[j - 1] && pDiv < aSubDLengths[j])
								{
									var f = (pDiv - aSubDLengths[j - 1]) / (aSubDLengths[j] - aSubDLengths[j - 1]);
									var pComp = aSubDPerc[j - 1] + f * (aSubDPerc[j] - aSubDPerc[j - 1]);
									p = pStart + pComp * (pEnd - pStart);
									break;
								}
							}
						}

						if(p > 1 && isClosed) // for selecting over closed curves start/end
							p -= 1;

						var sCnx = oObject.Name + ".isopnt[("; // 1: Name
						sCnx = sCnx + subCrv + "," + p + ")]"; // 2: subCrvIdx
						AddToSelection(sCnx, null, null);
					}

				//}
			}
		}
	}

	Application.CloseUndo();
	// Restore logging setting to the way it was.
	prefs.SetPreferenceValue("scripting.cmdlog", origSetting);
}


function CurveToolsPanel_CrvGrid_OnChanged( )
{
	Application.LogMessage("CurveToolsPanel_CrvGrid_OnChanged called",siVerbose);
	var oParam;
	oParam = PPG.CrvGrid;
	var oGridData;
	oGridData = oParam.Value;
}


function CurveToolsPanel_SetSelFilterObject_OnClicked( )
{
	Application.LogMessage("CurveToolsPanel_SetSelFilterObject_OnClicked called",siVerbose);
	SetSelFilter(siObjectFilter);
}


function CurveToolsPanel_SetSelFilterIsopoint_OnClicked( )
{
	Application.LogMessage("CurveToolsPanel_SetSelFilterIsopoint_OnClicked called",siVerbose);
	SetSelFilter(siIsopointFilter);
}


function CurveToolsPanel_Deselect_OnClicked( )
{
	Application.LogMessage("CurveToolsPanel_Deselect_OnClicked called",siVerbose);
	DeselectAllUsingFilter(); // siIsopointFilter
}


function CurveToolsPanel_HelpOnIntersectionIsopoints_OnClicked( )
{
	Application.LogMessage("CurveToolsPanel_HelpOnIntersectionIsopoints_OnClicked called",siVerbose);
	var sHelpText = "Selecting Intersection Isopoints\r\n" + 
					"1) '(Re)Load from Selection': click to load desired Curves. " +
					"When you open the PPG, this happens automatically. " +
					"You can use any mix of CurveLists or Subcurves.\r\n" +
					"2) 'Get/Set/Self' flags: Curve gets/sets Isopoints from/on others. " +
					"If both are off, the Curve will be ignored. " +
					"Self: self-intersection (off by default).\r\n" +
					"3) 'Approx. Steps': rises precision but also calculation time (a lot!).\r\n" +
					"Each Curve segment (between Knots) is subdivided into n linear pieces,\r\n" +
					"which are checked pairwise for intersections.\r\n" +
					"Degree 1 Curves ignore this setting and always give perfect results.\r\n" + 
					"4) 'Tolerance': increase if Curves that are slightly apart should also produce intersections.\r\n" +
					"5) Click 'Select Intersection Isopoints'.\r\n" + 
					"At selected Isopoints, you can now insert new Knots or scissor the Curve. " +
					"For trims and booleans, delete unneeded Subcurves and merge Boundaries.";
	var sTitle = "Quick help on selecting Intersection Isopoints";
	var oReturn = LargeMsgbox(sHelpText, sTitle );
}


function CurveToolsPanel_SetSelFilterKnot_OnClicked( )
{
	Application.LogMessage("CurveToolsPanel_SetSelFilterKnot_OnClicked called",siVerbose);
	SetSelFilter("Knot");
}


function CurveToolsPanel_HelpOnEquidistantIsopoints_OnClicked( )
{
	Application.LogMessage("CurveToolsPanel_HelpOnEquidistantIsopoints_OnClicked called",siVerbose);
	var sHelpText = "Selecting Division Isopoints\r\n" +
					"1) Select 2 Curve Knots on each (Sub)Curve you want to divide. " +
					"If you select more, the first and last define the segment.\r\n" +
					"2) 'Divisions': number of Isopoints that will be added between two Knots.\r\n" +
					"3) 'Divs get equal': choose if Isopoints should have equal Curve\r\n" + 
					"percentage or equal Curve length intervals.\r\n" +
					"4) 'Approx. Steps': rises precision of length calculation.\r\n" +
					"5) 'Also select Isopoints at Start & End': can be useful when scissoring afterwards.\r\n" +
					"6) 'On closed Curves, select over Start/End': flips selection side on closed Curves.\r\n" +
					"7) Click 'Select Division Isopoints'.\r\n";
	var sTitle = "Quick help on selecting Division Isopoints\r\n";
	var oReturn = LargeMsgbox(sHelpText, sTitle );
}


function CurveToolsPanel_SetSelFilterCurveBoundary_OnClicked( )
{
	Application.LogMessage("CurveToolsPanel_SetSelFilterCurveBoundary_OnClicked called",siVerbose);
	
	SetSelFilter("CurveBoundary");
}


function CurveToolsPanel_SetSelFilterSubcurve_OnClicked( )
{
	Application.LogMessage("CurveToolsPanel_Subcurve_OnClicked called",siVerbose);
	
	SetSelFilter("SubCurve");
}


function CurveToolsPanel_InsertKnots1_OnClicked( )
{
	Application.LogMessage("CurveToolsPanel_InsertKnots1_OnClicked called",siVerbose);
	
	var cSel = Selection;
	cSel = SIFilter(cSel, siIsopointFilter);
	InsertCurveKnot(cSel, 1, siPersistentOperation);
	//PPG.Refresh();
}


function CurveToolsPanel_InsertKnots2_OnClicked( )
{
	Application.LogMessage("CurveToolsPanel_InsertKnots2_OnClicked called",siVerbose);
	
	var cSel = Selection;
	cSel = SIFilter(cSel, siIsopointFilter);
	InsertCurveKnot(cSel, 2, siPersistentOperation);
	//PPG.Refresh();
}


function CurveToolsPanel_InsertKnots3_OnClicked( )
{
	Application.LogMessage("CurveToolsPanel_InsertKnots3_OnClicked called",siVerbose);
	
	var cSel = Selection;
	cSel = SIFilter(cSel, siIsopointFilter);
	InsertCurveKnot(cSel, 3, siPersistentOperation);
	//PPG.Refresh();
}


function CurveToolsPanel_AttachCurves_OnClicked( )
{
	Application.LogMessage("CurveToolsPanel_AttachCurves_OnClicked called",siVerbose);
	
	ApplyAttachCurves();
	PPG.Refresh();
}


function CurveToolsPanel_ExtractAllSubcurves_OnClicked( )
{
	Application.LogMessage("CurveToolsPanel_ExtractAllSubcurves_OnClicked called",siVerbose);
	
	ExtractAllSubcurves();
	PPG.Refresh();
}


function CurveToolsPanel_Scissor_OnClicked( )
{
	Application.LogMessage("CurveToolsPanel_Scissor_OnClicked called",siVerbose);
	
	ApplyScissorSubcurves();
	PPG.Refresh();
}


function CurveToolsPanel_DeleteSubcurves_OnClicked( )
{
	Application.LogMessage("CurveToolsPanel_DeleteSubcurves_OnClicked called",siVerbose);
	
	ApplyDeleteSubcurves();
	PPG.Refresh();
}


function CurveToolsPanel_DuplicateSubcurves_OnClicked( )
{
	Application.LogMessage("CurveToolsPanel_DuplicateSubcurves_OnClicked called",siVerbose);
	
	ApplyDuplicateSubcurves();
	PPG.Refresh();
}


function CurveToolsPanel_InvertSubcurves_OnClicked( )
{
	Application.LogMessage("CurveToolsPanel_DuplicateSubcurves_OnClicked called",siVerbose);
	
	ApplyInvertSubcurves();
	PPG.Refresh();
}


function CurveToolsPanel_OpenCloseSubcurves_OnClicked( )
{
	Application.LogMessage("CurveToolsPanel_OpenCloseSubcurves_OnClicked called",siVerbose);
	
	ApplyOpenCloseSubcurves();
	PPG.Refresh();
}


function CurveToolsPanel_OffsetSubcurves_OnClicked( )
{
	Application.LogMessage("CurveToolsPanel_OffsetSubcurves_OnClicked called",siVerbose);
	
	ApplyOffsetSubcurves();
	PPG.Refresh();
}


function CurveToolsPanel_MergeSubcurves_OnClicked( )
{
	Application.LogMessage("CurveToolsPanel_MergeSubcurves_OnClicked called",siVerbose);
	
	ApplyMergeSubcurves();
	PPG.Refresh();
}


function CurveToolsPanel_BlendSubcurves_OnClicked( )
{
	Application.LogMessage("CurveToolsPanel_BlendSubcurves_OnClicked called",siVerbose);
	
	ApplyBlendSubcurves();
	PPG.Refresh();
}


function CurveToolsPanel_Tolerance_OnChanged( )
{
	Application.LogMessage("CurveToolsPanel_Tolerance_OnChanged called",siVerbose);
	var oParam;
	oParam = PPG.Tolerance;
	var paramVal;
	paramVal = oParam.Value;
	Application.LogMessage("New value: " + paramVal,siVerbose);
	
}

function CurveToolsPanel_Approximation_OnChanged( )
{
	Application.LogMessage("CurveToolsPanel_Approximation_OnChanged called",siVerbose);
	var oParam;
	oParam = PPG.Approximation;
	var paramVal;
	paramVal = oParam.Value;
/*
	// Same as OGL Curve approximation.
	oCrvGrid = PPG.CrvGrid.Value;
	var sCrv = "";
	var sPrevCrv = "";
	for(var i = 0; i < oCrvGrid.RowCount; i++)
	{
		sPrevCrv = sCrv;
		sCrv = oCrvGrid.GetCell(1, i);
		if(sCrv != sPrevCrv)
		{
			var sParam = sCrv + ".geomapprox.gapproxvwcustep";
			SetValue(sParam, paramVal, null);
		}
	}
*/
	Application.LogMessage("New value: " + paramVal,siVerbose);
}


function CurveToolsPanel_ApproximationDiv_OnChanged( )
{
	Application.LogMessage("CurveToolsPanel_ApproximationDiv_OnChanged called",siVerbose);
	var oParam;
	oParam = PPG.ApproximationDiv;
	var paramVal;
	paramVal = oParam.Value;
	Application.LogMessage("New value: " + paramVal,siVerbose);
}


function CurveToolsPanel_Menu_Init( in_ctxt )
{
	var oMenu;
	oMenu = in_ctxt.Source;
	oMenu.AddCallbackItem("Curve Tools Panel","OnCurveToolsPanelMenuClicked");
	return true;
}


// Menu Button (Model>Modifiy>Curve>CurveToolsPanel) klicked
function OnCurveToolsPanelMenuClicked( in_ctxt )
{
	var oProp = new Object();

	var cCPs = FindObjects2(siCustomPropertyID);
	//var cCPIsoTools = new ActiveXObject("XSI.Collection");

	for(var i = 0; i < cCPs.Count; i++)
	{
		if(cCPs(i).Type == "CurveToolsPanel")
		{
			oProp = cCPs(i);
			break;
		}	
	}

	if(oProp.Type == undefined)
	{
		oReturn = Application.AddProp("CurveToolsPanel", ActiveSceneRoot, 0, "CurveToolsPanel");
		oProp = oReturn(0);
	} else
	{
		//oReturn = InspectObj( [InputObjs], [Keywords], [Title], [Mode], [Throw] );
		InspectObj(oProp, "", "Curve Tools Panel", siLockAndForceNew);
	}

	return true;
}


//______________________________________________________________________________

function initGridData(oGridData)
{
	//var oGridData = PPG.CrvGrid.Value;
	oGridData.BeginEdit();

	var cSel = Selection;
	var sSelFilter = cSel.Filter.Name;
	if(sSelFilter != "object" && sSelFilter != "SubCurve")
		SetSelFilter(siObjectFilter);

	//var rowCount = 0;
	//oGridData.RowCount = rowCount;
	var rowCount = oGridData.RowCount;

/*	// TODO? "Add sel. Curves"
	if(rowCount == 0)
		var bAdd = true;
	else
		var bAdd = false;
*/

	for(var i = 0; i < cSel.Count; i++)
	{
		if( cSel(i).Type == "crvlist")
		{
			var cCurves = cSel(i).ActivePrimitive.Geometry.Curves;
			
			
			for(var j = 0; j < cCurves.Count; j++)
			{
				if(rowCount == oGridData.RowCount)
					oGridData.RowCount = rowCount + 1;

				oGridData.SetCell( 0, rowCount, cSel(i));
				oGridData.SetCell( 1, rowCount, cSel(i).Name );
				oGridData.SetCell( 2, rowCount, j );
				oGridData.SetCell( 3, rowCount, true );
				oGridData.SetCell( 4, rowCount, true );
				oGridData.SetCell( 5, rowCount, false );
				rowCount++;
			}

		} else if( cSel(i).Type == "subcrvSubComponent" )
		{
			var oObject = cSel(i).SubComponent.Parent3DObject;
			var aElementIndices = cSel(i).SubComponent.ElementArray.toArray();
			//oGridData.RowCount = aElementIndices.length;

			for(var j = 0; j < aElementIndices.length; j++)
			{
				if(rowCount == oGridData.RowCount)
					oGridData.RowCount = rowCount + 1;

				oGridData.SetCell( 0, rowCount, oObject );
				oGridData.SetCell( 1, rowCount, oObject.Name );
				oGridData.SetCell( 2, rowCount, aElementIndices[j] );
				oGridData.SetCell( 3, rowCount, true );
				oGridData.SetCell( 4, rowCount, true );
				oGridData.SetCell( 5, rowCount, false );
				rowCount++;
			}
		}
	}

	oGridData.EndEdit();
}


// http://softimage.wiki.softimage.com/sdkdocs/scriptsdb/scriptsdb/GridWidget_1_js.htm
function deleteRow(oGridData)
{
	oGridData.BeginEdit();
	var oGridWidget = oGridData.GridWidget;
	// Shift the rows upwards to overwrite the selected rows.
	var writePos = 0;
	for(var readPos = 0; readPos < oGridData.RowCount; readPos++)
	{
		if(!oGridWidget.IsRowSelected(readPos))
		{
			if (readPos != writePos)
			{
				oGridData.SetRowValues(writePos, oGridData.GetRowValues(readPos) );
			}
			writePos++ ;
		}
	}
	// Shrink the GridData.
	oGridData.RowCount = writePos;
	oGridData.EndEdit();
}


function allKnotsToMultiplicity1(aKnots)
{
	var aKnots1 = [];
	
	for(var i = 0; i < aKnots.length; i++)
	{
		if(aKnots[i] != aKnots[i - 1])
			aKnots1.push(aKnots[i]);
	}
	
	return aKnots1;

}


/*
 function logVector3(sLog, v, dp)
{
	sLog += "x = " + Math.round(v.X*dp)/dp +
			"; y = " + Math.round(v.Y*dp)/dp +
			"; z = " + Math.round(v.Z*dp)/dp;
	LogMessage(sLog);
	
}


// http://en.wikipedia.org/wiki/Binomial_coefficient

function binomialCoefficient(n, k)
{
    if(k > n - k) // take advantage of symmetry
        k = n - k;
    var c = 1;
    for(var i = 0; i < k; i++)// in range(k):
	{
        c = c * (n - i);
        c = c / (i + 1);
	}
    return c;
}


function logKnotsArray(logString, aKnots, dp)
{
	//LogMessage(logString);
	var sKnotArray = logString;
	for ( var j = 0; j < aKnots.length; j++ )
	{
		var knotValue = Math.round(aKnots[j]*dp)/dp;
		if ( j == 0 ) sKnotArray = sKnotArray + knotValue;
		else sKnotArray = sKnotArray + ", " + knotValue;
	}
	
	LogMessage( sKnotArray );
	
}
*/