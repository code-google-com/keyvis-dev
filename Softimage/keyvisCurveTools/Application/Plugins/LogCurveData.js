//______________________________________________________________________________
// LogCurveDataPlugin
// 2010/03/30 by Eugen Sares
// last update: 2011/05/06
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

	dp = 1000;	// decimal precision

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
				LogCurveData(oComponentColl.Item(i), dp);
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
				LogCurveData(curves.Item(i), dp);
			}
			//LogCurveData(oObj.ActivePrimitive.Geometry.Curves(0), dp);
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
				LogMessage( "[" + oPoint.Index + "]: x = " + numberToString(x, dp) +
												"; y = " + numberToString(y, dp) +
												"; z = " + numberToString(z, dp) +
												"; w = " + numberToString(w, dp) );
			}
			
		}

	} while(false);
	// 
	return true;
}

//______________________________________________________________________________

function LogCurveData(oCrv, dp)	// Arg: NurbsCurve
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
	logControlPointsArray("", aPoints, dp);
	LogMessage("");

	aKnots = vbKnots.toArray();
	LogMessage("Number of Knots: " + aKnots.length);
	LogMessage("Number of Knots without multiplicity: " + getKnotCount(aKnots) );

	logKnotsArray("", aKnots, dp);
	LogMessage( "Knot interval (max - min): " + (aKnots[aKnots.length - 1] - aKnots[0]) );
	LogMessage("");

	if ( bClosed ) LogMessage( oCrv + " is closed." );
	else LogMessage( oCrv + " is open." );

	LogMessage( "Degree of " + oCrv + " is " + lDegree + "." );

	if(bClosed == false)
	{
		LogMessage("On open Curves: numKnots = numPoints + degree - 1");
		LogMessage("");
	} else
	{
		LogMessage("");
	}

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


function LogCurveData_Menu_Init( in_ctxt )
{
	var oMenu;
	oMenu = in_ctxt.Source;
	oMenu.AddCommandItem("Log Curve Data","LogCurveData");
	return true;
}


function getKnotCount(aKnots)
{
	if(aKnots.length == 0)
		return 0;

	var knotCount = 1;

	for(var i = 1; i < aKnots.length; i++)
	{
		if(aKnots[i - 1] < aKnots[i])
			knotCount += 1;
	}
	
	return knotCount;

}


function logControlPointsArray(sLog, aPoints, dp)
{
	if(sLog != "")
	LogMessage(sLog);
	
	for ( var i = 0; i < aPoints.length; i += 4 )
	{
		var x = aPoints[i];
		var y = aPoints[i + 1];
		var z = aPoints[i + 2];
		var w = aPoints[i + 3]; 
		LogMessage( "[" + i/4 + "]: x = " + numberToString(x, dp) +
								"; y = " + numberToString(y, dp) +
								"; z = " + numberToString(z, dp) );
								// + "; w = " + numberToString(w, dp) );

	}

}


function logKnotsArray(sLog, aKnots, dp)
{
	//LogMessage(sLog);
	var sKnotArray = sLog;
	for ( var j = 0; j < aKnots.length; j++ )
	{
		var knotValue = numberToString(aKnots[j], dp);
		if ( j == 0 ) sKnotArray = sKnotArray + knotValue;//.toString(10);
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
		LogMessage( "[" + i/3 + "]: x = " + numberToString(x, dp) +
								"; y = " + numberToString(y, dp) +
								"; z = " + numberToString(z, dp) );
	}
	
}


function logVector3(sLog, v, dp)
{
	sLog += "x = " + numberToString(v.X, dp) +
		"; y = " + numberToString(v.Y, dp) +
		"; z = " + numberToString(v.Z, dp);
	LogMessage(sLog);
	
}


function logMatrix(sLog, oM, dp)
{
	LogMessage(sLog);

	if(ClassName(oM) == "ISIMatrix3")
		size = 3;
	else
		size = 4;

	for(var row = 0; row < size; row++)
	{
		var s = "";
		for(var col = 0; col < size; col++) // column
		{
			s += numberToString( oM.Value( row, col ), 100 ) + "\t\t";
				
		}
		
		LogMessage(s);
		
	}
	
}


function numberToString(x, dp)
{
	var s = "";
	var dpLen = log10(dp);

	x *= dp;
	x = Math.round(x);

	if(x < 0)
	{
		var sSign = "-";
		x *= -1;
	} else
	{
		var sSign = " ";
	}

	s = "" + x;
	if(s.length < dpLen + 1)
	{
		var len = dpLen - s.length + 1;
		for(var i = 0; i < len; i++)
			s = "0" + s;
	}

	var s1 = s.substring(0, s.length - dpLen);
	var s2 = s.substring(s.length - dpLen, s.length);
	return sSign + s1 + "." + s2;

}


function log10(x)
{
	return ( Math.log(x) / Math.log(10) );
}