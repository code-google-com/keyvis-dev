# Ritalin for Maya version 2011
# Author: Stefan Kubicek 
# Last changed: 2010-08-17, 10:00
# File Version 1.5

# ====================================================================================================
# Description: Creates a Ritalin menu with options to change the camera navigation behaviour. 
# When enabled, cameras always tumble around the selected objects or components. This also works for bones and, if enabled,
# for skin influence objects (e.g. joints) when in paintSkinWeights mode.
#====================================================================================================

import maya.cmds as cmds
import maya.mel as mel

true = True
false = False

#Lets get rid of Ritalin Script jobs that might be lurking in Maya's guts from a previous session
try:
	cleanRitalinScriptJobs()
except:
	pass
	
global RitalinHonorInfluenceJoints; RitalinHonorInfluenceJoints = True
global RitalinEnabled; RitalinEnabled = cmds.optionVar (q='RitalinEnabled')
global RitalinScriptJobs; RitalinScriptJobs = []
global resetTumbleToolToCOI; resetTumbleToolToCOI = False
global RitalinDoComputeBB; RitalinDoComputeBB = True

global RitalinRememberSelections; RitalinRememberSelections = cmds.optionVar (q = "RitalinRememberSelections")

# ======================
# Some helpful functions
# ======================
def Error (strError): #requires maya.mel
	try: #we need to "try" here, otherwise Python throws an error making our custom error message disappear at the status line
		mel.eval('error ' + '"' + strError + '"')
	except:
		return
	
def Warning (strWarning): #requires maya.mel
	try: #we need to "try" here, otherwise Python throws an error making our custom error message disappear at the status line
		mel.eval('warning ' + '"' + strWarning + '"')
	except:
		return
	
def sourceMel (melScript, deferred = False):
	sourceCommand = ("source " + melScript)
	#print (sourceCommand)
	try:
		result = (mel.eval (sourceCommand))
		return result
	except:
		pass
		#Error("Could not source " + str(melScript) + ", make sure the file resides in a script folder known to Maya.")
		
def cleanRitalinScriptJobs():
	global RitalinScriptJobs
	for job in RitalinScriptJobs:
		try:
			cmds.scriptJob (kill = job)	
		except:
			Warning ("Job " + str(job) + " could not be killed!")
	RitalinScriptJobs = []

# ===========================================================================================================================
# Main function that computes the Camera's tumble pivot position based on the current selection or specific objects passed in
# ===========================================================================================================================

