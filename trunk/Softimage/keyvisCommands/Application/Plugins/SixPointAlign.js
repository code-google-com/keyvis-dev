// Script Name: SixPointAlign Plugin 
// Host Application: Softimage
// Last changed: 2009-08-01
// Author: Eugen Sares
// eugen@keyvis.at
// Description: Aligns an Object by picking 3 source Points, then 3 target Points


function XSILoadPlugin( in_reg )
{
	in_reg.Author = "Eugen Sares";
	in_reg.Name = "SixPointAlign";
	in_reg.Email = "eugen@keyvis.at";
	in_reg.URL = "";
	in_reg.Major = 1;
	in_reg.Minor = 0;

	in_reg.RegisterCommand("SixPointAlign","SixPointAlign");
	in_reg.RegisterMenu(siMenuMCPTransformBottomID,"SixPointAlign_Menu",false,false);
	//RegistrationInsertionPoint - do not remove this line
	return true;
}


//////////////////////////////////////////////////////////////////////////

function XSIUnloadPlugin( in_reg )
{
	var strPluginName;
	strPluginName = in_reg.Name;
	Application.LogMessage(strPluginName + " has been unloaded.",siVerbose);
	return true;
}


//////////////////////////////////////////////////////////////////////////

function SixPointAlign_Init( in_ctxt )
{
	var oCmd;
	oCmd = in_ctxt.Source;
	oCmd.Description = "Aligns an Object by picking 3 source Points, then 3 target Points";
	oCmd.Tooltip = "SixPointAlign";
	oCmd.ReturnValue = true;

	return true;
}


//////////////////////////////////////////////////////////////////////////

function SixPointAlign_Execute(  )
{
	Application.LogMessage("SixPointAlign_Execute called", siVerbose);
	
	var snap = GetValue("preferences.SnapProperties.Enable");	// remember what snapping was set to
	SetValue("preferences.SnapProperties.Enable", true, null);	// turn snapping on
	
	 try {
		if(Selection.count == 0)
			throw "Please select scene object(s) to align first.";
				
		var oSelAll = Application.Selection;

		var oSel = SIFilter(oSelAll, "sceneobject");	// Filter by 3D objects only 
		
		if(oSel.count == 0)
			throw "Please select scene object(s) to align first.";
				
		var vFrom1 = XSIMath.CreateVector3();
		var vFrom2 = XSIMath.CreateVector3();
		var vFrom3 = XSIMath.CreateVector3();
		var vTo1 = XSIMath.CreateVector3();
		var vTo2 = XSIMath.CreateVector3();
		var vTo3 = XSIMath.CreateVector3();
		
		////////////////////////////////////////////////////////////////////////
		// Pick 3 Source Points
		var pick = PickPosition("Pick First Source Point", "Pick First Source Point");
		vFrom1.x = pick("PosX");
		vFrom1.y = pick("PosY");
		vFrom1.z = pick("PosZ");
		button = pick("ButtonPressed");
		if(!button)
			throw "Cancelled.";
		//LogMessage("vFrom1.x = " + vFrom1.x + "    vFrom1.y = " + vFrom1.y + "    vFrom1.z = " + vFrom1.z);
		
		while(true) {
			pick = PickPosition("Pick Second Source Point", "Pick Second Source Point");
			vFrom2.x = pick("PosX");
			vFrom2.y = pick("PosY");
			vFrom2.z = pick("PosZ");
			button = pick("ButtonPressed");
			if(!button)
				throw "Cancelled.";
			//LogMessage("vFrom2.x = " + vFrom2.x + "    vFrom2.y = " + vFrom2.y + "    vFrom2.z = " + vFrom2.z);
			if(vFrom2.Equals(vFrom1))
			{
				LogMessage("Please pick another Point.");
				continue;
			}
			break;
		};

		
		while(true) {
			pick = PickPosition("Pick Third Source Point", "Pick Third Source Point");
			vFrom3.x = pick("PosX");
			vFrom3.y = pick("PosY");
			vFrom3.z = pick("PosZ");
			button = pick("ButtonPressed");
			if(!button)
				throw "Cancelled.";
			if(vFrom3.Equals(vFrom1) || vFrom3.Equals(vFrom2))
			{
				LogMessage("Please pick another Point.");
				continue;
			}
			break;
		};
		
		
		//////////////////////////////////////////////////////////////////////////
		// Pick 3 Target Points
		pick = PickPosition("Pick First Target Point", "Pick First Target Point");
		vTo1.x = pick("PosX");
		vTo1.y = pick("PosY");
		vTo1.z = pick("PosZ");
		button = pick("ButtonPressed");
		if(!button)
			throw "Cancelled.";
		
		while(true){
			pick = PickPosition("Pick Second Target Point", "Pick Second Target Point");
			vTo2.x = pick("PosX");
			vTo2.y = pick("PosY");
			vTo2.z = pick("PosZ");
			button = pick("ButtonPressed");
			if(!button)
				throw "Cancelled.";
		
			if(vTo2.Equals(vTo1)) 
			{
				LogMessage("Please pick another Point.");
				continue;
			}
			break;
		};
		
		while(true){
			pick = PickPosition("Pick Third Target Point", "Pick Third Target Point");
			vTo3.x = pick("PosX");
			vTo3.y = pick("PosY");
			vTo3.z = pick("PosZ");
			button = pick("ButtonPressed");
			if(!button)
				throw "Cancelled.";
		
			if(vTo3.Equals(vTo1) || vTo3.Equals(vTo2))
			{
				LogMessage("Please pick another Point.");
				continue;
			}
			break;
		};

		//////////////////////////////////////////////////////////////////////////
		
		
		for(var i = 0; i < oSel.Count; i++)
		{
			var obj = oSel(i);
			var START = GetMatrixFrom3Points(vFrom1, vFrom2, vFrom3);

			var TARGET = GetMatrixFrom3Points(vTo1, vTo2, vTo3);

			START.Invert(START);

			var OBJECT = obj.Kinematics.Global.Transform.Matrix4;
			OBJECT.Mul(OBJECT, START);	// transform object center to START
			
			OBJECT.Mul(OBJECT, TARGET);
			
			ApplyMatrix(obj, OBJECT);
			
		}
		
		SetValue("preferences.SnapProperties.Enable", snap, null);
		return true;
	
	};
	
	catch(e)
	{
		SetValue("preferences.SnapProperties.Enable", snap, null);
		Application.LogMessage(e, siWarning);
	}
	return false;

}


