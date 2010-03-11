# Ritalin for Maya version 2008 and higher
# Author: Stefan Kubicek 
# Last changed: 2010-03-03, 23:00
# File Version 1.4
# Code Dependencies: Sproing_Functions.py

# ====================================================================================================
# Description: Creates a Ritalin menu with options to change the camera navigation behaviour. 
# When enabled, cameras always tumble around the selected objects or components. This also works for bones and, if enabled,
# for skin influence objects when in paintSkinWeights mode.
#====================================================================================================

import maya.cmds as cmds
import maya.mel as mel

true = True
false = False

global RitalinFirstCall; RitalinFirstCall  = False
global RitalinHonorInfluenceJoints; RitalinHonorInfluenceJoints = True
global RitalinEnabled; RitalinEnabled = False;
global RitalinScriptJobs; RitalinScriptJobs = []
global resetTumbleToolToCOI; resetTumbleToolToCOI = False
global RitalinDoComputeBB; RitalinDoComputeBB = True

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
		
		

def cleanRitalinScriptJobs():
	global RitalinScriptJobs
	for job in RitalinScriptJobs:
		try:
			cmds.scriptJob (kill = job)	
		except:
			Warning ("Job " + str(job) + " could not be killed!")
	RitalinScriptJobs = []

cleanRitalinScriptJobs()


def setCamRotatePivots():
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
			
			Continue = False
			Selec = cmds.ls( selection = True )
			ComputeCenterAlreadyDone = False

			if len(Selec) > 0:
				X = 0.0; Y = 0.0; Z = 0.0
				#Let's find out if we are in skin weights paint mode
				currCtx = cmds.currentCtx(); 
				currTool = None
				try: 
					currTool = cmds.contextInfo (currCtx, c = True);
					#print("CurrentTool is:" + str(currTool))
				except: DoNothing = True
				if RitalinHonorInfluenceJoints == True: #In case we are painting skin weights we can ignore everything and just concentrate on the currently active skin joint
					if currTool == "artAttrSkin": 
						whichTool = cmds.artAttrSkinPaintCtx (currCtx, query = True, whichTool = True)
						if whichTool == "skinWeights": #Yes we are in skin paint wights mode
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
			
				if ComputeCenterAlreadyDone == False:  #Standard computation in case we are not in paintSkinWeights mode
					Joints = []
					stdObjects = []
					
					for o in Selec: 
						specialTransformTypes = ["selectHandle", "rotatePivot", "scalePivot", "Axis"]
						
						if (cmds.nodeType (o) == "joint"): 
							#Maya can't compute BB of joints (API bug?) so we have to work around this by dealing with joints rotatePivots instead
							#print ("Selected node is of type joint")
							isSpecialType = False
							for Type in specialTransformTypes:
								if o.find (Type) > -1:
									#print ("Selected node is of special TransformType")
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
								#print("Node has " + str(len(Shapes)) + " shapes!")
								#print (Shapes)
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
						#print ("Bounding Box is: " + str(BB))
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


def toggleRitalinHonorSkinJoints():
	global RitalinHonorInfluenceJoints
	RitalinHonorInfluenceJoints = not RitalinHonorInfluenceJoints
	setCamRotatePivots()
	print("toggleRitalinHonorSkinJoints()")


def toggleRitalin ():
	enableRitalin(not RitalinEnabled)
	print ("toggleRitalin()")
	
