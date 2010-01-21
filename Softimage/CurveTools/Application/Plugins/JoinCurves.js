// JoinCurves testscript
// ONLY FOR LINEAR CURVES, number of knots = number of points

var crvListGeom0		= Selection(0).ActivePrimitive.Geometry; // NurbsCurveList
var crvListGeom1		= Selection(1).ActivePrimitive.Geometry;
var outCrvList			= SICreateCurve("emptyCurve", 3, 1);
FreezeObj(outCrvList);
var outCrvListGeom		= outCrvList.ActivePrimitive.Geometry;


// CURVE 0 data
LogMessage( "===============================================================" );
LogMessage("CURVE 0");
var crv0_0				= crvListGeom0.Curves(0);	// NurbsCurve
LogCurveData(crv0_0);

var VBdata0_0			= crv0_0.Get2( siSiNurbs );
var data0_0				= VBdata0_0.toArray();
var ctrlPoints0			= data0_0[0].toArray();
var knots0				= data0_0[1].toArray();
var isClosed0			= data0_0[2];
var degree0				= data0_0[3];
var parameterization0	= data0_0[4];


// CURVE 1 data
LogMessage( "===============================================================" );
LogMessage("CURVE 1");
var crv1_0				= crvListGeom1.Curves(0);
LogCurveData(crv1_0);

var VBdata1_0			= crv1_0.Get2( siSiNurbs );
var data1_0				= VBdata1_0.toArray();
var ctrlPoints1			= data1_0[0].toArray();
var knots1				= data0_0[1].toArray();
var isClosed1			= data0_0[2];
var degree1				= data0_0[3];
var parameterization1	= data0_0[4];


// OUTPUT CURVE empty data
var outCrvCount			= 1;
var ctrlPoints			= new Array();
var numCtrlPoints		= new Array();
var knots				= new Array();
var numKnots			= new Array();
var isClosed			= new Array();
var degree				= new Array();
var parameterization	= new Array();


LogMessage( "===============================================================" );
LogMessage("NEW CURVE:");
/*
// MANUALLY SETTING A CURVE
// a simple L-shaped linear Curve. JScriptArrays.
ctrlPoints = [	0,0,0, 1,
				2,0,0, 1,
				2,0,1, 1];
numCtrlPoints = [3];
knots = [0,1,2];
numKnots = [3];
*/


// POINTS
ctrlPoints1				= ctrlPoints1.slice(4);	// remove the first Point of the second Curve
ctrlPoints				= ctrlPoints0.concat(ctrlPoints1);	
numCtrlPoints			= ctrlPoints.length/4;
// ToDo: use input transforms
// Log the new Point list:
LogMessage("Number of concatenated Control Points: " + numCtrlPoints);
for(var i = 0; i < numCtrlPoints; i++)
{
}

// KNOTS
knots1					= knots1.slice(1);	// remove the first Knot of the second Curve
var last = knots0.length - 1;
LogMessage("last index of knotVector 0: " + last);
var knotOffset			= knots0[last];
LogMessage("knotOffset: " + knotOffset);
for(i = 0; i < knots1.length; i++)
{
	//LogMessage("knot value before: " + knots1[i]);
	knots1[i] += knotOffset;
	//LogMessage("knot value after: " + knots1[i]);
}
knots					= knots0.concat(knots1);
numKnots				= knots.length;
LogMessage("Number of concatenated Knots: " + numKnots);
// Log the new Knot list:
LogMessage("Concatenated Knot Vector: ");
LogMessage(knots.toString());


// OTHER PARAMS
isClosed = [false];
degree = [1];
parameterization = [siNonUniformParameterization];	// 1

LogMessage("Setting curve...");
// Set the new Curve
// The internal Set code is expecting either a flat 1 dimensional array or a 2 dimensional array constructed from a VBArray.
// It is not able to convert an JScript Array of JScript Arrays and fails.
outCrvListGeom.Set(
	outCrvCount, 		// 0. number of Subcurves in the Curvelist
	ctrlPoints, 		// 1. JScriptArray, flat array of arrays!
	numCtrlPoints, 		// 2. JScriptArray, number of Control Points per Subcurve
	knots, 				// 3. JScriptArray, flat array of arrays!
	numKnots, 			// 4. JScriptArray
	isClosed, 			// 5. JScriptArray
	degree, 			// 6. JScriptArray
	parameterization, 	// 7. JScriptArray
	0) ;				// 8. NurbsFormat: 0 = siSINurbs, 1 = siIGESNurbs

LogMessage( "===============================================================" );
var outCrv				= outCrvListGeom.Curves(0);
LogCurveData(outCrv);



//________________________________________________________________________	
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