def setCamRotatePivots(oObjects = []):
	global RitalinDoComputeBB
	
	if RitalinDoComputeBB == True:
		global RitalinEnabled
		global RitalinHonorInfluenceJoints
		Units = cmds.currentUnit(query = True, linear = True)

		#Unfortunately Maya is too stupid to set the rotion pivot according to the currently set unit type in the scene. 
		#It always uses cm internally, so we need a Unit Multiplier (UM) depending on the active unit type for correction in case units are not set to cm

		if Units == "mm":
			UM = 0.1
		elif Units == "cm":
			UM = 1.0
		elif Units == "m":
			UM = 100.0
		elif Units == "in":
			UM = 2.54
		elif Units == "ft":
			UM = 30.48
		elif Units == "yd":
			UM = 91.44

		Cams = cmds.ls( dag = true, cameras = True )
		if RitalinEnabled == True:
			CheckPaintTool = True
			Continue = False
			ComputeCenterAlreadyDone = False
			
			if len(oObjects) == 0:
				#print("No Objects given to compute BB for, using current selection instead!")
				Selec = cmds.ls( selection = True )
			else:
				Selec = oObjects
				CheckPaintTool = False #In case there are objects given to compute BB center for we don't need to check for the paint tool, we already know what to compute BB for
			if len(Selec) > 0: #We have objects to work with?
				X = 0.0; Y = 0.0; Z = 0.0
				if CheckPaintTool:
					#Let's find out if we are in skin weights paint mode
					currCtx = cmds.currentCtx(); 
					currTool = ""
					try: #contextInfo operations are buggy in Maya 2011, we need to try.. :-(
						currTool = cmds.contextInfo (currCtx, t = True);
					except: pass
					
					if RitalinHonorInfluenceJoints == True: #In case we are painting skin weights we can ignore everything and just concentrate on the currently active skin joint
						if currTool == "artAttrSkin":
							whichTool = cmds.artAttrSkinPaintCtx (currCtx, query = True, whichTool = True)
							if whichTool == "skinWeights": #Yes, we are in skin paint weights mode
								
								influenceJoint = ""
								#Find the currently active joint for which weights are being painted
								influenceJoint = cmds.artAttrSkinPaintCtx  (currCtx, query = true, influence = true) 
								if influenceJoint != "":
									influenceJoint += (".rotatePivot")
									BB = cmds.exactWorldBoundingBox (influenceJoint)
									X = ((BB[0] + BB[3])/2)
									Y = ((BB[1] + BB[4])/2)
									Z = ((BB[2] + BB[5])/2)
									ComputeCenterAlreadyDone = True
									Continue = True			
				if ComputeCenterAlreadyDone == False:  #Standard computation in case we are not in paintSkinWeights mode or don't care if we are
					Joints = []
					stdObjects = []
					
					specialTransformTypes = ["selectHandle", "rotatePivot", "scalePivot", "Axis"]
					for o in Selec: 						
						if (cmds.nodeType (o) == "joint"): 
							#Maya can't compute BB of joints (API bug?) so we have to work around this by dealing with joint's rotatePivots instead
							#print ("Selected node is of type joint")
							isSpecialType = False
							for Type in specialTransformTypes:
								if o.find (Type) > -1:
									#print ("Selected node is of a special Transform Type")
									stdObjects.append(o)
									isSpecialType = True
									break
								
							if isSpecialType == False:
								#print ("Selected node is not of special TransformType, appending directly")
								stdObjects.append(o + ".rotatePivot")
								
						
						elif (cmds.nodeType (o) == "transform"):
							#Maya does not take shape nodes of selected objects into account automatically, we must supply such nodes directly
							#to compute BB of e.g. skinned objects or objects whose pivots have been moved far from their geometric centers
							#print ("Selected node is of type transform")
							Shapes = (cmds.ls(o, dagObjects = True, shapes = True, noIntermediate = True)) #Lets get all the shape nodes associated with the transform
							if len(Shapes) > 0:
								for shp in Shapes:
									#print ("Shape is of type " + cmds.nodeType(shp))
									#print ("Shape name: " + shp)
									shpName = str(shp)
									stdObjects.append(shpName)
							else: #We have a transform without a shape?
								stdObjects.append(o)
						
						else: 
							#print ("Node must be a subcomponent")
							stdObjects.append(o)

					if len(stdObjects) > 0:
						BB = cmds.exactWorldBoundingBox (stdObjects) #Do standard BB computation 
						X = ((BB[0] + BB[3])/2)
						Y = ((BB[1] + BB[4])/2)
						Z = ((BB[2] + BB[5])/2)
						Continue = True	
			
					
			#Finally let'S do the actual tumble pivot setting on the cameras
			if Continue == True : 
				cmds.tumbleCtx ("tumbleContext", edit = True, localTumble = 0) #Set the tumble tool to honor the cameras tumble pivot
				X = X * UM
				Y = Y * UM
				Z = Z * UM
				for cam in Cams:
					try:
						#finally set the tumble pivot of the camera to the coordinates we have calculated before
						cmds.setAttr (cam + ".tumblePivot", X, Y, Z)
					except: 
						Warning("Ritalin: Setting camera tumble pivot on " + cam + "failed!")

# ====================================================================================================
# 							Store Component Selections functions
# ====================================================================================================
def findStoredVertexSelectionTemplate ():
    VertexTemplates = cmds.blindDataType(query = True, longNames = True, typeId = 99410 )
    if VertexTemplates != None:
        #print ("Found Vertex Templates: " + str(VertexTemplates)) 
        return VertexTemplates[0]
    else:
        #print ("Creating StoredVertexSelectionDataTemplate...")
        StoredVertexSelectionDataTemplate = cmds.blindDataType(typeId = 99410, dataType = "boolean", longDataName = "StoredVertexSelectionData", shortDataName = "SVSD")
        Template = cmds.rename (StoredVertexSelectionDataTemplate, "StoredVertexSelectionDataTemplate")
        return Template     
    return None
       
