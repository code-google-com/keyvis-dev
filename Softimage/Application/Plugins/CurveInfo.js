// Select a CurveList first!

//var oEmpty = SICreateCurve("emptyCurve", 3, 1);

var oCrv = Application.Selection.Item(0);
//LogMessage("CurveList Name: " + oCrv.Name);	// test
//LogMessage("CurveList Type: " + oCrv.Type);	// crvlist
//LogMessage("CurveList ClassName: " + ClassName(oCrv));	// X3DObject

var curves = Selection(0).ActivePrimitive.Geometry.Curves;
LogMessage("Number of Subcurves: " + curves.Count);
var subcrv = 0;

// change input Curve here
var vbOutput = new VBArray( oCrv.ActivePrimitive.Geometry.Curves(subcrv).Get2( siSINurbs ) );
//var vbOutput = new VBArray( oEmpty.ActivePrimitive.Geometry.Curves(subcrv).Get2( siSINurbs ) );
var aOutput = vbOutput.toArray();

var vbCtrlPts = new VBArray( aOutput[0] );
var vbKnots = new VBArray( aOutput[1] );
var bClosed = aOutput[2];
var lDegree = aOutput[3];
var eParFactor = aOutput[4];

LogMessage( "INFORMATION FOR " + oCrv + ":" );		// change input Curve here
LogMessage( "===================================================================" );
LogMessage( "Control Points:" );
for ( i = 0; i <= vbCtrlPts.ubound(2); i++ )
{
   LogMessage( "x = " + vbCtrlPts.getItem(0,i) +
		"; y = " + vbCtrlPts.getItem(1,i) +
        "; z = " + vbCtrlPts.getItem(2,i) + 
		"; weight = " + vbCtrlPts.getItem(3,i)
           );
}
ctrlPtsArray = vbCtrlPts.toArray();
LogMessage("number of Points: " + ctrlPtsArray.length/4);
/*for(i = 0; i < ctrlPtsArray.length; i++)
{
	LogMessage("ctrlPtsArray[" + i + "]: " + ctrlPtsArray[i]);
}*/

LogMessage("JScript Array: " + ctrlPtsArray.toString());

LogMessage( "---------------------------------------------------------------" );
LogMessage( "Knots:" );
var sKnotArray = "";
for ( j = 0; j <= vbKnots.ubound(1); j++ )
{
   if ( j == 0 )
   {
       sKnotArray = vbKnots.getItem(j).toString(10);
   }
   else
   {
       sKnotArray = sKnotArray + ", " + vbKnots.getItem(j).toString(10);
   }
}
LogMessage( sKnotArray );

knotsArray = vbKnots.toArray();
LogMessage("number of Knots: " + knotsArray.length);
/*for(i = 0; i < knotsArray.length; i++)
{
	LogMessage("knotArray[" + i + "]: " + knotsArray[i]);
}*/
LogMessage("JScript Array: " + knotsArray.toString());

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



// INFO : INFORMATION FOR emptyCurve:
// INFO : ===================================================================
// INFO : Control Points:
// INFO : x = 0; y = 0; z = 0
// INFO : x = 0; y = 0; z = 0
// INFO : x = 0; y = 0; z = 0
// INFO : ctrlPtsArray[0]: 0
// INFO : ctrlPtsArray[1]: 0
// INFO : ctrlPtsArray[2]: 0
// INFO : ctrlPtsArray[3]: 1
// INFO : ctrlPtsArray[4]: 0
// INFO : ctrlPtsArray[5]: 0
// INFO : ctrlPtsArray[6]: 0
// INFO : ctrlPtsArray[7]: 1
// INFO : ctrlPtsArray[8]: 0
// INFO : ctrlPtsArray[9]: 0
// INFO : ctrlPtsArray[10]: 0
// INFO : ctrlPtsArray[11]: 1
// INFO : ctrlPtsArray[12]: 0
// INFO : ctrlPtsArray[13]: 0
// INFO : ctrlPtsArray[14]: 0
// INFO : ctrlPtsArray[15]: 1
// INFO : ---------------------------------------------------------------
// INFO : Knots:
// INFO : 0, 0, 0, 1, 1
// INFO : knotArray[0]: 0
// INFO : knotArray[1]: 0
// INFO : knotArray[2]: 0
// INFO : knotArray[3]: 1
// INFO : knotArray[4]: 1
// INFO : knotArray[5]: 1
// INFO : ---------------------------------------------------------------
// INFO : null is not closed.
// INFO : ---------------------------------------------------------------
// INFO : Degree of null is 3.
// INFO : ---------------------------------------------------------------
// INFO : null's knot parameterization is non-uniform.