//////////////////////////////////////////////////////////////////////////

function SixPointAlign_Menu_Init( in_ctxt )
{
	var oMenu;
	oMenu = in_ctxt.Source;
	oMenu.AddCommandItem("SixPointAlign","SixPointAlign");
	return true;
}


//////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////


function ApplyMatrix(object, MATRIX)
{
	var TResult = object.Kinematics.Global.Transform;
	var s = TResult.Scaling;	// preserve scaling. this is necessary if the clicked points ly on a straight line
	TResult.SetMatrix4(MATRIX);
	TResult.Scaling = s;
	object.Kinematics.Global.Transform = TResult;
}


//////////////////////////////////////////////////////////////////////////

function GetMatrixFrom3Points(v1, v2, v3)	// args: 3 SIVector3
// returns a transformation derived from 3 points
{
	var vX = XSIMath.CreateVector3();
	vX.Sub(v2, v1);
	var v1_3 = XSIMath.CreateVector3();
	v1_3.Sub(v3,v1);
	var vY = XSIMath.CreateVector3();
	vY.Cross(vX, v1_3);
	var vZ = XSIMath.CreateVector3();
	vZ.Cross(vX, vY);

	vX.Normalize(vX);
	vY.Normalize(vY);
	vZ.Normalize(vZ);

	var M = XSIMath.CreateMatrix4();
	
	M(0,0) = vX(0);		// (row, column)
	M(0,1) = vX(1);
	M(0,2) = vX(2);
	M(1,0) = vY(0);
	M(1,1) = vY(1);
	M(1,2) = vY(2);
	M(2,0) = vZ(0);
	M(2,1) = vZ(1);
	M(2,2) = vZ(2);
	M(3,0) = v1(0);
	M(3,1) = v1(1);
	M(3,2) = v1(2);
	
	return M;
}

////////////////////////////////////////////////////////////////////////