def findStoredFaceSelectionTemplate ():
    FaceTemplates = cmds.blindDataType(query = True, longNames = True, typeId = 99411 )
    if FaceTemplates != None:
        #print ("Found Face Templates: " + str(FaceTemplates)) 
        return FaceTemplates[0]
    else:
        #print ("Creating StoredFaceSelectionDataTemplate...")
        StoredFaceSelectionDataTemplate = cmds.blindDataType(typeId = 99411, dataType = "boolean", longDataName = "StoredFaceSelectionData", shortDataName = "SFSD")
        Template = cmds.rename (StoredFaceSelectionDataTemplate, "StoredFaceSelectionDataTemplate")
        return Template
    return None
    
def findStoredEdgeSelectionTemplate ():
    EdgeTemplates = cmds.blindDataType(query = True, longNames = True, typeId = 99412 )
    if EdgeTemplates != None:
        #print ("Found Edge Templates: " + str(EdgeTemplates))   
        return EdgeTemplates[0]
    else:
        #print ("Creating StoredEdgeSelectionDataTemplate...")
        StoredEdgeSelectionDataTemplate = cmds.blindDataType(typeId = 99412, dataType = "boolean", longDataName = "StoredEdgeSelectionData", shortDataName = "SESD")
        Template = cmds.rename (StoredEdgeSelectionDataTemplate, "StoredEdgeSelectionDataTemplate")
        return Template
    return None

def storeSelectionData ():
    if RitalinEnabled == True:
		if RitalinRememberSelections == True:
			print "Storing selection..."
			ComponentSelectMode = cmds.selectMode (query = True, component = True)
			if ComponentSelectMode == True:
				#if DoRecordSelection == True:
				
				#print("Storing current component selection...")   
				Sel = cmds.ls(sl = True)   
				hiliteObjs = cmds.ls (hilite = True)
				
				if (cmds.selectType (query = True, polymeshVertex = True) == True):
					if findStoredVertexSelectionTemplate () != None:
						#print ("Clearing stored vertex selections first...")   
						for obj in hiliteObjs:                    
							allVerts = getAllObjVertices(obj)
							if len(allVerts) > 0:
								cmds.polyBlindData(allVerts, typeId = 99410, associationType = "vertex", booleanData = False, longDataName = "StoredVertexSelectionData", shortDataName = "SVSD")
							vertList = list()
							for cmp in Sel:
								if cmp.find (obj + ".vtx[") > -1:
									vertList.append(cmp)
							#print ("Storing data for currently selected vertices: " + str(vertList))      
							if len(vertList) > 0:            
								StoredVertexSelectionData = cmds.polyBlindData(vertList, typeId = 99410, associationType = "vertex", booleanData = True, longDataName = "StoredVertexSelectionData", shortDataName = "SVSD")
								result = cmds.rename ( StoredVertexSelectionData , obj + "_StoredVertexSelectionData")
				   
				elif (cmds.selectType (query = True, polymeshFace = True) == True):
					if findStoredFaceSelectionTemplate () != None:
						#print ("Clearing stored face selections first...")
						for obj in hiliteObjs:                     
							allFaces = getAllObjFaces(obj)
							if len(allFaces) > 0:
								cmds.polyBlindData(allFaces, typeId = 99411, associationType = "face", booleanData = False, longDataName = "StoredFaceSelectionData", shortDataName = "SFSD")
							
							faceList = list()
							for cmp in Sel:
								if cmp.find (obj + ".f[") > -1:
									faceList.append(cmp)
							#print ("Storing data for currently selected faces: " + str(faceList) )      
							if len(faceList) > 0:            
								StoredFaceSelectionData = cmds.polyBlindData(faceList, typeId = 99411, associationType = "face", booleanData = True, longDataName = "StoredFaceSelectionData", shortDataName = "SFSD")
								result = cmds.rename ( StoredFaceSelectionData , obj + "_StoredFaceSelectionData")
				
				elif (cmds.selectType (query = True, polymeshEdge = True) == True):
					if findStoredEdgeSelectionTemplate () != None:
						#print ("Clearing stored edge selections first...")
						for obj in hiliteObjs: 
							allEdges = getAllObjEdges(obj)
							if len(allEdges) > 0:
								cmds.polyBlindData(allEdges, typeId = 99412, associationType = "edge", booleanData = False, longDataName = "StoredEdgeSelectionData", shortDataName = "SESD")
							
							edgeList = list()
							for cmp in Sel:
								if cmp.find (obj + ".e[") > -1:
									edgeList.append(cmp)
							#print ("Storing data for currently selected edges: " + str(edgeList) )      
							if len(edgeList) > 0:            
								StoredEdgeSelectionData = cmds.polyBlindData(edgeList, typeId = 99412, associationType = "edge", booleanData = True, longDataName = "StoredEdgeSelectionData", shortDataName = "SESD")
								result = cmds.rename( StoredEdgeSelectionData , obj + "_StoredEdgeSelectionData")       
						  