def enableRitalin(enable = True): 
	global RitalinEnabled
	global resetTumbleToolToCOI
	
	if enable == True:
		if RitalinEnabled == False:
			if (cmds.tumbleCtx ("tumbleContext", query = True, localTumble = true)) == 1:
				cmds.tumbleCtx ("tumbleContext", edit = True, localTumble = 0)
				resetTumbleToolToCOI = True
			else: resetTumbleToolToCOI = False

			cleanRitalinScriptJobs()
	
			#The dragRelease event is king, it always gets fired when the user presses the mouse button or moves the mouse with the button pressed - exactly what we need
			Job1 = cmds.scriptJob(runOnce = False, killWithScene = False, event =('DragRelease', "cmds.undoInfo (swf = False); setCamRotatePivots(); RitalinDoComputeBB = True; cmds.undoInfo (swf = True)"))
			RitalinScriptJobs.append(Job1)		

			#Due to a bug in Maya we need to run the following event at least once to ensure that the DragRelease event gets triggered above. Otherwise it never kicks in  :-(
			Job2 = cmds.scriptJob(runOnce = False, killWithScene = False, event =('SelectionChanged', "RitalinDoComputeBB = True; cmds.undoInfo (swf = False); setCamRotatePivots(); toggleComputation(); cmds.undoInfo (swf = True)"))
			RitalinScriptJobs.append(Job2)
		
			#createRitalinCameraScriptJobs()
			RitalinEnabled = True
			setCamRotatePivots()
			#print ("enableRitalin(True)")
	
	if enable == False:
		#print ("Attempting to disable Ritalin - Deleting script Jobs")
		if resetTumbleToolToCOI == True:
			cmds.tumbleCtx ("tumbleContext", edit = True, localTumble = 1)

		cleanRitalinScriptJobs()
		RitalinEnabled = False
		#print ("enableRitalin(False)")
		

def toggleComputation():
	global RitalinDoComputeBB;
	RitalinDoComputeBB == False
	currCtx = cmds.currentCtx(); 
	currTool = None
	try: 
		currTool = cmds.contextInfo (currCtx, c = True);
	except:
		RitalinDoComputeBB == False
	
	if currTool == "selectTool":
		RitalinDoComputeBB = True
	else:
		RitalinDoComputeBB = False
		
		
def createRitalinToolsMenu():
	global RitalinToolsMenu
	global RitalinEnableMenuItem
	global RitalinHonorJointsMenuItem

	gMainWindow = mel.eval('$tmpVar=$gMainWindow')
	Continue = False
	
	try:
		cmds.deleteUI (RitalinToolsMenu, menuItem = True)
		Continue = True
	except:
		Continue = False

	
	try:
		RitalinToolsMenu = (cmds.menu ("RitalinToolsMenu", label = 'Ritalin', tearOff = True, allowOptionBoxes = True, postMenuCommand = ("buildRitalinToolsMenu()"), parent = gMainWindow))
		RitalinEnableMenuItem = cmds.menuItem (label='Ritalin Enabled', checkBox = RitalinEnabled, command = ('toggleRitalin ()'), parent = RitalinToolsMenu)
		RitalinHonorJointsMenuItem = cmds.menuItem (label='Honor Joints when in PaintSkinWeights mode', checkBox = RitalinHonorInfluenceJoints, command = ('toggleRitalinHonorSkinJoints()'), parent = RitalinToolsMenu)
		Continue = True
	except:
		Continue = False
	
	if Continue == True:
		buildRitalinToolsMenu()

def buildRitalinToolsMenu():
	global RitalinToolsMenu
	global RitalinEnableMenuItem
	global RitalinHonorJointsMenuItem

	cmds.menuItem (RitalinEnableMenuItem, edit = True, checkBox = RitalinEnabled)
	cmds.menuItem (RitalinHonorJointsMenuItem, edit = True, checkBox = RitalinHonorInfluenceJoints)

"""
def loadSkinPaintToolIntergration():
	print("Paint integration init called")
	mel.eval('source "Ritalin_artSkinSelectInfluence.mel"')
"""
#MEL wrapper for toggleRitalin
mel.eval ("global proc  toggleRitalin () {python(\"toggleRitalin ()\");}")
#MEL wrapper for toggleRitalinHonorSkinJoints
mel.eval ("global proc toggleRitalinHonorSkinJoints () {python(\"toggleRitalinHonorSkinJoints ()\");}")	

#Create the Ritalins Menu after Maya has started up and there is a UI we can attach to:
cmds.evalDeferred ("createRitalinToolsMenu();", lowestPriority = True)  
#Upon Chris Staber's request Ritalin is now enabled by default
cmds.evalDeferred ("enableRitalin(True);", lowestPriority = True)
#cmds.evalDeferred ("loadSkinPaintToolIntergration();",lowestPriority = True) 