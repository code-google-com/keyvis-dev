// select Subcurves first!

var oSubComponents = Selection(0).SubComponent;

var oParent = oSubComponents.Parent3DObject;
// LogMessage(oParent.Name);	// text

var oComponentCollection = oSubComponents.ComponentCollection;
// LogMessage(oComponentCollection.Type);	//
// LogMessage(ClassName(oComponentCollection));	// NurbsCurveCollection

var delFlags = new Array(oComponentCollection.Count);

for(i = 0; i < oComponentCollection.Count; i++)
{
	var subcrv = oComponentCollection.item(i);
	Logmessage("Subcurve [" + subcrv.Index + "] selected");
	delFlags[subcrv.Index] = true;
}