def restoreSelectionData():
    if RitalinEnabled == True:
		if RitalinRememberSelections == True:
			Sel = cmds.ls(sl = True)    
			
			allHiliteObjsVerts = getAllHiliteObjsVertices()
			if len(allHiliteObjsVerts) > 0: 
				if (cmds.selectType (query = True, polymeshVertex = True) == True):
					if findStoredVertexSelectionTemplate () != None:            
						#print ("Restoring vertex selection...")     
						lsStoredVerts = cmds.polyQueryBlindData(allHiliteObjsVerts, sc=True, typeId = 99410, associationType = "vertex", booleanData = True, longDataName = "StoredVertexSelectionData", shortDataName = "SVSD")
						if lsStoredVerts != None:        
							storedComponents = list()    
							for i in range(0,len(lsStoredVerts)-1,2) :
								cmp = lsStoredVerts[i].rsplit(".",1)[0]; 
								storedComponents.append(cmp)
								  
							if len(storedComponents) > 0:
								#print ("Restoring selection for components: " + str(storedComponents))  
								cmds.select(storedComponents, add = False) #Replacing selection instead of adding...
					return

			allHiliteObjsFaces = getAllHiliteObjsFaces()
			if len(allHiliteObjsFaces) > 0:
				if (cmds.selectType (query = True, polymeshFace = True) == True):
					if findStoredFaceSelectionTemplate () != None:
						#print ("Restoring face selection...")          
						lsStoredFaces = cmds.polyQueryBlindData(allHiliteObjsFaces, sc=True, typeId = 99411, associationType = "face", booleanData = True, longDataName = "StoredFaceSelectionData", shortDataName = "SFSD")   
						if lsStoredFaces != None:     
							storedComponents = list()    
							for i in range(0,len(lsStoredFaces)-1,2) :
								cmp = lsStoredFaces[i].rsplit(".",1)[0]; 
								storedComponents.append(cmp)
								  
							if len(storedComponents) > 0:
								#print ("Restoring selection for components: " + str(storedComponents))  
								cmds.select(storedComponents, add = False) #Replacing selection instead of adding...
					return
					
			allHiliteObjsEdges = getAllHiliteObjsEdges()
			if len(allHiliteObjsEdges) > 0:
				#print allHiliteObjsEdges
				if (cmds.selectType (query = True, polymeshEdge = True) == True):
					if findStoredEdgeSelectionTemplate () != None:
						print ("Restoring edge selection...")          
						lsStoredEdges = cmds.polyQueryBlindData(allHiliteObjsEdges, sc=True, typeId = 99412, associationType = "edge", booleanData = True, longDataName = "StoredEdgeSelectionData", shortDataName = "SESD")    
						#print lsStoredEdges
						if lsStoredEdges != None:     
							storedComponents = list()    
							for i in range(0,len(lsStoredEdges)-1,2) :
								cmp = lsStoredEdges[i].rsplit(".",1)[0]; 
								storedComponents.append(cmp)
								  
							if len(storedComponents) > 0:
								#print ("Restoring selection for components: " + str(storedComponents))  
								cmds.select(storedComponents, add = False) #Replacing selection instead of adding...
					return

def getAllObjVertices (Object):
    allVertsList = list()
    vertCount = cmds.polyEvaluate(Object, vertex = True)
    vertSelString = (Object + '.vtx[0:' + str(vertCount -1) + ']')
    allVertsList.append(vertSelString)    
    return allVertsList

