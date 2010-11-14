# Script Name: QMenuConfigurator Plugin
# Host Application: Softimage
# Last changed: 2010-07-07, 11:00 hrs 
# Author: Stefan Kubicek
# mail: stefan@keyvis.at

# Code dependencies: uses GetCommandByUID from keyvisCommands.dll

"""
Views = Application.Desktop.ActiveLayout.Views
Sel = Views[1].GetAttributeValue("selection")
Application.LogMessage(Sel)

=============================================

Views = Application.Desktop.ActiveLayout.Views
#Application.LogMessage(Views[1].FullName)
for view in Views:
	if view.Floating:
	#if view.Visible:
		Application.LogMessage(view.Name + ": " + str(view.Type) + str(view.Rectangle) + str(view.FullName) + str(view.Parent))
"""
# TODO: Save version number with file
# TODO: Research if feasible: WIP -  QMenuGetSelectionDetails(): should query selection filter and only if filter is not Object or Group  or Center should pass on old selection types and class names (to find out if we are in component mode and what objects are hilited) - WIP
# TODO: Add same type of input variables to items, switches, menus and menu contexts (self, ...). Is "selection" argument really required?
# TODO: Find out why executing the QPop command to render a menu prevents modal dialogues from appearing (e.g. Info Selection, applying TopoOps in immed mode)
#		-> Report: Creating a blend curve in immediate mode from menu will let me adjust params. Creating one using same ApplyGenOp command will not. Why? How To?

#TODO: SetThumbnail, SelectionInfo, SetUserKeyword commands fail when called from QMenu (in general: Modal dialogues do not display after QMenuRender is called)
#Report: Remove Transform Group also deletes non-Transform-Group objects, even when they are not in a Transform group
#Report: When deleting a camera that is used in a viewport the viewport name label is not updated to the new camera is is looking through
#Report: Curve Fillet command does not work in Immed mode

#Report: it is not possible to categorize ones own commands
#Ask: Commands have always the same UID across versions of Softimage? How are custom command's UID always the same, they don't get stored anywhere -> Does not look like it
#TODO: Article about delayed events 
#TODO: Try finding currently active view by comparing Rectangles of available views -> Difficult, because rectangles retrieved from Python differ from those rported by Softimage
#TODO: Pass in Viewport under mouse to contexts script items and menu functions. Also include material editor
#Report:  ApplyGenOp does not care about ImmedMode, ApplyTopoOp/ApplyOp do, but they ignore siOperationMode parameter (always honor ImmedMode, even when setting siPersistentOperation)
#TODO: Finish Menu Items: Extract Edges as Curve

#Report: Timer event execution will not wait for Pick session.
#Report: No command for menu Items:  "Remove Knot" (Application.SetCurveKnotMultiplicity("circle.knot[14]", 0, "siPersistentOperation")  -> scripting required
# "Extract Edges As Curve", "Merges Curves",
#Report: There are no separate commands for menu items "Align Bezier Handles, -Back to Forward, -Forward to Back", (uses AlignBezierKnotsTangents)  
#TODO: Store Keys in preferences instead of config file
#TODO: Implement proper keywords file switching when changing script language of an item
#TODO: Execute button should only execute current text selection in editor
#TODO: Separate QMenuConfigurator into QMenuConfigurator (custom Prop only) and QMenuPreferences (file and debug prefs only)

#TODO: Evaluate if using a Selection Info class and event is really faster when evaluating contexts
#TODO: Create texture Editor and Render Tree example menu items

#TODO: Convert Merge clusters menu item into a command
#TODO: Implement QMenu command as Python lib so it can be called as a function and not as a command (prevents QMenu from appearing as the Undo/Repeat item in the edit menu)
#TODO: Fix QMenu menu not appearing on second monitor -> Eugen

#TODO: Use dictionaries in globalQMenu_Menus, ..Items etc? 
#TODO: Implement "LastClickedView" attribute and class and a command to query "full" and "nice" View Signature (TO find currently active Window?). Already implemented in GetView?
#TODO: Add categorisation to menus (like script items)
#TODO: GET XSI window handle using native Desktop.GetApplicationWindowHandle() function (faster than python and win32 code?)

#Try: Check if it is fast enough to have a custom command to execute context scripts (VB, JS, Py) instead of using the ExecuteScriptCode command, which is very slow
#TODO: Check if CommandCollection.Filter with "Custom" is any faster refreshing the Softimage commands lister

#Report: It is not possible to prevent a command from being repeatable (should be a capability flag of the command, or at least tied to noLogging)
#Report: It is not possible to set more than one shader ball model at a time
#Report: How to query name of currently active window? How to query currently active window.
#Report bug: When calling executeScriptCode for the first time on code stored in an ActiveX class attribute (e.g. MenuItem.dode) an attribute error will be thrown. Subsequent calls do not exhibit this behaviour
#Report bug: Execute Script Code is insanely slow compare to executing the code directly
#Report bug: Pasting into the text editor causes "\n" charcters to be replacd with "\n\r"
#Report bug: When executing context script error is thrown when last character is a whitespace or return char (Problem with text widget?) or comment
#Report Bug: Strange bug in XSI7.01: When a command allows notifications and is executed and undone, it causes itself or other commands to be unfindable through App.Commands("Commandname") (-> returns none)
#Report Bug: Local subdivision _does_ work when assigned to a key! Currently is flagged as not.
#Report duplicate commands (Dice Polygons, Dice Object & Dice Object/Polygons does the same)
#Report duplicate commands (Invert Polygons, Invert All Normals, Invert Selected Polygons; Delete Components vs Delete Component)
#Report duplicate commands (InsertCurveKnot, SetCurveKnotMultiplicity, 
#Report (custom?) commands not supporting key assignment are still listed in the keyboard mapping command list (should better not be listed?) 

#TODO: Implement Cleanup functionality to delete empty script items and menus

#Cleanup: Rename QMenu_MenuItem class and related functions (e.g. getQMenu_MenuItemByName) to "ScriptItem"
#Cleanup: Make all class attributes start with upper-case characters to  

#Japanese font is untested

#Report: oCodeEditor.SetAttribute(c.siUICapability, c.siCanLoad does not work?
#TODO: Enable color coding for text fields according to set script language - > Bug in XSI that prevents certain text editor features from being displayed already



# ============================= Helpful code snippets==========================================
"""
if ( !originalsetting ) { 
   prefs.SetPreferenceValue( "scripting.cmdlog", false ); 
"""

"""
Application.InstallCustomPreferences("QMenuConfigurator","QMenu")
"""

#============================== Plugin Code Start =============================================
import win32com.client
import win32com.server

import time
from win32com.client import constants as c
from win32com.client import dynamic as d

import os
import gc #Import garbage collector module
#import os.path
#import win32con
#import win32process #, pythoncom
import win32gui
import xml.dom.minidom as DOM

null = None
false = False
true = True
#True = 1
#False = 0

App = Application
Print = getattr(App, 'LogMessage')
getClassName = getattr(App,'ClassName')

#=========================================================================================================================
#=============================================== QMenu ActiveX-compliant classes =========================================
#=========================================================================================================================


class QMenuLastUsedItem:
 # Declare list of exported functions:
	_public_methods_ = ['set']
	 # Declare list of exported attributes
	_public_attrs_ = ['item', 'ViewSignatureLong', 'ViewSignatureNice']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = []

	def __init__(self):
	 # Initialize exported attributes:
		self.item = None
		self.ViewSignatureLong = str()
		self.ViewSignatureNice = str()
	
	def set (self, menuItem):
		self.item = menuItem
	
class QMenuSeparator:
 # Declare list of exported functions:
	_public_methods_ = []
	 # Declare list of exported attributes
	_public_attrs_ = ['type','name','UID']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = ['type']
	
	def __init__(self):
		 # Initialize exported attributes:
		self.type = "QMenuSeparator"
		self.UID = XSIFactory.CreateGuid()
		self.name = "NewSeparator"

class QMenuSeparators: #Holds existing Separators
 # Declare list of exported functions:
	_public_methods_ = ['addSeparator','deleteSeparator']
	 # Declare list of exported attributes
	_public_attrs_ = ['items']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = []
	
	def __init__(self):
		 # Initialize exported attributes:
		self.items = list()
	
	def addSeparator(self, sep):
		items = self.items
		sepNames = list()
		unwrappedSep = win32com.server.util.unwrap(sep)
		for item in items:
			unwrappedItem = win32com.server.util.unwrap(item)
			sepNames.append (unwrappedItem.name)
		if not (unwrappedSep.name in sepNames):
			items.append (sep)
			return True
		else:
			Print("Could not add " + str(unwrappedSep.name) + " to global QMenu Menu Sets because a set with that name already exists!", c.siError)
			return False	

	
	def deleteSep (self,sep):
		items = self.items
		try:
			items.remove(sep)
		except:
			Print(sep.name + "could not be found in QMenu globals - nothing to delete!", c.siWarning)
			
class QMenu_MenuItem:
 # Declare list of exported functions:
	_public_methods_ = []
	 # Declare list of exported attributes
	_public_attrs_ = ['type','UID', 'name', 'category', 'file', 'language', 'code', 'switch','isEnabled']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = ['type']
	
	def __init__(self):
		 # Initialize exported attributes:
		self.UID = XSIFactory.CreateGuid()
		self.name = str()
		self.category = str()
		#self.file = str()
		self.language = "Python"
		self.code = str()
		self.type = "QMenu_MenuItem"
		self.switch = False
		self.isEnabled = True

class QMenu_MenuItems:
 # Declare list of exported functions:
	_public_methods_ = ['addMenuItem','deleteMenuItem']
	 # Declare list of exported attributes
	_public_attrs_ = ['items']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = []
	
	def __init__(self):
		 # Initialize exported attributes:
		self.items = list()
	
	def addMenuItem (self, menuItem):
		items = self.items
		itemNames = list()
		unwrappedMenuItem = win32com.server.util.unwrap(menuItem)
		
		for item in items:
			unwrappedItem = win32com.server.util.unwrap(item)
			itemNames.append (unwrappedItem.name)
		if not (unwrappedMenuItem.name in itemNames):
			items.append (menuItem)
			return True
		else:
			Print("Could not add " + str(unwrappedMenuItem.name) + " to global QMenu Menu Items because an item with that name already exists!", c.siError)
			return False
			
	
	def deleteMenuItem (self, menuItem):
		items = self.items
		try:
			items.remove (menuItem)
		except:
			Print("QMenu Menu Item " + str(menuItem.name) + " was not found in global QMenu Menu Items and could not be deleted!", c.siError)
			
class QMenu_Menu:
 # Declare list of exported functions:
	_public_methods_ = ['insertMenuItem','removeMenuItem','removeAllMenuItems','removeMenuItemAtIndex','insertTempMenuItem','appendTempMenuItem','removeTempMenuItem','removeTempMenuItemAtIndex','removeAllTempMenuItems']
	 # Declare list of exported attributes
	_public_attrs_ = ['type','UID', 'name', 'items', 'tempItems','code','language','menuItemLastExecuted', 'executeCode']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = ['type']
	
	def __init__(self):
		 # Initialize exported attributes:
		self.type = "QMenu_Menu"
		self.UID = XSIFactory.CreateGuid()
		self.name = str()
		self.items = list()
		self.tempItems = list()
		self.code = str()
		#self.code = unicode()
		self.language = "Python"
		self.menuItemLastExecuted = list()
		self.executeCode = False #By default menu code is not getting execute. Most menus won't need any executable code.
		
	def insertMenuItem (self, index, menuItem):
		items = self.items
		
		if index == None:
			index = 0
		items.insert (index,menuItem)
	
	def removeMenuItem (self, menuItem):
		items = self.items
		try:
			items.remove (menuItem)
		except:
			Print("QMenu Menu '" + str(self.name) + "' does not have a menu item called " + str(menuItem.name) + " that could be removed!!", c.siError)
	
	def removeAllMenuItems (self):
		self.items = list()

	
	def removeAllTempMenuItems (self):
		self.tempItems = list()
	
	def removeMenuItemAtIndex (self, index):
		items = self.items
		try:
			#menuItem = items[index]
			items.pop(index)
		except:
			Print("QMenu Menu '" + str(self.name) + "' does not have a menu item at index " + str(index) + " that could be removed!!", c.siError)
			
	def insertTempMenuItem (self, index, menuItem):
		items = self.tempItems
		
		if index == None:
			index = 0 #len(tempItems)-1)
		items.insert (index,menuItem)
	
	def appendTempMenuItem (self, menuItem):
		items = self.tempItems
		items.append (menuItem)
	
	def removeTempMenuItem (self, menuItem):
		items = self.tempItems
		try:
			items.remove (menuItem)
		except:
			Print("QMenu Menu '" + str(self.name) + "' does not have a temporary menu called '" + str(menuItem.name) + "' that could be removed!", c.siError)
	
	def removeTempMenuItemAtIndex (self, index):
		items = self.tempItems
		try:
			#menuItem = items[index]
			items.pop(index)
		except:
			Print("QMenu Menu '" + str(self.name) + "' does not have a temporary menu item at index " + str(index) + " that could be removed!!", c.siError)

class QMenu_Menus:
 # Declare list of exported functions:
	_public_methods_ = ['addMenu','deleteMenu']
	 # Declare list of exported attributes
	_public_attrs_ = ['items', 'execute']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = []
	
	def __init__(self):
		 # Initialize exported attributes:
		self.items = list()
		self.execute = False #By default menu code should not be executed due to performance reasons (most menus won't have meaningful code anyway)

	def addMenu (self, menu):
		items = self.items
		menuNames = list()
		unwrappedMenu = win32com.server.util.unwrap(menu)
		for item in items:
			unwrappedItem = win32com.server.util.unwrap(item)
			menuNames.append (unwrappedItem.name)
		if not (unwrappedMenu.name in menuNames):
			items.append (menu)
			return True
		else:
			Print("Could not add " + str(unwrappedMenu.name) + " to global QMenu Menus because a menu with that name already exists!", c.siError)
			return False		

	
	def deleteMenu (self, menu):
		items = self.items
		try:
			items.remove (menu)
		except:
			Print("QMenu Menu" + str(menu.name) + " was not found in global QMenu Menu and could not be deleted!", c.siError)
			
class QMenu_MenuSet:
 # Declare list of exported functions:
	_public_methods_ = ['insertMenuAtIndex', 'removeMenuAtIndex','insertContext', 'removeContext', 'setMenu']
	 # Declare list of exported attributes
	_public_attrs_ = ['type','UID', 'name', 'AMenus', 'AContexts', 'BMenus', 'BContexts', 'CMenus', 'CContexts', 'DMenus', 'DContexts']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = ['type']
	
	def __init__(self):
		 # Initialize exported attributes:
		self.type = "QMenu_MenuSet"
		self.UID = XSIFactory.CreateGuid()
		self.name = str()
		self.AMenus = list()
		self.AContexts = list()
		self.BMenus = list()
		self.BContexts = list()
		self.CMenus = list()
		self.CContexts = list()
		self.DMenus = list()
		self.DContexts = list()
	
	def setMenu (self, index, menu, menuList):
		if menuList == "A":
			self.AMenus[index] = menu
		if menuList == "B":
			self.BMenus[index] = menu
		if menuList == "C":
			self.CMenus[index] = menu
		if menuList == "D":
			self.DMenus[index] = menu
	
	def insertMenuAtIndex (self, index, menu, menuList):
		if menuList == "A":
			self.AMenus.insert(index,menu)
		if menuList == "B":
			self.BMenus.insert(index,menu)
		if menuList == "C":
			self.CMenus.insert(index,menu)
		if menuList == "D":
			self.DMenus.insert(index,menu)
	
	def removeMenuAtIndex (self, index, menuList):
		if menuList == "A":
			self.AMenus.pop(index)
		if menuList == "B":
			self.BMenus.pop(index)
		if menuList == "C":
			self.CMenus.pop(index)
		if menuList == "D":
			self.DMenus.pop(index)
	
	def insertContext (self, index, context, contextList):
		if contextList == "A":
			self.AContexts.insert(index,context)
		if contextList == "B":
			self.BContexts.insert(index,context)
		if contextList == "C":
			self.CContexts.insert(index,context)
		if contextList == "D":
			self.DContexts.insert(index,context)

	def removeContext (self, index, contextList):
		if contextList == "A":
			self.AContexts.pop(index)
		if contextList == "B":
			self.BContexts.pop(index)
		if contextList == "C":
			self.CContexts.pop(index)
		if contextList == "D":
			self.DContexts.pop(index)
			
class QMenu_MenuSets: #Holds existing MenuSets
 # Declare list of exported functions:
	_public_methods_ = ['addSet','deleteSet']
	 # Declare list of exported attributes
	_public_attrs_ = ['items']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = []
	
	def __init__(self):
		 # Initialize exported attributes:
		self.items = list()
	
	def addSet(self, set):
		items = self.items
		setNames = list()
		unwrappedSet = win32com.server.util.unwrap(set)
		for item in items:
			unwrappedItem = win32com.server.util.unwrap(item)
			setNames.append (unwrappedItem.name)
		if not (unwrappedSet.name in setNames):
			items.append (set)
			return True
		else:
			Print("Could not add " + str(unwrappedSet.name) + " to global QMenu Menu Sets because a set with that name already exists!", c.siError)
			return False	

	
	def deleteSet (self,set):
		items = self.items
		try:
			items.remove(set)
		except:
			Print(set.name + "could not be found in globals - nothing to delete!", c.siWarning)
		
class QMenu_MenuDisplayContext:   #Holds the context evaluation code, which should return True or False (display or not display the menu)
 # Declare list of exported functions:
	_public_methods_ = []
	 # Declare list of exported attributes
	_public_attrs_ = ['type','UID', 'name', 'language', 'code']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = ['type']
	
	def __init__(self):
		 # Initialize exported attributes:
		self.type = "QMenu_MenuDisplayContext"
		self.UID = XSIFactory.CreateGuid()
		self.name = str()
		self.language = str()
		self.code = str()
		
class QMenu_MenuDisplayContexts:   #Holds existing display rcontexts
 # Declare list of exported functions:
	_public_methods_ = ['addContext', 'deleteContext']
	 # Declare list of exported attributes
	_public_attrs_ = ['items']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = []
	
	def __init__(self):
		 # Initialize exported attributes:
		self.items = list()
		
	def addContext(self, context):
		items = self.items
		contextNames = list()
		unwrappedContext = win32com.server.util.unwrap(context)
		for item in items:
			unwrappedItem = win32com.server.util.unwrap(item)
			contextNames.append (unwrappedItem.name)
		#Print("unwrappedContext.name found is: " + unwrappedContext.name)
		if not(unwrappedContext.name in contextNames):
			items.append (context)
			return True
		else:
			Print("Could not add " + str(unwrappedContext.name) + " to global QMenu Menu Display Contexts because a Display Context with that name already exists!", c.siError)
			return False
		
	def deleteContext (self, context):
		items = self.items
		if len(items) > 0:
			items.remove (context)
		
class QMenuDisplayEvent: #Display events store the keycodes of keys that have been chosen to display a specific menu number for whatever view the mouse is over
	# Declare list of exported functions:
	_public_methods_ = []
	 # Declare list of exported attributes
	_public_attrs_ = ['type','UID', 'number','key', 'keyMask']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = ['type']
	
	def __init__(self):
		 # Initialize exported attributes:
		self.type = "QMenuDisplayEvent"
		self.UID = XSIFactory.CreateGuid()
		self.number = int()
		self.key = int()
		self.keyMask = int()
		
class QMenuDisplayEvents: #Container class storing existing DisplayEvents
	# Declare list of exported functions:
	_public_methods_ = ['addEvent','deleteEvent', 'getEventNumber']
	 # Declare list of exported attributes
	_public_attrs_ = ['items']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = []
	
	def __init__(self):
		 # Initialize exported attributes:
		self.items = list()
	
	def addEvent(self, Event):
		items = self.items
		items.append(Event)
	
	def deleteEvent(self, index):
		items = self.items
		items.pop(index)
		
	def getEventNumber(self, Event):
		items = self.items
		return items.index (Event)

class QMenuViewSignature: #This class is used to store a unique identifier string for a view. A view is an area of screen estate for which a menu set can be defined (e.g. main 3D viewports, or shader tree window)
 # Declare list of exported functions:
	_public_methods_ = ['insertMenuSet','removeMenuSet']
	 # Declare list of exported attributes
	_public_attrs_ = ['UID','type','signature','name','menuSets']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = ['type']
	
	def __init__(self):
		 # Initialize exported attributes:
		self.UID = XSIFactory.CreateGuid()
		self.type = "QMenuViewSignature"
		self.signature = str()
		self.name = str()
		self.menuSets = list()
	
	def insertMenuSet (self, index, menuSet):
		menuSets = self.menuSets
		menuSets.insert(index,menuSet)
	
	def removeMenuSet (self, index):
		menuSets = self.menuSets
		menuSets.pop(index)
			
class QMenuViewSignatures: #Container class for existing ViewSignatures
 # Declare list of exported functions:
	_public_methods_ = ['addSignature', 'deleteSignature']
	 # Declare list of exported attributes
	_public_attrs_ = ['items']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = []
	
	def __init__(self):
		 # Initialize exported attributes:
		self.items = list()

	def addSignature (self, signature):
		items = self.items
		signatureNames = list()
		unwrappedSignature = win32com.server.util.unwrap(signature)
		for item in items:
			unwrappedItem = win32com.server.util.unwrap(item)
			signatureNames.append (unwrappedItem.name)
		if not (unwrappedSignature.name in signatureNames):
			items.append (signature)
			return True
		else:
			Print("Could not add " + str(unwrappedSignature.name) + " to global QMenu View Signatures because a signature with that name already exists!", c.siError)
			return False
	
	def deleteSignature (self, signature):
		items = self.items
		if len(items) > 0:
			items.remove (signature)	

#A simple class that only stores whether the QMenu Configurator has been opened or not, in which case the
#"changed" attribute is set to True. This causes a user query to pop up when Softimage exits asking 
#if the configuration changes should be saved.
class QMenuConfigStatus:
 # Declare list of exported functions:
	_public_methods_ = []
	 # Declare list of exported attributes
	_public_attrs_ = ['changed']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = []
	
	def __init__(self):
		 # Initialize exported attributes:
		self.changed = False
		
#A placeholder class that is used as a standin for missing commands that are used in menus.
#The command might be only temporarily missing because the plugin is currently,uninstalled or the workgroup
#temporarily unavailable. Yet, the command would be lost from the configuration when loaded and saved again while (a) command(s) is/are missing. 
#To prevent this, the MissingCommand class object is used as a standin for every command
#that cannot be found when the QMenu configuration file is loaded.
class QMenuMissingCommand:
 # Declare list of exported functions:
	_public_methods_ = []
	 # Declare list of exported attributes
	_public_attrs_ = ['type','name','UID']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = []
	
	def __init__(self):
		 # Initialize exported attributes:
		self.type = "MissingCommand"
		self.name = ""
		self.UID = ""

#It is potentially unsafe to reference Softimage command objects directly, we use a standin class instead that stores name and UID of the
#respective command.	
class QMenuCommandPlaceholder:
 # Declare list of exported functions:
	_public_methods_ = []
	 # Declare list of exported attributes
	_public_attrs_ = ['type','name','UID']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = []
	
	def __init__(self):
		 # Initialize exported attributes:
		self.type = "CommandPlaceholder"
		self.name = ""
		self.UID = ""

#QMenuSceneSelectionDetails is a class that's serves as a global data container for all kinds of selection-specific date.
#It is fed by a Selection Change Event.
#The aquired data is passed in to Menu Contexts so these contexts don't need to harvest the data repeatedly -> Speed improvement.
class QMenuSceneSelectionDetails:
 # Declare list of exported functions:
	_public_methods_ = ['storeSelection','recordTypes','recordClassNames','recordComponentClassNames','recordComponentParents','recordComponentParentTypes','recordComponentParentClassNames']
	 # Declare list of exported attributes
	_public_attrs_ = ['type','selection','Types','ClassNames','ComponentClassNames','ComponentParents','ComponentParentTypes','ComponentParentClassNames' ]
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = []
	
	def __init__(self):
		 # Initialize exported attributes:
		self.type = "SceneSelectionDetails"
		self.selection = list()
		self.Types = list()
		self.ClassNames = list()
		self.ComponentClassNames = list()
		self.ComponentParents = list()
		self.ComponentParentTypes = list()
		self.ComponentParentClassNames = list()
	
	def storeSelection (self, sel):
		self.selection = list()
		#for obj in App.Selection:
			#self.selection.append(obj)
	
	def recordTypes (self, TypeList):
		self.Types = list()
		for Type in TypeList:
			self.Types.append(Type)
	
	def recordClassNames (self,ClassNameList):
		self.ClassNames = list()
		for ClassName in ClassNameList:
			self.ClassNames.append(ClassName)

	def recordComponentClassNames (self,ComponentClassNameList):
		self.ComponentClassNames = list()
		for ComponentClassName in ComponentClassNameList:
			self.ComponentClassNames.append(ComponentClassName)
	
	def recordComponentParents (self, ComponentParentList):
		self.ComponentParents = list()
		for ComponentParent in ComponentParentList:
			self.ComponentParents.append (ComponentParent)
	
	def recordComponentParentTypes (self, ComponentParentTypeList):
		self.ComponentParentTypes = list()
		for ComponentParentType in ComponentParentTypeList:
			self.ComponentParentTypes.append (ComponentParentType)
			
	def recordComponentParentClassNames (self, ComponentParentClassNameList):
		self.ComponentParentClassNames = list()
		for ComponentParentClassName in ComponentParentClassNameList:
			self.ComponentParentClassNames.append (ComponentParentClassName)



#=========================================================================================================================				
#============================================== Plugin Initialisation ====================================================
#=========================================================================================================================	

def XSILoadPlugin( in_reg ):
	in_reg.Author = "Stefan Kubicek"
	in_reg.Name = "QMenuConfigurator"
	in_reg.Email = "stefan@tidbit-images.com"
	in_reg.URL = "mailto:stefan@tidbit-images.com"
	in_reg.Major = 0
	in_reg.Minor = 9

	#Register the QMenu configurator custom property
	in_reg.RegisterProperty( "QMenuConfigurator" )
	
	#Register Custom QMenu Commands
	in_reg.RegisterCommand( "QMenuCreateObject" , "QMenuCreateObject" )
	in_reg.RegisterCommand( "QMenuExecuteMenuItem" , "QMenuExecuteMenuItem" )
	in_reg.RegisterCommand( "QMenuGetMenuItemByName" , "QMenuGetMenuItemByName" )
	in_reg.RegisterCommand( "QMenuCreateConfiguratorCustomProperty", "QMenuCreateConfiguratorCustomProperty" )
	
	in_reg.RegisterCommand( "QMenuDisplayMenuSet_0", "QMenuDisplayMenuSet_0" )
	in_reg.RegisterCommand( "QMenuDisplayMenuSet_1", "QMenuDisplayMenuSet_1" )
	in_reg.RegisterCommand( "QMenuDisplayMenuSet_2", "QMenuDisplayMenuSet_2" )
	#in_reg.RegisterCommand( "QMenuDisplayMenuSet_3", "QMenuDisplayMenuSet_3" )
	in_reg.RegisterCommand( "QMenuRepeatLastCommand", "QMenuRepeatLastCommand" )

	#Register Menus
	in_reg.RegisterMenu( c.siMenuTbGetPropertyID , "QMenuConfigurator" , true , true)
	
	#Register events
	in_reg.RegisterEvent( "QMenuGetSelectionDetails", c.siOnSelectionChange)
	in_reg.RegisterEvent( "QMenuInitialize", c.siOnStartup )
	in_reg.RegisterEvent( "QMenuDestroy", c.siOnTerminate)
	in_reg.RegisterEvent( "QMenuCheckDisplayEvents" , c.siOnKeyDown )
	#in_reg.RegisterEvent( "QMenuPrintValueChanged" , c.siOnValueChange)
	in_reg.RegisterTimerEvent( "QMenuExecution", 0, 1 )
		

	return True

def XSIUnloadPlugin( in_reg ):
	strPluginName = in_reg.Name
	Print (str(strPluginName) + str(" has been unloaded."),c.siVerbose)
	return true


	
#=========================================================================================================================		
#====================================== QMenu Configurator UI Callback FUnctions  ========================================
#=========================================================================================================================	
def QMenuConfigurator_OnInit( ):
	Print ("QMenu: QMenuConfigurator_OnInit called",c.siVerbose)
	QMenuInitializeGlobals(False)
	globalQMenuConfigStatus = GetGlobalObject("globalQMenuConfigStatus")
	globalQMenuConfigStatus.changed = True #When opening the PPG we assume that changes are made. This is a somewhat bold assumption but checking every value for changes is too laborious 
	
	RefreshQMenuConfigurator()
	#Print ("Currently Inspected PPg's are: " + str(PPG.Inspected))
	PPG.Refresh()

def QMenuConfigurator_OnClosed():
	Print ("QMenuConfigurator_OnClosed called",c.siVerbose)
	App.Preferences.SetPreferenceValue("QMenu.DisplayEventKeys_Record", False)
	App.Preferences.SetPreferenceValue("QMenu.RecordViewSignature", False)
	
	#To keep the Softimage preference file tidy we don't want to stuff it full with potentially lengthy code nobody needs there anyway, so we empty
	#the text widget fields when the PPG closes. The only thing that could happen is that Softimage crashes while the PPG is still open, in which case the
	#code might still end up in the preference file (which might not happen when XSI crashes anyway because then even the preference file is not written). 
	PPG.MenuItem_Code.Value = ""
	PPG.MenuDisplayContext_Code = ""
	#Application.Preferences.SetPreferenceValue("QMenu.MenuItem_Code","")
	#Application.Preferences.SetPreferenceValue("QMenu.MenuDisplayCOntext_Code","")
	Application.Preferences.SaveChanges()
	
