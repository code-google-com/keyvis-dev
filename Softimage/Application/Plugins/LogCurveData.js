// Logs NurbsCurve data of a Subcurve

LogMessage( "===============================================================" );
LogMessage( "NURBSCURVE INFO" );

do
{
	var oSel = Application.Selection;
	if(oSel.Count == 0)
	{	
		LogMessage("Please select a CurveList or Subcurve first.");
		break;
	}
	
	var curve = oSel.Item(0);
	//LogMessage("CurveList Name: " + curve.Name);
	//LogMessage("CurveList Type: " + curve.Type);
	//LogMessage("CurveList ClassName: " + ClassName(curve));

	if(curve.Type == "subcrvSubComponent")
	{
		var oSubComponents = curve.SubComponent;
		//var oParent = oSubComponents.Parent3DObject;
		var oComponentColl = oSubComponents.ComponentCollection;
		LogMessage(oComponentColl.Count + " Subcurves selected");
		for(var i = 0; i < oComponentColl.Count; i++)	// var i makes i a local variable!
		{
			var subcrv = oComponentColl.Item(i);
			LogMessage( "===============================================================" );
			Logmessage("Subcurve: [" + subcrv.Index + "]");
			LogCurveData(oComponentColl.Item(i));
		}
		break;
	}
	if(curve.Type == "crvlist")
	{
		LogMessage("CurveList selected. Only the first Subcurve is logged.");
		LogCurveData(curve.ActivePrimitive.Geometry.Curves(0));
		break;
	}

} while(false);


//________________________________________________________________________

function LogCurveData(oCrv)	// Arg: NurbsCurve
{
	var vbOutput = new VBArray(oCrv.Get2( siSINurbs) );
	var aOutput = vbOutput.toArray();

	var vbCtrlPts = new VBArray( aOutput[0] );
	var vbKnots = new VBArray( aOutput[1] );
	var bClosed = aOutput[2];
	var lDegree = aOutput[3];
	var eParFactor = aOutput[4];

	var dp = 1000;	// 3 decimal points

	ctrlPtsArray = vbCtrlPts.toArray();
	LogMessage("Number of Control Points: " + ctrlPtsArray.length/4);
	//LogMessage( "Control Points:" );
	for ( var i = 0; i <= vbCtrlPts.ubound(2); i++ )
	{
		var x = vbCtrlPts.getItem(0,i);
		var y = vbCtrlPts.getItem(1,i);
		var z = vbCtrlPts.getItem(2,i);
		var w = vbCtrlPts.getItem(3,i);
	   LogMessage( "[" + i + "]: x = " + Math.round(x*dp)/dp + "; y = " + Math.round(y*dp)/dp + "; z = " + Math.round(z*dp)/dp + "; w = " + Math.round(w*dp)/dp );
	}
	
	/*for(i = 0; i < ctrlPtsArray.length; i++)
	{
		LogMessage("ctrlPtsArray[" + i + "]: " + ctrlPtsArray[i]);
	}*/
	//LogMessage("JScript Array: " + ctrlPtsArray.toString());

	LogMessage( "---------------------------------------------------------------" );
	knotsArray = vbKnots.toArray();
	LogMessage("Number of Knots: " + knotsArray.length);
	//LogMessage( "Knots:" );
	var sKnotArray = "";
	for ( var j = 0; j <= vbKnots.ubound(1); j++ )
	{
		var knotValue = Math.round(vbKnots.getItem(j)*dp)/dp;
		if ( j == 0 ) sKnotArray = "Knot Vector: " + knotValue.toString(10);
		else sKnotArray = sKnotArray + ", " + knotValue.toString(10);
	}
	LogMessage( sKnotArray );

	/*for(i = 0; i < knotsArray.length; i++)
	{
		LogMessage("knotArray[" + i + "]: " + knotsArray[i]);
	}*/
	//LogMessage("JScript Array: " + knotsArray.toString());

	LogMessage( "---------------------------------------------------------------" );
	if ( bClosed )
	{
	   LogMessage( oCrv + " is closed." );
	}
	else
	{
	   LogMessage( oCrv + " is not closed." );
	}

	LogMessage( "---------------------------------------------------------------" );
	LogMessage( "Degree of " + oCrv + " is " + lDegree + "." );

	LogMessage( "---------------------------------------------------------------" );
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
	
	LogMessage( "---------------------------------------------------------------" );
	LogMessage( "Curve Length: " + oCrv.Length);
	LogMessage( "" );
}