def getAllObjFaces(Object):
    allFacesList = list()
    faceCount = cmds.polyEvaluate(Object, face = True)
    faceSelString = (Object + '.f[0:' + str(faceCount -1) + ']')
    allFacesList.append(faceSelString)
    return allFacesList
    
def getAllObjEdges(Object):
    allEdgesList = list()
    edgeCount = cmds.polyEvaluate(Object, edge = True)
    edgeSelString = (Object + '.e[0:' + str(edgeCount -1) + ']')
    allEdgesList.append(edgeSelString)    
    return allEdgesList 
                              
def getAllHiliteObjsVertices():
    hiliteObjs = cmds.ls (hilite = True)
    allVertsList = list()
    
    for obj in hiliteObjs:
        vertCount = cmds.polyEvaluate(obj, vertex = True)
        vertSelString = (obj + '.vtx[0:' + str(vertCount -1) + ']')
        allVertsList.append(vertSelString)    
    return allVertsList

def getAllHiliteObjsFaces():
    hiliteObjs = cmds.ls (hilite = True)
    allFacesList = list()
    
    for obj in hiliteObjs:
        faceCount = cmds.polyEvaluate(obj, face = True)
        faceSelString = (obj + '.f[0:' + str(faceCount -1) + ']')
        allFacesList.append(faceSelString)
    return allFacesList
    
def getAllHiliteObjsEdges():
    hiliteObjs = cmds.ls (hilite = True)
    allEdgesList = list()
    
    for obj in hiliteObjs:
        edgeCount = cmds.polyEvaluate(obj, edge = True)
        edgeSelString = (obj + '.e[0:' + str(edgeCount -1) + ']')
        allEdgesList.append(edgeSelString)    
    return allEdgesList

						
# =============================================================================================================
# Some management functions (UI callbacks, interaction functions and script jobs that trigger the above function
# =============================================================================================================

def toggleRitalinHonorSkinJoints():
	global RitalinHonorInfluenceJoints
	RitalinHonorInfluenceJoints = not RitalinHonorInfluenceJoints
	cmds.optionVar (iv=('RitalinHonorInfluenceJoints', RitalinHonorInfluenceJoints))
	setCamRotatePivots()
	print("toggleRitalinHonorSkinJoints()")

def toggleRitalinRememberSelections():
	global RitalinRememberSelections
	RitalinRememberSelections = not RitalinRememberSelections
	cmds.optionVar (iv=('RitalinRememberSelections', RitalinRememberSelections))
	if RitalinRememberSelections == False:
		sourceMel ("Ritalin_doMenuComponentSelection_default.mel")
	else:
		sourceMel ("Ritalin_doMenuComponentSelection.mel")
	print("toggleRitalinRememberSelections()")

def toggleRitalin ():
	global RitalinEnabled
	RitalinEnabled = not RitalinEnabled
	enableRitalin(RitalinEnabled)
	cmds.optionVar (iv=('RitalinEnabled', RitalinEnabled))
	print ("toggleRitalin()")
	

# =============================================================================================================
# This function establishes the two script Jobs that trigger camera tumble pivot relocation when: 
#  - Changing a slection (clicking an object) or 
#  - Dragging the mouse (moving an object)
# A special case is also handled when the paint skin weights tool is active and user has selected the skin influence
# by right-dragging and selecting "Paint Skin Weights" from the popup marking menu
# =============================================================================================================


def enableRitalin(enable = True): 
	global RitalinEnabled
	global resetTumbleToolToCOI
	global RitalinRememberSelections
	
	if enable == True:
		if RitalinEnabled == False:
			if (cmds.tumbleCtx ("tumbleContext", query = True, localTumble = true)) == 1:
				cmds.tumbleCtx ("tumbleContext", edit = True, localTumble = 0)
				resetTumbleToolToCOI = True
			else: resetTumbleToolToCOI = False

		cleanRitalinScriptJobs()

		#The dragRelease event is king, it always gets fired when the user presses the mouse button or moves the mouse with the button pressed - exactly what we need
		Job1 = cmds.scriptJob(runOnce = False, killWithScene = False, event =('DragRelease',  "cmds.undoInfo (swf = False); setCamRotatePivots(); cmds.undoInfo (swf = True)"))
		RitalinScriptJobs.append(Job1)		

		#Due to a bug in Maya we need to run the following event at least once to ensure that the DragRelease event gets triggered above. Otherwise it never kicks in  :-(
		Job2 = cmds.scriptJob(runOnce = False, killWithScene = False, event =('SelectionChanged',  "cmds.undoInfo (swf = False); setCamRotatePivots(); storeSelectionData(); cmds.undoInfo (swf = True); ")) 
		RitalinScriptJobs.append(Job2)
	
		#createRitalinCameraScriptJobs()
		setCamRotatePivots()
		if RitalinRememberSelections == True:
			sourceMel ("Ritalin_doMenuComponentSelection.mel")
			storeSelectionData()
	
	if enable == False:
		#print ("Attempting to disable Ritalin - Deleting script Jobs")
		if resetTumbleToolToCOI == True:
			cmds.tumbleCtx ("tumbleContext", edit = True, localTumble = 1)
		
		sourceMel ("Ritalin_doMenuComponentSelection_default.mel")
		cleanRitalinScriptJobs()

		