def QMenuConfigurator_Define( in_ctxt ):
	# Warning! !!Don't set capability flags here (e.g.siReadOnly), it causes errros when copying the property from one object to another (e.g. <parameter>.SetCapabilityFlag (c.siReadOnly,true)   )
	Print ("QMenuConfigurator_Define called", c.siVerbose)
	DefaultConfigFile = ""

	oCustomProperty = in_ctxt.Source
	
	oCustomProperty.AddParameter2("QMenuEnabled",c.siBool,True,null,null,null,null,c.siClassifUnknown,c.siPersistable)	
	oCustomProperty.AddParameter2("FirstStartup",c.siBool,True,null,null,null,null,c.siClassifUnknown,c.siPersistable)	
	oCustomProperty.AddParameter2("QMenuConfigurationFile",c.siString,DefaultConfigFile,null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("CommandCategory",c.siString,"_ALL_",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("CommandFilter",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("CommandList",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("ShowHotkeyableOnly",c.siBool,True,null,null,null,null,c.siClassifUnknown,c.siPersistable)	
	oCustomProperty.AddParameter2("ShowScriptingNameInBrackets",c.siBool,False,null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("ShowItemType",c.siInt4,0,null,null,null,null,c.siClassifUnknown,c.siPersistable)
	
	oCustomProperty.AddParameter2("View",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("MenuContexts",c.siInt4,0,null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("ContextConfigurator",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("AutoSelectMenu",c.siBool,True,null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("MenuSets",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("MenuSetName",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("MenuSetChooser",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("ViewMenuSets",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	
	oCustomProperty.AddParameter2("MenuSelector",c.siInt4,0,null,null,null,null,c.siClassifUnknown,c.siPersistable)
	#oCustomProperty.AddParameter2("QMenu_MenuA",c.siBool,True,null,null,null,null,c.siClassifUnknown,c.siPersistable)
	#oCustomProperty.AddParameter2("QMenu_MenuB",c.siBool,0,null,null,null,null,c.siClassifUnknown,c.siPersistable)
	#oCustomProperty.AddParameter2("QMenu_MenuC",c.siBool,0,null,null,null,null,c.siClassifUnknown,c.siPersistable)
	#oCustomProperty.AddParameter2("QMenu_MenuD",c.siBool,0,null,null,null,null,c.siClassifUnknown,c.siPersistable)
	
	oCustomProperty.AddParameter2("MenuFilter",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("Menus",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("MenuChooser",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("ContextChooser",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	#oCustomProperty.AddParameter2("MenuName",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("MenuItems",c.siInt4,0,null,null,null,null,c.siClassifUnknown,c.siPersistable)
	
	oCustomProperty.AddParameter2("MenuItem_Category",c.siString,"_ALL_",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("MenuItem_Name",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("MenuItemList",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("MenuItem_Switch",c.siBool,False,null,null,null,null,c.siClassifUnknown,c.siPersistable)
	
	oCustomProperty.AddParameter2("MenuItem_Code",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("MenuItem_ScriptLanguage",c.siString,"Python",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("MenuItem_CategoryChooser",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("NewMenuItem_Category",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("MenuItem_IsActive",c.siBool,False,null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("CodeEditorHeight",c.siInt4,200,null,null,null,null,c.siClassifUnknown,c.siPersistable)

	oCustomProperty.AddParameter2("MenuDisplayContexts",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("MenuDisplayContext_Code",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("MenuDisplayContext_Name",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("MenuDisplayContext_ScriptLanguage",c.siString,"Python",null,null,null,null,c.siClassifUnknown,c.siPersistable)

	#Indepth configuration attributes
	oCustomProperty.AddParameter2("RecordViewSignature",c.siBool,False,null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("ViewSignatures",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("ViewSignatureName",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("ViewSignature",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	
	oCustomProperty.AddParameter2("DisplayEvent",c.siInt4,0,null,null,null,null,c.siClassifUnknown,c.siPersistable)
	#oCustomProperty.AddParameter2("DisplayEventName",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("DisplayEventKey",c.siInt4,0,null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("DisplayEventKeyMask",c.siInt4,0,null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("DisplayEventKeys_Record",c.siBool,False,null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("ShowQMenu_MenuString",c.siBool,False,null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("ShowQMenuTimes",c.siBool,False,null,null,null,null,c.siClassifUnknown,c.siPersistable)
	
def QMenuConfigurator_DefineLayout( in_ctxt ):
	oLayout = in_ctxt.Source	
	oLayout.Clear()
	oLayout.SetAttribute( c.siUIHelpFile, "http://www.tidbit-images.com/tools/xsi/QMenu")
	
	CustomGFXFilesPath = GetCustomGFXFilesPath()
	
	oLayout.AddTab("Main Configuration")
	oLayout.AddGroup()
	oLayout.AddItem("QMenuEnabled", "Enable QMenu")
	oLayout.AddRow()
	oQMenuConfigFile = oLayout.AddItem("QMenuConfigurationFile", "QMenu Config File", c.siControlFilePath)
	oQMenuConfigFile.SetAttribute (c.siUIFileFilter, "QMenu Configuration Files (*.xml)|*.xml|All Files (*.*)|*.*||")
	oQMenuConfigFile.SetAttribute (c.siUIInitialDir, "C:\\")
	oQMenuConfigFile.SetAttribute (c.siUIOpenFile, True)
	oQMenuConfigFile.SetAttribute (c.siUIFileMustExist, False)
	oLayout.AddButton("LoadConfig","Load")
	oLayout.AddButton("SaveConfig","Save")
	oLayout.EndRow()
	oLayout.EndGroup()
	
	oSC = oLayout.AddGroup("Configure Menu Sets") #Second column for  menu sets editing start#=======================================
	oViews = oLayout.AddEnumControl ("View", None, "Configure QMenu for",c.siControlCombo)
	oViews.SetAttribute(c.siUILabelMinPixels,100 )
	
	oLayout.AddRow()
	oGr = oLayout.AddGroup("Select Menu Set and Quadrant")
	oGr.SetAttribute(c.siUIWidthPercentage, 15)
	oMSChooser = oLayout.AddEnumControl ("MenuSetChooser", None, "Menu Set", c.siControlCombo)
	oMSChooser.SetAttribute(c.siUINoLabel, True)

	aUIitems = (CustomGFXFilesPath + "QMenu_MenuA.bmp", 0, CustomGFXFilesPath + "QMenu_MenuB.bmp", 1, CustomGFXFilesPath + "QMenu_MenuD.bmp", 3, CustomGFXFilesPath + "QMenu_MenuC.bmp",2)
	oLayout.AddSpacer()
	oLayout.AddStaticText("Select a Quad")
	oMenuSelector = oLayout.AddEnumControl ("MenuSelector", aUIitems, "Quadrant", c.siControlIconList)
	oMenuSelector.SetAttribute(c.siUINoLabel, True)
	oMenuSelector.SetAttribute(c.siUIColumnCnt,2)
	oMenuSelector.SetAttribute(c.siUILineCnt,2)
	oMenuSelector.SetAttribute(c.siUISelectionColor,0x000ff)

	oLayout.EndGroup() #End of Menu Set Configuration Group

	oLayout.AddGroup("Assign QMenu Menus to Contexts")
	oLayout.AddSpacer()
	oMenuContexts = oLayout.AddEnumControl ("MenuContexts", None, "",c.siControlListBox)
	oMenuContexts.SetAttribute(c.siUINoLabel, True)
	oMenuContexts.SetAttribute(c.siUICY, 135)
	#oLayout.AddRow()
	oLayout.AddButton ("AssignMenu", "Assign Menu to Context")
	oLayout.AddButton ("RemoveMenu", "Remove Menu from Context")
	#oLayout.EndRow()
	oLayout.EndGroup()

	oLayout.AddGroup("Menu Items in QMenu Menu")
	#oLayout.AddRow()
	oAuto = oLayout.AddItem ("AutoSelectMenu", "Auto-select menu of selected context for editing")
	oItems = oLayout.AddEnumControl ("MenuChooser", None, "Menu to edit",c.siControlCombo)
	#oItems.SetAttribute(c.siUIWidthPercentage, 70)
	#oItems.SetAttribute(c.siUICX, 200)
	#oAuto.SetAttribute(c.siUILabelPercentage, 10)
	#oLayout.EndRow()
	
	oLayout.AddRow()
	oMenuItems = oLayout.AddEnumControl ("MenuItems", None, "Menu Items",c.siControlListBox)
	oMenuItems.SetAttribute(c.siUINoLabel, True)
	oMenuItems.SetAttribute(c.siUICY, 113)
	oMenuItems.SetAttribute(c.siUIWidthPercentage, 20)
	oLayout.EndRow()
	oLayout.AddRow()

	oInsertCommandButton = oLayout.AddButton ("ItemInsert", "Insert Item")
	oLayout.AddButton ("ItemUp", "Move Up")
	oLayout.AddButton ("ItemDown", "Move Down")
	oLayout.AddButton ("RemoveMenuItem", "Remove")
	
	oLayout.AddButton ("FindItem", "Find sel. Item")
	oLayout.AddButton("InsertSeparator","Insert Separator")
	oLayout.EndRow()
	oLayout.EndGroup()
	oLayout.EndRow()
	
	oLayout.EndGroup() #Second column for  menu sets editing End #========================================================
	
	#oFG = oLayout.AddGroup("") #First column for  existing assets #=======================================================
	#oFG.SetAttribute(c.siUIShowFrame, False)
	oLayout.AddStaticText("Choose a command, menu, or script item below to add to the selected menu above...")
	oLayout.AddRow()
	oLayout.AddGroup("Existing Softimage Commands")
	#oLayout.AddSpacer()
	oLayout.AddItem ("ShowHotkeyableOnly", "Show Commands supporting key assignment only")
	#oLayout.AddSpacer()
	oLayout.AddItem ("ShowScriptingNameInBrackets", "Show ScriptingName in Brackets")
	oLayout.AddRow()
	oLayout.AddEnumControl ("CommandCategory", None, "Category",c.siControlCombo)
	oLayout.AddItem ("CommandFilter", "Name contains...", c.siControlString)
	oLayout.EndRow()
	oCommands = oLayout.AddEnumControl ("CommandList", None, "Commands",c.siControlListBox)
	oCommands.SetAttribute(c.siUINoLabel, True)
	oLayout.AddRow()
	oLayout.AddButton("InspectCommand", "Inspect Cmd")
	oLayout.AddButton("ExecuteCommand", "Execute Cmd")
	#oLayout.AddButton("ConvertCommandToMenuItem", "Create Script Item from Cmd")
	oLayout.EndRow()
	oLayout.EndGroup()

	oLayout.AddGroup("Existing QMenu Menus")
	oLayout.AddSpacer()
	oLayout.AddSpacer()
	#oLayout.AddSpacer()
	oLayout.AddItem ("MenuFilter", "Name contains...", c.siControlString)
	oMenus = oLayout.AddEnumControl ("Menus", None, "Menus",c.siControlListBox)
	oMenus.SetAttribute(c.siUINoLabel, True)
	#oLayout.AddItem("MenuName", "Name", c.siControlString)
	oLayout.AddRow()
	oLayout.AddButton ("CreateNewMenu", "Create new Menu")
	oLayout.AddButton ("DeleteMenu", "Delete selected Menu")
	oLayout.EndRow() #End Button Row
	oLayout.EndGroup() #End Group Existing Menus
	oLayout.EndRow()
	
	oLayout.AddRow()
	oLayout.AddGroup("Existing QMenu Switches and Script Items")
	
	oLayout.AddRow()
	oLayout.AddEnumControl ("MenuItem_Category", None, "Category",c.siControlCombo)
	#oLayout.AddItem ("ShowItemType", "Show Switch Items Only")
	oLayout.AddEnumControl ("ShowItemType", ("Scripts & Switches",0,"Switches only",1,"Scripts only",2),"Show Items of type")
	oLayout.EndRow()
	
	oMenuItems = oLayout.AddEnumControl ("MenuItemList", None, "Menu Item List",c.siControlListBox)
	oMenuItems.SetAttribute(c.siUINoLabel, True)
	oLayout.AddRow()
	oLayout.AddButton("CreateNewScriptItem","Create new Script Item")
	oLayout.AddButton("CreateNewSwitchItem","Create new Switch Item")
	oLayout.AddButton("DeleteScriptItem","Delete selected Script Item")
	oLayout.EndRow()
	oLayout.EndGroup()
	
	oLayout.AddGroup("Edit Menu or Script Item properties")
	oLayout.AddItem("MenuItem_Name", "Item Name", c.siControlString)
	oLayout.AddItem("MenuItem_CategoryChooser", "Assigne to Category", c.siControlCombo)
	oLayout.AddItem("NewMenuItem_Category", "Define(new) Category", c.siControlString)
	oLayout.AddItem("MenuItem_Switch", "Script Item is a switch")
	oLayout.AddItem("MenuItem_IsActive", "Allow menu code execution")
	oLayout.EndGroup()
	oLayout.EndRow()

	oLayout.AddGroup("Edit selected QMenu Menu or Script Item")
	oLayout.AddRow()
	oLanguage = oLayout.AddEnumControl("MenuItem_ScriptLanguage", ("Python","Python","JScript","JScript","VBScript","VBScript"), "      Scripting Language", c.siControlCombo)
	oLayout.AddSpacer(10,1)
	oLayout.AddButton("ExecuteCode", "Execute")
	oLayout.AddSpacer(10,1)
	oEditorHeight = oLayout.AddItem ("CodeEditorHeight", "Code Editor Height")
	#oEditorHeight.SetAttribute(c.siUICX, 150)
	#oEditorHeight.SetAttribute(c.siUIWidthPercentage, 10)
	oLayout.EndRow()
	
	oCodeEditor = oLayout.AddItem("MenuItem_Code", "Code", c.siControlTextEditor)
	#oCodeEditor.SetAttribute(c.siUIHeight, oLayout.Item("CodeEditorHeight").Value)
	intHeight = 200
	try:
		Height = Application.Preferences.GetPreferenceValue("QMenu.CodeEditorHeight")
	except:
		pass
	oCodeEditor.SetAttribute(c.siUIHeight, intHeight)
	oCodeEditor.SetAttribute(c.siUIToolbar, True )
	oCodeEditor.SetAttribute(c.siUILineNumbering, True )
	oCodeEditor.SetAttribute(c.siUIFolding, True ) #Broken since XSI7.0
	oCodeEditor.SetAttribute(c.siUIKeywordFile, GetDefaultConfigFilePath ("Python.keywords"))
	oCodeEditor.SetAttribute(c.siUICommentColor, 0xFF00FF)
	oCodeEditor.SetAttribute(c.siUICapability, c.siCanLoad )    #Broken since XSI7.0

	#oCodeEditor.SetAttribute(c.siUIKeywords, "def pass")
	oLayout.EndGroup()
	
	#================================== Display Events Tab =======================================================================================
	
	oLayout.AddTab("Display Events")
	oLayout.AddGroup()
	oLayout.AddItem("QMenuEnabled", "Enable QMenu")
	oLayout.AddRow()
	oQMenuConfigFile2 = oLayout.AddItem("QMenuConfigurationFile", "QMenu Config File", c.siControlFilePath)
	oQMenuConfigFile2.SetAttribute (c.siUIFileFilter, "QMenu Configuration Files (*.xml)|*.xml|All Files (*.*)|*.*||")
	oQMenuConfigFile2.SetAttribute (c.siUIInitialDir, "C:\\")
	oQMenuConfigFile2.SetAttribute (c.siUIOpenFile, True)
	oQMenuConfigFile2.SetAttribute (c.siUIFileMustExist, False)
	oLayout.AddButton("LoadConfig","Load")
	oLayout.AddButton("SaveConfig","Save")
	oLayout.EndRow()
	oLayout.EndGroup()
	
	
	oLayout.AddGroup("QMenu Display Events")
	oLayout.AddStaticText("\nSet the 'Record' check mark below, then press your desired key or key combination ( key + Shift, Alt or Ctrl) for the selected menu display event.\n\nNote: The record check mark will be automatically unchecked when a valid key or key combination has been pressed, or when leaving this tab or closing the configurator.",0,100)
	oLayout.AddRow()
	
	oLayout.AddGroup("",False,0)
	oEvents = oLayout.AddEnumControl ("DisplayEvent", None, "DisplayEvents", c.siControlListBox)
	oEvents.SetAttribute(c.siUINoLabel, True)
	oLayout.EndGroup()
	
	oLayout.AddGroup("",False,0)
	oLayout.AddItem("DisplayEventKeys_Record","Record")
	oKey = oLayout.AddItem("DisplayEventKey", "Key", c.siControlString)
	oKeyMask = oLayout.AddItem("DisplayEventKeyMask", "KeyMask", c.siControlString)
	oLayout.AddButton("AddDisplayEvent","Add Display Event")
	oLayout.AddButton("DeleteDisplayEvent","Delete selected Display Event")
	oLayout.EndGroup()
	oLayout.EndRow()	
	oLayout.EndGroup()
	
	oLayout.AddGroup("Description")
	oLayout.AddStaticText("There are two ways of invoking menu sets:\n\n1. Using 'Display Events'. This is the recommended way for all versions of Softimage from 7.0 to 2011.\n\n2. Alternatively you can use commands that you can bind to hotkeys of your choice.\nThe benefit is that you don't need to worry about potentially duplicate key assignments.\nLook in the 'Custom Script Commands' category for commands called 'QMenuDisplayMenuSet_0 - 3').\n\nNote: You can also use a combination of commands and display events if you want.\n",0,230 )
	oLayout.EndGroup()

#========================= Advanced Configuration Tab =============================================================================	

	oLayout.AddTab("Advanced Configuration")
	
	oLayout.AddGroup()
	oLayout.AddItem("QMenuEnabled", "Enable QMenu")
	oLayout.AddRow()
	oQMenuConfigFile3 = oLayout.AddItem("QMenuConfigurationFile", "QMenu Config File", c.siControlFilePath)
	oQMenuConfigFile3.SetAttribute (c.siUIFileFilter, "QMenu Configuration Files (*.xml)|*.xml|All Files (*.*)|*.*||")
	oQMenuConfigFile3.SetAttribute (c.siUIInitialDir, "C:\\")
	oQMenuConfigFile3.SetAttribute (c.siUIOpenFile, True)
	oQMenuConfigFile3.SetAttribute (c.siUIFileMustExist, False)
	oLayout.AddButton("LoadConfig","Load")
	oLayout.AddButton("SaveConfig","Save")
	oLayout.EndRow()
	oLayout.EndGroup()
	
	oLayout.AddGroup("Assign QMenu Menu Sets to Views")
	oLayout.AddRow()
	oLayout.AddGroup("Existing Views")
	oViews = oLayout.AddEnumControl ("ViewSignatures", None, "Views", c.siControlListBox)
	oViews.SetAttribute(c.siUINoLabel, True)
	oLayout.AddRow()
	oLayout.AddButton("AddQMenuViewSignature", "Create New View")
	oLayout.AddButton("DelQMenuViewSignature", "Delete Selected View")
	oLayout.EndRow()
	oLayout.AddItem("ViewSignatureName","Name")
	#oLayout.AddRow()
	oRecCheck = oLayout.AddItem("RecordViewSignature","Record a Signature for the selected View")
	oRecCheck.SetAttribute(c.siUIWidthPercentage,1)
	oLayout.AddItem("ViewSignature","Signature")
	
	#oLayout.AddButton("PickQMenuViewSignature", "Pick")
	#oLayout.EndRow()
	oLayout.EndGroup()
	
	oLayout.AddGroup("Assigned QMenu Menu Set(s) to selected View")
	oSets = oLayout.AddEnumControl ("ViewMenuSets", None, "Menu Sets",c.siControlListBox)
	oSets.SetAttribute(c.siUINoLabel, True)
	oLayout.AddRow()
	oLayout.AddButton ("InsertSetInView", "Insert Menu Set")
	oLayout.AddButton ("RemoveSetInView", "Remove Menu Set")
	oLayout.AddButton ("MoveSetUpInView", "Move Up")
	oLayout.AddButton ("MoveSetDownInView", "Move Down")
	oLayout.EndRow()
	oLayout.EndGroup()
	oLayout.EndRow()
	oLayout.EndGroup()
	
	oLayout.AddGroup("Assign QMenu Menu Contexts to Menu Sets")
	oLayout.AddRow() #New Row of Groups
	
	oLayout.AddGroup("Existing QMenu Menu Sets")
	oMenuSets = oLayout.AddEnumControl ("MenuSets", None, "", c.siControlListBox)
	oMenuSets.SetAttribute(c.siUINoLabel, True)
	oMenuSets.SetAttribute(c.siUICY, 152)
	oLayout.AddItem("MenuSetName","Name")
	oLayout.AddRow()
	oLayout.AddButton("CreateMenuSet", "Create new Menu Set")
	oLayout.AddButton("DeleteMenuSet", "Delete Selected Menu Set")
	oLayout.EndRow()
	oLayout.EndGroup() #Edit QMenu_MenuSets
	
	oLayout.AddGroup ("Assigned QMenu Menu Contexts to selected Menu Set")
	oLayout.AddRow()
	
	oQG = oLayout.AddGroup("", False, 25)
	#oQG.SetAttribute(c.siUIWidthPercentage, 25)
	oLayout.AddStaticText("Select a Quad")
	oMenuSelector2 = oLayout.AddEnumControl ("MenuSelector", aUIitems, "Select a Context", c.siControlIconList)
	oMenuSelector2.SetAttribute(c.siUINoLabel, True)
	oMenuSelector2.SetAttribute(c.siUIColumnCnt,2)
	oMenuSelector2.SetAttribute(c.siUILineCnt,2)
	oMenuSelector2.SetAttribute(c.siUISelectionColor,0x000ff)
	oLayout.EndGroup()
	
	oContexts = oLayout.AddEnumControl("ContextConfigurator",None,"",c.siControlListBox)
	oContexts.SetAttribute(c.siUINoLabel,True)
	oContexts.SetAttribute(c.siUICY, 152)
	oLayout.EndRow()
	
	oLayout.AddRow()
	oLayout.AddButton ("InsertMenuContext", "Insert Context")
	oLayout.AddButton ("RemoveMenuContext", "Remove Context")
	oLayout.AddButton ("CtxUp", "Move Up")
	oLayout.AddButton ("CtxDown", "Move Down")
	oLayout.EndRow()
	oLayout.EndGroup() #Menu Contexts
	
	oLayout.EndRow() #New Row of Groups
	oLayout.EndGroup() #Manage QMenu MenuSets
	
	oLayout.AddGroup("Existing QMenu Menu Contexts")
	oDisplayContexts = oLayout.AddEnumControl ("MenuDisplayContexts", None, "Menu Contexts", c.siControlListBox)
	oDisplayContexts.SetAttribute(c.siUINoLabel, True)
	oLayout.AddRow()
	oLayout.AddButton("CreateNewDisplayContext","Create New Context")
	oLayout.AddButton("DeleteDisplayContext","Delete Selected Context")
	oLayout.EndRow()
	
	oLayout.AddRow()
	oLayout.AddItem("MenuDisplayContext_Name", "Name", c.siControlString)
	oLayout.AddEnumControl("MenuDisplayContext_ScriptLanguage", ("Python","Python","JScript","JScript","VBScript","VBScript"), "Language", c.siControlCombo)
	#oLayout.AddEnumControl("MenuDisplayContext_ScriptLanguage", ("Python","Python"), "Language", c.siControlCombo) #Only Python for now due to execution speed penalty of ExecuteScriptCommand command
	oLayout.AddButton("ExecuteDisplayContextCode", "Execute")
	oLayout.EndRow()
	
	oCodeEditor2 = oLayout.AddItem("MenuDisplayContext_Code", "Code", c.siControlTextEditor)
	#oCodeEditor2.SetAttribute(c.siUIValueOnly, True)
	oCodeEditor2.SetAttribute(c.siUIToolbar, True )
	oCodeEditor2.SetAttribute(c.siUILineNumbering, True )
	oCodeEditor2.SetAttribute(c.siUIFolding, True )
	oCodeEditor2.SetAttribute(c.siUIKeywordFile, GetDefaultConfigFilePath ("Python.keywords"))
	oCodeEditor2.SetAttribute(c.siUICommentColor, 0xFF00FF)
	oCodeEditor2.SetAttribute(c.siUICapability, c.siCanLoad )    #Does not work?
	oLayout.EndGroup()
	
	#================================ Debugging Options Tab ============================================================================================
	oLayout.AddTab("Debug Options")
	oLayout.AddButton ("Refresh", "Reset/Delete all QMenu configuration data")
	oLayout.AddGroup("Debug Options")
	#oLayout.AddItem("FirstStartup", "First Startup")
	oLayout.AddItem("ShowQMenu_MenuString","Print QMenu Menu String on menu invokation")
	oLayout.AddItem("ShowQMenuTimes","Print QMenu preparation times")
	oLayout.EndGroup()

def QMenuConfigurator_CodeEditorHeight_OnChanged():
	oCodeEditor = PPG.PPGLayout.Item("MenuItem_Code")
	intHeight = PPG.CodeEditorHeight.Value
	oCodeEditor.SetAttribute(c.siUIHeight, intHeight)
	PPG.Refresh()
	
def QMenuConfigurator_ShowQMenu_MenuString_OnChanged():
	val = PPG.ShowQMenu_MenuString.Value
	Application.Preferences.SetPreferenceValue("QMenu.ShowQMenu_MenuString",val)
	print("Setting preference QMenu.ShowQMenu_MenuString to: " + str(val))
	
def QMenuConfigurator_ShowQMenuTimes_OnChanged():
	val = PPG.ShowQMenuTimes.Value
	Application.Preferences.SetPreferenceValue("QMenu.ShowQMenuTimes",val)
	print("Setting preference QMenu.ShowQMenuTimes to: " + str(val))
	
def QMenuConfigurator_CommandList_OnChanged():
	Print("QMenuConfigurator_CommandList_OnChanged called", c.siVerbose)
	PPG.Menus.Value = ""
	PPG.MenuItemList.Value = ""
	RefreshMenuItemDetailsWidgets()
	RefreshMenuSetDetailsWidgets()
	PPG.Refresh()
	
def QMenuConfigurator_MenuItemList_OnChanged():
	Print ("QMenuConfigurator_MenuItemList_OnChanged called",c.siVerbose)
	#When a MenuItem is selected no menu or command can be selected
	PPG.Menus.Value = ""
	PPG.CommandList.Value = ""
	
	RefreshMenuSetDetailsWidgets()
	RefreshMenuItemDetailsWidgets()
	PPG.Refresh()

def QMenuConfigurator_Menus_OnChanged():
	Print ("QMenuConfigurator_Menus_OnChanged called",c.siVerbose)	
	PPG.MenuItemList.Value = ""
	PPG.CommandList.Value = ""
	RefreshMenuItemDetailsWidgets()
	RefreshMenuSetDetailsWidgets()
	PPG.Refresh()
		
def QMenuConfigurator_MoveSetUpInView_OnClicked():
	Print("QMenuConfigurator_MoveSetUpInView_OnClicked called", c.siVerbose)
	CurrentViewName = PPG.ViewSignatures.Value
	CurrentSetName = PPG.ViewMenuSets.Value
	oCurrentView = getQMenu_ViewSignatureByName(CurrentViewName)
	oCurrentSet = getQMenu_MenuSetByName(CurrentSetName)
	
	if oCurrentView != None and oCurrentSet != None:
		CurrentSetIndex = oCurrentView.menuSets.index(oCurrentSet)
		if CurrentSetIndex > 0:
			oCurrentView.removeMenuSet(CurrentSetIndex)
			oCurrentView.insertMenuSet(CurrentSetIndex -1,oCurrentSet)
			RefreshViewMenuSets()
			RefreshMenuSetChooser()
			PPG.Refresh()

def QMenuConfigurator_MenuItems_OnChanged():
	Print("QMenuConfigurator_MenuItems_OnChanged called", c.siVerbose)
	RefreshMenuSetDetailsWidgets()
	PPG.Refresh()
			
def QMenuConfigurator_MoveSetDownInView_OnClicked():
	Print("QMenuConfigurator_MoveSetUpInView_OnClicked", c.siVerbose)
	CurrentViewName = PPG.ViewSignatures.Value
	CurrentSetName = PPG.ViewMenuSets.Value
	oCurrentView = getQMenu_ViewSignatureByName(CurrentViewName)
	oCurrentSet = getQMenu_MenuSetByName(CurrentSetName)
	
	if oCurrentView != None and oCurrentSet != None:
		CurrentSetIndex = oCurrentView.menuSets.index(oCurrentSet)
		if CurrentSetIndex < (len(oCurrentView.menuSets)-1):
			oCurrentView.removeMenuSet(CurrentSetIndex)
			oCurrentView.insertMenuSet(CurrentSetIndex +1,oCurrentSet)
			RefreshViewMenuSets()
			PPG.Refresh()
	
def QMenuConfigurator_AutoSelectMenu_OnChanged():
	Print("QMenuConfigurator_AutoSelectMenu_Onchanged called", c.siVerbose)
	if PPG.AutoSelectMenu.Value == True:
		PPG.MenuContexts.SetCapabilityFlag (c.siReadOnly,False)
		PPG.MenuChooser.SetCapabilityFlag (c.siReadOnly,True)
		RefreshMenuChooser()
		RefreshMenuSetDetailsWidgets()
		RefreshMenuItems()
		PPG.Refresh()
	else:
		PPG.MenuContexts.SetCapabilityFlag (c.siReadOnly,True)
		PPG.MenuChooser.SetCapabilityFlag (c.siReadOnly,False)

def QMenuConfigurator_MenuChooser_OnChanged():
	Print ("QMenuConfigurator_MenuChooser_OnChanged called",c.siVerbose)
	RefreshMenuItems()
	PPG.refresh()
	
def QMenuConfigurator_SaveConfig_OnClicked ():
	Print("QMenuConfigurator_SaveConfig_OnClicked called",c.siVerbose)
	fileName = PPG.QMenuConfigurationFile.Value
	result = QMenuSaveConfiguration(fileName)
	if result == False:
		Print("Failed saving QMenu Configuration to '" + fileName + "'! Please check write permissions and try again.",c.siError)
	else:
		Print("Successfully saved QMenu Configuration to '" + fileName + "' ")
	
def QMenuConfigurator_LoadConfig_OnClicked():
	Print("QMenuConfigurator_LoadConfig_OnClicked called",c.siVerbose)
	fileName = PPG.QMenuConfigurationFile.Value
		
	if str(fileName) != "":
		result = False
		result = QMenuLoadConfiguration(fileName)
		if result == True:
			RefreshQMenuConfigurator()
			PPG.Refresh()

def QMenuConfigurator_QMenuConfigurationFile_OnChanged():
	Print("QMenuConfigurator_QMenuConfigurationFile_OnChanged called",c.siVerbose)
	#When config filename is changed we assume that the user knows what he's doing and do not load default config on next startup
	App.Preferences.SetPreferenceValue("QMenu.FirstStartup",False)
	
def QMenuConfigurator_CommandCategory_OnChanged():
	Print("CommandCategory_OnChanged called", c.siVerbose)
	RefreshCommandList ()
	PPG.Refresh()

def QMenuConfigurator_CommandFilter_OnChanged():
	Print("CommandFilter_OnChanged called", c.siVerbose)
	RefreshCommandList ()
	PPG.Refresh()

def QMenuConfigurator_CreateNewScriptItem_OnClicked():
	Print ("QMenuConfigurator_CreateNewScriptItem_OnClicked called",c.siVerbose)

	Language = QueryScriptLanguage()
	if Language > -1: #User did not press Cancel?
		globalQMenu_MenuItems = GetGlobalObject("globalQMenu_MenuItems")
		newMenuItem = App.QMenuCreateObject("MenuItem")
		
		#Find the Category for the new menu item
		MenuItem_Category = str()
		MenuItem_Category = PPG.MenuItem_Category.Value

		if (MenuItem_Category == "") or (MenuItem_Category == "_ALL_"):
			MenuItem_Category = "Miscellaneous"	

		
		#Find a unique name for the new menu item
		listKnownMenuItem_Names = list()
		for menuItem in globalQMenu_MenuItems.items:
			listKnownMenuItem_Names.append (menuItem.name)

		uniqueName = getUniqueName("New Script Item",listKnownMenuItem_Names)
		
		newMenuItem.name = uniqueName
		newMenuItem.UID = XSIFactory.CreateGuid()
		newMenuItem.category = MenuItem_Category
		
	
		if Language == 0: newMenuItem.code = ("def Script_Execute (self, QMenu_MenuItems, QMenu_Menus, QMenu_MenuSets): #Dont rename this function \n\t#Put your script code here\n\tpass"); newMenuItem.language = "Python"
		if Language == 1: newMenuItem.code = ("function Script_Execute (self, QMenu_MenuItems, QMenu_Menus, QMenu_MenuSets) {\n\t//Put your script code here\n\tdoNothing = true\n}"); newMenuItem.language = "JScript"
		if Language == 2: newMenuItem.code = ("Function Script_Execute (self, QMenu_MenuItems, QMenu_Menus, QMenu_MenuSets) \n\t' Put your script code here\n\tdoNothing = true\nend Function"); newMenuItem.language = "VBScript"
		
		globalQMenu_MenuItems.addMenuItem(newMenuItem)

		RefreshMenuItem_CategoryList()
		PPG.MenuItem_Category.Value = MenuItem_Category
		RefreshMenuItemList()

		PPG.MenuItemList.Value = uniqueName
		PPG.CommandList.Value = ""
		PPG.Menus.Value = ""
		RefreshMenuItemDetailsWidgets()
		PPG.Refresh()
	
def QMenuConfigurator_CreateNewSwitchItem_OnClicked():
	Print ("QMenuConfigurator_CreateNewSwitchItem_OnClicked called",c.siVerbose)
	
	LanguageNumber = QueryScriptLanguage()
	if LanguageNumber > -1:
		Languages = ("Python","JScript","VBScript")
		Language = Languages [LanguageNumber]		
		
		globalQMenu_MenuItems = GetGlobalObject("globalQMenu_MenuItems")
		newMenuItem = App.QMenuCreateObject("MenuItem")
		
		#Find the Category for the new menu item
		MenuItem_Category = str()
		MenuItem_Category = PPG.MenuItem_Category.Value
		
		if (MenuItem_Category == "") or (MenuItem_Category == "_ALL_"):
			MenuItem_Category = "Switches"	

		#Find a unique name for the new menu item
		listKnownMenuItem_Names = list()
		for menuItem in globalQMenu_MenuItems.items:
			listKnownMenuItem_Names.append (menuItem.name)

		uniqueName = getUniqueName("New Scripted Switch Item",listKnownMenuItem_Names)
		
		newMenuItem.name = uniqueName
		newMenuItem.UID = XSIFactory.CreateGuid()
		newMenuItem.category = MenuItem_Category
		newMenuItem.switch = True
		newMenuItem.language = Language

		#Set default code
		if Language == "Python": 
			newMenuItem.code = ("def Switch_Init (self, QMenu_MenuItems, QMenu_Menus, QMenu_MenuSets): #Don't rename this function\n\t#Add your code here, return value must be boolean and represent the current state of the switch (on or off)\n\treturn False\n\n")
			newMenuItem.code += ("def Switch_Execute (self, QMenu_MenuItems, QMenu_Menus, QMenu_MenuSets): #Don't rename this function\n\t#Add your code here, it gets executed when the switch item is clicked in a QMenu menu \n\tpass\n\n")
		
		if Language == "JScript": 
			newMenuItem.code = ("function Switch_Init (self, QMenu_MenuItems, QMenu_Menus, QMenu_MenuSets) //Don't rename this function\n{\n\t//Add your code here, return value must be boolean and represent the current state of the switch (on or off)\n\treturn false\n}\n\n")
			newMenuItem.code += ("function Switch_Execute (self, QMenu_MenuItems, QMenu_Menus, QMenu_MenuSets) //Don't rename this function\n{\n\t//Add your code here, it gets executed when the switch item is clicked in a QMenu menu \n}")
		
		if Language == "VBScript": 
			newMenuItem.code = ("Function Switch_Init (self, QMenu_MenuItems, QMenu_Menus, QMenu_MenuSets) ' Don't rename this function\n\t' Add your code here, return value must be boolean and represent the current state of the switch (on or off)\n\tSwitch_Init = false\nend Function\n\n")
			newMenuItem.code += ("Function Switch_Execute (self, QMenu_MenuItems, QMenu_Menus, QMenu_MenuSets) ' Don't rename this function\n\t' Add your code here, it gets executed when the switch item is clicked in a QMenu menu \n\tdoNothing = True\nend Function")
				
		globalQMenu_MenuItems.addMenuItem(newMenuItem)

		RefreshMenuItem_CategoryList()
		PPG.MenuItem_Category.Value = MenuItem_Category
		RefreshMenuItemList()

		PPG.MenuItemList.Value = uniqueName
		PPG.CommandList.Value = ""
		PPG.Menus.Value = ""
		RefreshMenuItemDetailsWidgets()
		PPG.Refresh()

def QMenuConfigurator_MenuFilter_OnChanged():
	Print ("QMenuConfigurator_CreateNewSwitchItem_OnClicked called",c.siVerbose)
	CurrentSelectedMenuName = PPG.Menus.Value
	RefreshMenus()
	ListedMenuNames = PPG.PPGlayout.Item("Menus").UIItems
	if CurrentSelectedMenuName not in ListedMenuNames:
		PPG.Menus.Value = ""
	RefreshMenuSetDetailsWidgets()
	PPG.Refresh()
		
def QMenuConfigurator_CreateNewMenu_OnClicked():
	Print ("QMenuConfigurator_CreateNewMenu_OnClicked called",c.siVerbose)
	
	LanguageNumber = QueryScriptLanguage()
	if LanguageNumber > -1:
		globalQMenu_Menus = GetGlobalObject("globalQMenu_Menus")
		listKnownQMenu_MenuNames = list()
		for menu in globalQMenu_Menus.items:
			listKnownQMenu_MenuNames.append(menu.name)
		
		UniqueMenuName = getUniqueName("NewQMenu_Menu",listKnownQMenu_MenuNames)
			
		oNewMenu = App.QMenuCreateObject("Menu")
		oNewMenu.name = UniqueMenuName
		
		Languages = ("Python", "JScript", "VBScript")
		Language = Languages[LanguageNumber]
		
		oNewMenu.language = Language
		
		if 	Language == "Python":
			oNewMenu.Code = ("def QMenu_Menu_Execute(self, QMenu_MenuItems, QMenu_Menus, QMenu_MenuSets):\t#Don't rename this function\n\t#Add your script code here\n\tpass")
		
		if 	Language == "JScript":
			oNewMenu.Code = ("function QMenu_Menu_Execute(self, QMenu_MenuItems, QMenu_Menus, QMenu_MenuSets)\t//Don't rename this function\n{\n\t//Add your script code here\n}")

		if 	Language == "VBScript":
			oNewMenu.Code = ("sub QMenu_Menu_Execute(self, QMenu_MenuItems, QMenu_Menus, QMenu_MenuSets)\t'Don't rename this function\n\t'Add your script code here\nend Sub")			
		
		globalQMenu_Menus.addMenu(oNewMenu)

		RefreshMenus()
		RefreshMenuChooser()
		PPG.Menus.Value = UniqueMenuName
		PPG.MenuItemList.Value = ""
		PPG.CommandList.Value = ""
		RefreshMenuItemDetailsWidgets()
		RefreshMenuSetDetailsWidgets()
		PPG.Refresh()

def QMenuConfigurator_DeleteScriptItem_OnClicked():
	Print("QMenuConfigurator_DeleteScriptItem_OnClicked called", c.siVerbose)
	CurrentMenuItemName = str(PPG.MenuItemList.Value)
	if CurrentMenuItemName != "":
		globalQMenu_MenuItems = GetGlobalObject("globalQMenu_MenuItems")
		
		CurrentMenuItemIndex = None
		MenuItemsEnum = list(PPG.PPGLayout.Item("MenuItemList").UIItems)
		CurrentMenuItemIndex = MenuItemsEnum.index(CurrentMenuItemName)
		
		deleteQMenu_MenuItem(CurrentMenuItemName)

		#Select the next logical menu item in the list for convenience
		if CurrentMenuItemIndex != None:
			if CurrentMenuItemIndex < 2: #The first menuItem was selected?
				if len(MenuItemsEnum) > 2: # and more than 1 menu items in the enum list left?
					PreviousMenuItemName = MenuItemsEnum[CurrentMenuItemIndex +2]
				else: PreviousMenuItemName = ""
			else: #the first menu item was not selected, make the previous one selected after deletion..
				PreviousMenuItemName = MenuItemsEnum[CurrentMenuItemIndex - 2]
						
			PPG.MenuItemList.Value = PreviousMenuItemName
			RefreshMenuItemDetailsWidgets()
			RefreshMenuItems()
			RefreshMenuSetDetailsWidgets()
			
			CurrentCategory = PPG.MenuItem_Category.Value
			RefreshMenuItem_CategoryList()
			MenuItemCategories = PPG.PPGLayout.Item("MenuItem_Category").UIItems
			if CurrentCategory in MenuItemCategories:
				PPG.MenuItem_Category.Value = CurrentCategory
			else:
				PPG.MenuItem_Category.Value = "_ALL_"
			RefreshMenuItemList()
			PPG.Refresh()

def QMenuConfigurator_DeleteMenu_OnClicked():
	Print("QMenuConfigurator_DeleteMenu_OnClicked called", c.siVerbose)
	CurrentMenuName = PPG.Menus.Value
	if str(CurrentMenuName) != "":
		globalQMenu_Menus = GetGlobalObject("globalQMenu_Menus")
		CurrentMenuIndex = None
		
		MenusEnum = PPG.PPGLayout.Item("Menus").UIItems
		for oMenu in globalQMenu_Menus.items:
			if oMenu.name == CurrentMenuName:
				CurrentMenuIndex = MenusEnum.index(CurrentMenuName)
		
		deleteQMenu_Menu(CurrentMenuName)	
		RefreshMenus()
			
		if CurrentMenuIndex != None:
			#Print("CurrentContextIndex is: " + str(CurrentContextIndex))
			if CurrentMenuIndex < 2: #The first menuitem was selected?
				if len(MenusEnum) > 2: # and more than 1 contexts in the enum list left?
					PreviousMenuName = MenusEnum[CurrentMenuIndex +2]
				else: PreviousMenuName = ""
			else: #the first menu was not selected, make the previous one selected after deletion..
				PreviousMenuName = MenusEnum[CurrentMenuIndex - 2]
						
			PPG.Menus.Value = PreviousMenuName
		RefreshMenuContexts()
		RefreshMenuItems()
		RefreshMenuItemDetailsWidgets()
		RefreshMenuSetDetailsWidgets()
		PPG.Refresh()
					
def QMenuConfigurator_RemoveMenu_OnClicked():
	CurrentMenuSetName = str(PPG.MenuSetChooser.Value)
		
	if CurrentMenuSetName != "":
		oCurrentMenuSet = None
		oChosenMenu = None
		oCurrentMenuSet = getQMenu_MenuSetByName(CurrentMenuSetName)
		
		if oCurrentMenuSet != None: #The menu set was found?
			globalQMenu_Menus = GetGlobalObject("globalQMenu_Menus")
			
			if PPG.MenuSelector.Value == 0: CurrentMenus = "A"
			if PPG.MenuSelector.Value == 1: CurrentMenus = "B"
			if PPG.MenuSelector.Value == 2: CurrentMenus = "C"
			if PPG.MenuSelector.Value == 3: CurrentMenus = "D"
			
			CurrentMenuNumber = (PPG.MenuContexts.Value)
			oCurrentMenuSet.setMenu (CurrentMenuNumber, None, CurrentMenus)
			RefreshMenuContexts()
			RefreshMenuChooser()
			RefreshMenuSetDetailsWidgets()
			RefreshMenuItems()
			PPG.Refresh()
					
def QMenuConfigurator_AssignMenu_OnClicked():
	Print ("QMenuConfigurator_AssignMenu_OnClicked called",c.siVerbose)
	globalQMenu_MenuSets = GetGlobalObject("globalQMenu_MenuSets")
	CurrentMenuSetName = str(PPG.MenuSetChooser.Value)
		
	if CurrentMenuSetName != "":
		oCurrentMenuSet = None
		oChosenMenu = None
		oCurrentMenuSet = getQMenu_MenuSetByName(CurrentMenuSetName)
		
		if oCurrentMenuSet != None:
			globalQMenu_Menus = GetGlobalObject("globalQMenu_Menus")
			
			if PPG.MenuSelector.Value == 0: CurrentMenus = "A"
			if PPG.MenuSelector.Value == 1: CurrentMenus = "B"
			if PPG.MenuSelector.Value == 2: CurrentMenus = "C"
			if PPG.MenuSelector.Value == 3: CurrentMenus = "D"
			
			CurrentMenuNumber = (PPG.MenuContexts.Value)
			ChosenMenuName = str(PPG.Menus.Value)
			if ((ChosenMenuName != "")  and (CurrentMenuNumber > -1)):
				if (ChosenMenuName != "_NONE_"):
					oChosenMenu = getQMenu_MenuByName(ChosenMenuName )

				oCurrentMenuSet.setMenu (CurrentMenuNumber, oChosenMenu, CurrentMenus)
				RefreshMenuContexts()
				
	if PPG.AutoSelectMenu.Value == True:
		RefreshMenuChooser()
		RefreshMenuSetDetailsWidgets()
		RefreshMenuItems()
	PPG.Refresh()

def QMenuConfigurator_MenuContexts_OnChanged():
	Print ("QMenuConfigurator_MenuContexts_OnChanged called",c.siVerbose)
		
	RefreshMenuSetDetailsWidgets()
	if PPG.AutoSelectMenu.Value == True:
		RefreshMenuChooser() 
		RefreshMenuItems()
		RefreshMenuItemDetailsWidgets()
	PPG.Refresh()

def QMenuConfigurator_ItemInsert_OnClicked():
	Print ("QMenuConfigurator_ItemInsert_OnClicked called",c.siVerbose)
	oCurrentMenu = getQMenu_MenuByName(PPG.MenuChooser.Value)
	if oCurrentMenu != None:
		CurrentMenuItemIndex = PPG.MenuItems.Value
		if CurrentMenuItemIndex < 0:
			CurrentMenuItemIndex  = 0
		
		oItemToInsert = None
	#Insert a command in case it was selected
		if PPG.CommandList.Value != "":
			oCmdToInsert = getCommandByUID(PPG.CommandList.Value)
			oItemToInsert = App.QMenuCreateObject("CommandPlaceholder")
			oItemToInsert.name = oCmdToInsert.name
			oItemToInsert.UID = oCmdToInsert.UID

	#Insert a script item in case it was selected	
		if PPG.MenuItemList.Value != "":
			oItemToInsert = getQMenu_MenuItemByName ( PPG.MenuItemList.Value)

	#Insert a menu in case it was selected
		if PPG.Menus.Value != "":
			oItemToInsert = getQMenu_MenuByName ( PPG.Menus.Value )
			

		if oItemToInsert != None:
			oCurrentMenu.insertMenuItem (CurrentMenuItemIndex+1, oItemToInsert)
			
			RefreshMenuItems()
			PPG.MenuItems.Value = CurrentMenuItemIndex+1
			RefreshMenuSetDetailsWidgets()
			PPG.Refresh()		

def QMenuConfigurator_MenuItem_Name_OnChanged():
	Print("QMenuConfigurator_MenuItem_Name_OnChanged called", c.siVerbose)
	
	if PPG.MenuItem_Name.Value != "":
		globalQMenu_MenuItems = GetGlobalObject("globalQMenu_MenuItems")
		globalQMenu_Menus = GetGlobalObject("globalQMenu_Menus")
		
		NewMenuItem_Name = ""
		Done = False
		KnownMenuItemNames = list()
		oItem = None
		RefreshRequired = False
		
		#Lets see if a Script Item is selected whose name shall be changed
		if PPG.MenuItemList.Value != "":
			for oMenuItem in globalQMenu_MenuItems.items:
				KnownMenuItemNames.append(oMenuItem.name) #Get all known Script Items names so we can later find a new uinique name
				
			oItem = getQMenu_MenuItemByName(PPG.MenuItemList.Value)
			Done = True
		
		#A Script item was not selected, lets see if a menu was selected
		if Done == False:
			KnownMenuItemNames = list()
			if PPG.Menus.Value != "":
				for oMenu in globalQMenu_Menus.items:
					KnownMenuItemNames.append(oMenu.name) #Get all known Menu names so we can later find a new uinique name
				
				oItem = getQMenu_MenuByName(PPG.Menus.Value)
			
		if oItem != None:
			if oItem.Name != PPG.MenuItem_Name.Value:
				NewMenuItem_Name = getUniqueName(PPG.MenuItem_Name.Value, KnownMenuItemNames)
				oItem.name = NewMenuItem_Name	
		
		#Select the renamed object in the respective list view
		if PPG.MenuItemList.Value != "":
			PPG.MenuItemList.Value = NewMenuItem_Name
			PPG.Menus.Value = ""
			
			RefreshMenuItemList()
			RefreshMenuItems()
			RefreshMenuItemDetailsWidgets()
			PPG.Refresh()
			
		if PPG.Menus.Value != "":
			PPG.Menus.Value = NewMenuItem_Name
			PPG.MenuItemList.Value = ""
			
			RefreshMenuChooser()
			RefreshMenuItems()
			RefreshMenus()
			RefreshMenuContexts()
			RefreshMenuItemDetailsWidgets()
			PPG.Refresh()
		
	else:
		Print("QMenu menu or script item  names must not be empty!", c.siWarning)
		if PPG.MenuItemList.Value != "":
			PPG.MenuItem_Name.Value = PPG.MenuItemList.Value
		if PPG.Menus.Value != "":
			PPG.MenuItem_Name.Value = PPG.Menus.Value
		
def QMenuConfigurator_NewMenuItem_Category_OnChanged():
	Print("QMenuConfigurator_NewMenuItem_Category_OnChanged called", c.siVerbose)
	CurrentMenuItem_Name = PPG.MenuItemList.Value
	CurrentMenuItem_Category = PPG.MenuItem_Category.Value
	globalQMenu_MenuItems = GetGlobalObject("globalQMenu_MenuItems")
	
	NewMenuItem_Category = PPG.NewMenuItem_Category.Value.replace(";","_")

	for menuItem in globalQMenu_MenuItems.items:
		if menuItem.name == CurrentMenuItem_Name:
			menuItem.category = NewMenuItem_Category
			
	RefreshMenuItem_CategoryList()
	
	if CurrentMenuItem_Category != "_ALL_": 
		PPG.MenuItem_Category.Value = NewMenuItem_Category
		
	RefreshMenuItem_CategoryChooserList()
	RefreshMenuItemList()

	RefreshMenuItemDetailsWidgets()
	#PPG.NewMenuItem_Category.Value = menuItem.category
	PPG.Refresh()

def QMenuConfigurator_MenuItem_Switch_OnChanged():
	Print("QMenuConfigurator_NewMenuItem_Category_OnChanged called", c.siVerbose)
	CurrentMenuItem_Name = PPG.MenuItemList.Value
	MenuItem_Switch = PPG.MenuItem_Switch.Value
	globalQMenu_MenuItems = GetGlobalObject("globalQMenu_MenuItems")
	
	for menuItem in globalQMenu_MenuItems.items:
		if menuItem.name == CurrentMenuItem_Name:
			menuItem.switch = MenuItem_Switch
			
	RefreshMenuItemList()
	PPG.Refresh()

def QMenuConfigurator_ShowItemType_OnChanged():
	Print("QMenuConfigurator_ShowItemType_OnChanged called", c.siVerbose)
	RefreshMenuItemList()
	if PPG.ShowItemType.Value:
		if PPG.MenuItemList.Value not in PPG.PPGLayout.Item("MenuItemList").UIItems:
			PPG.MenuItemList.Value = ""
	
	RefreshMenuItemDetailsWidgets()
	PPG.Refresh()
	
def QMenuConfigurator_MenuItem_ScriptLanguage_OnChanged():
	Print("QMenuConfigurator_MenuItem_ScriptLanguage_OnChanged called", c.siVerbose)
	NewScriptLanguage = str(PPG.MenuItem_ScriptLanguage.Value)
	
	if PPG.MenuItemList.Value != "":
		oMenuItem = getQMenu_MenuItemByName(PPG.MenuItemList.Value)
		if oMenuItem != None:
			oMenuItem.language = NewScriptLanguage
		
	elif PPG.Menus.Value != "":
		oMenu = getQMenu_MenuByName(PPG.Menus.Value)
		if oMenu != None:
			oMenu.language = NewScriptLanguage

def QMenuConfigurator_MenuItem_Code_OnChanged():
	Print("QMenuConfigurator_MenuItem_Code_OnChanged called", c.siVerbose)
	
	#Let's replace nasty linefeed \r characters that can occur when pasting code into the editor
	Code = PPG.MenuItem_Code.Value
	#Code = Code.rstrip() #Lets get rid of trailling whitespaces
	Code = Code.replace("\r","") #Lets get rid of carriage returns as these result in extra lines when read back from the config file
	PPG.MenuItem_Code.Value = Code
	
	#Lets set the code data on the menu or item
	if PPG.MenuItemList.Value != "":
		oMenuItem = getQMenu_MenuItemByName(PPG.MenuItemList.Value)
		if oMenuItem != None:
			oMenuItem.code = PPG.MenuItem_Code.Value
		
	elif PPG.Menus.Value != "":
		oMenu = getQMenu_MenuByName(PPG.Menus.Value)
		if oMenu != None:
			oMenu.code = PPG.MenuItem_Code.Value
			
def QMenuConfigurator_MenuItem_CategoryChooser_OnChanged():
	Print("QMenuConfigurator_MenuItem_CategoryChooser_OnChanged called", c.siVerbose)
	CurrentMenuItem_Name = PPG.MenuItemList.Value
	CurrentMenuItem_Category = PPG.MenuItem_Category.Value
	NewMenuItem_Category = PPG.MenuItem_CategoryChooser.Value
	
	globalQMenu_MenuItems = GetGlobalObject("globalQMenu_MenuItems")
	for menuItem in globalQMenu_MenuItems.items:
		if menuItem.name == CurrentMenuItem_Name:
			menuItem.category = NewMenuItem_Category 
	
	RefreshMenuItem_CategoryList()
	if CurrentMenuItem_Category != "_ALL_": PPG.MenuItem_Category.Value = NewMenuItem_Category 
	RefreshMenuItemList()
	PPG.MenuItemList.Value = CurrentMenuItem_Name 
	RefreshMenuItemDetailsWidgets()
	PPG.Refresh()
		
def QMenuConfigurator_MenuItem_Category_OnChanged():
	Print("QMenuConfigurator_MenuItem_Category_OnChanged called", c.siVerbose)
	RefreshMenuItemList()
	if PPG.MenuItemList.Value not in PPG.PPGLayout.Item("MenuItemList").UIItems:
		PPG.MenuItemList.Value = ""
			
	RefreshMenuItemDetailsWidgets()
	PPG.Refresh()

def QMenuConfigurator_MenuItem_IsActive_OnChanged():
	Print("QMenuConfigurator_MenuItem_IsActive_OnChanged called", c.siVerbose)
	
	#globalQMenu_MenuItems = GetGlobalObject("globalQMenu_MenuItems")
	globalQMenu_Menus = GetGlobalObject("globalQMenu_Menus")
	
	oItem = None
	RefreshRequired = False
	
	#Done = False
	#Lets see if a Script Item is selected which should be set to inactive
	#if PPG.MenuItemList.Value != "":
		#oItem = getQMenu_MenuItemByName(PPG.MenuItemList.Value)
		#if oItem != None:
			#oItem.isActive = PPG.MenuItem_IsActive.Value
		#Done = True
	
	#A Script item was not selected, lets see if a menu	was selected
	#if Done == False:
	if PPG.Menus.Value != "":
		oItem = getQMenu_MenuByName(PPG.Menus.Value)
		
		if oItem != None:
			#Print("Attempting to set Menu's executeCode flag to " + str(PPG.MenuItem_IsActive.Value))
			oItem.executeCode = PPG.MenuItem_IsActive.Value

def QMenuConfigurator_CreateMenuSet_OnClicked():
	Print("QMenuConfigurator_CreateMenuSet_OnClicked called", c.siVerbose)
	globalQMenu_MenuSets = GetGlobalObject("globalQMenu_MenuSets")
	globalQMenu_MenuSetNamesList = list()
	for Set in globalQMenu_MenuSets.items:
		globalQMenu_MenuSetNamesList.append(Set.name)
	
	newSetName = getUniqueName("NewQMenu_MenuSet",globalQMenu_MenuSetNamesList)
	
	newSet = App.QMenuCreateObject("MenuSet")
	newSet.Name = newSetName
	
	globalQMenu_MenuSets.addSet(newSet)
	RefreshMenuSets()
	PPG.MenuSets.Value = newSetName
	PPG.MenuSetName.Value = newSetName
	RefreshContextConfigurator()
	PPG.Refresh()

def QMenuConfigurator_MenuSelector_OnChanged():
	Print("QMenuConfigurator_MenuSelector_OnChanged called", c.siVerbose)
	RefreshContextConfigurator()
	RefreshMenuContexts()
	RefreshMenuChooser()
	RefreshMenuItems()
	RefreshMenuSetDetailsWidgets()
	PPG.Refresh()
	
def QMenuConfigurator_View_OnChanged():
	Print("QMenuConfigurator_View_OnChanged()", c.siVerbose)
	RefreshMenuSetChooser()
	RefreshMenuContexts()
	PPG.MenuContexts.Value = 0
	RefreshMenuChooser()
	RefreshMenuItems()
	RefreshMenuSetDetailsWidgets()
	PPG.Refresh()
	
def QMenuConfigurator_MenuSets_OnChanged():
	Print("QMenuConfigurator_MenuSets_OnChanged called", c.siVerbose)
	PPG.MenuSetName.Value = PPG.MenuSets.Value
	RefreshContextConfigurator()
	PPG.Refresh()

def QMenuConfigurator_MenuSetName_OnChanged():
	Print("QMenuConfigurator_MenuSetName_OnChanged called", c.siVerbose)
	NewMenuSetName = PPG.MenuSetName.Value
	CurrentMenuSetName = PPG.MenuSets.Value

	if NewMenuSetName != "" :
		if NewMenuSetName != CurrentMenuSetName:		
			globalQMenu_MenuSets = GetGlobalObject("globalQMenu_MenuSets")
			globalQMenu_MenuSetNames = list()
			for oMenuSet in globalQMenu_MenuSets.items:
				globalQMenu_MenuSetNames.append(oMenuSet.name)
			
			uniqueMenuSetName = getUniqueName(NewMenuSetName, globalQMenu_MenuSetNames)

			PPG.MenuSetName.Value = uniqueMenuSetName
			
			for oMenuSet in globalQMenu_MenuSets.items:
				if oMenuSet.name == PPG.MenuSets.Value:
					oMenuSet.name = uniqueMenuSetName
					PPG.MenuSets.Value = oMenuSet.name
			
			RefreshMenuSets()
			RefreshViewMenuSets()
			RefreshMenuSetChooser()
			PPG.Refresh()
	else:
		Print("QMenu Menu Set names must not be empty!", c.siWarning)
	
def QMenuConfigurator_DeleteMenuSet_OnClicked():
	Print("QMenuConfigurator_DeleteMenuSet_OnClicked called", c.siVerbose)
	globalQMenu_MenuSets = GetGlobalObject("globalQMenu_MenuSets")
	globalQMenuViewSignatures = GetGlobalObject("globalQMenuViewSignatures")
	currentMenuSetName = str(PPG.MenuSets.Value)
	menuSetNamesEnum = PPG.PPGLayout.Item ("MenuSets").UIItems
	currentMenuSetIndex = None
	
	if currentMenuSetName != "": 
		if len(menuSetNamesEnum) > 0:
			currentMenuSetIndex = menuSetNamesEnum.index(currentMenuSetName)
		
		oCurrentMenuSet = None
		oCurrentMenuSet = getQMenu_MenuSetByName (currentMenuSetName)
		
		if oCurrentMenuSet != None:
			globalQMenu_MenuSets.deleteSet(oCurrentMenuSet)
			for oViewSignature in globalQMenuViewSignatures.items:
				for oSet in oViewSignature.menuSets:
					if oSet == oCurrentMenuSet:
						oViewSignature.removeMenuSet( oViewSignature.menuSets.index(oSet))

		RefreshMenuSets()
		RefreshViewMenuSets()
		
		if currentMenuSetIndex != None:
			if (currentMenuSetIndex < 2): #The first menu set item in the list was selected?
				if len(menuSetNamesEnum) > 2: #Were there more than 1 sets in the enum list left?
					previousMenuSetName = menuSetNamesEnum[currentMenuSetIndex +2]
				else:
					previousMenuSetName = ""
			else:
				previousMenuSetName = menuSetNamesEnum[currentMenuSetIndex -2]
				#Print("PreviousMenuSetName is: " + str(previousMenuSetName))
			PPG.MenuSets.Value = previousMenuSetName
		
		PPG.MenuSetName.Value = PPG.MenuSets.Value 
		RefreshContextConfigurator()
		PPG.Refresh()

def QMenuConfigurator_ViewSignature_OnChanged():
	Print("QMenuConfigurator_ViewSignature_OnChanged", c.siVerbose)
	globalQMenuViewSignatures = GetGlobalObject("globalQMenuViewSignatures")
	currentSignatureName = str(PPG.ViewSignatures.Value)
	
	if currentSignatureName != "":
		for oSignature in globalQMenuViewSignatures.items:
			if oSignature.name == currentSignatureName:
				oCurrentSignature = oSignature
				oCurrentSignature.signature = PPG.ViewSignature.Value

def QMenuConfigurator_ViewSignatures_OnChanged():
	Print("QMenuConfigurator_ViewSignatures_OnChanged called", c.siVerbose)
	RefreshViewDetailsWidgets()
	RefreshViewMenuSets()
	PPG.Refresh()
		
def QMenuConfigurator_ViewSignatureName_OnChanged():
	Print("QMenuConfigurator_ViewSignatureName_OnChanged", c.siVerbose)
	currentSignatureName = PPG.ViewSignatures.Value
	newSignatureName = str(PPG.ViewSignatureName.Value)
	
	if newSignatureName != "" :
		if currentSignatureName != newSignatureName:
			globalQMenuViewSignatures = GetGlobalObject("globalQMenuViewSignatures")
			listKnownViewSignatureNames = list()
			
			currentSignatureName = PPG.ViewSignatures.Value
			if str(currentSignatureName) != "":
				for signature in globalQMenuViewSignatures.items:
					listKnownViewSignatureNames.append(signature.name)
						
				oCurrentSignature = getQMenu_ViewSignatureByName(currentSignatureName)
				if oCurrentSignature != None:
		
					newSignatureName = getUniqueName(newSignatureName,listKnownViewSignatureNames)
					oCurrentSignature.name = newSignatureName

					RefreshViewSignaturesList()
					#RefreshViewSelector()
					PPG.View.Value = newSignatureName
					PPG.ViewSignatures.Value = oCurrentSignature.name
					PPG.ViewSignatureName.Value = oCurrentSignature.name
					PPG.ViewSignature.Value = oCurrentSignature.signature
	else:
		Print("QMenu View Signture names must not be empty!", c.siWarning)
	
	PPG.ViewSignatureName.Value = PPG.ViewSignatures.Value	

def QMenuConfigurator_AddQMenuViewSignature_OnClicked():
	Print("QMenuConfigurator_AddQMenuViewSignature_OnClicked called", c.siVerbose)
	globalQMenuViewSignatures = GetGlobalObject("globalQMenuViewSignatures")
	
	newSignature = App.QMenuCreateObject("ViewSignature")
	listKnownViewSignatureNames = list()
	for signature in globalQMenuViewSignatures.items:
		listKnownViewSignatureNames.append(signature.name)
		
	newSignatureName = getUniqueName("NewView",listKnownViewSignatureNames)
	newSignatureString = "Viewer;DS_ChildViewManager;DS_ChildRelationalView;TrayClientWindow;"
	newSignature.name = newSignatureName
	newSignature.signature = newSignatureString	
	globalQMenuViewSignatures.addSignature(newSignature)
	RefreshViewSignaturesList()
	PPG.ViewSignatures.Value = newSignatureName
	PPG.ViewSignature.Value = newSignatureString
	PPG.ViewSignatureName.Value = newSignatureName
	RefreshViewSelector()
	RefreshViewMenuSets()
	PPG.Refresh()
	
def QMenuConfigurator_DelQMenuViewSignature_OnClicked():
	Print("QMenuConfigurator_DelQMenuViewSignature_OnClicked called", c.siVerbose)
	
	if str(PPG.ViewSignatures.Value) != "":
		globalQMenuViewSignatures = GetGlobalObject("globalQMenuViewSignatures")
		currentSignatureName = PPG.ViewSignatures.Value
		currentViewIndex = None
		viewSignatureNamesEnum = list()
		
		viewSignatureNamesEnum = PPG.PPGLayout.Item ("ViewSignatures").UIItems
		if len(viewSignatureNamesEnum) > 0:
			currentViewIndex = viewSignatureNamesEnum.index(PPG.ViewSignatures.Value)
			
		for signature in globalQMenuViewSignatures.items:
			if signature.name == currentSignatureName:
				globalQMenuViewSignatures.deleteSignature(signature)
		
		RefreshViewSignaturesList()
		previousViewSignatureName = ""
		
		if currentViewIndex != None:
			if (currentViewIndex - 2) < 0:
				if len(viewSignatureNamesEnum) > 2:
					previousViewSignatureName = viewSignatureNamesEnum[currentViewIndex +2]
			else: 
				previousViewSignatureName = viewSignatureNamesEnum[currentViewIndex - 2]
						
		PPG.ViewSignatures.Value = previousViewSignatureName
		RefreshViewDetailsWidgets()
		RefreshViewMenuSets()
		RefreshViewSelector()
		RefreshMenuSetChooser()
		PPG.Refresh()
	
def QMenuConfigurator_RecordViewSignature_OnChanged():
	if PPG.RecordViewSignature.Value == True:
		Print("Please move the mouse cursor over the desired window area and press any key on the keyboard", c.siWarning)
		
def QMenuConfigurator_CreateNewDisplayContext_OnClicked():
	Print("QMenuConfigurator_CreateNewDisplayContext_OnClicked called", c.siVerbose)

	LanguageNumber = QueryScriptLanguage()
	if LanguageNumber > -1:
		Languages = ("Python","JScript","VBScript")
		Language = Languages[LanguageNumber]
		globalQMenu_MenuDisplayContexts = GetGlobalObject("globalQMenu_MenuDisplayContexts")
		
		uniqueDisplayContextName = "NewDisplayContext"
		DisplayContextNames = list()
		for oDisplayContext in globalQMenu_MenuDisplayContexts.items:
			DisplayContextNames.append(oDisplayContext.name)
		
		uniqueDisplayContextName = getUniqueName(uniqueDisplayContextName,DisplayContextNames)
		
		oNewDisplayContext = App.QMenuCreateObject("MenuDisplayContext")
		oNewDisplayContext.name = uniqueDisplayContextName
		oNewDisplayContext.language = Language
		
		if Language == "Python":
			oNewDisplayContext.code = ("def QMenuContext_Execute(selection , Types , ClassNames , ComponentClassNames , ComponentParents , ComponentParentTypes , ComponentParentClassNames): #This function must not be renamed!\n\t#Add your code here\n\treturn True\t#This function must return a boolean")
		if Language == "JScript":
			oNewDisplayContext.code = ("function QMenuContext_Execute(selection , Types , ClassNames , ComponentClassNames , ComponentParents , ComponentParentTypes , ComponentParentClassNames) //This function must not be renamed!\n{\n\t//Add your code here\n\treturn true\t//This function must return a boolean\n}")
		if Language == "VBScript":
			oNewDisplayContext.code = ("Function QMenuContext_Execute(selection , Types , ClassNames , ComponentClassNames , ComponentParents , ComponentParentTypes , ComponentParentClassNames) 'This function must not be renamed!\n\t'Add your code here\n\tQMenuContext_Execute = True\t'This function must return a boolean\n end Function")
		
		globalQMenu_MenuDisplayContexts.addContext(oNewDisplayContext)
		RefreshMenuDisplayContextsList()
		PPG.MenuDisplayContexts.Value = uniqueDisplayContextName
		RefreshMenuDisplayContextDetailsWidgets()
		PPG.Refresh()

def QMenuConfigurator_DeleteDisplayContext_OnClicked():
	Print("QMenuConfigurator_DeleteDisplayContext_OnClicked called", c.siVerbose)
	CurrentMenuDisplayContextName = PPG.MenuDisplayContexts.Value
	if str(CurrentMenuDisplayContextName) != "":
		globalQMenu_MenuDisplayContexts = GetGlobalObject("globalQMenu_MenuDisplayContexts")
		globalQMenu_MenuSets = GetGlobalObject("globalQMenu_MenuSets")

		CurrentContextIndex = None
		MenuDisplayContextsEnum = PPG.PPGLayout.Item("MenuDisplayContexts").UIItems
		
		oCurrentDisplayContext = None
		for oDisplayContext in globalQMenu_MenuDisplayContexts.items:
			if oDisplayContext.name == CurrentMenuDisplayContextName:
				oCurrentDisplayContext = oDisplayContext
				
		#Delete Context from MenuSets
		if oCurrentDisplayContext != None:
			for oMenuSet in globalQMenu_MenuSets.items:
				try:
					Index = oMenuSet.AContexts.index(oCurrentDisplayContext)
					oMenuSet.removeContext(Index, "A")
					oMenuSet.removeMenuAtIndex(Index,"A")
				except:
					DoNothin = true
				try:
					Index = oMenuSet.BContexts.index(oCurrentDisplayContext)
					oMenuSet.removeContext(Index, "B")
					oMenuSet.removeMenuAtIndex(Index,"B")
				except:
					DoNothin = true
				try:
					Index = oMenuSet.CContexts.index(oCurrentDisplayContext)
					oMenuSet.removeContext(Index, "C")
					oMenuSet.removeMenuAtIndex(Index,"C")
				except:
					DoNothin = true
				try:
					Index = oMenuSet.DContexts.index(oCurrentDisplayContext)
					oMenuSet.removeContext(Index, "D")
					oMenuSet.removeMenuAtIndex(Index,"D")
				except:
					DoNothin = true

		#Delete Context from globals
		globalQMenu_MenuDisplayContexts.deleteContext(oCurrentDisplayContext)
		CurrentContextIndex = MenuDisplayContextsEnum.index(CurrentMenuDisplayContextName)
		
		RefreshMenuDisplayContextsList()
		RefreshContextConfigurator()
			
		if CurrentContextIndex != None:
			#Print("CurrentContextIndex is: " + str(CurrentContextIndex))
			if CurrentContextIndex < 2: #The first menuitem was selected?
				if len(MenuDisplayContextsEnum) > 2: # and more than 1 contexts in the enum list left?
					#Print ("Length is: " + str(len(MenuDisplayContextsEnum)))
					PreviousMenuDisplayContextName = MenuDisplayContextsEnum[CurrentContextIndex +2]
				else: PreviousMenuDisplayContextName = ""
			else: #the first menu item was not selected, make the previous one selected after deletion..
				PreviousMenuDisplayContextName = MenuDisplayContextsEnum[CurrentContextIndex - 2]
				#Print("previousViewSignatureName  is: " + str(PreviousViewSignatureName))
						
			PPG.MenuDisplayContexts.Value = PreviousMenuDisplayContextName
			RefreshMenuDisplayContextDetailsWidgets()
			PPG.Refresh()
	
def QMenuConfigurator_MenuDisplayContexts_OnChanged():
	Print("QMenuConfigurator_MenuDisplayContexts_OnChanged called", c.siVerbose)
	globalQMenu_MenuDisplayContexts = GetGlobalObject("globalQMenu_MenuDisplayContexts")
	oCurrentMenuDisplayContext = None
	CurrentMenuDisplayContextName = PPG.MenuDisplayContexts.Value

	for oDisplayContext in globalQMenu_MenuDisplayContexts.items:
		if oDisplayContext.name == CurrentMenuDisplayContextName:
			oCurrentMenuDisplayContext = oDisplayContext
	
	if oCurrentMenuDisplayContext != None:
		PPG.MenuDisplayContext_Name.Value = oCurrentMenuDisplayContext.name
		PPG.MenuDisplayContext_Code.Value = oCurrentMenuDisplayContext.code
		PPG.MenuDisplayContext_ScriptLanguage.Value = oCurrentMenuDisplayContext.language

def QMenuConfigurator_MenuDisplayContext_Name_OnChanged():
	Print("QMenuConfigurator_MenuDisplayContext_Name_OnChanged called", c.siVerbose)
	NewMenuDisplayContextName = PPG.MenuDisplayContext_Name.Value
	CurrentMenuDisplayContextName = PPG.MenuDisplayContexts.Value
	
	if str(NewMenuDisplayContextName) != "":
		if NewMenuDisplayContextName != CurrentMenuDisplayContextName:
			globalQMenu_MenuDisplayContexts = GetGlobalObject("globalQMenu_MenuDisplayContexts")
			oCurrentMenuDisplayContext = None
			CurrentMenuDisplayContextName = PPG.MenuDisplayContexts.Value
			DisplayContextNames = list()
			for oDisplayContext in globalQMenu_MenuDisplayContexts.items:
				DisplayContextNames.append(oDisplayContext.name)
				if oDisplayContext.name == CurrentMenuDisplayContextName:
					oCurrentMenuDisplayContext = oDisplayContext
			
			if oCurrentMenuDisplayContext != None:
				UniqueMenuDisplayContextName = getUniqueName(NewMenuDisplayContextName, DisplayContextNames)
				oCurrentMenuDisplayContext.name = UniqueMenuDisplayContextName
				RefreshMenuDisplayContextsList()
				PPG.MenuDisplayContexts.Value = UniqueMenuDisplayContextName
				RefreshContextConfigurator()
				RefreshMenuDisplayContextDetailsWidgets()
				RefreshMenuContexts()
				PPG.Refresh()
	else:
		Print("QMenu Menu Display Context names must not be empty!", c.siWarning)
		PPG.MenuDisplayContext_Name.Value = PPG.MenuDisplayContexts.Value
	
def QMenuConfigurator_MenuDisplayContext_ScriptLanguage_OnChanged():
	Print("QMenuConfigurator_MenuDisplayContext_ScriptLanguage_OnChanged called", c.siVerbose)
	globalQMenu_MenuDisplayContexts = GetGlobalObject("globalQMenu_MenuDisplayContexts")
	oCurrentMenuDisplayContext = None
	CurrentMenuDisplayContextName = PPG.MenuDisplayContexts.Value
	MenuDisplayContextLanguage = PPG.MenuDisplayContext_ScriptLanguage.Value

	for oDisplayContext in globalQMenu_MenuDisplayContexts.items:
		if oDisplayContext.name == CurrentMenuDisplayContextName:
			oCurrentMenuDisplayContext = oDisplayContext
	
	if oCurrentMenuDisplayContext != None:
		oCurrentMenuDisplayContext.language = MenuDisplayContextLanguage
	
	#TODO: implement text widget feature switching as a vbs or JScript function, python does not seem to work
	#oTextWidget = PPG.PPGLayout.Item("MenuDisplayContext_Code")
	#oTextWidget.SetAttribute(c.siUIKeywords , "for in def print if" )
	#oTextWidget.SetAttribute(c.siUIKeywordFile , "C:\users\Administrator\Autodesk\Softimage_7.5\Addons\QMenu\Data\Preferences\Python.keywords" )
	
def QMenuConfigurator_MenuDisplayContext_Code_OnChanged():
	Print("QMenuConfigurator_MenuDisplayContext_Code_OnChanged called", c.siVerbose)
	globalQMenu_MenuDisplayContexts = GetGlobalObject("globalQMenu_MenuDisplayContexts")
	oCurrentMenuDisplayContext = None
	CurrentMenuDisplayContextName = PPG.MenuDisplayContexts.Value
	Code = PPG.MenuDisplayContext_Code.Value

	
	Code = Code.rstrip() #Lets get rid of trailling whitespaces
	Code = Code.replace("\r","") #Lets get rid of carriage returns as these result in extra lines when read back from the config file

	for oDisplayContext in globalQMenu_MenuDisplayContexts.items:
		if oDisplayContext.name == CurrentMenuDisplayContextName:
			oCurrentMenuDisplayContext = oDisplayContext
	
	if oCurrentMenuDisplayContext != None:
		oCurrentMenuDisplayContext.code = Code
		PPG.MenuDisplayContext_Code.Value = oCurrentMenuDisplayContext.code
		
def QMenuConfigurator_InsertMenuContext_OnClicked():
	Print("QMenuConfigurator_InsertMenuContext_OnClicked called", c.siVerbose)
	
	CurrentMenuSetName = PPG.MenuSets.Value
	SelectedMenuDisplayContextName = PPG.MenuDisplayContexts.Value #The name of the selected context that shall be assigned
	CurrentMenuDisplayContextName = PPG.ContextConfigurator.Value #The name of the already assigned context above which the new context shall be inserted
	
	oCurrentMenuSet = None
	oSelectedMenuDisplayContext = None
	oCurrentMenuSet = getQMenu_MenuSetByName(CurrentMenuSetName)
	oSelectedMenuDisplayContext = getQMenu_MenuDisplayContextByName(SelectedMenuDisplayContextName)
	oCurrentMenuDisplayContext = getQMenu_MenuDisplayContextByName(CurrentMenuDisplayContextName)
		
	if ((oCurrentMenuSet != None) and (oSelectedMenuDisplayContext != None)):

		if PPG.MenuSelector.Value == 0:
			Contexts = oCurrentMenuSet.AContexts
			Menus = oCurrentMenuSet.AMenus
			MenuList = ContextList = "A"
		if PPG.MenuSelector.Value == 1:
			Contexts = oCurrentMenuSet.BContexts
			Menus = oCurrentMenuSet.BMenus
			MenuList = ContextList = "B"
		if PPG.MenuSelector.Value == 2:
			Contexts = oCurrentMenuSet.CContexts
			Menus = oCurrentMenuSet.CMenus
			MenuList = ContextList = "C"
		if PPG.MenuSelector.Value == 3:
			Contexts = oCurrentMenuSet.DContexts
			Menus = oCurrentMenuSet.DMenus
			MenuList = ContextList = "D"
		
		if not(oSelectedMenuDisplayContext in Contexts):
			CurrentMenuDisplayContextIndex = 0
			try:
				CurrentMenuDisplayContextIndex = Contexts.index(oCurrentMenuDisplayContext)
			except:
				CurrentMenuDisplayContextIndex = 0
			oCurrentMenuSet.insertContext(CurrentMenuDisplayContextIndex,oSelectedMenuDisplayContext,ContextList)
			oCurrentMenuSet.insertMenuAtIndex(CurrentMenuDisplayContextIndex, None, MenuList)
				
			RefreshContextConfigurator()
			PPG.ContextConfigurator.Value = oSelectedMenuDisplayContext.name
			
			RefreshMenuContexts()
			RefreshMenuSetDetailsWidgets()
			RefreshMenuChooser()
			RefreshMenuItems()
			RefreshMenuSetDetailsWidgets()
			RefreshMenuItemDetailsWidgets()
			PPG.Refresh()
			
def QMenuConfigurator_RemoveMenuContext_OnClicked():
	Print("QMenuConfigurator_RemoveMenuContext_OnClicked called", c.siVerbose)
	globalQMenu_MenuSets = GetGlobalObject("globalQMenu_MenuSets")
	globalQMenu_MenuDisplayContexts = GetGlobalObject("globalQMenu_MenuDisplayContexts")
	
	CurrentMenuSetName = PPG.MenuSets.Value
	CurrentMenuDisplayContextName = PPG.ContextConfigurator.Value
	CurrentMenuDisplayContextIndex = None
	CurrentMenuDisplayContextEnum = PPG.PPGLayout.Item("ContextConfigurator").UIItems
	#Print("CurrentMenuDisplayContextEnum is: " + str(CurrentMenuDisplayContextEnum))

	if str(CurrentMenuDisplayContextName) != "":
		DisplayContextIndex = None
		oCurrentMenuSet = None
		oCurrentMenuDisplayContext = None

		oCurrentMenuSet = getQMenu_MenuSetByName(CurrentMenuSetName)
		
		for oMenuDisplayContext in globalQMenu_MenuDisplayContexts.items:
			if oMenuDisplayContext.name == CurrentMenuDisplayContextName:
				oCurrentMenuDisplayContext = oMenuDisplayContext
				CurrentMenuDisplayContextIndex = CurrentMenuDisplayContextEnum.index(CurrentMenuDisplayContextName)

		if PPG.MenuSelector.Value == 0:
			#Print("A is active")
			Contexts = oCurrentMenuSet.AContexts
			MenuList = ContextList = "A"
		if PPG.MenuSelector.Value == 1:
			Contexts = oCurrentMenuSet.BContexts
			MenuList = ContextList = "B"
		if PPG.MenuSelector.Value == 2:
			Contexts = oCurrentMenuSet.CContexts
			MenuList = ContextList = "C"
		if PPG.MenuSelector.Value == 3:
			Contexts = oCurrentMenuSet.DContexts
			MenuList = ContextList = "D"
		
		DisplayContextIndex = Contexts.index(oCurrentMenuDisplayContext)
			
		oCurrentMenuSet.removeContext (DisplayContextIndex, ContextList)
		oCurrentMenuSet.removeMenuAtIndex(DisplayContextIndex,MenuList)
		
		#Print("DisplayContextIndex is: " + str(DisplayContextIndex))
		
		if CurrentMenuDisplayContextIndex != None:
			if CurrentMenuDisplayContextIndex < 2: #The first menu display context was selected?
				if len(CurrentMenuDisplayContextEnum) > 2: # and more than 1 menu display context still in list?
					PreviousMenuDisplayContextName = CurrentMenuDisplayContextEnum[CurrentMenuDisplayContextIndex + 2]
				else: 
					#Print("previousViewSignatureName  is: " + str(PreviousViewSignatureName))
					PreviousMenuDisplayContextName = ""
			else: #the first display context item was not selected, make the previous one selected after deletion..
				PreviousMenuDisplayContextName = CurrentMenuDisplayContextEnum[CurrentMenuDisplayContextIndex - 2]
				
			RefreshContextConfigurator()
			PPG.ContextConfigurator.Value = PreviousMenuDisplayContextName
			
			RefreshMenuContexts()
			RefreshMenuChooser()
			RefreshMenuItems()
			RefreshMenuSetDetailsWidgets()
			RefreshMenuItemDetailsWidgets()
			PPG.Refresh()
	
def QMenuConfigurator_InsertSetInView_OnClicked():
	Print("QMenuConfigurator_InsertSetInView_OnClicked called", c.siVerbose)
	globalQMenuViewSignatures = GetGlobalObject("globalQMenuViewSignatures")
	globalQMenu_MenuSets = GetGlobalObject("globalQMenu_MenuSets")
	CurrentViewSignatureName = str(PPG.ViewSignatures.Value)
	CurrentMenuSetName = str(PPG.ViewMenuSets.Value)
	oCurrentMenuSet = None
	oCurrentViewSignature = None
	SelectedMenuSetName = str(PPG.MenuSets.Value)
	oSelectedMenuSet = None #The Menu Set selected in Existing QMenu Menu Sets
	
	MenuSetIndex = 0

	if (CurrentViewSignatureName != "") and (SelectedMenuSetName != ""): #Is a View Signature and an existing QMenu menu Set selected?
		for oMenuSet in globalQMenu_MenuSets.items:
			if oMenuSet.name == SelectedMenuSetName:
				oSelectedMenuSet = oMenuSet
			
		for oSignature in globalQMenuViewSignatures.items:
			if oSignature.name == CurrentViewSignatureName:
				oCurrentViewSignature = oSignature
		
		if CurrentMenuSetName == "":
			MenuSetIndex = 0
			
		if CurrentMenuSetName != "":
			MenuSetNameList = list()
			MenuSets = oCurrentViewSignature.menuSets
			for oMenuSet in MenuSets:
				if oMenuSet.name == CurrentMenuSetName:
					oCurrentMenuSet = oMenuSet
			if oCurrentMenuSet != None:
				try:
					MenuSetIndex = MenuSets.index(oCurrentMenuSet)
				except:
					MenuSetIndex = 0
		
		if not(oSelectedMenuSet in oCurrentViewSignature.menuSets):
			oCurrentViewSignature.insertMenuSet(MenuSetIndex, oSelectedMenuSet)
			PPG.ViewMenuSets.Value = oSelectedMenuSet.name
			RefreshViewMenuSets()
		RefreshViewSelector()
		RefreshMenuSetChooser()
		RefreshMenuContexts()
		RefreshMenuSetDetailsWidgets()
		PPG.Refresh()
			
def QMenuConfigurator_RemoveSetInView_OnClicked():
	Print("QMenuConfigurator_RemoveSetInView_OnClicked called", c.siVerbose)
	globalQMenu_MenuSets = GetGlobalObject("globalQMenu_MenuSets")
	globalQMenuViewSignatures = GetGlobalObject("globalQMenuViewSignatures")
	
	CurrentViewSignatureName = str(PPG.ViewSignatures.Value)
	CurrentMenuSetName = str(PPG.ViewMenuSets.Value)
	oCurrentMenuSet = None
	oCurrentViewSignature = None
	
	if (CurrentMenuSetName != "") and (CurrentViewSignatureName!= ""):
	
		for oMenuSet in globalQMenu_MenuSets.items:
			if oMenuSet.name == CurrentMenuSetName:
				oCurrentMenuSet = oMenuSet
		
		CurrentViewSignatureMenuSets = list()
		
		for oSignature in globalQMenuViewSignatures.items:
			if oSignature.name == CurrentViewSignatureName:
				oCurrentViewSignature = oSignature
				CurrentViewSignatureMenuSets = oCurrentViewSignature.menuSets
		
		if len(CurrentViewSignatureMenuSets) > 0:
			try:
				CurrentMenuSetIndex = CurrentViewSignatureMenuSets.index(oCurrentMenuSet)
			except:
				CurrentMenuSetIndex = None
				
			if oCurrentMenuSet != None:
				if (CurrentMenuSetIndex == 0):
					if len(CurrentViewSignatureMenuSets) == 1:
						PreviousViewMenuSetName = ""
					else:
						PreviousViewMenuSetName = CurrentViewSignatureMenuSets[CurrentMenuSetIndex +1].name
				else:
					PreviousViewMenuSetName = CurrentViewSignatureMenuSets[CurrentMenuSetIndex -1].name
				
				oCurrentViewSignature.removeMenuSet(CurrentMenuSetIndex) #Delete the menu set
				
			PPG.ViewMenuSets.Value = PreviousViewMenuSetName
		RefreshViewMenuSets()
		RefreshMenuSetChooser()
		RefreshMenuContexts()
		RefreshMenuSetDetailsWidgets()
		PPG.Refresh()		

def QMenuConfigurator_MenuSetChooser_OnChanged():
	Print("QMenuConfigurator_MenuSetChooser_OnChanged called", c.siVerbose)
	RefreshMenuContexts()
	PPG.MenuContexts.Value = -1
	RefreshMenuChooser()
	RefreshMenuItems()
	PPG.Refresh()
	
def QMenuConfigurator_InspectCommand_OnClicked():
	Print("QMenuConfigurator_InspectCommand_OnClicked called", c.siVerbose)
	CurrentCommandUID = PPG.CommandList.Value
	CurrentCommand = getCommandByUID(CurrentCommandUID)
	#CurrentCommand = App.Commands(CurrentCommandName)
	#Print(CurrentCommandName)
	if CurrentCommand != None:
		if CurrentCommand.Name != "":
			App.EditCommand(CurrentCommand.Name)

def QMenuConfigurator_ExecuteCommand_OnClicked():
	Print("QMenuConfigurator_InspectCommand_OnClicked called", c.siVerbose)
	CurrentCommandUID = PPG.CommandList.Value
	CurrentCommand = getCommandByUID(CurrentCommandUID)
	#CurrentCommand = App.Commands(CurrentCommandName)
	#Print(CurrentCommandName)
	if CurrentCommand != None:
		if CurrentCommand.Name != "":
			CurrentCommand.Execute()
				
"""
def QMenuConfigurator_ConvertCommandToMenuItem_OnClicked():
	Print("QMenuConfigurator_ConvertCommandToMenuItem_OnClicked called", c.siVerbose)
	globalQMenu_MenuItems = GetGlobalObject("globalQMenu_MenuItems")
	CurrentCommandUID = PPG.CommandList.Value
	CurrentCommand = getCommandByUID(CurrentCommandUID)
	CurrentCommandName = ""
	if CurrentCommand != None:
		CurrentCommandName = CurrentCommand.Name
		if CurrentCommandName != "":
			CurrentCommand = App.Commands(CurrentCommandName)

			MenuItemCode = ""
			ArgList = list()
			if CurrentCommand != None:
				#if PPG.MenuItem_ScriptLanguage.Value == "Python": #Works only in Python for now
				MenuItemCode += ("# QMenu Automatic script conversion of command \"" + CurrentCommandName + "\" (ScriptingName: \"" + CurrentCommand.ScriptingName + "\")\n\n")
				MenuItemCode = MenuItemCode + ("Application.Commands(\"" + CurrentCommandName + "\").Execute()")
				PPG.MenuItem_ScriptLanguage.Value == "Python"
				
				NewQMenu_MenuItem = App.QMenuCreateObject("MenuItem")
				
				KnownMenuItemNames = list()
				for MenuItem in globalQMenu_MenuItems.items:
					KnownMenuItemNames.append(MenuItem.name)
				UniqueName = getUniqueName (CurrentCommandName, KnownMenuItemNames)
				NewQMenu_MenuItem.Name = UniqueName
				
				if CurrentCommand.Category != "":
					Categories = CurrentCommand.Category 
					Cat = (Categories.split("|"))
					NewQMenu_MenuItem.Category = Cat[0]
				else:
					NewQMenu_MenuItem.Category = "Custom"
				
				NewQMenu_MenuItem.language = PPG.MenuItem_ScriptLanguage.Value
				
				NewQMenu_MenuItem.code = MenuItemCode
				
				globalQMenu_MenuItems.addMenuItem(NewQMenu_MenuItem)
				RefreshMenuItem_CategoryList()
				PPG.MenuItem_Category.Value = NewQMenu_MenuItem.Category
				RefreshMenuItemList()
				PPG.MenuItemList.Value = NewQMenu_MenuItem.Name
				RefreshMenuItemDetailsWidgets()
				PPG.Refresh()
"""
						
def QMenuConfigurator_ShowHotkeyableOnly_OnChanged():
	Print("QMenuConfigurator_ShowHotkeyableOnly_OnChanged called", c.siVerbose)
	if PPG.ShowHotkeyableOnly.Value == True:
		CurrentCommandUID = PPG.CommandList.Value
		CurrentCommand = getCommandByUID(CurrentCommandUID)
		if CurrentCommand != None and CurrentCommand.SupportsKeyAssignment ==  False:
			PPG.CommandList.Value = ""
			
	RefreshCommandList()
	RefreshMenuItemDetailsWidgets()
	RefreshMenuSetDetailsWidgets()
	PPG.Refresh()
	
def QMenuConfigurator_ShowScriptingNameInBrackets_OnChanged():
	Print("QMenuConfigurator_ShowScriptingNameInBrackets_OnChanged called", c.siVerbose)
	RefreshCommandList()
	PPG.Refresh()

	
#TODO: Turn menu code execution into it's own generic function which takes the menu item and the ArgList as arguments. 
# Do the same for menu items ->Easier maintenance
def QMenuConfigurator_ExecuteCode_OnClicked():
	Print("QMenuConfigurator_ExecuteCode_OnClicked called", c.siVerbose)

	#Is a menu selected?
	if PPG.Menus.Value != "":
		oSelectedItem = getQMenu_MenuByName(PPG.Menus.Value)
		if oSelectedItem != None:
			globalQMenu_MenuItems = GetGlobalObject("globalQMenu_MenuItems")
			globalQMenu_Menus = GetGlobalObject("globalQMenu_Menus")
			globalQMenu_MenuSets = GetGlobalObject("globalQMenu_MenuSets")
			
			Language = oSelectedItem.language
			Code = oSelectedItem.code
			if Code != "":
				ArgList = [oSelectedItem, globalQMenu_MenuItems, globalQMenu_Menus, globalQMenu_MenuSets]
				try:
					App.ExecuteScriptCode(Code, Language,"QMenu_Menu_Execute", ArgList)
				except:
					Print("An Error occured executing the script code of QMenu Menu '" + oSelectedItem.name + "', please see script editor for details!", c.siError)
					raise
				return
	
	#Is a Menu Item selected?
	if PPG.MenuItemList.Value != "":
		oSelectedItem = getQMenu_MenuItemByName(PPG.MenuItemList.Value)
		if oSelectedItem != None:
			App.QMenuExecuteMenuItem(oSelectedItem )

def QMenuConfigurator_ExecuteDisplayContextCode_OnClicked():
	Print("QMenuConfigurator_ExecuteDisplayContextCode_OnClicked called", c.siVerbose)

	if PPG.MenuDisplayContexts.Value != "":
		oContext = getQMenu_MenuDisplayContextByName(PPG.MenuDisplayContexts.Value)
		if oContext != None:

			#Collect some data before we execute the context code
			SelInfo = GetGlobalObject("globalQMenuSceneSelectionDetails")

			#SelInfo.storeSelection(App.Selection) #Store the currently selected objects in the global scene delection details object -> This is already doen in the onSelectionChange callbak
			selection = Application.Selection #SelInfo.selection
			Types = SelInfo.Types
			ClassNames = SelInfo.ClassNames
			ComponentClassNames = SelInfo.ComponentClassNames
			ComponentParents = SelInfo.ComponentParents
			ComponentParentTypes = SelInfo.ComponentParentTypes
			ComponentParentClassNames = SelInfo.ComponentParentClassNames
			
			notSilent = False
			ExecuteDisplayContext (oContext, selection, Types, ClassNames, ComponentClassNames, ComponentParents, ComponentParentTypes, ComponentParentClassNames, notSilent)

def ExecuteDisplayContext (oContext, selection, Types, ClassNames, ComponentClassNames, ComponentParents,ComponentParentTypes,ComponentParentClassNames, silent):
	DisplayMenu = False #Let's assume the function will evaluate to false
	ErrorOccured = False
	if oContext != None:
		Code = oContext.code
		Language = oContext.language

		if Language == "Python":
			Code = Code + ("\nDisplayMenu = QMenuContext_Execute(selection, Types, ClassNames, ComponentClassNames, ComponentParents,ComponentParentTypes,ComponentParentClassNames)")
			try:
				exec (Code) #Execute Python code natively within the context of this function, all passed function variables are known
			except Exception as ContextError:
				Print("An Error occurred executing the QMenu_MenuDiplayContext '" + oContext.name +"', use QMenu Configurator for manual execution and debugging.", c.siError)
				DisplayMenu = False
				ErrorOccured = True
				#raise
		else: #Language is not Python, use Softimages ExecuteScriptCode Command to execute the code
			DisplayMenu = App.ExecuteScriptCode( oContext.code, Language, "QMenuContext_Execute",[selection, Types, ClassNames, ComponentClassNames, ComponentParents,ComponentParentTypes,ComponentParentClassNames]) #This function returns a variant containing the result of the executed function and...something else we don't care about 
			DisplayMenu = DisplayMenu[0]
		if silent != True: 
			if ErrorOccured == True:
				raise ContextError
			if type(DisplayMenu) != bool:
				Print("QMenu_MenuDisplayContext '" + oContext.name + "' evaluates to: " + str(DisplayMenu) + ", which is not a boolean value!", c.siWarning)
			if type(DisplayMenu) == bool:
				Print("QMenu_MenuDisplayContext '" + oContext.name + "' evaluates to: " + str(DisplayMenu))


	return DisplayMenu

def QMenuConfigurator_RemoveMenuItem_OnClicked():
	Print("QMenuConfigurator_RemoveMenuItem_OnClicked called", c.siVerbose)
	SelectedMenuItemNumber = PPG.MenuItems.Value
	oSelectedMenu = getQMenu_MenuByName(PPG.MenuChooser.Value)
	if oSelectedMenu != None:
		numItems = len(oSelectedMenu.items)
		MenuItemsEnumList = list(PPG.PPGLayout.Item("MenuItems").UIItems)

		#TODO: Make sure no duplicates are inserted (limitation of enums, they return the same number even if a different item is selected when items are named similarly :-( )

		if (SelectedMenuItemNumber > -1) and (oSelectedMenu != None):
			
			oSelectedMenu.removeMenuItemAtIndex (SelectedMenuItemNumber)
			RefreshMenuItems()
			
			if SelectedMenuItemNumber == 0: #Was the first item in the list selected and deleted?
				if numItems > 1: #Was there more than 1 item in the list?
					PPG.MenuItems.Value = 0 #Select the new first menu item in the list
				else:
					PPG.MenuItems.Value = -1 #It was the one and only menu item, select nothing
					#Print(PPG.MenuItems.Value)
			if SelectedMenuItemNumber > 0: #Some other than the first one was selected
				if SelectedMenuItemNumber == (numItems -1): #Was the last one selected?
					PPG.MenuItems.Value = (SelectedMenuItemNumber - 1) 
				else:
					PPG.MenuItems.Value = SelectedMenuItemNumber

			RefreshMenuSetDetailsWidgets()
			PPG.Refresh()
			
def QMenuConfigurator_ItemUp_OnClicked():
	Print("QMenuConfigurator_ItemUp_OnClicked called", c.siVerbose)
	oMenu = getQMenu_MenuByName(PPG.MenuChooser.Value) #Lets get the name of the menu currently selected in the menu chooser drop down list
	MenuItemIndex = PPG.MenuItems.Value #Lets get the index of the currently selected menu item of above said menu
	oMenuItem = oMenu.items[MenuItemIndex] #Get the actual menu item object from the index

	if oMenu != None and oMenuItem != None:
		if MenuItemIndex > 0:
			oMenu.removeMenuItemAtIndex(MenuItemIndex)
			oMenu.insertMenuItem(MenuItemIndex -1,oMenuItem)
			RefreshMenuItems()
			PPG.MenuItems.Value = MenuItemIndex -1
			RefreshMenuSetDetailsWidgets()
			PPG.Refresh()
						
def QMenuConfigurator_ItemDown_OnClicked():
	Print("QMenuConfigurator_ItemDown_OnClicked called", c.siVerbose)
	oMenu = getQMenu_MenuByName(PPG.MenuChooser.Value)
	MenuItemIndex = PPG.MenuItems.Value
	oMenuItem = oMenu.items[MenuItemIndex]
	if oMenu != None and oMenuItem != None:
		if MenuItemIndex != ((len(oMenu.items))-1): #If the last one's not selected..
			oMenu.removeMenuItemAtIndex(MenuItemIndex)
			oMenu.insertMenuItem(MenuItemIndex + 1,oMenuItem)
			RefreshMenuItems()
			PPG.MenuItems.Value = MenuItemIndex +1
			RefreshMenuSetDetailsWidgets()
			PPG.Refresh()

def QMenuConfigurator_FindItem_OnClicked():
	Print("QMenuConfigurator_FindItem_OnClicked called", c.siVerbose)
	oSelectedMenu = getQMenu_MenuByName(PPG.MenuChooser.Value)
	if oSelectedMenu != None:
		oSelectedItem = oSelectedMenu.items[PPG.MenuItems.Value]
		if oSelectedItem != None:
			#if oSelectedItem.type != "Separator":
			if oSelectedItem.type == "CommandPlaceholder":
				oCmd = getCommandByUID(oSelectedItem.UID)
				if len(oCmd.categories) > 0:
					PPG.CommandCategory.Value = oCmd.categories[0]
				else:
					PPG.CommandCategory.Value = "_ALL_"
				PPG.CommandFilter.Value = ""
				RefreshCommandList()
				PPG.CommandList.Value = oCmd.UID
				PPG.Menus.Value = ""
				PPG.MenuItemList.Value = ""
				RefreshMenuItemDetailsWidgets()
				
			if oSelectedItem.type == "QMenu_Menu":
				PPG.Menus.Value = oSelectedItem.name
				PPG.CommandList.Value = ""
				PPG.MenuItemList.Value = ""
				RefreshMenuItemDetailsWidgets()
				
			if oSelectedItem.type == "QMenu_MenuItem":
				PPG.MenuItem_Category.Value = oSelectedItem.category
				PPG.ShowItemType.Value = False
				RefreshMenuItemList ( )
				if oSelectedItem.name in PPG.PPGLayout.Item("MenuItemList").UIItems:
					PPG.MenuItemList.Value = oSelectedItem.name
				else:
					PPG.MenuItemList.Value = ""
				#PPG.MenuItemList.Value = oSelectedItem.name
				PPG.Menus.Value = ""
				PPG.CommandList.Value = ""
				RefreshMenuItemDetailsWidgets()

			PPG.Refresh()

def QMenuConfigurator_CtxUp_OnClicked():
	Print("QMenuConfigurator_CtxUp_OnClicked called", c.siVerbose)
	SelectedMenuSetName = PPG.MenuSets.Value
	SelectedContextName = PPG.ContextConfigurator.Value
	oMenuSet = getQMenu_MenuSetByName (SelectedMenuSetName)
	oContext = getQMenu_MenuDisplayContextByName (SelectedContextName)
	
	if ((oMenuSet != None) and (oContext != None)):

		if PPG.MenuSelector.Value == 0:
			Contexts = oMenuSet.AContexts
			Menus = oMenuSet.AMenus
			MenuList = ContextList = "A"
		if PPG.MenuSelector.Value == 1:
			Contexts = oMenuSet.BContexts
			Menus = oMenuSet.BMenus
			MenuList = ContextList = "B"
		if PPG.MenuSelector.Value == 2:
			Contexts = oMenuSet.CContexts
			Menus = oMenuSet.CMenus
			MenuList = ContextList = "C"
		if PPG.MenuSelector.Value == 3:
			Contexts = oMenuSet.DContexts
			Menus = oMenuSet.DMenus
			MenuList = ContextList = "D"
		
		ContextIndex = Contexts.index(oContext)
		if ContextIndex > 0:
			oMenu = Menus[ContextIndex]
			oMenuSet.removeContext (ContextIndex, ContextList)
			oMenuSet.insertContext (ContextIndex -1 , oContext, ContextList)
			oMenuSet.removeMenuAtIndex (ContextIndex, MenuList)
			oMenuSet.insertMenuAtIndex (ContextIndex -1, oMenu, MenuList)
			RefreshContextConfigurator()
			PPG.MenuContexts.Value = PPG.MenuContexts.Value -1
			RefreshMenuContexts()
			RefreshMenuSetDetailsWidgets()
			RefreshMenuItems()
			RefreshMenuItemDetailsWidgets()
			PPG.Refresh()
			
def QMenuConfigurator_CtxDown_OnClicked():
	Print("QMenuConfigurator_CtxDown_OnClicked called", c.siVerbose)
	SelectedMenuSetName = PPG.MenuSets.Value
	SelectedContextName = PPG.ContextConfigurator.Value
	oMenuSet = getQMenu_MenuSetByName (SelectedMenuSetName)
	oContext = getQMenu_MenuDisplayContextByName (SelectedContextName)
	
	if (oMenuSet != None) and (oContext != None):
		if PPG.MenuSelector.Value == 0:
			Contexts = oMenuSet.AContexts
			Menus = oMenuSet.AMenus
			MenuList = ContextList = "A"
		if PPG.MenuSelector.Value == 1:
			Contexts = oMenuSet.BContexts
			Menus = oMenuSet.BMenus
			MenuList = ContextList = "B"
		if PPG.MenuSelector.Value == 2:
			Contexts = oMenuSet.CContexts
			Menus = oMenuSet.CMenus
			MenuList = ContextList = "C"
		if PPG.MenuSelector.Value == 3:
			Contexts = oMenuSet.DContexts
			Menus = oMenuSet.DMenus
			MenuList = ContextList = "D"
		if Contexts != None:
			ContextIndex = Contexts.index(oContext)
			if ContextIndex < (len(Contexts) -1):
				oMenu = Menus[ContextIndex]
				oMenuSet.removeContext (ContextIndex, ContextList)
				oMenuSet.insertContext (ContextIndex +1 , oContext, ContextList)
				oMenuSet.removeMenuAtIndex (ContextIndex, MenuList)
				oMenuSet.insertMenuAtIndex (ContextIndex +1, oMenu, MenuList)
				RefreshContextConfigurator()
				PPG.MenuContexts.Value = PPG.MenuContexts.Value +1
				RefreshMenuContexts()
				RefreshMenuSetDetailsWidgets()
				RefreshMenuItems()
				RefreshMenuItemDetailsWidgets()
				PPG.Refresh()

def QMenuConfigurator_InsertSeparator_OnClicked():
	Print("QMenuConfigurator_InsertSeparator_OnClicked called", c.siVerbose)
	oCurrentMenu = getQMenu_MenuByName(PPG.MenuChooser.Value)
	oGlobalSeparators = GetGlobalObject("globalQMenuSeparators")
	oGlobalSeparator = oGlobalSeparators.items[0]
			
	if oCurrentMenu != None:
		CurrentMenuItemIndex = PPG.MenuItems.Value
		if CurrentMenuItemIndex < 0:
			CurrentMenuItemIndex  = 0
		
		oCurrentMenu.insertMenuItem (CurrentMenuItemIndex, oGlobalSeparator)		
			
		RefreshMenuItems()
		PPG.MenuItems.Value = CurrentMenuItemIndex
		RefreshMenuSetDetailsWidgets()
		PPG.Refresh()	
	
def QMenuConfigurator_Refresh_OnClicked():
	QMenuInitializeGlobals(True)
	RefreshQMenuConfigurator()
	#App.Preferences.SetPreferenceValue("QMenu.FirstStartup",False)
	PPG.Refresh()

def QMenuConfigurator_AddDisplayEvent_OnClicked():
	Print("QMenuConfigurator_AddDisplayEvent_OnClicked called", c.siVerbose)
	oGlobalQMenuDisplayEvents = GetGlobalObject("globalQMenuDisplayEvents")
	globalQMenuDisplayEvents = oGlobalQMenuDisplayEvents.items
	#Find the Display event with the highest number
	HighestNumber = (len(globalQMenuDisplayEvents)) -1
	
	oNewDisplayEvent = App.QMenuCreateObject("DisplayEvent")
	oGlobalQMenuDisplayEvents.addEvent(oNewDisplayEvent)
	RefreshDisplayEvents()
	PPG.DisplayEvent.Value = HighestNumber +1
	RefreshDisplayEventsKeys()
	
	PPG.Refresh()
	
def QMenuConfigurator_DeleteDisplayEvent_OnClicked():
	Print("QMenuConfigurator_DeleteDisplayEvent_OnClicked called", c.siVerbose)
	globalQMenuDisplayEvents = GetGlobalObject("globalQMenuDisplayEvents")
	EventIndex = PPG.DisplayEvent.Value
	oDisplayEvent = None
	globalQMenuDisplayEvents.deleteEvent(EventIndex)

	#Uncheck the record checkbox again
	PPG.DisplayEventKeys_Record.Value = False 
	App.Preferences.SetPreferenceValue("QMenu.DisplayEventKeys_Record", False)
	
	RefreshDisplayEvents()

	if EventIndex == len(globalQMenuDisplayEvents.items):
		PPG.DisplayEvent.Value = EventIndex -1
		RefreshDisplayEventsKeys()
	PPG.Refresh()
	
def QMenuConfigurator_DisplayEvent_OnChanged():
	Print("QMenuConfigurator_DisplayEvent_OnCanged", c.siVerbose)
	globalQMenuDisplayEvents = GetGlobalObject("globalQMenuDisplayEvents")

	if PPG.DisplayEvent.Value > -1:
		oSelectedEvent = globalQMenuDisplayEvents.items[PPG.DisplayEvent.Value]
	
	#Uncheck the record checkbox again
	PPG.DisplayEventKeys_Record.Value = False 
	App.Preferences.SetPreferenceValue("QMenu.DisplayEventKeys_Record", False)
	RefreshDisplayEventsKeys()
	
def QMenuConfigurator_DisplayEventKey_OnChanged():
	Print("QMenuConfigurator_DisplayEventKey_OnCanged", c.siVerbose)
	if (str(PPG.DisplayEventKey.Value) != None):
		#Print("Display event key code entered is: " + str(PPG.DisplayEventKey.Value))
		globalQMenuDisplayEvents = GetGlobalObject("globalQMenuDisplayEvents")
		try:
			oSelectedEvent = globalQMenuDisplayEvents.items[PPG.DisplayEvent.Value]
		except:
			oSelectedEvent = None
		if oSelectedEvent != None:
			oSelectedEvent.key = PPG.DisplayEventKey.Value
	
	#Uncheck the record checkbox again
	PPG.DisplayEventKeys_Record.Value = False 
	App.Preferences.SetPreferenceValue("QMenu.DisplayEventKeys_Record", False)
	RefreshDisplayEventsKeys()
	
def QMenuConfigurator_DisplayEventKeyMask_OnChanged():
	Print("QMenuConfigurator_DisplayEventKey_OnCanged", c.siVerbose)
	if (str(PPG.DisplayEventKey.Value) != None):
		globalQMenuDisplayEvents = GetGlobalObject("globalQMenuDisplayEvents")
		try:
			oSelectedEvent = globalQMenuDisplayEvents.items[PPG.DisplayEvent.Value]
		except:
			oSelectedEvent = None
		if oSelectedEvent != None:
			oSelectedEvent.keyMask = PPG.DisplayEventKeyMask.Value

	#Uncheck the record checkbox again
	PPG.DisplayEventKeys_Record.Value = False 
	App.Preferences.SetPreferenceValue("QMenu.DisplayEventKeys_Record", False)
	RefreshDisplayEventsKeys()
				
def QMenuConfigurator_DisplayEvents_OnTab():
	Print ("QMenuConfigurator_DisplayEvents_OnTab called",c.siVerbose)
	PPG.DisplayEventKeys_Record.Value = False
	PPG.RecordViewSignature.Value = False	

def QMenuConfigurator_LowLevelSettings_OnTab():
	Print ("QMenuConfigurator_LowLevelSettings_OnTab called",c.siVerbose)
	PPG.RecordViewSignature.Value = False
	PPG.DisplayEventKeys_Record.Value = False

def QMenuConfigurator_DebugOptions_OnTab():
	Print ("QMenuConfigurator_DebugOptions_OnTab called",c.siVerbose)
	PPG.RecordViewSignature.Value = False
	PPG.DisplayEventKeys_Record.Value = False

def QMenuConfigurator_MainSettings_OnTab():
	Print ("QMenuConfigurator_MeinSettings_OnTab called",c.siVerbose)
	PPG.RecordViewSignature.Value = False
	PPG.DisplayEventKeys_Record.Value = False

	
	
	
#=========================================================================================================================	
#======================================== Misc. QMenu Configurator Functions ==============================================
#=========================================================================================================================

def RefreshMenuSetDetailsWidgets():
	Print ("QMenu: RefreshMenuSetDetailsWidgets called",c.siVerbose)

	#Disable all buttons first
	PPG.MenuSetChooser.SetCapabilityFlag(c.siReadOnly, True)
	
	#PPG.QMenu_MenuA.SetCapabilityFlag (c.siReadOnly,True)
	#PPG.QMenu_MenuB.SetCapabilityFlag (c.siReadOnly,True)
	#PPG.QMenu_MenuC.SetCapabilityFlag (c.siReadOnly,True)
	#PPG.QMenu_MenuD.SetCapabilityFlag (c.siReadOnly,True)

	PPG.PPGLayout.Item("AssignMenu").SetAttribute (c.siUIButtonDisable, True)
	PPG.PPGLayout.Item("RemoveMenu").SetAttribute (c.siUIButtonDisable, True)
	
	PPG.PPGLayout.Item("ItemInsert").SetAttribute (c.siUIButtonDisable, True)
	PPG.PPGLayout.Item("InsertSeparator").SetAttribute (c.siUIButtonDisable, True)
	PPG.PPGLayout.Item("ItemUp").SetAttribute (c.siUIButtonDisable, True)
	PPG.PPGLayout.Item("ItemDown").SetAttribute (c.siUIButtonDisable, True)
	PPG.PPGLayout.Item("RemoveMenuItem").SetAttribute (c.siUIButtonDisable, True)
	PPG.PPGLayout.Item("FindItem").SetAttribute (c.siUIButtonDisable, True)

	#Start re-enabling buttons
	#Check if a view was selected:
	if PPG.View.Value != "":
		PPG.MenuSetChooser.SetCapabilityFlag(c.siReadOnly, False)
	
		#Check if a Context was selected
		if PPG.MenuSetChooser.Value != "":
			oCurrentMenuSet = getQMenu_MenuSetByName(PPG.MenuSetChooser.Value)
			if oCurrentMenuSet != None:
		

				oMenu = None
				try:
					if PPG.MenuSelector.Value == 0: oMenu = oCurrentMenuSet.AMenus[PPG.MenuContexts.Value]
					if PPG.MenuSelector.Value == 1: oMenu = oCurrentMenuSet.BMenus[PPG.MenuContexts.Value]
					if PPG.MenuSelector.Value == 2: oMenu = oCurrentMenuSet.CMenus[PPG.MenuContexts.Value]
					if PPG.MenuSelector.Value == 3: oMenu = oCurrentMenuSet.DMenus[PPG.MenuContexts.Value]
					#Print("name of the menu is: " + str(oMenu.name))
				except:
					pass
					#Print("QMenu function 'RefreshMenuSetDetailsWidgets' says: Could not determine current menu!", c.siError)
				if oMenu != None: #Is a menu assigned to the selected context?
					PPG.PPGLayout.Item("RemoveMenu").SetAttribute (c.siUIButtonDisable, False)
					if PPG.AutoSelectMenu.Value == True:
						PPG.MenuChooser.Value = oMenu.name

				if PPG.MenuContexts.Value > -1:
					if PPG.Menus.Value != "": #Is a menu selected that could be assigned to the context?
						PPG.PPGLayout.Item("AssignMenu").SetAttribute (c.siUIButtonDisable, False) #Enable the button


		#A Menu's items are currently displayed?
		if PPG.MenuChooser.Value != "":
			oCurrentMenu = getQMenu_MenuByName(PPG.MenuChooser.Value)
			if oCurrentMenu != None:
				PPG.PPGLayout.Item("InsertSeparator").SetAttribute (c.siUIButtonDisable, False)
				if (PPG.Menus.Value != "") or (PPG.MenuItemList.Value != "") or (PPG.CommandList.Value != ""): #Is some assignable item selected in one of the combo boxes?
					PPG.PPGLayout.Item("ItemInsert").SetAttribute (c.siUIButtonDisable, False) #Enable the Insert Item button again
			
			if PPG.MenuItems.Value > -1: #A menu item is currently selected?
				if oCurrentMenu != None:
					oCurrentMenuItem = None
					try:
						oCurrentMenuItem = oCurrentMenu.items[PPG.MenuItems.Value]
					except:
						pass
					if oCurrentMenuItem != None:
						PPG.PPGLayout.Item("ItemUp").SetAttribute (c.siUIButtonDisable, False)
						PPG.PPGLayout.Item("ItemDown").SetAttribute (c.siUIButtonDisable, False)
						PPG.PPGLayout.Item("RemoveMenuItem").SetAttribute (c.siUIButtonDisable, False)
						if oCurrentMenuItem.type != "Separator":
							PPG.PPGLayout.Item("FindItem").SetAttribute (c.siUIButtonDisable, False)
													
def RefreshMenuItemDetailsWidgets():
	Print("QMenu: RefreshMenuItemDetailsWidgets called", c.siVerbose)

#Disable all widgets first
	#PPG.MenuName.SetCapabilityFlag (c.siReadOnly,False)
	PPG.PPGLayout.Item("InspectCommand").SetAttribute (c.siUIButtonDisable, True)
	PPG.PPGLayout.Item("ExecuteCode").SetAttribute (c.siUIButtonDisable, True)
	#PPG.PPGLayout.Item("ConvertCommandToMenuItem").SetAttribute (c.siUIButtonDisable, True)
	PPG.PPGLayout.Item("DeleteScriptItem").SetAttribute (c.siUIButtonDisable, True)		
	PPG.PPGLayout.Item("DeleteMenu").SetAttribute (c.siUIButtonDisable, True)		
	PPG.NewMenuItem_Category.SetCapabilityFlag (c.siReadOnly,True)
	PPG.MenuItem_CategoryChooser.SetCapabilityFlag (c.siReadOnly,True)
	PPG.MenuItem_Name.SetCapabilityFlag (c.siReadOnly,True)
	PPG.MenuItem_ScriptLanguage.SetCapabilityFlag (c.siReadOnly,True)
	PPG.MenuItem_Code.SetCapabilityFlag (c.siReadOnly,True)
	PPG.MenuItem_Switch.SetCapabilityFlag (c.siReadOnly,True)
	PPG.MenuItem_IsActive.SetCapabilityFlag (c.siReadOnly,True)
	
#Empty input fields
	PPG.MenuItem_Name.Value = ""
	PPG.NewMenuItem_Category.Value = ""
	PPG.MenuItem_CategoryChooser.Value = ""
	PPG.MenuItem_Code.Value = ""
	PPG.MenuItem_ScriptLanguage.Value = ""
	PPG.MenuItem_Switch.Value = False
	PPG.MenuItem_IsActive.Value = False

					
#Check if a command was selected:
	if PPG.CommandList.Value != "":
		oItem = getCommandByUID(PPG.CommandList.Value)
		if oItem != None:
			ItemName = oItem.name
			PPG.PPGLayout.Item("InspectCommand").SetAttribute (c.siUIButtonDisable, False)
			#PPG.PPGLayout.Item("ConvertCommandToMenuItem").SetAttribute (c.siUIButtonDisable, False)
			PPG.PPGLayout.Item("ExecuteCode").SetAttribute (c.siUIButtonDisable, False)
			
			PPG.NewMenuItem_Category.Value = ""
			PPG.MenuItem_CategoryChooser.Value = ""
			PPG.MenuItem_Code.Value =  ""
		
#Check if a script item was selected:		
	if PPG.MenuItemList.Value != "":
		ItemName = PPG.MenuItemList.Value
		oItem = getQMenu_MenuItemByName(ItemName)
		if oItem != None:
			#PPG.MemuItem_CategoryChooser.Value = 
			PPG.MenuItem_Name.Value = oItem.name
			PPG.NewMenuItem_Category.Value = oItem.category
			RefreshMenuItem_CategoryChooserList()
			PPG.MenuItem_CategoryChooser.Value = oItem.category
			PPG.MenuItem_Code.Value = oItem.code
			PPG.MenuItem_ScriptLanguage.Value = oItem.language
			PPG.MenuItem_Switch.Value = oItem.switch
			
			PPG.PPGLayout.Item("ExecuteCode").SetAttribute (c.siUIButtonDisable, False)
			PPG.MenuItem_Name.SetCapabilityFlag (c.siReadOnly,False)
			PPG.NewMenuItem_Category.SetCapabilityFlag (c.siReadOnly,False)
			PPG.MenuItem_CategoryChooser.SetCapabilityFlag (c.siReadOnly,False)
			PPG.MenuItem_ScriptLanguage.SetCapabilityFlag (c.siReadOnly,False)
			PPG.MenuItem_Code.SetCapabilityFlag (c.siReadOnly,False)
			PPG.MenuItem_Switch.SetCapabilityFlag (c.siReadOnly,False)
			
			#PPG.PPGLayout.Item("CreateNewScriptItem").SetAttribute (c.siUIButtonDisable, False)
			PPG.PPGLayout.Item("DeleteScriptItem").SetAttribute (c.siUIButtonDisable, False)			

#Check if a menu was selected			
	if PPG.Menus.Value != "":
		ItemName = PPG.Menus.Value
		oItem = getQMenu_MenuByName(ItemName)
		if oItem != None:
			#PPG.PPGLayout.Item("CreateNewMenu").SetAttribute (c.siUIButtonDisable, True)
			PPG.PPGLayout.Item("DeleteMenu").SetAttribute (c.siUIButtonDisable, False)	
			PPG.MenuItem_Name.Value = oItem.name
			PPG.NewMenuItem_Category.Value = ""
			PPG.MenuItem_CategoryChooser.Value = ""
			PPG.MenuItem_ScriptLanguage.Value = ""
			PPG.MenuItem_ScriptLanguage.Value = oItem.language
			PPG.MenuItem_Code.Value = oItem.code
			PPG.MenuItem_IsActive.Value = oItem.executeCode
			
			PPG.PPGLayout.Item("DeleteMenu").SetAttribute (c.siUIButtonDisable, False)	
			PPG.PPGLayout.Item("ExecuteCode").SetAttribute (c.siUIButtonDisable, False)
			PPG.MenuItem_Name.SetCapabilityFlag (c.siReadOnly,False)
			PPG.MenuItem_ScriptLanguage.SetCapabilityFlag (c.siReadOnly,False)
			PPG.MenuItem_Code.SetCapabilityFlag (c.siReadOnly,False)
			PPG.MenuItem_IsActive.SetCapabilityFlag (c.siReadOnly,False)

def ResetToDefaultValues():
	Print("QMenu: ResetToDefaultValues called", c.siVerbose)
	PPG.QMenuConfigurationFile.Value = App.Preferences.GetPreferenceValue("QMenu.QMenuConfigurationFile")
	PPG.View.Value = ""
	PPG.CommandList.Value = "_ALL_"
	PPG.Menus.Value = ""
	PPG.MenuItem_Category.Value = "_ALL_"
	PPG.MenuItem_Switch.Value = 0
	PPG.MenuItemList.Value = "_ALL_"
	PPG.MenuItem_Code = ""
	PPG.MenuSetChooser.Value = ""
	PPG.MenuSelector.Value = 0
	PPG.MenuContexts.Value = -1
	PPG.MenuChooser.Value = ""
	PPG.AutoSelectMenu.Value = True
	PPG.MenuItems.Value = -1
	PPG.MenuItem_Name = ""
	PPG.MenuItem_Category = ""
	PPG.MenuItem_CategoryChooser = ""
	PPG.MenuItem_ScriptLanguage = ""
	PPG.CommandList.Value = ""
	PPG.Menus.Value = ""
	PPG.MenuItemList.Value = ""
	PPG.DisplayEventKeys_Record.Value = 0
	PPG.DisplayEvent.Value = -1
	
def RefreshQMenuConfigurator():
	Print("QMenu: RefreshQMenuConfigurator called", c.siVerbose)
	ResetToDefaultValues()
	RefreshMenuDisplayContextsList()
	RefreshMenuDisplayContextDetailsWidgets()
	RefreshMenuItem_CategoryList()
	RefreshMenuItemList()
	RefreshViewSelector()
	RefreshViewSignaturesList()
	RefreshViewDetailsWidgets()
	RefreshMenuSets()
	RefreshContextConfigurator()
	PPG.MenuSetName.Value = PPG.MenuSets.Value #TODO: Put this in a proper refresh function. Update: Isn't it already? 
	
	RefreshViewMenuSets()
	RefreshMenuSetChooser()
	RefreshMenuContexts()
	RefreshMenuChooser()
	RefreshMenus()
	
	RefreshCommandCategoryList()
	RefreshCommandList()
	RefreshMenuSetDetailsWidgets()
	RefreshMenuItems()
	RefreshMenuItemDetailsWidgets()
	RefreshDisplayEvents()
	RefreshDisplayEventsKeys()	
	
def RefreshMenus():
	Print("QMenu: RefreshMenus called", c.siVerbose)
	globalQMenu_Menus = GetGlobalObject("globalQMenu_Menus")
	MenuNameFilter = PPG.MenuFilter.Value
	MenusEnum = list()
	MenuNames = list()
	
	for oMenu in globalQMenu_Menus.items:
		MenuNames.append(oMenu.name)
	
	MenuNames.sort() #Sort Menu names alphabetically

	for MenuName in MenuNames:
		if MenuNameFilter != "":
			if MenuName.find (MenuNameFilter) > -1:
				MenusEnum.append("(m) " + MenuName)
				MenusEnum.append(MenuName)
		else:
			MenusEnum.append("(m) " + MenuName)
			MenusEnum.append(MenuName)
			
	
	PPG.PPGLayout.Item("Menus").UIItems = MenusEnum
	PPG.Refresh()

def RefreshMenuChooser():
	Print("QMenu: RefreshMenuChooser called", c.siVerbose)
	globalQMenu_Menus = GetGlobalObject("globalQMenu_Menus")
	MenusEnum = list()

	for oMenu in globalQMenu_Menus.items:
		MenusEnum.append(oMenu.name)
		MenusEnum.append(oMenu.name)
	
	MenusEnum.sort()
	
	PPG.PPGLayout.Item("MenuChooser").UIItems = MenusEnum
	
	#Find and select the appropriate menu name in the chooser..
	if PPG.AutoSelectMenu.Value == True:
		#PPG.MenuChooser.SetCapabilityFlag (c.siReadOnly,True)
		oCurrentMenuSet = getQMenu_MenuSetByName(PPG.MenuSetChooser.Value)
		if oCurrentMenuSet != None:
			CurrentMenus = None
			
			if PPG.MenuSelector.Value == 0: CurrentMenus = oCurrentMenuSet.AMenus
			if PPG.MenuSelector.Value == 1: CurrentMenus = oCurrentMenuSet.BMenus
			if PPG.MenuSelector.Value == 2: CurrentMenus = oCurrentMenuSet.CMenus
			if PPG.MenuSelector.Value == 3: CurrentMenus = oCurrentMenuSet.DMenus
			if CurrentMenus != None:
				oCurrentMenu = None
				try:
					oCurrentMenu = CurrentMenus[PPG.MenuContexts.Value]
				except:
					pass
				
				if oCurrentMenu != None:
					PPG.MenuChooser.Value = oCurrentMenu.name
				else:
					PPG.MenuChooser.Value = -1
		else:
			PPG.MenuChooser.Value = -1

def RefreshMenuContexts():
	Print("QMenu: RefreshMenuContexts called", c.siVerbose)
	CurrentMenuSetName = str(PPG.MenuSetChooser.Value)
	oCurrentMenuSet = None
	CurrentContexts = None
	CurrentMenus = None
	CurrentContextsEnum = list()
	
	if CurrentMenuSetName != "":
		oCurrentMenuSet = getQMenu_MenuSetByName(CurrentMenuSetName)
		if oCurrentMenuSet != None:
			if PPG.MenuSelector.Value == 0: CurrentContexts = oCurrentMenuSet.AContexts; CurrentMenus = oCurrentMenuSet.AMenus
			if PPG.MenuSelector.Value == 1: CurrentContexts = oCurrentMenuSet.BContexts; CurrentMenus = oCurrentMenuSet.BMenus
			if PPG.MenuSelector.Value == 2: CurrentContexts = oCurrentMenuSet.CContexts; CurrentMenus = oCurrentMenuSet.CMenus
			if PPG.MenuSelector.Value == 3: CurrentContexts = oCurrentMenuSet.DContexts; CurrentMenus = oCurrentMenuSet.DMenus
		
			startrange = 0
			endrange = (len(CurrentContexts))
			
			if ((CurrentContexts != None) and (CurrentMenus != None)):
				for i in range(startrange , endrange):
					ContextString = str(CurrentContexts[i].name)
					MenuString = "NONE"
					if len(CurrentMenus) > 0:
						if CurrentMenus[i] != None:
							MenuString = str(CurrentMenus[i].name)
					
					ContextAndMenuString = ("(ctx) " + ContextString + " - " + "(m) " + MenuString)
					#Print(ContextAndMenuString)
					CurrentContextsEnum.append(ContextAndMenuString)
					#CurrentContextsEnum.append(ContextAndMenuString)
					CurrentContextsEnum.append(i)
	PPG.PPGLayout.Item ("MenuContexts").UIItems = CurrentContextsEnum

	try:
		PPG.MenuContexts.Value = 0
	except:
		DoNothing = True
		
def RefreshMenuSetChooser():
	Print("QMenu: RefreshMenuSetChooser called", c.siVerbose)
	CurrentChosenMenuSetName = str(PPG.MenuSetChooser.Value)
	CurrentViewName = str(PPG.View.Value)
	oCurrentViewSignature = None
	MenuSetChooserEnum = list()
	
	if CurrentViewName != "":
		globalQMenuViewSignatures = GetGlobalObject("globalQMenuViewSignatures")
		for oViewSignature in globalQMenuViewSignatures.items:
			if oViewSignature.name == CurrentViewName:
				oCurrentViewSignature = oViewSignature
				#break
		
		if oCurrentViewSignature != None:
			MenuSets = oCurrentViewSignature.menuSets
			for oMenuSet in MenuSets:
				MenuSetChooserEnum.append("(ms-" + str(oCurrentViewSignature.menuSets.index(oMenuSet)) + ") " + oMenuSet.name)
				MenuSetChooserEnum.append(oMenuSet.name)

	PPG.PPGLayout.Item("MenuSetChooser").UIItems = MenuSetChooserEnum
	PPG.MenuSetChooser.Value = ""
	if CurrentChosenMenuSetName != "":
		if CurrentChosenMenuSetName in MenuSetChooserEnum:
			PPG.MenuSetChooser.Value = CurrentChosenMenuSetName
	if str(PPG.MenuSetChooser.Value) == "":
		if len(MenuSetChooserEnum) > 0:
			PPG.MenuSetChooser.Value = MenuSetChooserEnum[1]
					
def RefreshViewMenuSets():
	Print("QMenu: RefreshViewMenuSets called", c.siVerbose)
	globalQMenuViewSignatures = GetGlobalObject("globalQMenuViewSignatures")
	CurrentViewSignatureName = str(PPG.ViewSignatures.Value)
	oCurrentViewSignature = None
	CurrentViewMenuSets = list()
	CurrentViewMenuSetsEnum = list()
	
	if CurrentViewSignatureName == "":
		PPG.PPGLayout.Item("ViewMenuSets").UIItems = CurrentViewMenuSetsEnum
	
	if CurrentViewSignatureName != "":
		for oSignature in globalQMenuViewSignatures.items:
			if oSignature.name == CurrentViewSignatureName:
				oCurrentViewSignature = oSignature
				break
		if oCurrentViewSignature != None:
			CurrentViewMenuSets = oCurrentViewSignature.menuSets
		if (len(CurrentViewMenuSets) > 0):
			#Print(oCurrentViewSignature.name + " contains " + str(len(CurrentViewMenuSets)) +" menusets")
			for oMenuSet in CurrentViewMenuSets:
				CurrentViewMenuSetsEnum.append("(ms-" + str(oCurrentViewSignature.menuSets.index(oMenuSet)) + ") " + oMenuSet.name)
				CurrentViewMenuSetsEnum.append(oMenuSet.name)
			PPG.PPGLayout.Item("ViewMenuSets").UIItems = CurrentViewMenuSetsEnum
		else:
			PPG.PPGLayout.Item("ViewMenuSets").UIItems = CurrentViewMenuSetsEnum
				
def RefreshMenuDisplayContextsList():
	Print("QMenu: RefreshMenuDisplayContextsList called", c.siVerbose)
	globalQMenu_MenuDisplayContexts = GetGlobalObject("globalQMenu_MenuDisplayContexts")
	DisplayContextList = list()
	DisplayContextEnum = list()
	for oDisplayContext in globalQMenu_MenuDisplayContexts.items:
		DisplayContextList.append(oDisplayContext.name)

	DisplayContextList.sort()
	
	for name in DisplayContextList:
		DisplayContextEnum.append("(ctx) " + name)
		DisplayContextEnum.append(name)
		
	PPG.PPGLayout.Item("MenuDisplayContexts").UIItems = DisplayContextEnum
	
def RefreshMenuDisplayContextDetailsWidgets():
	Print("QMenu: RefreshMenuDisplayContextDetailsWidgets called", c.siVerbose)
	CurrentMenuDisplayContextName = PPG.MenuDisplayContexts.Value
	oCurrentMenuDisplayContext = None
	oCurrentMenuDisplayContext = getQMenu_MenuDisplayContextByName (CurrentMenuDisplayContextName)
	PPG.MenuDisplayContext_Name.Value = ""
	PPG.MenuDisplayContext_Code.Value = ""
	
	if oCurrentMenuDisplayContext != None:
		PPG.MenuDisplayContext_Name.Value = oCurrentMenuDisplayContext.name
		PPG.MenuDisplayContext_Code.Value = oCurrentMenuDisplayContext.code
		PPG.MenuDisplayContext_ScriptLanguage.Value = oCurrentMenuDisplayContext.language
	
def RefreshContextConfigurator():
	Print("QMenu: RefreshContextConfigurator called", c.siVerbose)
	globalQMenu_MenuSets = GetGlobalObject("globalQMenu_MenuSets")
	
	oCurrentMenuSet = None
	CurrentContexts = None
	CurrentContextsEnum = list()
	currentMenuSetName = PPG.MenuSets.Value
	for oMenuSet in globalQMenu_MenuSets.items:
		if oMenuSet.name == currentMenuSetName:
			oCurrentMenuSet = oMenuSet
	
	if oCurrentMenuSet != None:
		if PPG.MenuSelector.Value == 0: CurrentContexts = oCurrentMenuSet.AContexts
		if PPG.MenuSelector.Value == 1: CurrentContexts = oCurrentMenuSet.BContexts
		if PPG.MenuSelector.Value == 2: CurrentContexts = oCurrentMenuSet.CContexts
		if PPG.MenuSelector.Value == 3: CurrentContexts = oCurrentMenuSet.DContexts
	
	if CurrentContexts != None:
		for oContext in CurrentContexts:
			CurrentContextsEnum.append("(ctx) " + oContext.name)
			CurrentContextsEnum.append(oContext.name)
	PPG.PPGLayout.Item ("ContextConfigurator").UIItems = CurrentContextsEnum
				
def RefreshViewSignaturesList():
	Print("QMenu: RefreshViewSignaturesList called", c.siVerbose)
	globalQMenuViewSignatures = GetGlobalObject("globalQMenuViewSignatures")
	viewSignatureNameListEnum = list()
	
	for signature in globalQMenuViewSignatures.items:
		viewSignatureNameListEnum.append("(v) " + signature.name)
		viewSignatureNameListEnum.append(signature.name)
	
	
	PPG.PPGLayout.Item ("ViewSignatures").UIItems = viewSignatureNameListEnum
	if len(viewSignatureNameListEnum) == 0:
		PPG.ViewSignatures.Value = ""
	PPG.Refresh()

def RefreshViewDetailsWidgets():
	Print("QMenu: RefreshViewDetailsWidgets called", c.siVerbose)
	CurrentViewName = PPG.ViewSignatures.Value
	#Disable all the view editing widgets first
	PPG.ViewSignatureName.SetCapabilityFlag(c.siReadOnly, True)
	PPG.ViewSignature.SetCapabilityFlag(c.siReadOnly, True)
	PPG.RecordViewSignature.SetCapabilityFlag(c.siReadOnly, True)
	PPG.PPGLayout.Item("AddQMenuViewSignature").SetAttribute (c.siUIButtonDisable, False)
	PPG.PPGLayout.Item("DelQMenuViewSignature").SetAttribute (c.siUIButtonDisable, True)
	
	if CurrentViewName != "":
		oCurrentView = getQMenu_ViewSignatureByName(CurrentViewName)
		if oCurrentView != None:
			#Re-enable all the view editing widgets
			PPG.ViewSignatureName.SetCapabilityFlag(c.siReadOnly, False)
			PPG.ViewSignature.SetCapabilityFlag(c.siReadOnly, False)
			PPG.RecordViewSignature.SetCapabilityFlag(c.siReadOnly, False)
			PPG.PPGLayout.Item("AddQMenuViewSignature").SetAttribute (c.siUIButtonDisable, False)
			PPG.PPGLayout.Item("DelQMenuViewSignature").SetAttribute (c.siUIButtonDisable, False)
			PPG.RecordViewSignature.Value = False
			PPG.ViewSignatureName.Value = oCurrentView.name
			PPG.ViewSignature.Value = oCurrentView.signature
	else:
		PPG.ViewSignatureName.Value = ""
		PPG.ViewSignature.Value = ""
		
def RefreshCommandCategoryList():
	Print("QMenu: RefreshCommandCategoryList called", c.siVerbose)
	CommandCategoriesSet = set() #Create a set for command categories (we don't want duplicates)
	CommandCategoriesList = list()
	CommandCategoriesEnum = list()

	for Command in App.Commands:
		for Category in Command.Categories:
			CommandCategoriesSet.add(Category)

	CommandCategoriesList = list(CommandCategoriesSet)
	CommandCategoriesList.sort()
	CommandCategoriesEnum.append("_ALL_")
	CommandCategoriesEnum.append("_ALL_")

	for Category in CommandCategoriesList:
		CommandCategoriesEnum.append(Category)
		CommandCategoriesEnum.append(Category)

	PPG.PPGLayout.Item ("CommandCategory").UIItems = CommandCategoriesEnum #Populate the ListControl with the known Command Categories 

def RefreshViewSelector():
	Print("QMenu: RefreshViewSelector called", c.siVerbose)

	CurrentViewName = PPG.View.Value
	CurrentViewSignature = ""
	oCurrentView = None
	globalQMenuViewSignatures = GetGlobalObject("globalQMenuViewSignatures")
	viewSelectorEnumList = list()
	KnownViews = globalQMenuViewSignatures.items
	FirstKnownViewName = ""
	
	#Refresh the view selector list box
	for view in KnownViews:
		viewSelectorEnumList.append(view.name)
		viewSelectorEnumList.append(view.name)
	
	if len(KnownViews) > 0:
		FirstKnownViewName = str(KnownViews[0].name)

		PPG.PPGLayout.Item("View").UIItems = viewSelectorEnumList
		#PPG.ViewSignatureName.Value = CurrentViewName
		#PPG.ViewSignature.Value = CurrentViewSignature
		if str(CurrentViewName) == "":
			PPG.View.Value = str(FirstKnownViewName)
	else:
		PPG.PPGLayout.Item("View").UIItems = viewSelectorEnumList
		PPG.View.Value = ""
				
def RefreshMenuItem_CategoryList():
	Print("QMenu: RefreshMenuItem_CategoryList called",c.siVerbose)
	listMenuItemCategories = list()
	listMenuItemCategoriesEnum = list()
	globalQMenu_MenuItems = GetGlobalObject("globalQMenu_MenuItems")
	#Print ("globalQMenu_MenuItems knows those menuItems: " + str(globalQMenu_MenuItems.items))
	
	for menuItem in globalQMenu_MenuItems.items:
		listMenuItemCategories.append (menuItem.category)
	
	listMenuItemCategories = list(set(listMenuItemCategories))
	listMenuItemCategories.sort()

	listMenuItemCategoriesEnum.append("_ALL_")
	listMenuItemCategoriesEnum.append("_ALL_")

	for Category in listMenuItemCategories:
		listMenuItemCategoriesEnum.append(Category)
		listMenuItemCategoriesEnum.append(Category)

	PPG.PPGLayout.Item ("MenuItem_Category").UIItems = listMenuItemCategoriesEnum #Populate the ListControl with the known MenuItemCategories
	PPG.MenuItem_Category.Value = "_ALL_"

def RefreshMenuItem_CategoryChooserList(): #This refreshes the widget that lets you change a QMenu script item's category
	Print("QMenu: RefreshMenuItem_CategoryChooserList called",c.siVerbose)
	globalQMenu_MenuItems = GetGlobalObject("globalQMenu_MenuItems")
	
	listMenuItemCategories = list()
	listMenuItemCategoriesEnum = list()

	for menuItem in globalQMenu_MenuItems.items:
		listMenuItemCategories.append (menuItem.category)
	
	listMenuItemCategories = list(set(listMenuItemCategories)) #get rid of duplicates
	listMenuItemCategories.sort()


	for Category in listMenuItemCategories:
		listMenuItemCategoriesEnum.append(Category)
		listMenuItemCategoriesEnum.append(Category)

	PPG.PPGLayout.Item ("MenuItem_CategoryChooser").UIItems = listMenuItemCategoriesEnum #Populate the ListControl with the known MenuItemCategories
		
def RefreshMenuItems():
	Print ("QMenu: RefreshMenuItems called",c.siVerbose)
	globalQMenu_Menus = GetGlobalObject("globalQMenu_Menus")
	CurrentMenuItemNumber= str(PPG.MenuItems.Value)
	CurrentMenuName = str(PPG.MenuChooser.Value)
	listMenuItemsEnum = list()
	oCurrentMenu = None
	oCurrentMenu = getQMenu_MenuByName(CurrentMenuName)
	
	if oCurrentMenu != None:
		listMenuItems = oCurrentMenu.items
		Counter = 0
		for oItem in listMenuItems:
			prefix = "      "
			if str(oItem.type) == "CommandPlaceholder" or str(oItem.type) == "MissingCommand":
				prefix = "(c)  "
			if str(oItem.type) == "QMenu_MenuItem":
				if oItem.switch:
					prefix = "(sw)  "
				else:
					prefix = "(s)  "
			if str(oItem.type) == "QMenu_Menu":
				prefix = "(m) "
			MissingName = ("_DELETED ITEM_")
			if oItem.name == "":
				NameInList = (prefix + MissingName)
			else:
				NameInList = (prefix + oItem.name)
			if oItem.type == "QMenuSeparator":
				NameInList = "------------------"
			
			#Append items with similar names with a whitespace to keep the names unique in the enum
			while NameInList in listMenuItemsEnum:
				#Print(NameInList + " already exists, adding whitespace")
				NameInList = NameInList + " "
			listMenuItemsEnum.append (NameInList )
			listMenuItemsEnum.append (Counter)
			Counter += 1
				
		PPG.PPGLayout.Item("MenuItems").UIItems = listMenuItemsEnum
	else:
		PPG.PPGLayout.Item("MenuItems").UIItems = list()
	
	if not(CurrentMenuItemNumber in listMenuItemsEnum):
		PPG.MenuItems.Value = -1

def RefreshMenuSets():
	Print ("QMenu: RefreshMenuSets called",c.siVerbose)
	globalQMenu_MenuSets = GetGlobalObject("globalQMenu_MenuSets")
	MenuSetsNameList = list()
	MenuSetsNameListEnum = list()
	
	for oSet in globalQMenu_MenuSets.items:
		MenuSetsNameList.append(oSet.name)
	
	MenuSetsNameList.sort()
	
	for SetName in MenuSetsNameList:
		MenuSetsNameListEnum.append("(ms) " + SetName)
		MenuSetsNameListEnum.append(SetName)
	
	PPG.PPGLayout.Item ("MenuSets").UIItems = MenuSetsNameListEnum
			
def RefreshMenuItemList():
	Print("QMenu: RefreshMenuItemList called",c.siVerbose)
	globalQMenu_MenuItems = GetGlobalObject("globalQMenu_MenuItems")
	listKnownMenuItems = list(globalQMenu_MenuItems.items)
	
	listMenuItem_Names = list()
	listMenuItem_NamesEnum = list()
	
	
	MenuItem_Category =  (PPG.MenuItem_Category.Value) #Get the currently selected menu item category value from the category selector in the PPG's UI

	for menuItem in listKnownMenuItems:
		if MenuItem_Category == "_ALL_" or menuItem.category == MenuItem_Category:
			listMenuItem_Names.append(menuItem.name)
	
	listMenuItem_Names.sort()
	menuItem = None		
	
	TypeToList = PPG.ShowItemType.Value
	
	for menuItemName in listMenuItem_Names:
		menuItem = getQMenu_MenuItemByName(menuItemName)
		
		if TypeToList == 0:
			if menuItem.switch == True:
				listMenuItem_NamesEnum.append("(sw) " + menuItemName)
				listMenuItem_NamesEnum.append(menuItemName)
			else:
				listMenuItem_NamesEnum.append("(s) " + menuItemName)
				listMenuItem_NamesEnum.append(menuItemName)
				
		elif TypeToList == 1 and menuItem.switch == True:
			listMenuItem_NamesEnum.append("(sw) " + menuItemName)
			listMenuItem_NamesEnum.append(menuItemName)
		elif TypeToList == 2:
			listMenuItem_NamesEnum.append("(s) " + menuItemName)
			listMenuItem_NamesEnum.append(menuItemName)
			
	PPG.PPGLayout.Item ("MenuItemList").UIItems = listMenuItem_NamesEnum
	
def RefreshCommandList():
	Print("QMenu: RefreshCommandList called",c.siVerbose)
	CommandListEnum = list()
	ComCatName = PPG.CommandCategory.Value
	OnlyHotkeyable = PPG.ShowHotkeyableOnly.Value
	ShowScriptingName = PPG.ShowScriptingNameInBrackets.Value
	CommandListStorage = list()
	
	if ComCatName == "_ALL_":
		for Command in App.Commands:
			if Command.Name != "": #We don't list commands with empty names
				if OnlyHotkeyable == True: #Show only hotkeyable commands
					if Command.SupportsKeyAssignment == True:
						CommandEntry = Command.Name
						if ShowScriptingName == True:
							ScriptingNameString = " (" + Command.ScriptingName + ")"
							CommandEntry = CommandEntry  + ScriptingNameString
						CommandList = list()
						CommandList.append(CommandEntry)
						CommandList.append(Command.UID)
						CommandListStorage.append(CommandList)


				else: #Also show non-hotkeyable commands
					CommandEntry = Command.Name
					if ShowScriptingName == True:
						ScriptingNameString = " (" + Command.ScriptingName + ")"
						CommandEntry = CommandEntry  + ScriptingNameString
						
					CommandList = list()
					CommandList.append(CommandEntry)
					CommandList.append(Command.UID)
					CommandListStorage.append(CommandList)
				

	else: #We are listing commands of a specific category...
		FilteredCommands = App.Commands.Filter(ComCatName)
		#Print("Filtered commands found: " + str(len(FilteredCommands)))
		for Command in FilteredCommands:	
			if Command.Name != "":
				#CommandEntry = "None"
				if OnlyHotkeyable == True:
					if Command.SupportsKeyAssignment == True:
						CommandEntry = Command.Name
						if ShowScriptingName == True:
							ScriptingNameString = " (" + Command.ScriptingName + ")"
							CommandEntry = CommandEntry  + ScriptingNameString
						
						CommandList = list()
						CommandList.append(CommandEntry)
						CommandList.append(Command.UID)
						CommandListStorage.append(CommandList)
							
				else:
					CommandEntry = Command.Name
					if ShowScriptingName == True:
						ScriptingNameString = " (" + Command.ScriptingName + ")"
						CommandEntry = CommandEntry  + ScriptingNameString
							
					CommandList = list()
					CommandList.append(CommandEntry)
					CommandList.append(Command.UID)
					CommandListStorage.append(CommandList)

	CommandListStorage.sort()
	
	strCommandFilter = PPG.CommandFilter.Value
	for oEntry in CommandListStorage:
		NameInList = oEntry[0]
		GUID = oEntry[1]
		while NameInList in CommandListEnum: #Some softimage commands appear more than once with the same name, we need to make sure that the name is unique in the list, so we add spaces
				NameInList = NameInList + " "
		if strCommandFilter != "": #Filter for commands containing the search string
			if NameInList.find(strCommandFilter) > -1:
				CommandListEnum.append("(c) " + NameInList) #Mark item as command by prefixing it with (c) and add the uique name to it
				CommandListEnum.append(GUID) #Append with the GUID
		else: #We are not filtering command names, just append the item to the list
			CommandListEnum.append("(c) " + NameInList) #Append name
			CommandListEnum.append(GUID) #Append GUID
	
	PPG.PPGLayout.Item ("CommandList").UIItems = CommandListEnum
	
def RefreshDisplayEventsKeys():
	Print("QMenu: RefreshDisplayEventsKeys called", c.siVerbose)
	globalQMenuDisplayEvents = GetGlobalObject("globalQMenuDisplayEvents").items
	if len(globalQMenuDisplayEvents) > 0:
		oSelectedEvent = globalQMenuDisplayEvents[PPG.DisplayEvent.Value]
	else:
		#Print("An error occured trying to determine currently selected event...")
		oSelectedEvent = None
	
	if oSelectedEvent != None:
		#Print("Selected event is not None...")
		PPG.DisplayEventKey.Value = oSelectedEvent.key
		PPG.DisplayEventKeyMask.Value = oSelectedEvent.keyMask
		
		PPG.DisplayEventKey.SetCapabilityFlag (c.siReadOnly,False)
		PPG.DisplayEventKeyMask.SetCapabilityFlag (c.siReadOnly,False)
		PPG.DisplayEventKeys_Record.SetCapabilityFlag (c.siReadOnly,False)
				
	else:
		PPG.DisplayEventKey.Value = 0
		PPG.DisplayEventKeyMask = 0
		
		PPG.DisplayEventKey.SetCapabilityFlag (c.siReadOnly,True)
		PPG.DisplayEventKeyMask.SetCapabilityFlag (c.siReadOnly,True)
		PPG.DisplayEventKeys_Record.SetCapabilityFlag (c.siReadOnly,True)

def RefreshDisplayEvents():
	Print("QMenu: RefreshDisplayEvents called", c.siVerbose)
	globalQMenuDisplayEvents = GetGlobalObject("globalQMenuDisplayEvents").items
	DisplayEventsEnumList = list()
	Counter = 0
	for oDisplayEvent in globalQMenuDisplayEvents:
		DisplayEventsEnumList.append ("Display QMenu Menu Set " + str(Counter))
		DisplayEventsEnumList.append (Counter)
		Counter +=1
	
	PPG.PPGLayout.Item("DisplayEvent").UIItems = DisplayEventsEnumList
	if len(globalQMenuDisplayEvents) == 0:
		PPG.DisplayEvent.Value = -1
	
def QMenuSaveConfiguration(fileName):
	Print("QMenu: QMenuSaveConfiguration called", c.siVerbose)
	
	#Lets check if the path exists
	folderName = os.path.dirname (fileName) #.rsplit("\\")
	if os.path.exists(folderName):
		if os.path.isfile(fileName) == True: #Does the file already exist? Lets make a backup copy with timestamp first
			#timestring = time.strftime ("_%Y.%M.%d_%H.%M.%S")
			fileData = os.stat(fileName) #get some file information, including last changed date and time, which we will use to create a unique backup file name
			changeDate = time.localtime(fileData.st_atime) #Get a readable form of the file change date 
			fileNameSansExtension = fileName.rsplit(".",1)[0]
			timestring = ("_" + str(changeDate.tm_year) + "." + str(changeDate.tm_mon) + "." + str(changeDate.tm_mday) + "_" + str(changeDate.tm_hour) + "." + str(changeDate.tm_min) + "." + str(changeDate.tm_sec))
			try:
				backupFileName = (fileNameSansExtension + timestring + ".xml")
				Print("Saving current QMenu configuration backup as " + backupFileName)
				os.rename(fileName, (fileNameSansExtension + timestring + ".xml"))
			except:
				Print("Current Qmenu configuration backup file could not be created - attempting to overwrite...",c.siWarning)
			globalQMenu_MenuItems = GetGlobalObject("globalQMenu_MenuItems").items
			globalQMenu_Menus = GetGlobalObject("globalQMenu_Menus").items
			globalQMenu_MenuSets = GetGlobalObject("globalQMenu_MenuSets").items
			globalQMenu_MenuDisplayContexts = GetGlobalObject("globalQMenu_MenuDisplayContexts").items
			globalQMenuViewSignatures = GetGlobalObject("globalQMenuViewSignatures").items
			globalQMenuDisplayEvents = GetGlobalObject("globalQMenuDisplayEvents").items

			oConfigDoc = DOM.Document()
			RootNode = oConfigDoc.createElement("QMenuComponents") #Create Root level node
			oConfigDoc.appendChild(RootNode)

			#VersionNode = oConfigDoc.createElement("QMenu_Version")
			RootNode.setAttribute("QMenu_Version", (str(Application.Plugins("QMenuConfigurator").Major) + "." +str(Application.Plugins("QMenuConfigurator").Minor)))
			
			MenuItemsNode = oConfigDoc.createElement("QMenu_MenuItems")
			RootNode.appendChild(MenuItemsNode)
			MenusNode = oConfigDoc.createElement("QMenu_Menus")
			RootNode.appendChild(MenusNode)
			MenuSetsNode = oConfigDoc.createElement("QMenu_MenuSets")
			RootNode.appendChild(MenuSetsNode)
			MenuDisplayContextsNode = oConfigDoc.createElement("QMenu_MenuDisplayContexts")
			RootNode.appendChild(MenuDisplayContextsNode)
			ViewsNode = oConfigDoc.createElement("QMenuViewSignatures")
			RootNode.appendChild(ViewsNode)
			DisplayEventsNode = oConfigDoc.createElement("QMenuDisplayEvents")
			RootNode.appendChild(DisplayEventsNode)

		# === Save Menu Items ===	
			for oMenuItem in globalQMenu_MenuItems:
				MenuItemNode = oConfigDoc.createElement("QMenu_MenuItem")
				MenuItemNode.setAttribute("UID", oMenuItem.UID)
				MenuItemNode.setAttribute("name", oMenuItem.name)
				MenuItemNode.setAttribute("type", oMenuItem.type)
				MenuItemNode.setAttribute("category", oMenuItem.category)
				MenuItemNode.setAttribute("language", oMenuItem.language)
				if oMenuItem.switch:
					MenuItemNode.setAttribute("switch", "True")
				else:
					MenuItemNode.setAttribute("switch", "False")
				
				oMenuItemCode = oConfigDoc.createTextNode (oMenuItem.code)
				if oMenuItem.code == "": oMenuItemCode.nodeValue = " "
				MenuItemNode.appendChild(oMenuItemCode)
				
				#Test setting code as an attribute...
				#MenuItemNode.setAttribute("code", oMenuItem.code)
				MenuItemsNode.appendChild(MenuItemNode)	
			
		# === Save Menus ===
			for oMenu in globalQMenu_Menus:
				MenuNode = oConfigDoc.createElement("QMenu_Menu")
				MenuNode.setAttribute("name", str(oMenu.name))
				MenuNode.setAttribute("type", oMenu.type)
				MenuNode.setAttribute("language", oMenu.language)
				if oMenu.executeCode == True:
					MenuNode.setAttribute("executeCode", "True")
				if oMenu.executeCode == False:
					MenuNode.setAttribute("executeCode", "False")
					
				oMenuCode = oConfigDoc.createTextNode (oMenu.code)
				#oMenuCode.nodeValue = str(oMenu.code)
				if oMenu.code == "": oMenuCode.nodeValue = " "
				MenuNode.appendChild(oMenuCode)	
				
				MenuItems = getattr(oMenu, "items")
				NameList = list()
				for MenuItem in MenuItems:
					if MenuItem.type == "MissingCommand":
						NameList.append("Command")
					elif MenuItem.type == "CommandPlaceholder":
						NameList.append("Command")
					else:
						NameList.append(str(MenuItem.type)) #Finally this could only be a command or a scripted menu item
					NameList.append(str(MenuItem.name))
					NameList.append(str(MenuItem.UID))
				
				MenuItemsNames = ListToString(NameList)
				MenuNode.setAttribute("items", MenuItemsNames)
				MenusNode.appendChild(MenuNode)
			
		# === Save Menu Sets ===
			for oMenuSet in globalQMenu_MenuSets:
				MenuSetNode = oConfigDoc.createElement("QMenu_MenuSet")
				MenuSetNode.setAttribute("name", oMenuSet.name)
				MenuSetNode.setAttribute("type", oMenuSet.type)
				
				Attributes = ["AMenus","AContexts","BMenus","BContexts","CMenus","CContexts","DMenus","DContexts"]
				for Attr in Attributes:
					AttrList = list()
					oItems = getattr(oMenuSet, Attr)
					#Print(Attr + ": " + str(oItems))
					for oItem in oItems:
						if oItem != None:
							AttrList.append (str(oItem.name))
						else:
							AttrList.append("None")
					AttrString = ListToString(AttrList)
					#Print(AttrString)
					MenuSetNode.setAttribute(Attr, AttrString)
				MenuSetsNode.appendChild(MenuSetNode)
		
		# === Save Menu Contexts ===
			for oDisplayContext in globalQMenu_MenuDisplayContexts:
				DisplayContextNode = oConfigDoc.createElement("QMenu_MenuDisplayContext")
				DisplayContextNode.setAttribute("name", oDisplayContext.name)
				DisplayContextNode.setAttribute("type", oDisplayContext.type)
				DisplayContextNode.setAttribute("language", oDisplayContext.language)
				#DisplayContextNode.setAttribute("code", str(oDisplayContext.code))	
				
				
				oDisplayContextCode = oConfigDoc.createTextNode (oDisplayContext.code)
				if oDisplayContext.code == "": oDisplayContextCode.nodeValue = " "
				DisplayContextNode.appendChild(oDisplayContextCode)
				MenuDisplayContextsNode.appendChild(DisplayContextNode)
			
		# === Save View Signatures ===
			for oSignature in globalQMenuViewSignatures:
				ViewSignatureNode = oConfigDoc.createElement("QMenuViewSignature")
				ViewSignatureNode.setAttribute("name",oSignature.name)
				ViewSignatureNode.setAttribute("type", oSignature.type)
				ViewSignatureNode.setAttribute("signature", str(oSignature.signature))
				MenuSetNames = list()
				for MenuSet in oSignature.menuSets:
					MenuSetNames.append(MenuSet.name)
				MenuSetNamesString = ListToString(MenuSetNames)
				
				ViewSignatureNode.setAttribute("menuSets", MenuSetNamesString)
				ViewsNode.appendChild(ViewSignatureNode)

		# === Save Display Events ===
			for oDisplayEvent in globalQMenuDisplayEvents:
				#Print("Saving Display events")
				DisplayEventNode = oConfigDoc.createElement("QMenuDisplayEvent")
				DisplayEventNode.setAttribute("number", str(oDisplayEvent.number))
				DisplayEventNode.setAttribute("type", oDisplayEvent.type)
				DisplayEventNode.setAttribute("key", str(oDisplayEvent.key))
				DisplayEventNode.setAttribute("keyMask", str(oDisplayEvent.keyMask))
				DisplayEventsNode.appendChild(DisplayEventNode)	
				#Print("\nDisplayeventsnode with number " + str(oDisplayEvent.number) + " saved\n")

			#Finally write out the whole configuration document as an xml file
			try:
				ConfigDocFile = open(fileName,"w")
				oConfigDoc.writexml(ConfigDocFile,indent = "",addindent = "", newl = "")
				ConfigDocFile.close()
				return True
			except:
				return False
	else:
		Print("Cannot save QMenu Configuration to '" + fileName + "' because the folder does not exist. Please correct the file path and try again.", c.siError)
		
def QMenuLoadConfiguration(fileName):
	Print("QMenu: QMenuLoadConfiguration called", c.siVerbose)

	if fileName != "":
		if os.path.isfile(fileName) == True:
			QMenuConfigFile = DOM.parse(fileName)
			#In case the file could be loaded and parsed we can destroy the existing configuration in memory and refill it with the new data from the file
			QMenuInitializeGlobals(True)
			globalQMenuSeparators = GetGlobalObject("globalQMenuSeparators")
			globalQMenu_MenuItems = GetGlobalObject("globalQMenu_MenuItems")
			globalQMenu_Menus = GetGlobalObject("globalQMenu_Menus")
			globalQMenu_MenuSets = GetGlobalObject("globalQMenu_MenuSets")
			globalQMenu_MenuDisplayContexts = GetGlobalObject("globalQMenu_MenuDisplayContexts")
			globalQMenuViewSignatures = GetGlobalObject("globalQMenuViewSignatures")
			globalQMenuDisplayEvents = GetGlobalObject("globalQMenuDisplayEvents")
			
		#=== Start creating QMenu objects from the file data ===
			Components = QMenuConfigFile.getElementsByTagName("QMenuComponents")

			for Component in Components[0].childNodes:
				if Component.localName == "QMenu_MenuItems":
					QMenu_MenuItems = Component.childNodes
					for MenuItem in QMenu_MenuItems:
						if str(MenuItem.localName) != "None":
							#Print("MenuItemLocalName is: " + MenuItem.localName)
							NewMenuItem = App.QMenuCreateObject("MenuItem")
							NewMenuItem.name = MenuItem.getAttribute("name")
							NewMenuItem.category = MenuItem.getAttribute("category")
							NewMenuItem.language = MenuItem.getAttribute("language")
							if MenuItem.getAttribute("switch") == "True":
								NewMenuItem.switch = True
							
							CodeNode = MenuItem.childNodes[0]
							if CodeNode.nodeValue != " ":
								NewMenuItem.code = CodeNode.nodeValue
							
							#Test reading code from code attribute
							#NewMenuItem.code = MenuItem.getAttribute("code")
	
							globalQMenu_MenuItems.addMenuItem(NewMenuItem)

			for Component in Components[0].childNodes:			
				if Component.localName == "QMenu_Menus":
					QMenu_Menus = Component.childNodes
					#Create all menus first to avoid a race condition (menus can contain other menus)
					for Menu in QMenu_Menus: 
						if str(Menu.localName) != "None":
							#Print("MenuLocalName is: " + Menu.localName)
							oNewMenu = App.QMenuCreateObject("Menu")
							globalQMenu_Menus.addMenu(oNewMenu)
							oNewMenu.name = Menu.getAttribute("name")
							oNewMenu.language = Menu.getAttribute("language")
							executeCode = Menu.getAttribute("executeCode")
							if executeCode == "True":
								oNewMenu.executeCode = True
							if executeCode == "False":
								oNewMenu.executeCode = False
							CodeNode = Menu.childNodes[0]
							if CodeNode.nodeValue != " ":
								oNewMenu.code = CodeNode.nodeValue
					
					#Then fill the menus with menu items, menus, commands and separators
					for Menu in QMenu_Menus: 
						if str(Menu.localName) != "None":
							oNewMenu = getQMenu_MenuByName(Menu.getAttribute("name"))
							MenuItemNames = str(Menu.getAttribute("items"))
							#Print ("MenuItems are:"  + str(MenuItemNames))
							MenuItemNamesList = MenuItemNames.split(";")
							i = 0
							while i < (len(MenuItemNamesList)-1):
								if MenuItemNamesList[i] == "QMenu_MenuItem":
									oMenuItem = getQMenu_MenuItemByName(MenuItemNamesList[i+1])
									if oMenuItem != None:
										oNewMenu.insertMenuItem (len(oNewMenu.items), oMenuItem)
								if MenuItemNamesList[i] == "QMenu_Menu":
									oMenuItem = getQMenu_MenuByName(MenuItemNamesList[i+1])
									if oMenuItem != None:
										oNewMenu.insertMenuItem (len(oNewMenu.items), oMenuItem)
								if MenuItemNamesList[i] == "Command":
									oMenuItem = App.Commands(MenuItemNamesList[i+1]) #Get Command by name
									#oMenuItem = getCommandByUID(MenuItemNamesList[i+2]) #Get Command by UID through a Python function, which is slower but safer
									#oMenuItem = App.GetCommandByUID(MenuItemNamesList[i+2]) #Get Command by UID through custom c++ command, which is much faster than Python but still slow
									
									if oMenuItem != None:
										oDummyCmd = App.QMenuCreateObject("CommandPlaceholder")
										oDummyCmd.name = (MenuItemNamesList[i+1])
										
										oDummyCmd.UID = (MenuItemNamesList[i+2])
										oNewMenu.insertMenuItem (len(oNewMenu.items), oDummyCmd)
									else: #Command could not be found? Insert Dummy command instead, it might become available at a later session
										#Print("A command named '" + str(MenuItemNamesList[i+1]) + "' could not be found!", c.siWarning)
										oMissingCmd = App.QMenuCreateObject("MissingCommand")
										oMissingCmd.name = (MenuItemNamesList[i+1])
										
										oMissingCmd.UID = (MenuItemNamesList[i+2])
										oNewMenu.insertMenuItem (len(oNewMenu.items), oMissingCmd)
										
								if MenuItemNamesList[i] == "QMenuSeparator":
									oMenuItem = getQMenuSeparatorByName(MenuItemNamesList[i+1])
									if oMenuItem != None:
										oNewMenu.insertMenuItem (len(oNewMenu.items), oMenuItem)
								i = i+3 #Increase counter by 3 to get to the next item (we save 3 properties per item: type, name, UID)
				
			for Component in Components[0].childNodes:
				if Component.localName == "QMenu_MenuDisplayContexts":
					QMenuContexts = Component.childNodes
					for Context in QMenuContexts:
						if str(Context.localName) == "QMenu_MenuDisplayContext":
							oNewContext = App.QMenuCreateObject("MenuDisplayContext")
							oNewContext.name = Context.getAttribute("name")
							oNewContext.language = Context.getAttribute("language")
							CodeNode = Context.childNodes[0]
							if CodeNode.nodeValue != " ":
								oNewContext.code = CodeNode.nodeValue
							result = globalQMenu_MenuDisplayContexts.addContext(oNewContext)

								
			for Component in Components[0].childNodes:
				if Component.localName == "QMenu_MenuSets":
					QMenu_MenuSets = Component.childNodes
					for Set in QMenu_MenuSets:
						if str(Set.localName) == ("QMenu_MenuSet"):
							oNewMenuSet = App.QMenuCreateObject("MenuSet")
							oNewMenuSet.name = Set.getAttribute("name")
							
							AContextNames = ((Set.getAttribute("AContexts")).split(";"))
							AMenuNames = ((Set.getAttribute("AMenus")).split(";"))

							if len(AContextNames) == len(AMenuNames):
								for AContextName in AContextNames:
									oAContext = getQMenu_MenuDisplayContextByName(str(AContextName))
									if oAContext != None:
										ContextIndex = AContextNames.index(AContextName)
										AMenuName = AMenuNames[ContextIndex]
										oAMenu = getQMenu_MenuByName(AMenuName)
										oNewMenuSet.insertContext (len(oNewMenuSet.AContexts), oAContext, "A")
										oNewMenuSet.insertMenuAtIndex (len(oNewMenuSet.AMenus), oAMenu, "A")
							
							BContextNames = ((Set.getAttribute("BContexts")).split(";"))
							BMenuNames = ((Set.getAttribute("BMenus")).split(";"))

							if len(BContextNames) == len(BMenuNames):
								for BContextName in BContextNames:
									oBContext = getQMenu_MenuDisplayContextByName(str(BContextName))
									if oBContext != None:
										ContextIndex = BContextNames.index(BContextName)
										BMenuName = BMenuNames[ContextIndex]
										oBMenu = getQMenu_MenuByName(BMenuName)
										oNewMenuSet.insertContext (len(oNewMenuSet.BContexts), oBContext, "B")
										oNewMenuSet.insertMenuAtIndex (len(oNewMenuSet.BMenus), oBMenu, "B")
							
							CContextNames = ((Set.getAttribute("CContexts")).split(";"))
							CMenuNames = ((Set.getAttribute("CMenus")).split(";"))

							if len(CContextNames) == len(CMenuNames):
								for CContextName in CContextNames:
									oCContext = getQMenu_MenuDisplayContextByName(str(CContextName))
									if oCContext != None:
										ContextIndex = CContextNames.index(CContextName)
										CMenuName = CMenuNames[ContextIndex]
										oCMenu = getQMenu_MenuByName(CMenuName)
										oNewMenuSet.insertContext (len(oNewMenuSet.CContexts), oCContext, "C")
										oNewMenuSet.insertMenuAtIndex (len(oNewMenuSet.CMenus), oCMenu, "C")
										
							DContextNames = ((Set.getAttribute("DContexts")).split(";"))
							DMenuNames = ((Set.getAttribute("DMenus")).split(";"))

							if len(DContextNames) == len(DMenuNames):
								for DContextName in DContextNames:
									oDContext = getQMenu_MenuDisplayContextByName(str(DContextName))
									if oDContext != None:
										ContextIndex = DContextNames.index(DContextName)
										DMenuName = DMenuNames[ContextIndex]
										oDMenu = getQMenu_MenuByName(DMenuName)
										oNewMenuSet.insertContext (len(oNewMenuSet.DContexts), oDContext, "D")
										oNewMenuSet.insertMenuAtIndex (len(oNewMenuSet.DMenus), oDMenu, "D")
							globalQMenu_MenuSets.addSet(oNewMenuSet)

							
			for Component in Components[0].childNodes:
				if Component.localName == "QMenuViewSignatures":
					QMenuSignatures = Component.childNodes
					for Signature in QMenuSignatures:
						if str(Signature.localName) == "QMenuViewSignature":
							oNewSignature = App.QMenuCreateObject("ViewSignature")
							oNewSignature.name = Signature.getAttribute("name")

							oNewSignature.signature = Signature.getAttribute("signature")

							MenuSets = Signature.getAttribute("menuSets").split(";")

							for MenuSet in MenuSets:
								oMenuSet = getQMenu_MenuSetByName(MenuSet)
								if oMenuSet != None:
									oNewSignature.insertMenuSet(len(oNewSignature.menuSets), oMenuSet)

							result = globalQMenuViewSignatures.addSignature(oNewSignature)
								
			for Component in Components[0].childNodes:
				if Component.localName == "QMenuDisplayEvents":
					QMenuDisplayEvents = Component.childNodes
					for Event in QMenuDisplayEvents:
						if str(Event.localName) == "QMenuDisplayEvent":
							oNewDisplayEvent = App.QMenuCreateObject("DisplayEvent")
							oNewDisplayEvent.number = int(Event.getAttribute("number"))
							#Print("\nFound Display Event Number " + str(oNewDisplayEvent.number))
							oNewDisplayEvent.key = int(Event.getAttribute("key"))
							oNewDisplayEvent.keyMask = int(Event.getAttribute("keyMask"))
							result = globalQMenuDisplayEvents.addEvent(oNewDisplayEvent)
			return True
		else:
			Print("Could not load QMenu Configuration from '" + str(fileName) + "' because the file could not be found!", c.siError)
			return False



			
#=========================================================================================================================
#===================================== Command Callback Functions ========================================================
#=========================================================================================================================

#This is the main function that creates the string describing the Menu to render
def DisplayMenuSet( MenuSetIndex ):
	
	#Print("DisplayQMenu_MenuSet_Execute called", c.siVerbose)
	ViewSignature = (GetView(True))[0] #get the short/nice view signature
	WindowPos = ViewSignature[2]
	
	#Lets find the current viewport under the mouse and activate it so we can work with a specific view further down.
	#This makes view operations more predictable in case the user clicks on a menu entry in a long menu that overlaps another view
	#In which case the wrong view would be affected.
	
	#Test code to find floating window the user is currently working in.
	#This would be useful to get the currently active projection that's selected in a texture editor, or selected nodes in Render Tree.
	#However, defining popup menus for Rendertree is a bit futile because it's native menues are pretty complete already,
	#and for Tex Editor there would first need to be proper commands for all the UV operations available(atm most of the logic seems 
	#to happen in the menu callbacks), there are no commands that could be conveniently used in a custom popup menu. 
	#Instead extensive scripting would be required.
	Views = Application.Desktop.ActiveLayout.Views
	oVM = Views.Find( "View Manager" )
	"""
	FloatingWindowUnderMouse = None
	for View in Views:
		if View.Visible == True:
			if View.Rectangle == WindowPos:
				FloatingWindowUnderMouse = View
				Print ("Window under mouse is: " + str(FloatingWindowUnderMouse))
				
	#oView = oVM.Views( Application.GetViewportUnderMouse() );
	#oView = oVM.GetAttributeValue("focusedviewport")
	"""
	
	#Activate the 3D view currently under the mouse so viewport operations triggered affect that view and not the one that was active before the menu was opened from 
	oView = oVM.GetAttributeValue("viewportundermouse")
	oVM.SetAttributeValue("focusedviewport",oView)

	t0 = time.clock() #Record time before we start getting the first 4 menus

	globalQMenuViewSignatures = GetGlobalObject("globalQMenuViewSignatures")
	
	#Look through all defined View signatures known to QMenu and find the first that fits
	if globalQMenuViewSignatures != None:
		oCurrentView = None
		for oView in globalQMenuViewSignatures.items:
			#if oView.signature == ViewSignature:
			if oView.signature.find(ViewSignature) > -1:
				oCurrentView = oView
				break  #Lets take the first matching view signature we found (there should not be duplicates anyway)
		
		oMenuSet = None
		if oCurrentView != None:
			try:
				oMenuSet = oCurrentView.menuSets[MenuSetIndex]
			except:
				Print("There is currently no QMenu Menu Set " + str(MenuSetIndex) + " defined for view '" + oCurrentView.name + "!", c.siVerbose)
		
		if oMenuSet != None:
			QMenuGlobals = GetDictionary()
			#ArgList.append(QMenuGlobals("globalQMenuLastUsedItem").item)
			QMenu_MenuItems = QMenuGlobals("globalQMenu_MenuItems").items
			QMenu_Menus = QMenuGlobals("globalQMenu_Menus").items
			QMenu_MenuSets = QMenuGlobals("globalQMenu_MenuSets").items
			#ArgList.append(QMenu_MenuSets)
			#ArgList.append(QMenu_MenuItems)
			#ArgList.append(QMenu_Menus)
				
			oAMenu = None; #AMenuItemList = list()
			oBMenu = None; #BMenuItemList = list()
			oCMenu = None; #CMenuItemList = list()
			oDMenu = None; #DMenuItemList = list()
			oMenus = list()
				
			#Quadrants = ((oMenuSet.AContexts,oMenuSet.AMenus),(oMenuSet.BContexts,oMenuSet.BMenus),(oMenuSet.CContexts,oMenuSet.CMenus),(oMenuSet.DContexts,oMenuSet.DMenus))
			
			#Find menu A by evaluating all of the D-quadrant menu's context functions and taking the first one that returns True
			SelInfo = GetGlobalObject("globalQMenuSceneSelectionDetails")
			#SelInfo.storeSelection(App.Selection)

			selection = App.Selection
			Types = SelInfo.Types
			ClassNames = SelInfo.ClassNames
			ComponentClassNames = SelInfo.ComponentClassNames
			ComponentParents = SelInfo.ComponentParents
			ComponentParentTypes = SelInfo.ComponentParentTypes
			ComponentParentClassNames = SelInfo.ComponentParentClassNames
			silent = True
			
			for RuleIndex in range(0,len(oMenuSet.AContexts)):
				oContext = oMenuSet.AContexts[RuleIndex]
				DisplayMenu = False
				DisplayMenu = ExecuteDisplayContext (oContext, selection, Types, ClassNames, ComponentClassNames, ComponentParents, ComponentParentTypes, ComponentParentClassNames, silent)
				
				if DisplayMenu == True: #We have found a matching context rule, we will display the associated menu
					oAMenu = oMenuSet.AMenus[RuleIndex]
					break
			
			oMenus.append(oAMenu) #Add the found menu to the Menus list
			
			#Find menu B by evaluating all of the D-quadrant menu's context functions and taking the first one that returns True
			for RuleIndex in range(0,len(oMenuSet.BContexts)):
				oContext = oMenuSet.BContexts[RuleIndex]
				DisplayMenu = False
				DisplayMenu = ExecuteDisplayContext (oContext,selection, Types, ClassNames, ComponentClassNames, ComponentParents, ComponentParentTypes, ComponentParentClassNames, silent)
				
				if DisplayMenu == True: #We have found a matching context rule, we will display the associated menu
					oBMenu = oMenuSet.BMenus[RuleIndex]
					break
			
			oMenus.append(oBMenu) #Add the found menu to the Menus list
			
			#Find menu C by evaluating all of the D-quadrant menu's context functions and taking the first one that returns True
			for RuleIndex in range(0,len(oMenuSet.CContexts)):
				oContext = oMenuSet.CContexts[RuleIndex]
				DisplayMenu = False
				DisplayMenu = ExecuteDisplayContext (oContext,selection, Types, ClassNames, ComponentClassNames, ComponentParents, ComponentParentTypes, ComponentParentClassNames, silent)
				
				if DisplayMenu == True:
					oCMenu = oMenuSet.CMenus[RuleIndex]
					break
			
			oMenus.append(oCMenu) #Add the found menu to the Menus list
			
			#Find menu D by evaluating all of the D-quadrant menu's context functions and taking the first one that returns True
			for RuleIndex in range(0,len(oMenuSet.DContexts)):
				oContext = oMenuSet.DContexts[RuleIndex]
				DisplayMenu = False
				DisplayMenu = ExecuteDisplayContext (oContext,selection, Types, ClassNames, ComponentClassNames, ComponentParents, ComponentParentTypes, ComponentParentClassNames, silent)
				if DisplayMenu == True:
					oDMenu = oMenuSet.DMenus[RuleIndex]
					break
			
			oMenus.append(oDMenu) #Add the found menu to the Menus list
						
			t1 = time.clock() #Record time after getting first 4 menu and start searching for submenus
			#Find Submenus
			NewMenuFound = True

			CheckedMenus = list()
			while NewMenuFound == True:
				NewMenuFound = False #Lets assume we don't find a new menu first
				for oMenu in oMenus: #Search for submenus in  menus A to D, if any
					if oMenu != None and oMenu not in CheckedMenus:
						Code = unicode(oMenu.code)
						if Code != "" and oMenu.executeCode == True:
							#ArgList = list(); ArgList.append(oMenu) #QMenu_Menu_Execute function takes it's own menu as an argument 
							#Print(oMenu.name)
							#Print(oMenu.code)
							Application.ExecuteScriptCode(Code, oMenu.language, "QMenu_Menu_Execute", [oMenu, QMenu_MenuItems, QMenu_Menus, QMenu_MenuSets]) #Execute the menu's script code (maybe it creates more menu items or even more submenus)
							#except:
								#raise
								#Print("An Error occured executing QMenu Menu's '" + oMenu.name + "' script code, please see script editor for details!", c.siError)
						
						#Lets find regular submenus					
						for oMenuItem in oMenu.items:
							if oMenuItem.type == "QMenu_Menu":
								if not (oMenuItem in oMenus):
									oMenus.append(oMenuItem)
									NewMenuFound = True

						#Lets find temporary submenus	
						for oMenuItem in oMenu.tempItems:
							if oMenuItem.type == "QMenu_Menu":
								if not (oMenuItem in oMenus):
									oMenus.append(oMenuItem)
									NewMenuFound = True

						
						CheckedMenus.append(oMenu)
			
			t2 = time.clock() #Finished assembling list of all menus
			
			#============ Build the QMenu Menu string from found menus and submenus	==========================
			QMenuString = str()
			MenuCounter = 0
			MenuString = "" #Start the MenuSet string
			ArgList = list()
					
			if oMenus != [None,None,None,None]:				
				for oMenu in oMenus: 
					MenuString = MenuString + "[" #Start the menu string
					if oMenu != None:
						if (len(oMenu.items) == 0) and (len(oMenu.tempItems) == 0):
							MenuString = MenuString + "[[Empty]" +  "[-1]" + "[3]" + "]"
						else:
							if MenuCounter == 2 or MenuCounter == 3: #Add the title at the beginning of the menu in case it's menu 2 or 3
								MenuString = MenuString + "[[" + oMenu.name + "]"  + "[-1]" + "[3]" + "]" 
							
							#Add regular menu items to the display string
							for oItem in oMenu.items:
								if oItem.type == "CommandPlaceholder":
									MenuString = MenuString + "[[" + oItem.name + "]"  + "[-1]" + "[1]" + "]" 
								if oItem.type == "QMenu_MenuItem":
									#Print(oItem.name + " is a switch: " + str(oItem.switch))
									if oItem.switch == True:
										Language = oItem.language
										#result = False
										self = oItem
										if Language == "Python": #Execute Python code natively, it's faster this way
											Code = (oItem.code + ("\nresult = Switch_Init(self, QMenu_MenuItems, QMenu_Menus, QMenu_MenuSets)"))
											exec (Code)
										else:
											results = App.ExecuteScriptCode(oItem.code, Language, "Switch_Init",[self, QMenu_MenuItems, QMenu_Menus, QMenu_MenuSets])
											result = results[0]
										if result == True:
											MenuString = MenuString + "[[" + oItem.name + "]"  + "[-1]" + "[5]" + "]"
										else:
											MenuString = MenuString + "[[" + oItem.name + "]"  + "[-1]" + "[1]" + "]"
										#except:
											#Print ("An Error occured evaluating the Switch_Eval function of menu item '" + oItem.name + "'. Please see script editor for details", c.siVerbose)	
											#raise
									else: #Item is not a switch, must be a normal menu item
										MenuString = MenuString + "[[" + oItem.name + "]"  + "[-1]" + "[1]" + "]"
										
								if oItem.type == "QMenu_Menu":
									#try:
									MenuIndex = oMenus.index(oItem)
									MenuString = MenuString + "[[" + oItem.name + "]" + "[" + str(MenuIndex) + "]" + "[1]" + "]" 
									#except:
										#pass
								if oItem.type == "QMenuSeparator":
									MenuString = MenuString + "[]"
								if oItem.type == "MissingCommand":
									MenuString = MenuString + "[[" + oItem.name + "]"  + "[-1]" + "[0]" + "]"

							#Add temporary menu items to the display string
							for oItem in oMenu.tempItems:
								if oItem.type == "Command":
									MenuString = MenuString + "[[" + oItem.name + "]"  + "[-1]" + "[1]" + "]" 
								if oItem.type == "QMenu_MenuItem":
									MenuString = MenuString + "[[" + oItem.name + "]"  + "[-1]" + "[1]" + "]" 
								if oItem.type == "QMenu_Menu":
									#try:
										MenuIndex = oMenus.index(oItem)
										MenuString = MenuString + "[[" + oItem.name + "]"  + "[" + str(MenuIndex) + "]" + "[1]" + "]" 
									#except:
										#DoNothing = True
								if oItem.type == "QMenuSeparator":
									MenuString = MenuString + "[[]"  + "[-1]" + "[0]" + "]" 
							#Add the title at the end of the menu in case it's menu 0 or 1
							if MenuCounter == 0 or MenuCounter == 1:
								MenuString = MenuString + "[[" + oMenu.name + "]"  + "[-1]" + "[3]" + "]" 
					#else:
						#MenuString = MenuString + "[[None]" +  "[-1]" + "[3]" + "]"
						
					MenuString = MenuString + "]" #Close the menu string
					MenuCounter +=1
				
				t3 = time.clock() #Time 
				
				#ShowString = App.Preferences.GetPreferenceValue("QMenu.ShowQMenu_MenuString")
				if App.Preferences.GetPreferenceValue("QMenu.ShowQMenu_MenuString") == True:
					#Print ("QMenu.ShowQMenu_MenuString is:" + str(App.Preferences.GetPreferenceValue("QMenu.ShowQMenu_MenuString")))
					
					Print(MenuString) #Debug option to actually print out the string that will be passed to the QMenu menu renderer
				
				if App.Preferences.GetPreferenceValue("QMenu.ShowQMenuTimes") == True:
					#Print ("QMenu.ShowQMenuTimes:" + str(App.Preferences.GetPreferenceValue("QMenu.ShowQMenuTimes")))
					
					Print("Time taken to get menus A-D was " + str(t1 - t0) + " seconds.")
					Print("Time taken to get submenus without duplicates was " + str(t2 - t1) + " seconds.")
					Print("Time taken to prepare the QMenu menu string from the menus list was " + str(t3 - t2) + " seconds.")
					Print("Total QMenu preparation time was " + str(t3 - t0) + " seconds.")
				
				#Finally Render the Quad Menu using the string we just built and wait for user to pick an item
				
				#oQMenu_MenuItem = App.QMenuGetMenuItemByName("Set Curve Knot Multiplicity"); return oQMenu_MenuItem #TODO: Debug QMenuRender command and find out why Operator Inspection fails after it has been called in some cases
				CursorPos = win32gui.GetCursorPos()
				WinUnderMouse = win32gui.WindowFromPoint (CursorPos) #Get window under mouse
				
				MenuItemToExecute = App.QMenuRender(MenuString) #Display the menu, get clicked menu item from user
				
				win32gui.SetFocus(WinUnderMouse) #Set focus back to window under mouse
				#===========================================================================
				#===========  Find the clicked menu item from the returned value ===========
				#===========================================================================
				oClickedMenuItem = None
				if ((MenuItemToExecute[0] != -1) and (MenuItemToExecute[1] != -1)): #Was something clicked in any of the menus?
					#Print("MenuItemToExecute is: " + str(MenuItemToExecute))
					oClickedMenu = oMenus[MenuItemToExecute[0]] #get the clicked QMenu_Menu object
					if oClickedMenu != None:
						
						#Was one of the upper two menus selected?
						if MenuItemToExecute[0] == 0 or MenuItemToExecute[0] == 1: 
							if MenuItemToExecute[1] == len(oClickedMenu.items) + len(oClickedMenu.tempItems): #Was the menu Title selected?
								globalQMenuLastUsedItem = GetGlobalObject("globalQMenuLastUsedItem")
								oClickedMenuItem = globalQMenuLastUsedItem.item #When clicking on any of the Menu Titles repeat the last command
							else:
								#Was one of the temp menu items clicked on? (Temp menu items are always listed after permanent menu items)
								if MenuItemToExecute[1] > (len(oClickedMenu.items)-1): 
									oClickedMenuItem = oClickedMenu.tempItems[MenuItemToExecute[1]-(len(oClickedMenu.items))]
								#No, one of the normal menu items was selected...
								else: 
									oClickedMenuItem = oClickedMenu.items[MenuItemToExecute[1]]
									
						#Was one of the lower two menus selected?
						if MenuItemToExecute[0] == 2 or MenuItemToExecute[0] == 3: 
							if MenuItemToExecute[1] == 0: #Was the menu Title selected?
								globalQMenuLastUsedItem = GetGlobalObject("globalQMenuLastUsedItem")
								oClickedMenuItem = globalQMenuLastUsedItem.item 
							else:
								#Was one of the temp menu items clicked on?
								if MenuItemToExecute[1] > (len(oClickedMenu.items)): 
									oClickedMenuItem = oClickedMenu.tempItems[MenuItemToExecute[1]-(len(oClickedMenu.items)+1)] #get the clicked temp menu item
								#No, one of the normal menu items was selected...
								else: 
									oClickedMenuItem = oClickedMenu.items[MenuItemToExecute[1]-1] #Subtract the menu title entry 
						
						#Was any of the sub-menus selected?
						if MenuItemToExecute[0] > 3:
							if len(oClickedMenu.items) > 0: #Are there any menu items to check for in the first place?
								if MenuItemToExecute[1] > (len(oClickedMenu.items)-1): #Was one of the temp menu items clicked on?
									oClickedMenuItem = oClickedMenu.tempItems[MenuItemToExecute[1]-(len(oClickedMenu.items))]
								else:
									oClickedMenuItem = oClickedMenu.items[MenuItemToExecute[1]]
							elif len(oClickedMenu.tempItems) > 0: #No Menu items, but maybe there are temp menu items..
								oClickedMenuItem = oClickedMenu.tempItems[MenuItemToExecute[1]]
				
				if oClickedMenuItem != None:
					
					return oClickedMenuItem
				else:
					return None

def QMenuRepeatLastCommand_Init(in_Ctxt):
	oCmd = in_Ctxt.Source
	oCmd.SetFlag(c.siSupportsKeyAssignment,  True)
	oCmd.SetFlag(c.siCannotBeUsedInBatch, True)
	oCmd.SetFlag(c.siNoLogging, False)
	oCmd.SetFlag(c.siAllowNotifications, False) #It's important this is false otherwise XSI becomes unstable when undoing the command (forgets about existing commands, but not always about the last executed one)
	return True	

def QMenuRepeatLastCommand_Execute():
	Print("QMenuRepeatLastCommand_Execute called", c.siVerbose)
	globalQMenuLastUsedItem = GetGlobalObject("globalQMenuLastUsedItem")
	oQMenu_MenuItem = globalQMenuLastUsedItem.item
	if oQMenu_MenuItem != None:
		App.QMenuExecuteMenuItem ( oQMenu_MenuItem )

def QMenuGetMenuItemByName_Init(in_Ctxt):
	oCmd = in_Ctxt.Source
	oCmd.ReturnValue = True
	oArgs = oCmd.Arguments
	oArgs.Add("strMenuItemName")
	oCmd.SetFlag(c.siSupportsKeyAssignment, False)
	oCmd.SetFlag(c.siCannotBeUsedInBatch, True)
	oCmd.SetFlag(c.siNoLogging, True)
	oCmd.SetFlag(c.siAllowNotifications, True) #It's important this is "False" otherwise XSI becomes unstable when undoing the command (forgets about existing commands, but not always about the last executed one)
	return True
	
def QMenuGetMenuItemByName_Execute( strMenuItemName ):
	oMenuItem = getQMenu_MenuItemByName(strMenuItemName)
	return oMenuItem
	
def QMenuDisplayMenuSet_0_Init( in_Ctxt ):
	oCmd = in_Ctxt.Source
	oCmd.SetFlag(c.siSupportsKeyAssignment, True)
	oCmd.SetFlag(c.siCannotBeUsedInBatch, True)
	oCmd.SetFlag(c.siNoLogging, True)
	oCmd.SetFlag(c.siAllowNotifications, True) #It's important this is false otherwise XSI becomes unstable when undoing the command (forgets about existing commands, but not always about the last executed one)
	return True				

def QMenuDisplayMenuSet_0_Execute():
	Print("QMenuDisplayMenuSet_0_Execute called", c.siVerbose)
	if App.Preferences.GetPreferenceValue("QMenu.QMenuEnabled"):
		oQMenu_MenuItem = DisplayMenuSet(0)
		#oQMenu_MenuItem = App.QMenuGetMenuItemByName("Set Curve Knot Multiplicity")
		if oQMenu_MenuItem != None:
			globalQMenuLastUsedItem = GetGlobalObject("globalQMenuLastUsedItem")
			globalQMenuLastUsedItem.set(oQMenu_MenuItem)			
			App.QMenuExecuteMenuItem(oQMenu_MenuItem)
			#QMenuTimer = Application.EventInfos( "QMenuExecution" ) #Find the execution timer
			#QMenuTimer.Reset( 0, 1 ) #Reset the timer with a millisecond until execution and with just a single repetition
									#It will execute the chosen MenuItem with no noticeable delay.
									#We are using this timer event to ensure that, no matter what has happened before, the chosen menu item
									#is the last piece of code that's executed by this plugin so it properly appears as repeatable in Softimage'S Edit menu
				
def QMenuDisplayMenuSet_1_Init( in_Ctxt ):
	oCmd = in_Ctxt.Source
	oCmd.SetFlag(c.siSupportsKeyAssignment, True)
	oCmd.SetFlag(c.siCannotBeUsedInBatch, True)
	oCmd.SetFlag(c.siNoLogging, True)
	oCmd.SetFlag(c.siAllowNotifications, False) #It's important this is false otherwise XSI becomes unstable when undoing the command (forgets about existing commands, but not always about the last executed one)
	return True				

def QMenuDisplayMenuSet_1_Execute():
	Print("QMenuDisplayMenuSet_1_Execute called", c.siVerbose)
	if App.Preferences.GetPreferenceValue("QMenu.QMenuEnabled"):
		oQMenu_MenuItem = DisplayMenuSet(1)
		if oQMenu_MenuItem != None:
			globalQMenuLastUsedItem = GetGlobalObject("globalQMenuLastUsedItem")
			globalQMenuLastUsedItem.set(oQMenu_MenuItem)			
			App.QMenuExecuteMenuItem(oQMenu_MenuItem)
			#QMenuTimer = Application.EventInfos( "QMenuExecution" ) #Find the execution timer
			#QMenuTimer.Reset( 0, 1 ) #Reset the timer with a millisecond until execution and with just a single repetition
									#It will execute the chosen MenuItem with no noticeable delay.
									#We are using this timer event to ensure that, no matter what has happened before, the chosen menu item
									#is the last piece of code that's executed by this plugin so it properly appears as repeatable in Softimage'S Edit menu

def QMenuDisplayMenuSet_2_Init( in_Ctxt ):
	oCmd = in_Ctxt.Source
	oCmd.SetFlag(c.siSupportsKeyAssignment, True)
	oCmd.SetFlag(c.siCannotBeUsedInBatch, True)
	oCmd.SetFlag(c.siNoLogging, True)
	oCmd.SetFlag(c.siAllowNotifications, False) #It's important this is false otherwise XSI becomes unstable when undoing the command (forgets about existing commands, but not always about the last executed one)
	return True				

def QMenuDisplayMenuSet_2_Execute():
	Print("QMenuDisplayMenuSet_2_Execute called", c.siVerbose)
	if App.Preferences.GetPreferenceValue("QMenu.QMenuEnabled"):
		oQMenu_MenuItem = DisplayMenuSet(2)
		if oQMenu_MenuItem != None:
			globalQMenuLastUsedItem = GetGlobalObject("globalQMenuLastUsedItem")
			globalQMenuLastUsedItem.set(oQMenu_MenuItem)			
			App.QMenuExecuteMenuItem(oQMenu_MenuItem)
			#QMenuTimer = Application.EventInfos( "QMenuExecution" ) #Find the execution timer
			#QMenuTimer.Reset( 0, 1 ) #Reset the timer with a millisecond until execution and with just a single repetition
									#It will execute the chosen MenuItem with no noticeable delay.
									#We are using this timer event to ensure that, no matter what has happened before, the chosen menu item
									#is the last piece of code that's executed by this plugin so it properly appears as repeatable in Softimage'S Edit menu

def QMenuDisplayMenuSet_3_Init( in_Ctxt ):
	oCmd = in_Ctxt.Source
	oCmd.SetFlag(c.siSupportsKeyAssignment, True)
	oCmd.SetFlag(c.siCannotBeUsedInBatch, True)
	oCmd.SetFlag(c.siNoLogging, True)
	oCmd.SetFlag(c.siAllowNotifications, False) #It's important this is false otherwise XSI becomes unstable when undoing the command (forgets about existing commands, but not always about the last executed one)
	return True				

def QMenuDisplayMenuSet_3_Execute():
	Print("QMenuDisplayMenuSet_3_Execute called", c.siVerbose)
	if App.Preferences.GetPreferenceValue("QMenu.QMenuEnabled"):
		oQMenu_MenuItem = DisplayMenuSet(3)
		if oQMenu_MenuItem != None:
			globalQMenuLastUsedItem = GetGlobalObject("globalQMenuLastUsedItem")
			globalQMenuLastUsedItem.set(oQMenu_MenuItem)			
			App.QMenuExecuteMenuItem(oQMenu_MenuItem)
			#QMenuTimer = Application.EventInfos( "QMenuExecution" ) #Find the execution timer
			#QMenuTimer.Reset( 0, 1 ) #Reset the timer with a millisecond until execution and with just a single repetition
									#It will execute the chosen MenuItem with no noticeable delay.
									#We are using this timer event to ensure that, no matter what has happened before, the chosen menu item
									#is the last piece of code that's executed by this plugin so it properly appears as repeatable in Softimage'S Edit menu

									
							
def QMenuExecuteMenuItem_Init( in_ctxt ):
	oCmd = in_ctxt.Source
	oCmd.ReturnValue = False
	oArgs = oCmd.Arguments
	oArgs.Add("oQMenu_MenuItem")
	oCmd.SetFlag(c.siSupportsKeyAssignment, False)
	oCmd.SetFlag(c.siCannotBeUsedInBatch, True)
	oCmd.SetFlag(c.siNoLogging, True)
	oCmd.SetFlag(c.siAllowNotifications, True) #It's important this is "False" otherwise XSI becomes unstable when undoing the command (forgets about existing commands, but not always about the last executed one)
	return True
	
def QMenuExecuteMenuItem_Execute ( oQMenu_MenuItem ):
	Print("QMenuExecuteMenuItem_Execute called", c.siVerbose)
	QMenuGlobals = GetDictionary()

	if oQMenu_MenuItem != None:

		#Instead of the actual command only it's name is given because Softimage has the tendency to forget commands (not always the
		#same command that was referenced) after undoing it when the command is referenced by a python object (e.g. a list or custom ActiveX class). 
		#Therefore we only work with command names instead and look up the command for execution again,
		#which imposes only a minimal speed penalty.

		success = True
		if oQMenu_MenuItem.type == "CommandPlaceholder": #We use the commandplaceholder class to store the name of the command to execute because storing the command directly causes problems in XSI
			try:
				#Print("Executing command with UID of: " + str(oQMenu_MenuItem.UID)) 
				#oCmd =  App.GetCommandByUID(oQMenu_MenuItem.UID) #We used a compiled command now fast enough to look up commands by their UID, we avoid executing the false one with the same name (there are duplicates of commands in softimage sharing the same name)
				oCmd= App.Commands(oQMenu_MenuItem.name) #We use the name to identify the command because finding by UID would be too slow 
				oCmd.Execute()
				return True
			except:
				success = False
				raise
			finally:
				if success == False:
					Print("An Error occured while QMenu executed the command '" + oQMenu_MenuItem.name + "', please see script editor for details!", c.siError)
					return False
				
			#SucessfullyExecuted = True
					
		if oQMenu_MenuItem.type == "QMenu_MenuItem":
			ArgList = list()
			#ArgList.append(QMenuGlobals("globalQMenuLastUsedItem").item)
			ArgList.append(oQMenu_MenuItem)
			ArgList.append(QMenuGlobals("globalQMenu_MenuItems").items)
			ArgList.append(QMenuGlobals("globalQMenu_Menus").items)
			ArgList.append(QMenuGlobals("globalQMenu_MenuSets").items)
			#ArgList.append(QMenuGlobals("globalQMenu_MenuDisplayContexts").items)
			#ArgList.append(QMenuGlobals("globalQMenuViewSignatures").items)
			#ArgList.append(QMenuGlobals("globalQMenuDisplayEvents").items)
			
			Code = (oQMenu_MenuItem.code)
			if Code != "":
				Language = (oQMenu_MenuItem.language)
				if oQMenu_MenuItem.switch == True:
					#try:
					App.ExecuteScriptCode(Code, Language, "Switch_Execute", ArgList )
					return True
					#except:
						#success = False
						#raise	
					#finally:
						#if success == False:
							#Print("An Error occured while QMenu executed the switch item '" + oQMenu_MenuItem.name + "', please see script editor for details!", c.siError)
							#return False
						
				else:
					#try:
					#exec(Code + '\nScript_Execute ("", "", "", "")')
					#print("\n")
					#print("Code is: ")
					#print(Code)
					App.ExecuteScriptCode( Code, Language , "Script_Execute", ArgList )
					return True
					#except:
						#success = False
					#finally:
						#if success == False:
							#Print("An Error occured while QMenu executed the script item '" + oQMenu_MenuItem.name + "', please see script editor for details!", c.siError)
							#return False
						
			else:
				Print("QMenu Menu item '" + oQMenu_MenuItem.name + "' has no code to execute!",c.siWarning)
				#return False
	
def QMenuCreateObject_Init( io_Context ):
	oCmd = io_Context.Source
	oCmd.ReturnValue = true
	oArgs = oCmd.Arguments
	oArgs.Add("QMenuType", c.siArgumentInput, "MenuItem")
	oCmd.SetFlag(c.siSupportsKeyAssignment, False)
	oCmd.SetFlag(c.siCannotBeUsedInBatch, True)
	oCmd.SetFlag(c.siNoLogging, True)
	return True

def QMenuCreateObject_Execute( QMenuType ):
	QMenuElement = None
	if QMenuType == "LastUsedItem":
		QMenuElement = QMenuLastUsedItem()
	if QMenuType == "MenuItem":
		QMenuElement = QMenu_MenuItem()
	if QMenuType == "MenuItems":
		QMenuElement = QMenu_MenuItems()	
	if QMenuType == "Menu":
		QMenuElement = QMenu_Menu()
	if QMenuType == "Menus":
		QMenuElement = QMenu_Menus()
	if QMenuType == "MenuSet":
		QMenuElement = QMenu_MenuSet()		
	if QMenuType == "MenuSets":
		QMenuElement = QMenu_MenuSets()
	if QMenuType == "MenuDisplayContext":
		QMenuElement = QMenu_MenuDisplayContext()
	if QMenuType == "MenuDisplayContexts":
		QMenuElement = QMenu_MenuDisplayContexts()
	if QMenuType == "DisplayEvent":
		QMenuElement = QMenuDisplayEvent()
	if QMenuType == "DisplayEvents":
		QMenuElement = QMenuDisplayEvents()
	if QMenuType == "ViewSignature":
		QMenuElement = QMenuViewSignature()
	if QMenuType == "ViewSignatures":
		QMenuElement = QMenuViewSignatures()
	if QMenuType == "ConfigStatus":
		QMenuElement = QMenuConfigStatus()
	if QMenuType == "Separator":
		QMenuElement = QMenuSeparator()
	if QMenuType == "Separators":
		QMenuElement = QMenuSeparators()
	if QMenuType == "MissingCommand":
		QMenuElement = QMenuMissingCommand()
	if QMenuType == "CommandPlaceholder":
		QMenuElement = QMenuCommandPlaceholder()
	if QMenuType == "Globals":
		QMenuElement = QMenuGlobals()
	if QMenuType == "SceneSelectionDetails":
		QMenuElement = QMenuSceneSelectionDetails()
	# Class MUST be wrapped before being returned:
	if QMenuElement != None:
		return win32com.server.util.wrap(QMenuElement)
	else:
		return None
 
def QMenuCreateConfiguratorCustomProperty_Init( in_ctxt ):
	oCmd = in_ctxt.Source
	oCmd.Description = "Create QMenuConfigurator custom property at scene root level"
	oCmd.Tooltip = "Create QMenuCreateConfiguratorCustomProperty custom property at scene root level"
	oCmd.ReturnValue = true
	oArgs = oCmd.Arguments
	oCmd.SetFlag(c.siSupportsKeyAssignment, False)
	oCmd.SetFlag(c.siCannotBeUsedInBatch, True)
	oCmd.SetFlag(c.siNoLogging, True)
	return true
    
def QMenuCreateConfiguratorCustomProperty_Execute(bCheckSingle = true): 
    Print("QMenuCreateConfiguratorCustomProperty_Execute called",c.siVerbose)
    boolTest = false
    
    if bCheckSingle == true:
        colQMenuConfigurator = XSIFactory.CreateActiveXObject( "XSI.Collection" )
        A = App.FindObjects( "", "{76332571-D242-11d0-B69C-00AA003B3EA6}" ) #Find all Custom Properties
        
        for o in A:
            if o.Type == ("QMenuConfigurator"): #Find all Custom Properties of Type "QMenuConfigurator"
                colQMenuConfigurator.Add (o) #And store them in a Collection
        if colQMenuConfigurator.Count > 0: boolTest = true
                
    if boolTest == false:
        a = App.AddProp( "QMenuConfigurator", App.ActiveSceneRoot, 0, "QMenuConfigurator", "" )
        #Add the Custom property to the scene root. AddProp returns a ISIVTCollection that contains
        # 2 elements: The created Custom Property type and the Created Custom Properties as an XSICollection
        #This is not documented in the AddProp command help page, but in a separate page called
        #"Python Example: Working with the ISIVTCollection returned from a Command". Yuk!
        return a
    
    if boolTest == true:
        Print("QMenuConfigurator Property already defined - Inspecting existing Property instead of creating a new one", c.siWarning)
        App.InspectObj (QMenuConfigurator(0))
        return false


		

#=========================================================================================================================		
# ========================================= Event Callback Functions =====================================================
#=========================================================================================================================
#"On selection changed" event to collect information about currently selected Objects
def QMenuGetSelectionDetails_OnEvent(in_ctxt):
	#Print("QMenu: QMenuGetSelectionDetails_OnEvent called",c.siVerbose)
	
	t0 = time.clock()
	QMenuGetSelectionDetails()
	t1 = time.clock()
	timeTaken = (t1 - t0)/1000
	if App.Preferences.GetPreferenceValue("QMenu.ShowQMenuTimes"):
		Print("QMenuGetSelectionDetails event took: " + str(timeTaken) + "seconds")

def QMenuGetSelectionDetails():
	Print("QMenu: QMenuGetSelectionDetails called",c.siVerbose)
	oSelDetails = GetGlobalObject("globalQMenuSceneSelectionDetails")
	if oSelDetails != None:
		
		oSelection = Application.Selection
		SelCount = oSelection.Count
		
		"""
		lsSelectionTypes_old = list(oSelDetails.Types)
		lsSelectionClassNames_old = list(oSelDetails.ClassNames)
		lsSelectionComponentClassNames_old = list(oSelDetails.ComponentClassNames)
		lsSelectionComponentParents_old = list(oSelDetails.ComponentParents)
		lsSelectionComponentParentTypes_old = list(oSelDetails.ComponentParentTypes)
		lsSelectionComponentParentClassNames_old = list(oSelDetails.ComponentParentClassNames)
		"""
		
		
		lsSelectionTypes = list() #
		lsSelectionClassNames = list() #
		lsSelectionComponentClassNames = list() #
		lsSelectionComponentParents = list() #
		lsSelectionComponentParentTypes = list() #
		lsSelectionComponentParentClassNames = list()
		
		#To speed up context evaluation we add at least an empty string in case nothing is selected
		if SelCount == 0:
			lsSelectionTypes.append ("")
			lsSelectionClassNames.append ("")		
			lsSelectionComponentClassNames.append("")
			lsSelectionComponentParents.append ("")
			lsSelectionComponentParentTypes.append ("")
			lsSelectionComponentParentClassNames.append ("")
			
		else:
			for oSel in oSelection:
				
				SelectionType = oSel.Type
				SelectionClassName = getClassName(oSel)
				#Make sure there are dummy values so all lists will have the same number of items independant of selected objects or components
				SelectionComponentClassName = ""
				SelectionComponentParent = ""
				SelectionComponentParentType = ""
				SelectionComponentParentClassName = ""
							
				#Start appending values to the lists
				lsSelectionTypes.append (SelectionType)
				lsSelectionClassNames.append (SelectionClassName)
				
				#Let's get subcomponent collection data if there is any (otherwise the above (None and "") values are used later on
				if SelectionClassName == "CollectionItem":
					try:
						SelectionComponentClassName = getClassName(oSel.SubComponent.ComponentCollection(0)) #We assume that the class of the first element in the collection is representative of the rest of it's elements
					except:
						SelectionComponentClassName = ""
					try:
						SelectionComponentParent = (oSel.SubComponent.Parent3DObject)
					except:
						SelectionComponentParent = ""
					try:
						SelectionComponentParentType = (oSel.SubComponent.Parent3DObject.Type)
					except:
						SelectionComponentParentType = ""
					try:
						SelectionComponentParentClassName = getClassName(oSel.SubComponent.Parent3DObject)
					except:
						SelectionComponentParentClassName = ""
				
				#Finally add remaining component items to the lists
				lsSelectionComponentClassNames.append(SelectionComponentClassName)
				lsSelectionComponentParents.append (SelectionComponentParent)
				lsSelectionComponentParentTypes.append (SelectionComponentParentType)
				lsSelectionComponentParentClassNames.append (SelectionComponentParentClassName)
	
	
		#Fill the SelectionInfo Object with the Data we have aquired
		#If currently nothing is selected we assume we are dealing with the previously selected object(s)
		if (SelCount < 1) and (Application.Selection.Filter.Name != "object"):
			pass
			"""
			oSelDetails.recordTypes (lsSelectionTypes_old)
			Print("Recorded Types: " + str(lsSelectionTypes_old))
			oSelDetails.recordClassNames (lsSelectionClassNames_old)
			Print("Recorded ClassNames: " + str(lsSelectionClassNames_old))
			
			oSelDetails.recordComponentClassNames (lsSelectionComponentClassNames_old)
			Print("Recorded ComponentClassNames: " + str(lsSelectionComponentClassNames_old))
			oSelDetails.recordComponentParents (lsSelectionComponentParents_old)
			Print("Recorded ComponentParents: " + str(lsSelectionComponentParents_old))
			
			oSelDetails.recordComponentParentTypes (lsSelectionComponentParentTypes_old)
			Print("Recorded ComponentParentTypes: " + str(lsSelectionComponentParentTypes_old))
			oSelDetails.recordComponentParentClassNames (lsSelectionComponentParentClassNames_old)
			Print("Recorded ComponentParents: " + str(lsSelectionComponentParentClassNames_old))
			"""
 
		else: #Something is selected
		
			#Print("Recording Selection Types: " + str(lsSelectionTypes))
			oSelDetails.recordTypes (lsSelectionTypes)
			#Print("Recording Selection Class Names: " + str(lsSelectionClassNames))
			oSelDetails.recordClassNames (lsSelectionClassNames)
			
			#Print("Recording Component Class Names: " + str(lsSelectionComponentClassNames))
			oSelDetails.recordComponentClassNames (lsSelectionComponentClassNames)
			
			#Print("Recording Component Parents: " + str(lsSelectionComponentParents))
			oSelDetails.recordComponentParents (lsSelectionComponentParents)
			
			#Print("Recording Component Parent Types: " + str(lsSelectionComponentParentTypes))
			oSelDetails.recordComponentParentTypes (lsSelectionComponentParentTypes)
			
			#Print("Recording Component Parent Class Names: " + str(lsSelectionComponentParentClassNames))
			oSelDetails.recordComponentParentClassNames (lsSelectionComponentParentClassNames)	


	"""
	#Experimental stuff - to be cleaned up
	from win32com.client import constants as c

	Sel = Application.Selection.GetAsText()
	print Sel
	#Fil = Application.Selection.Filter
	#print Fil.Type
	#print Fil.Name

	#Application.SelectObjectFilter()
	Application.SetSelFilter ("Object")
	Sel2 = Application.Selection.GetAsText()
	print Sel2
	Application.SetSelFilter ("Vertex")
	#Sel = Application.Selection.GetAsText()
	#Application.SelectObj(Sel)
	#Sel3 = Application.Selection.GetAsText()
	#print Sel3
	"""	


#Key down event that searches through defined QMenu view signatures to find one matching the window under the mouse
def QMenuPrintValueChanged_OnEvent( in_ctxt):
	Object = in_ctxt.GetAttribute("Object")
	print ("Changed Object is: " + str(Object))
	print ("Full Name is: " + in_ctxt.GetAttribute("FullName") )
	print Object.Type 
	
def QMenuCheckDisplayEvents_OnEvent( in_ctxt ):  
	#Print("QMenuCheckDisplayEvents_OnEvent called",c.siVerbose)
 	#Application.DelayedRefresh()
	KeyPressed = in_ctxt.GetAttribute("KeyCode")
	KeyMask = in_ctxt.GetAttribute("ShiftMask")
	
	globalQMenuDisplayEventContainer = GetGlobalObject("globalQMenuDisplayEvents")
	
	Consumed = False #Event hasn't been consumed yet
	
	if globalQMenuDisplayEventContainer != None:
		globalQMenuDisplayEvents = globalQMenuDisplayEventContainer.items

		if App.Preferences.GetPreferenceValue("QMenu.RecordViewSignature") == True:
			ViewSignature = (GetView(True))[0]
			App.SetValue("preferences.QMenu.ViewSignature", ViewSignature, "")
			#App.Preferences.SetPreferenceValue("QMenu.RecordViewSignature",0)
			App.SetValue("preferences.QMenu.RecordViewSignature", False, "")
			Print("QMenu View Signature of picked window: " + str(ViewSignature), c.siVerbose)
			Consumed = True
			
		if App.Preferences.GetPreferenceValue("QMenu.DisplayEventKeys_Record") == True:
			#if App.GetValue("preferences.QMenu.DisplayEventKeys_Record") == True and Consumed == False: #Is user currently recording key events? We must query this from the PPG rather than from Preferences because the preference might not be known yet
			oSelectedEvent = None
			oSelectedEvent = globalQMenuDisplayEvents[App.Preferences.GetPreferenceValue("QMenu.DisplayEvent")] #Get the currently selected display event number in the selection list
			
			KeyMaskValues = (16,17,18) #Key masks not allowed as single key assignments (Strg, Alt and Shift keys)
			
			if KeyPressed not in KeyMaskValues:
				if oSelectedEvent != None:
					oSelectedEvent.key = KeyPressed
					oSelectedEvent.keyMask = KeyMask
				
					App.SetValue("preferences.QMenu.DisplayEventKey", KeyPressed)
					App.SetValue("preferences.QMenu.DisplayEventKeyMask", KeyMask)
				App.SetValue("preferences.QMenu.DisplayEventKeys_Record",False)
		
		QMenuEnabled = App.Preferences.GetPreferenceValue("QMenu.QMenuEnabled")
		if (QMenuEnabled == True) or (QMenuEnabled == 1) or (QMenuEnabled == 'True') and (Consumed == False): #Is QMenu enabled and the event hasn't been consumed yet?
			#Check known display events whether there is one that should react to the currently pressed key(s)
			for oDispEvent in globalQMenuDisplayEvents:
				if ((oDispEvent.key == KeyPressed) and (oDispEvent.keyMask == KeyMask )): #We have found a display event that matches the key(s) that were just pressed
					Consumed = True
					
					#Finally display the corresponding menu set associated with the display event and get the users input
					oChosenMenuItem = DisplayMenuSet( globalQMenuDisplayEventContainer.getEventNumber(oDispEvent))
					
					
					if oChosenMenuItem != None:
						globalQMenuLastUsedItem = GetGlobalObject("globalQMenuLastUsedItem")
						globalQMenuLastUsedItem.set(oChosenMenuItem)
						#QMenuExecuteMenuItem_Execute(oChosenMenuItem)
						
						App.QMenuExecuteMenuItem(oChosenMenuItem)
						#gc.collect()
						#QMenuTimer = Application.EventInfos( "QMenuExecution" ) #Find the execution timer
						#QMenuTimer.Reset( 0, 1 ) #Reset the timer with a millisecond until execution and with just a single repetition
												#It will execute the chosen MenuItem with no noticeable delay.
												#We are using this timer event to ensure that, no matter what has happened before, the chosen menu item
												#is the last piece of code that's executed by this plugin so it properly appears a repeatable in Softimage's Edit menu
				
					break #We only care for the first found display event assuming there are no duplicates (and even if there are it's not our fault)
				
		# Finally tell Softimage that the event has been consumed (which prevents commands bound to the same hotkey to be executed)
		in_ctxt.SetAttribute("Consumed",Consumed)

def QMenuExecution_OnEvent (in_ctxt):
	Print("QMenu: QMenuExecution_OnEvent called",c.siVerbose)
	globalQMenuLastUsedItem = GetGlobalObject("globalQMenuLastUsedItem")
	
	if globalQMenuLastUsedItem != None:	
		if globalQMenuLastUsedItem.item != None:
			oItem = globalQMenuLastUsedItem.item
			App.QMenuExecuteMenuItem (oItem)
			
def QMenuInitialize_OnEvent (in_ctxt):
	Print ("QMenu Startup event called",c.siVerbose)
	QMenuInitializeGlobals(True)
	FirstStartup = False
	#Load the QMenu Config File
	QMenuConfigFile = ""
	try:
		FirstStartup = Application.Preferences.GetPreferenceValue("QMenu.FirstStartup")
		#Print("FirstStartup Preference Value is: " + str(FirstStartup))
		#Print("Type of FirstStartup Preference Value is: " + str(type(FirstStartup)))
	except:
		#Print("Could not retrieve state of FirstStartup QMenu preference value, assuming it is the first startup...", c.siVerbose)
		FirstStartup = True
	
	if (FirstStartup == "False") or (FirstStartup == "0") or (FirstStartup == False) or (FirstStartup == 0):
		#QMenuConfigFile = App.GetValue("preferences.QMenu.QMenuConfigurationFile") #Does not work, QMenuConfigurator custom property not yet established, need to read from preferences directly instead of using GetValue...
		QMenuConfigFile = App.Preferences.GetPreferenceValue("QMenu.QMenuConfigurationFile")
		#Print("QMenuConfigFile as defined in Prefs is: " + str(QMenuConfigFile))
	
	if (FirstStartup == "True") or (FirstStartup == "1") or (FirstStartup == True) or (FirstStartup == 1):
		#Print("FirstStartup is actually: " + str(FirstStartup) + ". -> getting default config file path")
		QMenuConfigFile = GetDefaultConfigFilePath("QMenuConfiguration_Default.xml") #Get the file path as string of the QMenu default configuration file.
	
	if (str(QMenuConfigFile) != ""):
		Print("Attempting to load QMenu Configuration from: " + str(QMenuConfigFile), c.siVerbose)
		result = QMenuLoadConfiguration(QMenuConfigFile)
		if result:
			Print("Successfully loaded QMenu Config file from: " + str(QMenuConfigFile) , c.siVerbose)
			QMenuConfigFile = App.Preferences.SetPreferenceValue("QMenu.QMenuConfigurationFile",QMenuConfigFile)
			QMenuConfigFile = App.Preferences.SetPreferenceValue("QMenu.FirstStartup", false)
			QMenuConfigFile = App.SetValue("preferences.QMenu.FirstStartup", false)
			
		else:
			Print("Failed loading QMenu Config file from: " + str(QMenuConfigFile) , c.siError)
	else:
		Print("QMenu configuration file could not be found, check QMenu preferences. -> Disabling QMenu.", c.siWarning)
		#App.SetValue("preferences.QMenu.QMenuEnabled", false, "")
	
	#App.Preferences.SaveChanges()
	Application.ExecuteScriptCode("pass", "Python") #Dummy script code execution call to prevent stupid Softimage bug causing error messages upon calling this command on code stored in a menu item code attribute for the first time
	App.QMenuRender("") #Call QMenu to load the required .Net components to avoid having to wait when it's actually called manually for the first time after startup
	
def QMenuDestroy_OnEvent (in_ctxt): 
	globalQMenuConfigStatus = GetGlobalObject("globalQMenuConfigStatus")
	if globalQMenuConfigStatus.changed == True:
		Message = ("The QMenu configuration has been changed - would you like to save it?")
		Caption = ("Save QMenu configuration?")
		DoSaveFile = XSIUIToolkit.MsgBox( Message, 36, Caption )
		if DoSaveFile == True:
			QMenuConfigFile = App.Preferences.GetPreferenceValue("QMenu.QMenuConfigurationFile")
			Result = QMenuSaveConfiguration(QMenuConfigFile)
			if Result == False:  #Something went wrong
				Message = ("The QMenu configuration file could not be written - would you like to save to the dafault backup file?")
				Caption = ("Saving failed, save a QMenu Configuration backup file?")
				#TODO: Add backup function that saves file to a default position in case the previous save attempt failed

				


#=========================================================================================================================					
#===================================== Custom Property Menu Callback Functions ===========================================
#=========================================================================================================================

def QMenuConfigurator_Init( in_ctxt ):
    oMenu = in_ctxt.Source
    oMenu.AddCallbackItem("Edit QMenu Menus","QMenuConfiguratorMenuClicked")
    #oMenu.AddSeparatorItem()
    return true

def QMenuConfiguratorMenuClicked( in_ctxt ):
    App.QMenuCreateConfiguratorCustomProperty()
    return true

	


#=========================================================================================================================	
#=========================================== Helper functions ============================================================
#=========================================================================================================================	

def GetView( Silent = False):
	CursorPos = win32gui.GetCursorPos()
	#WindowPos = win32gui.GetWindowPlacement(hwnd)
	
	WinUnderMouse = win32gui.WindowFromPoint (CursorPos)
	WindowSignature = getDS_ChildName(WinUnderMouse)
	
	#WindowPlacement = win32gui.GetWindowPlacement(WinUnderMouse)
	#Print ("WindowPlacement is " + str(WindowPlacement))
	##WindowPos[0] = (WindowPos[0] + 4)
	##WindowPos[2] = (WindowPos[2] + 4)
	##WindowPos[3] = (WindowPos[3] + 30)
	
	#ClientRect = win32gui.GetClientRect(WinUnderMouse)
	#Print ("ClientRect is " + str(ClientRect))
	
	#WindowRect = win32gui.GetWindowRect (WinUnderMouse)
	#Print ("WindowRect is " + str(WindowRect))	
	
	#Lets make a clean version of the string without spaces or numbers
	WindowSignatureShort = str()
	WindowSignature = WindowSignature.replace(" ","") #Remove spaces from the string
	for char in WindowSignature: #Remove numbers from the string
		if not char.isdigit():
			WindowSignatureShort = (WindowSignatureShort + char)
			
	if Silent != True:
		Print ("Picked Window has the following short QMenu View Signature: " + str(WindowSignatureShort), c.siVerbose)
		Print ("Picked Window has the following long QMenu View Signature: " + str(WindowSignature), c.siVerbose)
		
	Signatures = list()
	Signatures.append (WindowSignatureShort)
	Signatures.append (WindowSignature)
	#Signatures.append (WindowPos)
	#Print(Signatures)
	return Signatures
	
def GetDefaultConfigFilePath(FileNameToAppend):
	DefaultConfigFile = ""
	for plug in App.Plugins:
		if plug.Name == ("QMenuConfigurator"):
			DefaultConfigFolder = (plug.OriginPath.rsplit("\\",3)[0] + "\\Data\\Preferences\\")#Get the left side of the path before "Data"
			#Print("DefaultConfigFolder: " + str(DefaultConfigFolder))
			DefaultConfigFilePath =  (DefaultConfigFolder + FileNameToAppend)
			return DefaultConfigFilePath

def GetCustomGFXFilesPath():
	CustomGFXFolder = ""
	for plug in App.Plugins:
		if plug.Name == ("QMenuConfigurator"):
			CustomGFXFolder = (plug.OriginPath.rsplit("\\",3)[0] + "\\Data\\Images\\")#Get the left side of the path before "Data"
			return CustomGFXFolder

def QMenuInitializeGlobals(force = False):
	Print("QMenu: QMenuInitializeGlobals called", c.siVerbose)
	#if force == False:
	if GetGlobalObject ("globalQMenuLastUsedItem") == None or force == True:
		SetGlobalObject ("globalQMenuLastUsedItem", App.QMenuCreateObject("LastUsedItem"))

	if GetGlobalObject ("globalQMenuSeparators") == None or force == True:
		SetGlobalObject ("globalQMenuSeparators",App.QMenuCreateObject("Separators"))
		oGlobalSeparators = GetGlobalObject("globalQMenuSeparators")
		oGlobalSeparators.addSeparator(App.QMenuCreateObject("Separator"))	
		
	if (GetGlobalObject ("globalQMenu_MenuItems") == None) or force == True:
		SetGlobalObject ("globalQMenu_MenuItems", App.QMenuCreateObject("MenuItems"))	

	if (GetGlobalObject ("globalQMenu_Menus") == None) or force == True:
		SetGlobalObject ("globalQMenu_Menus", App.QMenuCreateObject("Menus"))	

	if (GetGlobalObject ("globalQMenu_MenuSets") == None) or force == True:
		SetGlobalObject ("globalQMenu_MenuSets", App.QMenuCreateObject("MenuSets"))
		
	if (GetGlobalObject ("globalQMenu_MenuDisplayContexts") == None) or force == True:
		SetGlobalObject ("globalQMenu_MenuDisplayContexts", App.QMenuCreateObject("MenuDisplayContexts"))
		
	if (GetGlobalObject ("globalQMenuViewSignatures") == None) or force == True:
		SetGlobalObject ("globalQMenuViewSignatures", App.QMenuCreateObject("ViewSignatures"))
		
	if (GetGlobalObject ("globalQMenuDisplayEvents") == None) or force == True:
		SetGlobalObject ("globalQMenuDisplayEvents", App.QMenuCreateObject("DisplayEvents"))

	if (GetGlobalObject ("globalQMenuConfigStatus") == None) or force == True:
		SetGlobalObject ("globalQMenuConfigStatus", App.QMenuCreateObject("ConfigStatus"))
	
	if (GetGlobalObject ("globalQMenuSceneSelectionDetails") == None) or force == True:
		SetGlobalObject ("globalQMenuSceneSelectionDetails", App.QMenuCreateObject("SceneSelectionDetails"))
			
	QMenuGetSelectionDetails()
	
	"""
	if force == True:
		SetGlobalObject ("globalQMenuLastUsedItem", App.QMenuCreateObject("LastUsedItem"))
		SetGlobalObject ("globalQMenuSeparators",App.QMenuCreateObject("Separators"))
		oGlobalSeparators = GetGlobalObject("globalQMenuSeparators")
		oGlobalSeparators.addSeparator(App.QMenuCreateObject("Separator"))	
		
		SetGlobalObject ("globalQMenu_MenuItems", App.QMenuCreateObject("MenuItems"))	
		SetGlobalObject ("globalQMenu_Menus", App.QMenuCreateObject("Menus"))	
		SetGlobalObject ("globalQMenu_MenuSets", App.QMenuCreateObject("MenuSets"))
		SetGlobalObject ("globalQMenu_MenuDisplayContexts", App.QMenuCreateObject("MenuDisplayContexts"))
		SetGlobalObject ("globalQMenuViewSignatures", App.QMenuCreateObject("ViewSignatures"))
		SetGlobalObject ("globalQMenuDisplayEvents", App.QMenuCreateObject("DisplayEvents"))
		SetGlobalObject ("globalQMenuConfigStatus", App.QMenuCreateObject("ConfigStatus"))
		SetGlobalObject ("globalQMenuSceneSelectionDetails", App.QMenuCreateObject("SceneSelectionDetails"))
	"""

def deleteQMenu_Menu(MenuName):
	if MenuName != "":
		globalQMenu_Menus = GetGlobalObject("globalQMenu_Menus")
		oMenuToDelete = getQMenu_MenuByName(MenuName)
		
		#Delete Menu from global QMenu menus
		for oMenu in globalQMenu_Menus.items:
			if oMenu == oMenuToDelete:
				globalQMenu_Menus.deleteMenu(oMenu)
			
		
		#Delete Menu from global QMenu menu Sets too (Python does not allow for global object destruction :-( )
		globalQMenu_MenuSets = GetGlobalObject("globalQMenu_MenuSets").items
		for oMenuSet in globalQMenu_MenuSets:
			for oMenu in oMenuSet.AMenus:
				if oMenu == oMenuToDelete:
					try:
						MenuIndex = oMenuSet.AMenus.index(oMenu)
						oMenuSet.removeMenuAtIndex (MenuIndex,"A")
					except:
						DoNothin = True
			for oMenu in oMenuSet.BMenus:
				if oMenu == oMenuToDelete:
					try:
						MenuIndex = oMenuSet.BMenus.index(oMenu)
						oMenuSet.removeMenuAtIndex (MenuIndex,"B")
					except:
						DoNothin = True
			for oMenu in oMenuSet.CMenus:
				if oMenu == oMenuToDelete:
					try:
						MenuIndex = oMenuSet.AMenus.index(oMenu)
						oMenuSet.removeMenuAtIndex (MenuIndex, "C")
					except:
						DoNothin = True
			for oMenu in oMenuSet.DMenus:
				if oMenu == oMenuToDelete:
					try:
						MenuIndex = oMenuSet.AMenus.index(oMenu)
						oMenuSet.removeMenuAtIndex (MenuIndex, "D")
					except:
						DoNothin = True
						
		for oMenu in globalQMenu_Menus.items:
			for oItem in oMenu.items:
				if oItem == oMenuToDelete:
					oMenu.removeMenuItem(oMenuToDelete)			

def deleteQMenu_MenuItem(MenuItemName):				
	Print ("QMenu: deleteQMenu_MenuItem called",c.siVerbose)

	globalQMenu_MenuItems = GetGlobalObject("globalQMenu_MenuItems")
	globalQMenu_Menus = GetGlobalObject("globalQMenu_Menus")
	
	for oMenuItem in globalQMenu_MenuItems.items:
		if oMenuItem.name == MenuItemName:
			globalQMenu_MenuItems.deleteMenuItem(oMenuItem)
	
	for oMenu in globalQMenu_Menus.items:
		for oMenuItem in oMenu.items:
			if oMenuItem.name == MenuItemName:
				oMenu.removeMenuItem (oMenuItem)
					
def ListToString(List):
	String = ""
	for i in range (0,len(List)):
		String += str(List[i])
		if i < (len(List)-1):
			String += ";"
	return String

def getDS_ChildName( hwnd): #, clean = True):
	#Print("GetDS_ChildName called", c.siVerbose)
	ViewSignature = ""
	#ViewData = []
	#WindowTitle = win32gui.GetWindowText(hwnd)
	MainWindowReached = False
	while MainWindowReached == False:
		WindowTitle = win32gui.GetWindowText(hwnd)
		if (WindowTitle.find ("SOFTIMAGE") == -1) and (WindowTitle.find ("Softimage") == -1): #We have not reached the main application Window yet...
			if WindowTitle != "": #We only care for non-empty strings...
				DelimitedWindowTitle = (WindowTitle + ";")
				ViewSignature = (ViewSignature + DelimitedWindowTitle) #Append new window's title to existing window signature string
				#WindowPos = win32gui.GetWindowPlacement(hwnd)
				#Print (WindowPos)
			hwnd = win32gui.GetParent(hwnd)
		else:
			MainWindowReached = True
			#WindowPos = win32gui.GetWindowPlacement(hwnd)
			#ViewData.append(ViewSignature)
			#ViewData.append(list(WindowPos[4]))
	return ViewSignature
      
def splitAlphaNum(name):
	name = str(name)
	namelength = (len(name))
	Counter = 1
	Continue = True
	finaldigipart = ""
	finalalphapart = ""

	while Continue  ==  True:
		digipart = name[(namelength - Counter):namelength]
		if digipart.isdigit() ==  True:
			alphapart = name[0:(namelength - (Counter))]
			#App.LogMessage("alphapart after slicing is: " + alphapart)
			#App.LogMessage("digipart after slicing is: " + digipart)
			Counter +=1
			newdigipart = name[(namelength - Counter):namelength]
			if newdigipart.isdigit() ==  False:
				finaldigipart = digipart
				finalalphapart = alphapart
				Continue = False
			else:
				Continue = True
		else:
			Continue = False
			finalalphapart = name
			finaldigipart = 0
			
	returnVal = list()
	returnVal.append(finalalphapart)
	returnVal.append(int(finaldigipart))
	return returnVal
			
def getUniqueName (name, listOfNames):
	listOfNames = list(listOfNames)
	uniqueName = name.replace(";","_")
	unique = False #Lets assume the name is not unique for now

	if len(listOfNames) > 0:
		while unique == False:
			foundit = False
			for i in range (0, len(listOfNames)):
				if listOfNames[i] == uniqueName:
					foundit = True
			if foundit == True:
				number =  (splitAlphaNum(uniqueName)[1])
				number = ((int(number))+1)
				namepart = splitAlphaNum(uniqueName)[0]
				uniqueName = (namepart + str(number))
				unique = False
			if foundit == False:
				unique = True
	else:
		Print ("QMenu: getUniqueName - Given list of names is empty!",c.siVerbose)
		unique = True
	if unique == True:
		return uniqueName

def getUniqueSpacedName (name, listOfNames):
	listOfNames = list(listOfNames)
	uniqueName = name.replace(";","_")
	unique = False #Lets assume the name is not unique for now

	if len(listOfNames) > 0:
		while unique == False:
			foundit = False
			for i in range (0, len(listOfNames)):
				if listOfNames[i] == uniqueName:
					foundit = True
			if foundit == True:
				uniqueName = uniqueName + " "
				unique = False
			if foundit == False:
				unique = True
	else:
		Print ("QMenu: getUniqueName - Given list of names is empty!",c.siVerbose)
		unique = True
	
	if unique == True:
		return uniqueName

def getQMenu_MenuByName (menuName):
	globalQMenu_Menus = GetGlobalObject("globalQMenu_Menus")
	for menu in globalQMenu_Menus.items:
		if menu.name == menuName:
			return menu

def getQMenu_MenuByUID (menuUID):
	globalQMenu_Menus = GetGlobalObject("globalQMenu_Menus")
	for menu in globalQMenu_Menus.items:
		if menu.UID == menuUID:
			return menu

def getQMenu_MenuSetByName (menuSetName):
	globalQMenu_MenuSets = GetGlobalObject("globalQMenu_MenuSets")
	for oMenuSet in globalQMenu_MenuSets.items:
		if oMenuSet.name == menuSetName:
			return oMenuSet

def getQMenu_MenuDisplayContextByName (menuDisplayContextName):
	globalQMenu_MenuDisplayContexts = GetGlobalObject("globalQMenu_MenuDisplayContexts")
	for oContext in globalQMenu_MenuDisplayContexts.items:
		if oContext.name == menuDisplayContextName:
			return oContext
			
def getQMenu_MenuItemByName (menuItemName):
	globalQMenu_Menus = GetGlobalObject("globalQMenu_MenuItems")
	oMenuItem = None
	for oMenuItem in globalQMenu_Menus.items:
		if oMenuItem.name == menuItemName:
			break
	return oMenuItem

def getQMenuSeparatorByName (separatorName):
	globalQMenuSeparators = GetGlobalObject("globalQMenuSeparators")
	for oItem in globalQMenuSeparators.items:
		if oItem.name == separatorName:
			return oItem
					
def getQMenu_ViewSignatureByName(signatureName):
	globalQMenuViewSignatures = GetGlobalObject("globalQMenuViewSignatures")	
	for oSignature in globalQMenuViewSignatures.items:
		if oSignature.name == signatureName:
			return oSignature

def getCommandByUID(UID):
	for Cmd in App.Commands:
		if Cmd.UID == UID:
			#Print("Command matching UI is: " + (Cmd))
			return Cmd
	return None

def GetGlobalObject ( in_VariableName ):

	if len(in_VariableName) == 0:
		Print("Invalid argument to GetGlobal", c.siError)

	dic = GetDictionary()
	
	if in_VariableName in dic:
		return dic[in_VariableName]
	else:
		return None

def SetGlobalObject( in_VariableName, in_Value ):

	if len(in_VariableName) == 0:
		Print("Invalid argument to SetGlobal", c.siError)

	dic = GetDictionary()		
	dic[in_VariableName] = in_Value		

def GetDictionary():

	thisPlugin = Application.Plugins("QMenuConfigurator")
	if thisPlugin.UserData == None:
		# Create the dictionary on the fly.  Once created
		# it will remain active as long as Softimage is running.
		# (Unless you manually Unload or Reload this plugin)

		dict = d.Dispatch( "Scripting.Dictionary" )
		thisPlugin.UserData = dict

	g_dictionary = thisPlugin.UserData
	return g_dictionary
	
def QueryScriptLanguage():
	oDial = win32com.client.Dispatch( "XSIDial.XSIDialog" )
	Language = oDial.Combo( "Please choose Scripting Language for the new Item", ["Python","JScript","VBScript"] );
	return Language

	
	
	
#=========================================================================================================================	
#========================================== Old and experimental Stuff ===================================================
#=========================================================================================================================	

"""
def CollectHandles( handle , winList ):
	winList.append(handle)
	return True
 
def getXSITopLevelWindow():
	#Returns the handle to the XSI top-level window
	wins = []
	win32gui.EnumWindows(CollectHandles, wins) 
	currentId = os.getpid()
	for handle in wins:
		tid, pid = win32process.GetWindowThreadProcessId(handle)
		if pid == currentId:
			title = win32gui.GetWindowText(handle)
			if title.startswith('SOFTIMAGE') or title.startswith('Autodesk Softimage'):
				#Print("Softimage window found!")
				#win32gui.SetWindowText(handle,Windowtext)
				return handle
	return None		


def fGetChildren (colObjects):
    colChildren = XSIFactory.CreateActiveXObject( "XSI.Collection" )
    for o in objs:
        for child in o.Children: colChildren.Add (child)
    fGetChildren (colChildren)
    return colChildren
	
def fGetSelection():
    sel = XSIFactory.CreateActiveXObject( "XSI.Collection" )
    for o in App.Selection:
        sel.Add(o)
    return sel
"""