//______________________________________________________________________________
// LogCurveDataPlugin
// 2010/03/30 by Eugen Sares
// last update: 2010/12/21
//______________________________________________________________________________

function XSILoadPlugin( in_reg )
{
	in_reg.Author = "Gene";
	in_reg.Name = "LogCurveDataPlugin";
	in_reg.Major = 1;
	in_reg.Minor = 0;

	in_reg.RegisterCommand("LogCurveData","LogCurveData");
	//RegistrationInsertionPoint - do not remove this line
	in_reg.RegisterMenu(siMenuTbModelModifyCurveID,"LogCurveData_Menu",false,false);

	return true;
}


function XSIUnloadPlugin( in_reg )
{
	var strPluginName;
	strPluginName = in_reg.Name;
	Application.LogMessage(strPluginName + " has been unloaded.",siVerbose);
	return true;
}


function LogCurveData_Init( in_ctxt )
{
	var oCmd;
	oCmd = in_ctxt.Source;
	oCmd.Description = "";
	oCmd.ReturnValue = true;

	return true;
}

//______________________________________________________________________________

function LogCurveData_Execute(  )
{

	Application.LogMessage("LogCurveData_Execute called",siVerbose);

	LogMessage( "===============================================================" );
	LogMessage( "NURBSCURVE INFO" );

	dp = 100;	// decimal precision

	do
	{
		var oSel = Application.Selection;
		if(oSel.Count == 0)
		{	
			LogMessage("Please select a CurveList or Subcurve first.");
			break;
		}
		
		var oObj = oSel.Item(0);
		//LogMessage("CurveList Name: " + curve.Name);
		//LogMessage("CurveList Type: " + curve.Type);
		//LogMessage("CurveList ClassName: " + ClassName(curve));

		if(oObj.Type == "subcrvSubComponent")
		{
			var oSubComponents = oObj.SubComponent;
			//var oParent = oSubComponents.Parent3DObject;
			var oComponentColl = oSubComponents.ComponentCollection;
			LogMessage(oComponentColl.Count + " Subcurves selected");
			for(var i = 0; i < oComponentColl.Count; i++)	// var i makes i a local variable!
			{
				var subcrv = oComponentColl.Item(i);
				Logmessage("Subcurve: [" + subcrv.Index + "]");
				LogCurveData(oComponentColl.Item(i));
			}
			break;
		}
		
		if(oObj.Type == "crvlist")
		{
			LogMessage("CurveList " + oObj.Name + " selected.");
			var curves = oObj.ActivePrimitive.Geometry.Curves;
			LogMessage("Number of Subcurves: " + curves.Count);
			LogMessage("");
			for(var i = 0; i < curves.Count; i++)
			{
				var subcrv = curves.Item(i);
				Logmessage("Subcurve: [" + subcrv.Index + "]");
				LogCurveData(curves.Item(i));
			}
			//LogCurveData(oObj.ActivePrimitive.Geometry.Curves(0));
			break;
		}
		
		if(oObj.Type == "pntSubComponent")
		{
			// get ControlPointCollection
			var oPoints = oObj.SubComponent.ComponentCollection;
			LogMessage(oPoints.Count + " Points selected.");
			for(var i = 0; i < oPoints.Count; i++)
			{
				oPoint = oPoints.item(i);
				//LogMessage(oPoint.Type);	// ControlPoint
				var x = oPoint.x;
				var y = oPoint.y;
				var z = oPoint.z;
				var w = oPoint.w;
				LogMessage( "[" + oPoint.Index + "]: x = " + Math.round(x*dp)/dp + "; y = " + Math.round(y*dp)/dp + "; z = " + Math.round(z*dp)/dp + "; w = " + Math.round(w*dp)/dp );
			}
			
		}

	} while(false);
	// 
	return true;
}

//______________________________________________________________________________

function LogCurveData(oCrv)	// Arg: NurbsCurve
{
	var vbOutput = new VBArray(oCrv.Get2( siSINurbs) );
	var aOutput = vbOutput.toArray();

	var vbCtrlPts = new VBArray( aOutput[0] );
	var vbKnots = new VBArray( aOutput[1] );
	var bClosed = aOutput[2];
	var lDegree = aOutput[3];
	var eParFactor = aOutput[4];

	aPoints = vbCtrlPts.toArray();
	LogMessage("Number of Control Points: " + aPoints.length/4);
	logControlPointsArray(aPoints, dp);

	aKnots = vbKnots.toArray();
	LogMessage("Number of Knots: " + aKnots.length);

	logKnotsArray(aKnots, dp);

	if ( bClosed ) LogMessage( oCrv + " is closed." );
	else LogMessage( oCrv + " is open." );

	LogMessage( "Degree of " + oCrv + " is " + lDegree + "." );

	switch( eParFactor )
	{
	   case siUniformParameterization :
		   LogMessage( oCrv + "'s knot parameterization is uniform." );
		   break;
	   case siNonUniformParameterization :
		   LogMessage( oCrv + "'s knot parameterization is non-uniform." );
		   break;
	   case siChordLengthParameterization :
		   LogMessage( oCrv + "'s knot parameterization is chord-length." );
		   break;
	   default :
		   LogMessage( oCrv + "'s knot parameterization is centripetal." );
	}
	
	LogMessage( "Curve Length: " + oCrv.Length);
	LogMessage( "" );
}


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


function LogCurveData_Menu_Init( in_ctxt )
{
	var oMenu;
	oMenu = in_ctxt.Source;
	oMenu.AddCommandItem("Log Curve Data","LogCurveData");
	return true;
}