def createRitalinToolsMenu():
	global RitalinEnabled
	global RitalinToolsMenu
	global RitalinEnableMenuItem
	global RitalinHonorJointsMenuItem
	global RitalinRememberSelectionsMenuItem
	global RitalinRememberSelections
	gMainWindow = mel.eval('$tmpVar=$gMainWindow')
	Continue = False
	
	try:
		#print "Attempting delete RitalinToolsMenu as MenuItem"
		cmds.deleteUI (RitalinToolsMenu, menuItem = True)
		Continue = True
	except:
		Continue = False
	try:
		#print "Attempting delete PerforceToolsMenu as Menu"
		cmds.deleteUI (RitalinToolsMenu, menu = True)
		Continue = True
	except:
		Continue = False

	try:
		RitalinToolsMenu = (cmds.menu ("RitalinToolsMenu", label = 'Ritalin', tearOff = True, allowOptionBoxes = True, postMenuCommand = ("buildRitalinToolsMenu()"), parent = gMainWindow))
		RitalinEnableMenuItem = cmds.menuItem (label='Ritalin Enabled', checkBox = RitalinEnabled, command = ('toggleRitalin (); buildRitalinToolsMenu()'), parent = RitalinToolsMenu)
		RitalinHonorJointsMenuItem = cmds.menuItem (label='Honor Joints when in PaintSkinWeights mode', checkBox = RitalinHonorInfluenceJoints, command = ('toggleRitalinHonorSkinJoints()'), parent = RitalinToolsMenu)
		RitalinRememberSelectionsMenuItem = cmds.menuItem (label='Remember Component Selections', checkBox = RitalinRememberSelections, command = ('toggleRitalinRememberSelections()'), parent = RitalinToolsMenu)
		Continue = True
	except:
		Continue = False
	
	if Continue == True:
		buildRitalinToolsMenu()

def buildRitalinToolsMenu():
	global RitalinEnabled
	global RitalinRememberSelections
	
	global RitalinToolsMenu
	global RitalinEnableMenuItem
	global RitalinHonorJointsMenuItem
	global RitalinRememberSelectionsMenuItem
	
	cmds.menuItem (RitalinEnableMenuItem, edit = True, checkBox = RitalinEnabled)
	cmds.menuItem (RitalinHonorJointsMenuItem, edit = True, checkBox = RitalinHonorInfluenceJoints, enable = RitalinEnabled)
	cmds.menuItem (RitalinRememberSelectionsMenuItem, edit = True, checkBox = RitalinRememberSelections)


#MEL wrapper for toggleRitalin
mel.eval ("global proc  toggleRitalin () {python(\"toggleRitalin ()\");}")
#MEL wrapper for toggleRitalinHonorSkinJoints
mel.eval ("global proc toggleRitalinHonorSkinJoints () {python(\"toggleRitalinHonorSkinJoints ()\");}")	
#MEL wrapper for toggleRitalinRememberSelections()
mel.eval ("global proc toggleRitalinRememberSelections() {python(\"toggleRitalinRememberSelections()\");}")	

#Create the Ritalin Menu after Maya has started up and there is a UI we can attach to:
cmds.evalDeferred ("createRitalinToolsMenu();", lowestPriority = True)  
cmds.evalDeferred ("enableRitalin(True);", lowestPriority = False)