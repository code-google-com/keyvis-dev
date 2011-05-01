# Script Name: QMenuConfigurator Plugin
# Host Application: Softimage
# Last changed: 2010-07-07, 11:00 hrs 
# Author: Stefan Kubicek
# mail: stefan@keyvis.at

# Code dependencies: none

# Changes:
# Added verbose error reporting when manually executing a switch item
# Added Backface culling Switch Item to Views Menu set
# Added more "Multiply by..." menu items to the property editing menus
#Added "Open Plugin Manager" item to the Script Editor Menu.
# QMenu Init is now evaluated after Softimage has finished starting up so that a race condition with not yet fully initialised custom QMenu preference is avoided
# Added support for ICE Trees and Render Trees (both docked and floating)
# View Signatures can now be substrings of the full signature and can thus be more generic -> e.g. Script Editor QMenu can be called from any mouse position over the Script editor
# as long as it has not cought the input focus (cursor)
# Turned off command logging while assembling and evaluating menu data to reduce script log clutter
# 2012: More reliable command execution by using e delayed timer event that ensure that clicked menu items are executed after any QMenu code.(Pick session work from within timer events, seems to have been fixed in 2012)
# 2012: Using new check mark feature in QMenu Menu to indicate if QMenu is activated or not instead of differently named menu items



#New Bugs:
#Material Manager is not a relational view?  -> Rendertree can't be interrogated, MM has no "Views" to look through.


# = Bugs and TODOs= 
#TODO: Try using a proper command for DisplayMenuSet and see if problem with modal PPGs persists
#QMenu Bug: Find out why executing the QPop command to render a menu prevents modal dialogues from appearing (e.g. Info Selection, applying TopoOps in immed mode, CreateModelAndCOnvertToRef)
#	-> Report: Creating a blend curve in immediate mode from menu will let me adjust params. Creating one using same ApplyGenOp command will not. Why? How To?
#   -> SetThumbnail, SelectionInfo, SetUserKeyword commands fail when called from QMenu (in general: Modal dialogues do not display after QMenuRender is called)
#TODO: Store Keys in preferences instead of config file
#TODO: Write "Remove from all Groups or from selected Groups" command 
#TODO: Write "Toggle Backface Culling in View" command
#TODO: WIP- Execute all Python code items natively, ExecuteScriptCode is problematic on 32bit systems.

#TODO: Try finding currently active view by comparing Rectangles of available views -> Difficult, because rectangles retrieved from Python differ from those rported by Softimage
#TODO: Execute button should only execute current text selection in editor
#TODO: Create texture Editor and Render Tree example menu items
#TODO: Convert Merge clusters menu item into a command
#TODO: Implement QMenu command as Python lib so it can be called as a function and not as a command (prevents QMenu from appearing as the Undo/Repeat item in the edit menu)
#TODO: Better use dictionaries in globalQMenu_Menus, ..Items etc? 
#TODO: Add categorisation to menus (like script items)
#TODO: Check if CommandCollection.Filter with "Custom" is any faster refreshing the Softimage commands lister
#TODO: Implement Cleanup functionality to delete empty script items and menus


#Maybe-Bugs:
#SI bug: When calling executeScriptCode for the first time on code stored in an ActiveX class attribute (e.g. MenuItem.dode) an attribute error will be thrown. Subsequent calls do not exhibit this behaviour
#SI Bug: Strange bug in XSI7.01: When a command allows notifications and is executed and undone, it causes itself or other commands to be unfindable through App.Commands("Commandname") (-> returns none)
#SI Bug: ApplyGenOp does not care about ImmedMode, ApplyTopoOp/ApplyOp do, but they ignore siOperationMode parameter (always honor ImmedMode, even when setting siPersistentOperation)


# ============================= Helpful code snippets==========================================
"""
if ( !originalsetting ) { 
   prefs.SetPreferenceValue( "scripting.cmdlog", false ); 
"""

"""
Application.InstallCustomPreferences("QMenuConfigurator","QMenu")
"""

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

#============================== Plugin Code Start =============================================
import win32com.client
import win32com.server

#from win32com.client.dynamic import Dispatch 


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
	_public_attrs_ = ['Type','Name','UID']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = ['Type']
	
	def __init__(self):
		 # Initialize exported attributes:
		self.Type = "QMenuSeparator"
		self.UID = XSIFactory.CreateGuid()
		self.Name = "NewSeparator"

class QMenuSeparators: #Holds existing Separators
 # Declare list of exported functions:
	_public_methods_ = ['addSeparator','deleteSeparator']
	 # Declare list of exported attributes
	_public_attrs_ = ['Items']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = []
	
	def __init__(self):
		 # Initialize exported attributes:
		self.Items = list()
	
	def addSeparator(self, sep):
		items = self.Items
		sepNames = list()
		unwrappedSep = win32com.server.util.unwrap(sep)
		for item in items:
			unwrappedItem = win32com.server.util.unwrap(item)
			sepNames.append (unwrappedItem.Name)
		if not (unwrappedSep.Name in sepNames):
			items.append (sep)
			return True
		else:
			Print("Could not add " + str(unwrappedSep.Name) + " to global QMenu Menu Sets because a set with that name already exists!", c.siError)
			return False	

	def deleteSeparator (self,sep):
		items = self.Items
		try:
			items.remove(sep)
		except:
			Print(sep.Name + "could not be found in QMenu globals - nothing to delete!", c.siWarning)
			
class QMenu_MenuItem:
 # Declare list of exported functions:
	_public_methods_ = []
	 # Declare list of exported attributes
	_public_attrs_ = ['Type','UID', 'Name', 'Category', 'File', 'Language', 'Code', 'Switch','IsEnabled']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = ['Type']
	
	def __init__(self):
		 # Initialize exported attributes:
		self.UID = XSIFactory.CreateGuid()
		self.Name = str()
		self.Category = str()
		#self.File = str()
		self.Language = "Python"
		self.Code = str()
		self.Type = "QMenu_MenuItem"
		self.Switch = False
		self.IsEnabled = True

class QMenu_MenuItems:
 # Declare list of exported functions:
	_public_methods_ = ['addMenuItem','deleteMenuItem']
	 # Declare list of exported attributes
	_public_attrs_ = ['Items']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = []
	
	def __init__(self):
		 # Initialize exported attributes:
		self.Items = list()
	
	def addMenuItem (self, menuItem):
		items = self.Items
		itemNames = list()
		unwrappedMenuItem = win32com.server.util.unwrap(menuItem)
		
		for item in items:
			unwrappedItem = win32com.server.util.unwrap(item)
			itemNames.append (unwrappedItem.Name)
		if not (unwrappedMenuItem.Name in itemNames):
			items.append (menuItem)
			return True
		else:
			Print("Could not add " + str(unwrappedMenuItem.Name) + " to global QMenu Menu Items because an item with that name already exists!", c.siError)
			return False
			
	def deleteMenuItem (self, menuItem):
		items = self.Items
		try:
			items.remove (menuItem)
		except:
			Print("QMenu Menu Item " + str(menuItem.Name) + " was not found in global QMenu Menu Items and could not be deleted!", c.siError)
			
class QMenu_Menu:
 # Declare list of exported functions:
	_public_methods_ = ['insertMenuItem','removeMenuItem','removeAllMenuItems','removeMenuItemAtIndex','insertTempMenuItem','appendTempMenuItem','removeTempMenuItem','removeTempMenuItemAtIndex','removeAllTempMenuItems']
	 # Declare list of exported attributes
	_public_attrs_ = ['Type','UID', 'Name', 'Items', 'TempItems','Code','Language','MenuItemLastExecuted', 'ExecuteCode']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = ['Type']
	
	def __init__(self):
		 # Initialize exported attributes:
		self.Type = "QMenu_Menu"
		self.UID = XSIFactory.CreateGuid()
		self.Name = str()
		self.Items = list()
		self.TempItems = list()
		self.Code = str()
		#self.Code = unicode()
		self.Language = "Python"
		self.MenuItemLastExecuted = list()
		self.ExecuteCode = False #By default menu code is not getting execute. Most menus won't need any executable code.
		
	def insertMenuItem (self, index, menuItem):
		items = self.Items
		
		if index == None:
			index = 0
		items.insert (index,menuItem)
	
	def removeMenuItem (self, menuItem):
		items = self.Items
		try:
			items.remove (menuItem)
		except:
			Print("QMenu Menu '" + str(self.Name) + "' does not have a menu item called " + str(menuItem.Name) + " that could be removed!!", c.siError)
	
	def removeAllMenuItems (self):
		self.Items = list()

	
	def removeAllTempMenuItems (self):
		self.TempItems = list()
	
	def removeMenuItemAtIndex (self, index):
		items = self.Items
		try:
			#menuItem = items[index]
			items.pop(index)
		except:
			Print("QMenu Menu '" + str(self.Name) + "' does not have a menu item at index " + str(index) + " that could be removed!!", c.siError)
			
	def insertTempMenuItem (self, index, menuItem):
		items = self.TempItems
		
		if index == None:
			index = 0 #len(TempItems)-1)
		items.insert (index,menuItem)
	
	def appendTempMenuItem (self, menuItem):
		items = self.TempItems
		items.append (menuItem)
	
	def removeTempMenuItem (self, menuItem):
		items = self.TempItems
		try:
			items.remove (menuItem)
		except:
			Print("QMenu Menu '" + str(self.Name) + "' does not have a temporary menu called '" + str(menuItem.Name) + "' that could be removed!", c.siError)
	
	def removeTempMenuItemAtIndex (self, index):
		items = self.TempItems
		try:
			#menuItem = items[index]
			items.pop(index)
		except:
			Print("QMenu Menu '" + str(self.Name) + "' does not have a temporary menu item at index " + str(index) + " that could be removed!!", c.siError)

class QMenu_Menus:
 # Declare list of exported functions:
	_public_methods_ = ['addMenu','deleteMenu']
	 # Declare list of exported attributes
	_public_attrs_ = ['Items', 'Execute']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = []
	
	def __init__(self):
		 # Initialize exported attributes:
		self.Items = list()
		self.Execute = False #By default menu code should not be executed due to performance reasons (most menus won't have meaningful code anyway)

	def addMenu (self, menu):
		items = self.Items
		menuNames = list()
		unwrappedMenu = win32com.server.util.unwrap(menu)
		for item in items:
			unwrappedItem = win32com.server.util.unwrap(item)
			menuNames.append (unwrappedItem.Name)
		if not (unwrappedMenu.Name in menuNames):
			items.append (menu)
			return True
		else:
			Print("Could not add " + str(unwrappedMenu.Name) + " to global QMenu Menus because a menu with that name already exists!", c.siError)
			return False		

	
	def deleteMenu (self, menu):
		items = self.Items
		try:
			items.remove (menu)
		except:
			Print("QMenu Menu" + str(menu.Name) + " was not found in global QMenu Menu and could not be deleted!", c.siError)
			
class QMenu_MenuSet:
 # Declare list of exported functions:
	_public_methods_ = ['insertMenuAtIndex', 'removeMenuAtIndex','insertContextAtIndex', 'removeContextAtIndex', 'setMenutAtIndex','setContextAtIndex']
	 # Declare list of exported attributes
	_public_attrs_ = ['Type','UID', 'Name', 'AMenus', 'AContexts', 'BMenus', 'BContexts', 'CMenus', 'CContexts', 'DMenus', 'DContexts']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = ['Type']
	
	def __init__(self):
		 # Initialize exported attributes:
		self.Type = "QMenu_MenuSet"
		self.UID = XSIFactory.CreateGuid()
		self.Name = str()
		self.AMenus = list()
		self.AContexts = list()
		self.BMenus = list()
		self.BContexts = list()
		self.CMenus = list()
		self.CContexts = list()
		self.DMenus = list()
		self.DContexts = list()
	
	def setMenutAtIndex (self, index, menu, quadrant):
		if quadrant == "A":
			self.AMenus[index] = menu
		if quadrant == "B":
			self.BMenus[index] = menu
		if quadrant == "C":
			self.CMenus[index] = menu
		if quadrant == "D":
			self.DMenus[index] = menu
	
	def setContextAtIndex (self, index, context, quadrant):
		if quadrant == "A":
			self.AContexts[index] = context
		if quadrant == "B":
			self.BContexts[index] = context
		if quadrant == "C":
			self.CContexts[index] = context
		if quadrant == "D":
			self.DContexts[index] = context
			
	
	def insertMenuAtIndex (self, index, menu, quadrant):
		if quadrant == "A":
			self.AMenus.insert(index,menu)
		if quadrant == "B":
			self.BMenus.insert(index,menu)
		if quadrant == "C":
			self.CMenus.insert(index,menu)
		if quadrant == "D":
			self.DMenus.insert(index,menu)
	
	def removeMenuAtIndex (self, index, quadrant):
		if quadrant == "A":
			self.AMenus.pop(index)
		if quadrant == "B":
			self.BMenus.pop(index)
		if quadrant == "C":
			self.CMenus.pop(index)
		if quadrant == "D":
			self.DMenus.pop(index)
	
	def insertContextAtIndex (self, index, context, quadrant):
		if quadrant == "A":
			self.AContexts.insert(index,context)
		if quadrant == "B":
			self.BContexts.insert(index,context)
		if quadrant == "C":
			self.CContexts.insert(index,context)
		if quadrant == "D":
			self.DContexts.insert(index,context)

	def removeContextAtIndex (self, index, quadrant):
		if quadrant == "A":
			self.AContexts.pop(index)
		if quadrant == "B":
			self.BContexts.pop(index)
		if quadrant == "C":
			self.CContexts.pop(index)
		if quadrant == "D":
			self.DContexts.pop(index)
			
class QMenu_MenuSets: #Holds existing MenuSets
 # Declare list of exported functions:
	_public_methods_ = ['addSet','deleteSet']
	 # Declare list of exported attributes
	_public_attrs_ = ['Items']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = []
	
	def __init__(self):
		 # Initialize exported attributes:
		self.Items = list()
	
	def addSet(self, set):
		items = self.Items
		setNames = list()
		unwrappedSet = win32com.server.util.unwrap(set)
		for item in items:
			unwrappedItem = win32com.server.util.unwrap(item)
			setNames.append (unwrappedItem.Name)
		if not (unwrappedSet.Name in setNames):
			items.append (set)
			return True
		else:
			Print("Could not add " + str(unwrappedSet.Name) + " to global QMenu Menu Sets because a set with that name already exists!", c.siError)
			return False	

	
	def deleteSet (self,set):
		items = self.Items
		try:
			items.remove(set)
		except:
			Print(set.Name + "could not be found in globals - nothing to delete!", c.siWarning)
		
class QMenu_MenuDisplayContext:   #Holds the context evaluation code, which should return True or False (display or not display the menu)
 # Declare list of exported functions:
	_public_methods_ = []
	 # Declare list of exported attributes
	_public_attrs_ = ['Type','UID', 'Name', 'Language', 'Code','ScanDepth']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = ['Type']
	
	def __init__(self):
		 # Initialize exported attributes:
		self.Type = "QMenu_MenuDisplayContext"
		self.UID = XSIFactory.CreateGuid()
		self.Name = str()
		self.Language = str()
		self.Code = str()
		self.ScanDepth = 0
		
class QMenu_MenuDisplayContexts:   #Holds existing display rcontexts
 # Declare list of exported functions:
	_public_methods_ = ['addContext', 'deleteContext']
	 # Declare list of exported attributes
	_public_attrs_ = ['Items']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = []
	
	def __init__(self):
		 # Initialize exported attributes:
		self.Items = list()
		
	def addContext(self, context):
		items = self.Items
		contextNames = list()
		unwrappedContext = win32com.server.util.unwrap(context)
		for item in items:
			unwrappedItem = win32com.server.util.unwrap(item)
			contextNames.append (unwrappedItem.Name)
		#Print("unwrappedContext.Name found is: " + unwrappedContext.Name)
		if not(unwrappedContext.Name in contextNames):
			items.append (context)
			return True
		else:
			Print("Could not add " + str(unwrappedContext.Name) + " to global QMenu Menu Display Contexts because a Display Context with that name already exists!", c.siError)
			return False
		
	def deleteContext (self, context):
		items = self.Items
		if len(items) > 0:
			items.remove (context)
		
class QMenuDisplayEvent: #Display events store the keycodes of keys that have been chosen to display a specific menu number for whatever view the mouse is over
	# Declare list of exported functions:
	_public_methods_ = []
	 # Declare list of exported attributes
	_public_attrs_ = ['Type','UID', 'Number','Key', 'KeyMask']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = ['Type']
	
	def __init__(self):
		 # Initialize exported attributes:
		self.Type = "QMenuDisplayEvent"
		self.UID = XSIFactory.CreateGuid()
		self.Number = int()
		self.Key = int()
		self.KeyMask = int()
		
class QMenuDisplayEvents: #Container class storing existing DisplayEvents
	# Declare list of exported functions:
	_public_methods_ = ['addEvent','deleteEvent', 'getEventNumber']
	 # Declare list of exported attributes
	_public_attrs_ = ['Items']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = []
	
	def __init__(self):
		 # Initialize exported attributes:
		self.Items = list()
	
	def addEvent(self, Event):
		items = self.Items
		items.append(Event)
	
	def deleteEvent(self, index):
		items = self.Items
		items.pop(index)
		
	def getEventNumber(self, Event):
		items = self.Items
		return items.index (Event)

class QMenuViewSignature: #This class is used to store a unique identifier string for a view. A view is an area of screen estate for which a menu set can be defined (e.g. main 3D viewports, or shader tree window)
 # Declare list of exported functions:
	_public_methods_ = ['insertMenuSet','removeMenuSet']
	 # Declare list of exported attributes
	_public_attrs_ = ['UID','Type','Signature','Name','MenuSets']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = ['Type']
	
	def __init__(self):
		 # Initialize exported attributes:
		self.UID = XSIFactory.CreateGuid()
		self.Type = "QMenuViewSignature"
		self.Signature = str()
		self.Name = str()
		self.MenuSets = list()
	
	def insertMenuSet (self, index, menuSet):
		menuSets = self.MenuSets
		menuSets.insert(index,menuSet)
	
	def removeMenuSet (self, index):
		menuSets = self.MenuSets
		menuSets.pop(index)
			
class QMenuViewSignatures: #Container class for existing ViewSignatures
 # Declare list of exported functions:
	_public_methods_ = ['addSignature', 'deleteSignature']
	 # Declare list of exported attributes
	_public_attrs_ = ['Items']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = ['Type']
	
	def __init__(self):
		 # Initialize exported attributes:
		self.Items = list()
		self.Type = "QMenuViewSignatures"

	def addSignature (self, signature):
		items = self.Items
		signatureNames = list()
		unwrappedSignature = win32com.server.util.unwrap(signature)
		for item in items:
			unwrappedItem = win32com.server.util.unwrap(item)
			signatureNames.append (unwrappedItem.Name)
		if not (unwrappedSignature.Name in signatureNames):
			items.append (signature)
			return True
		else:
			Print("Could not add " + str(unwrappedSignature.Name) + " to global QMenu View Signatures because a signature with that name already exists!", c.siError)
			return False
	
	def deleteSignature (self, signature):
		items = self.Items
		if len(items) > 0:
			items.remove (signature)	

#A simple class that only stores whether the QMenu Configurator has been opened or not, in which case the
#"changed" attribute is set to True. This causes a user query to pop up when Softimage exits asking 
#if the configuration changes should be saved.
class QMenuConfigStatus:
 # Declare list of exported functions:
	_public_methods_ = []
	 # Declare list of exported attributes
	_public_attrs_ = ['Changed']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = []
	
	def __init__(self):
		 # Initialize exported attributes:
		self.Changed = False
		
#A placeholder class that is used as a standin for missing commands that are used in menus.
#The command might be only temporarily missing because the plugin is currently,uninstalled or the workgroup
#temporarily unavailable. Yet, the command would be lost from the configuration when loaded and saved again while (a) command(s) is/are missing. 
#To prevent this, the MissingCommand class object is used as a standin for every command
#that cannot be found when the QMenu configuration file is loaded.
class QMenuMissingCommand:
 # Declare list of exported functions:
	_public_methods_ = []
	 # Declare list of exported attributes
	_public_attrs_ = ['Type','Name','UID']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = ['Type']
	
	def __init__(self):
		 # Initialize exported attributes:
		self.Type = "MissingCommand"
		self.Name = ""
		self.UID = ""

class QMenuRecentlyCreatedICENode:
 # Declare list of exported functions:
	_public_methods_ = ['storeCommandScriptingName', 'storePresetFileName']
	 # Declare list of exported attributes
	_public_attrs_ = ['Type','Name','UID','CommandScriptingName','PresetFileName']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = ['Type']
	
	def __init__(self):
		 # Initialize exported attributes:
		self.Type = "QMenuRecentlyCreatedICENode"
		self.Name = ""
		self.UID = ""
		CommandScriptingName = ""
		PresetFileName = ""

	def storeCommandScriptingName (self, CommandScriptingName):
		self.CommandScriptingName = CommandScriptingName
	
	def storePresetFileName (self, PresetFileName):
		self.PresetFileName = PresetFileName

"""
class QMenuRecentlyCreatedICENodes: #Container class storing existing DisplayEvents
	# Declare list of exported functions:
	_public_methods_ = ['addNode']
	 # Declare list of exported attributes
	_public_attrs_ = ['Nodes']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = []
	
	def __init__(self):
		 # Initialize exported attributes:
		self.Nodes = list()
	
	def addNode(self, Node):
		items = self.Items
		items.append(Event)
		while len(items) > 10:
			items.pop(0)
"""		
		
#It is potentially unsafe to reference Softimage command objects directly, we use a standin class instead that stores name and UID of the
#respective command.	
class QMenuCommandPlaceholder:
 # Declare list of exported functions:
	_public_methods_ = []
	 # Declare list of exported attributes
	_public_attrs_ = ['Type','Name','UID']
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = ['Type']
	
	def __init__(self):
		 # Initialize exported attributes:
		self.Type = "CommandPlaceholder"
		self.Name = ""
		self.UID = ""

#QMenuContext is a class that's serves as a global data container for all kinds of selection-specific date.
#It is fed by a Selection Change Event.
#The aquired data is passed in to Menu Contexts so these contexts don't need to harvest the data repeatedly -> Speed improvement.
class QMenuContext:
 # Declare list of exported functions:
	_public_methods_ = ['storeQMenuObject','storeX3DObjects','storeSelectionTypes','storeSelectionClassNames','storeSelectionComponentClassNames','storeSelectionComponentParents','storeSelectionComponentParentTypes','storeSelectionComponentParentClassNames','storeMenuItems','storeMenus','storeMenuSets','storeDisplayContexts','storeMenuContexts','storeCurrentXSIView','storeLastICENode', 'storeClickedMenu','storeClickedMenuItemNumber'] #'getSelectionClassNames'
	 # Declare list of exported attributes
	_public_attrs_ = ['Type','ThisQMenuObject','X3DObjects','Types','ClassNames','ComponentClassNames','ComponentParents','ComponentParentTypes','ComponentParentClassNames','MenuItems','Menus','MenuSets','DisplayContexts','MenuContexts','CurrentXSIView','ClickedMenu', 'ClickedMenuItemNumber', 'LastICENodes' ]
	 # Declare list of exported read-only attributes:
	_readonly_attrs_ = ['Type']
	
	def __init__( self ):
		self.Type = "Context"
		self.ThisQMenuObject = None
		self.X3DObjects = list()
		self.Types = list()
		self.ClassNames = list()
		self.ComponentClassNames = list()
		self.ComponentParents = list()
		self.ComponentParentTypes = list()
		self.ComponentParentClassNames = list()
		self.MenuItems = None
		self.MenuSets = None
		self.MenuContexts = None
		self.Menus = None
		self.DispalyContexts = None
		self.CurrentView = None
		self.ClickedMenu = None
		self.ClickedMenuItemNumber = None
		self.LastICENodes = None

	def storeQMenuObject ( self, oObj ):
		self.ThisQMenuObject = oObj

	def storeX3DObjects (self, Objects ):
		self.X3DObjects = list()
		for oObj in Objects:
			self.X3DObjects.append(oObj)
			
	def storeSelectionTypes (self, TypeList ):
		self.Types = list()
		for Type in TypeList:
			self.Types.append(Type)
	
	def storeSelectionClassNames ( self, ClassNameList ):
		self.ClassNames = list()
		for ClassName in ClassNameList:
			self.ClassNames.append(ClassName)

	def storeSelectionComponentClassNames ( self , ComponentClassNameList ):
		self.ComponentClassNames = list()
		for ComponentClassName in ComponentClassNameList:
			self.ComponentClassNames.append(ComponentClassName)
	
	def storeSelectionComponentParents (self, ComponentParentList):
		self.ComponentParents = list()
		for ComponentParent in ComponentParentList:
			self.ComponentParents.append (ComponentParent)
	
	def storeSelectionComponentParentTypes (self, ComponentParentTypeList):
		self.ComponentParentTypes = list()
		for ComponentParentType in ComponentParentTypeList:
			self.ComponentParentTypes.append (ComponentParentType)
			
	def storeSelectionComponentParentClassNames (self, ComponentParentClassNameList):
		self.ComponentParentClassNames = list()
		for ComponentParentClassName in ComponentParentClassNameList:
			self.ComponentParentClassNames.append (ComponentParentClassName)

	def storeMenuItems (self, oMenuItems):
		self.MenuItems = oMenuItems
			
	def storeMenus (self, oMenus):
		self.Menus = oMenus
			
	def storeMenuSets (self, oMenuSets):
		self.MenuSets = oMenuSets

	def storeMenuContexts (self, oMenuContexts):
		self.MenuContexts = oMenuContexts

	def storeDisplayContexts (self, oDispalyContexts):
		self.DispalyContexts = oDispalyContexts
		
	def storeCurrentXSIView (self, oXSIView):
		self.CurrentXSIView = oXSIView
		
	def storeLastICENode (self, ICENode):
		"""
		cleanList = list()
		items = self.LastICENodes
		items.append(ICENode)
		items = list(set(items))
	
		#max 10 items in list
		while len(items) >= 10:
			items.pop(0)
		"""

		cleanList = list()
		items = self.LastICENodes
		#items.append(ICENode)
		
		#Remove potential duplicates that may already be in the list
		for item in items:
			if item != ICENode:
				cleanList.append(item)
		
		#10 items in list max
		while len(items) >= 10:
			items.pop(0)
			
		cleanList.append(ICENode)

	def storeClickedMenuItemNumber (self, ItemNumber):
		self.ClickedMenuItemNumber = ItemNumber
	
	def storeClickedMenu (self, ClickedMenu):
		self.ClickedMenu = ClickedMenu
		
#=========================================================================================================================				
#============================================== Plugin Initialisation ====================================================
#=========================================================================================================================	

def XSILoadPlugin( in_reg ):
	in_reg.Author = "Stefan Kubicek"
	in_reg.Name = "QMenuConfigurator"
	in_reg.Email = "stefan@keyvis.at"
	in_reg.URL = "http://www.keyvis.at"
	in_reg.Major = 0
	in_reg.Minor = 95

	XSIVersion = getXSIMainVersion()
	
	#=== Register the QMenu Configurator Custom Property ===
	in_reg.RegisterProperty( "QMenuConfigurator" )
	in_reg.RegisterProperty( "QMenuPreferences" )
	
	#=== Register Custom Commands ===
	in_reg.RegisterCommand( "QMenuCreateObject" , "QMenuCreateObject" )
	in_reg.RegisterCommand( "QMenuGetByName" , "QMenuGetByName" )
	in_reg.RegisterCommand( "QMenuCreatePreferencesCustomProperty", "QMenuCreatePreferencesCustomProperty" )
	in_reg.RegisterCommand( "QMenuDisplayMenuSet_0", "QMenuDisplayMenuSet_0" )
	in_reg.RegisterCommand( "QMenuDisplayMenuSet_1", "QMenuDisplayMenuSet_1" )
	in_reg.RegisterCommand( "QMenuDisplayMenuSet_2", "QMenuDisplayMenuSet_2" )
	in_reg.RegisterCommand( "QMenuDisplayMenuSet_3", "QMenuDisplayMenuSet_3" )
	in_reg.RegisterCommand( "QMenuRepeatLastCommand", "QMenuRepeatLastCommand" )
	in_reg.RegisterCommand( "QMenuExecuteMenuItem" , "QMenuExecuteMenuItem" )
	in_reg.RegisterCommand( "QMenuGetPreferencesCustomProperty" , "QMenuGetPreferencesCustomProperty" )
	in_reg.RegisterCommand( "QMenuGetConfiguratorCustomProperty" , "QMenuGetConfiguratorCustomProperty" )
	in_reg.RegisterCommand( "QMenuRefreshSelectionContextObject" , "QMenuRefreshSelectionContextObject" )
	in_reg.RegisterCommand( "Open QMenu Editor" , "OpenQMenuEditor" )
	
	
	#=== Register events ===
	#in_reg.RegisterEvent( "QMenuGetSelectionDetails", c.siOnSelectionChange)
	in_reg.RegisterEvent( "QMenu_NewSceneHandler", c.siOnEndNewScene) #Needed because selection change handler is not fired when new scene is created 
		 																 #wrong menus are displayed based on selection that does not exist anymore in new scene)
	in_reg.RegisterTimerEvent( "QMenuInitialize", 0,1 )
	in_reg.RegisterTimerEvent( "QMenuExecution", 0, 1 )
	in_reg.RegisterEvent( "QMenuDestroy", c.siOnTerminate)
	in_reg.RegisterEvent( "QMenuCheckDisplayEvents" , c.siOnKeyDown ) #Menu Display event handler, checks the pressed key against the defined keyboard events for QMenu
	#in_reg.RegisterEvent( "QMenuPrintValueChanged" , c.siOnValueChange)
	#in_reg.RegisterEvent( "AutoCenterNewObjects" , c.siOnObjectAdded) #Test event to center new objects

	#=== Register Menus ===
	in_reg.RegisterMenu( c.siMenuMainTopLevelID  , "QMenu" , False , True)
	
	
	return True

def XSIUnloadPlugin( in_reg ):
	strPluginName = in_reg.Name
	Print (str(strPluginName) + str(" has been unloaded."),c.siVerbose)
	return true


#=========================================================================================================================		
#====================================== QMenu Configurator UI Callback Functions  ========================================
#=========================================================================================================================	
def QMenuConfigurator_OnInit( ):
	Print ("QMenu: QMenuConfigurator_OnInit called",c.siVerbose)
	initializeQMenuGlobals(False)
	globalQMenu_ConfigStatus = getGlobalObject("globalQMenu_ConfigStatus")
	globalQMenu_ConfigStatus.Changed = True #When opening the PPG we assume that changes are made. This is a simplification but checking every value for changes would be too laborious.
	RefreshQMenuConfigurator()
	#Print ("Currently Inspected PPG's are: " + str(PPG.Inspected))
	PPG.Refresh()

def QMenuConfigurator_OnClosed():
	Print ("QMenuConfigurator_OnClosed called",c.siVerbose)
	
	#Stop recording event keys and view signatures when the configurator PPG is closed
	PPG.DisplayEventKeys_Record.Value = False
	PPG.RecordViewSignature.Value = False
	
def QMenuPreferences_Define(in_ctxt):
	Print ("QMenuPreferences_Define called", c.siVerbose)
	DefaultConfigFile = ""

	oCustomProperty = in_ctxt.Source
	oCustomProperty.AddParameter2("QMenuEnabled",c.siBool,True,null,null,null,null,c.siClassifUnknown,c.siPersistable)	
	oCustomProperty.AddParameter2("FirstStartup",c.siBool,True,null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("QMenuConfigurationFile",c.siString,DefaultConfigFile,null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("ShowQMenu_MenuString",c.siBool,False,null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("ShowQMenuTimes",c.siBool,False,null,null,null,null,c.siClassifUnknown,c.siPersistable)

def QMenuPreferences_DefineLayout(in_ctxt):
	oLayout = in_ctxt.Source	
	oLayout.Clear()
	oLayout.SetAttribute( c.siUIHelpFile, "http://www.keyvis.at/tools/xsi/QMenu")
	
	CustomGFXFilesPath = getCustomGFXFilesPath()
	
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
	
	oLayout.AddGroup("Debug Options")
	#oLayout.AddItem("FirstStartup", "First Startup")
	oLayout.AddItem("ShowQMenu_MenuString","Print QMenu Menu String on menu invokation")
	oLayout.AddItem("ShowQMenuTimes","Print QMenu preparation times")
	oLayout.EndGroup()
	
	#oLayout.AddButton ("OpenConfigurator", "Open QMenu configurator")
	
def QMenuConfigurator_Define( in_ctxt ):
	# Warning! !!Don't set capability flags here (e.g.siReadOnly), it causes errros when copying the property from one object to another (e.g. <parameter>.SetCapabilityFlag (c.siReadOnly,true)   )
	Print ("QMenuConfigurator_Define called", c.siVerbose)
	DefaultConfigFile = ""

	oCustomProperty = in_ctxt.Source

	oCustomProperty.AddParameter2("QMenuConfigurationFile",c.siString,DefaultConfigFile,null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("CommandCategory",c.siString,"_ALL_",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("CommandFilter",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("CommandList",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("ShowHotkeyableOnly",c.siBool,True,null,null,null,null,c.siClassifUnknown,c.siPersistable)	
	oCustomProperty.AddParameter2("ShowScriptingNameInBrackets",c.siBool,False,null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("ShowItemType",c.siInt4,0,null,null,null,null,c.siClassifUnknown,c.siPersistable)
	
	oCustomProperty.AddParameter2("View",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("MenuContexts",c.siInt4,0,null,null,null,null,c.siClassifUnknown,c.siPersistable)
	#oCustomProperty.AddParameter2("ContextConfigurator",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("AutoSelectMenu",c.siBool,True,null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("MenuSets",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("MenuSetName",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("MenuSetChooser",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("ViewMenuSets",c.siInt4,-1,null,null,null,null,c.siClassifUnknown,c.siPersistable)
	
	oCustomProperty.AddParameter2("QuadSelector",c.siInt4,0,null,null,null,null,c.siClassifUnknown,c.siPersistable)	
	oCustomProperty.AddParameter2("MenuFilter",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("Menus",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("MenuChooser",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
	oCustomProperty.AddParameter2("ContextChooser",c.siString,"",null,null,null,null,c.siClassifUnknown,c.siPersistable)
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
	oCustomProperty.AddParameter2("MenuDisplayContext_ScanDepth",c.siInt4,0,null,null,null,null,c.siClassifUnknown,c.siPersistable)
	
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
	#oCustomProperty.AddParameter2("ShowQMenu_MenuString",c.siBool,False,null,null,null,null,c.siClassifUnknown,c.siPersistable)
	#oCustomProperty.AddParameter2("ShowQMenuTimes",c.siBool,False,null,null,null,null,c.siClassifUnknown,c.siPersistable)
	
	
def QMenuConfigurator_DefineLayout( in_ctxt ):
	oLayout = in_ctxt.Source	
	oLayout.Clear()
	oLayout.SetAttribute( c.siUIHelpFile, "http://www.tkeyvis.at/tools/xsi/QMenu")
	
	CustomGFXFilesPath = getCustomGFXFilesPath()
	
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
	oLayout.AddRow()
	oViews = oLayout.AddEnumControl ("View", None, "Configure QMenu for",c.siControlCombo)
	oViews.SetAttribute(c.siUILabelMinPixels,100 )
	oAuto = oLayout.AddItem ("AutoSelectMenu", "Auto-select menu of selected context for editing")
	oLayout.EndRow()
	
	oLayout.AddRow()
	oGr = oLayout.AddGroup("Select Menu Set and Quadrant")
	oGr.SetAttribute(c.siUIWidthPercentage, 15)
	oMSChooser = oLayout.AddEnumControl ("MenuSetChooser", None, "Menu Set", c.siControlCombo)
	oMSChooser.SetAttribute(c.siUINoLabel, True)

	aUIitems = (CustomGFXFilesPath + "QMenu_MenuA.bmp", 0, CustomGFXFilesPath + "QMenu_MenuB.bmp", 1, CustomGFXFilesPath + "QMenu_MenuD.bmp", 3, CustomGFXFilesPath + "QMenu_MenuC.bmp",2)
	oLayout.AddSpacer()
	oLayout.AddStaticText("Select a Quad to Edit")
	oMenuSelector = oLayout.AddEnumControl ("QuadSelector", aUIitems, "Quadrant", c.siControlIconList)
	oMenuSelector.SetAttribute(c.siUINoLabel, True)
	oMenuSelector.SetAttribute(c.siUIColumnCnt,2)
	oMenuSelector.SetAttribute(c.siUILineCnt,2)
	oMenuSelector.SetAttribute(c.siUISelectionColor,0x000ff)

	oLayout.EndGroup() #End of Menu Set Configuration Group

	oCtxGrp = oLayout.AddGroup("Assign QMenu Menus to Contexts")
	oCtxGrp.SetAttribute(c.siUIWidthPercentage, 45)#oLayout.AddSpacer()
	
	#oGR1 = oLayout.AddGroup()
	#oGR1.SetAttribute(c.siUIShowFrame, False)
	oLayout.AddRow()
	oLayout.AddButton ("InsertMenuContext", "Insert Ctxt..")
	oLayout.AddButton ("RemoveMenuContext", "Remove Ctxt")
	oLayout.AddButton ("ReplaceMenuContext", "Replace Ctxt...")
	oLayout.EndRow()
	#oLayout.EndGroup()
	
	oMenuContexts = oLayout.AddEnumControl ("MenuContexts", None, "",c.siControlListBox)
	oMenuContexts.SetAttribute(c.siUINoLabel, True)
	oMenuContexts.SetAttribute(c.siUICY, 135)
	oLayout.AddRow()
	

	
	oGR2 = oLayout.AddGroup()
	oGR2.SetAttribute(c.siUIShowFrame, False)
	oLayout.AddButton ("CtxUp", "Move Up")
	oLayout.AddButton ("CtxDown", "Move Down")
	oLayout.EndGroup()
	
	oGR3 = oLayout.AddGroup()
	oGR3.SetAttribute(c.siUIShowFrame, False)
	oLayout.AddButton ("AssignMenu", "Assign Menu")
	oLayout.AddButton ("RemoveMenu", "Remove Menu")
	oLayout.EndGroup()
	
	oLayout.EndRow()
	oLayout.EndGroup()

	oLayout.AddGroup("Menu Items in QMenu Menu")
	#oLayout.AddRow()
	
	oItems = oLayout.AddEnumControl ("MenuChooser", None, "Menu to edit",c.siControlCombo)
	#oItems.SetAttribute(c.siUIWidthPercentage, 70)
	#oItems.SetAttribute(c.siUICX, 200)
	#oAuto.SetAttribute(c.siUILabelPercentage, 10)
	#oLayout.EndRow()
	
	oLayout.AddRow()
	oMenuItems = oLayout.AddEnumControl ("MenuItems", None, "Menu Items",c.siControlListBox)
	oMenuItems.SetAttribute(c.siUINoLabel, True)
	oMenuItems.SetAttribute(c.siUICY, 135) #113
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
	oLayout.AddSpacer()
	oLayout.AddStaticText("Choose a command, menu, or script item below, then add it to the selected context or menu above...")
	oLayout.AddSpacer()
	oLayout.AddRow()
	oLayout.AddGroup("Existing Softimage Commands")
	#oLayout.AddSpacer()
	oLayout.AddItem ("ShowHotkeyableOnly", "Show Commands supporting key assignment only")
	#oLayout.AddSpacer()
	oLayout.AddItem ("ShowScriptingNameInBrackets", "Show Scripting Name in Brackets")
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

	oLayout.AddGroup("Existing QMenus")
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
	oLayout.AddGroup("Existing Switches and Script Items")
	
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
	oLayout.AddButton("DeleteScriptItem","Delete selected Item")
	oLayout.EndRow()
	oLayout.EndGroup()
	
	oLayout.AddGroup("Edit selected Menu or Script Item properties")
	oLayout.AddItem("MenuItem_Name", "Item Name", c.siControlString)
	oLayout.AddItem("MenuItem_CategoryChooser", "Assign to Category", c.siControlCombo)
	oLayout.AddItem("NewMenuItem_Category", "Define(new) Category", c.siControlString)
	oLayout.AddItem("MenuItem_Switch", "Script Item is a switch")
	oLayout.AddItem("MenuItem_IsActive", "Allow menu code execution")
	oLayout.EndGroup()
	oLayout.EndRow()

	oLayout.AddGroup("Edit selected Menu or Script Item")
	oLayout.AddRow()
	oLanguage = oLayout.AddEnumControl("MenuItem_ScriptLanguage", ("Python","Python","JScript","JScript","VBScript","VBScript"), "      Scripting Language", c.siControlCombo)
	oLayout.AddSpacer(10,1)
	oLayout.AddButton("ExecuteItemCode", "Execute")
	oLayout.AddSpacer(10,1)
	oEditorHeight = oLayout.AddItem ("CodeEditorHeight", "Code Editor Height")
	#oEditorHeight.SetAttribute(c.siUICX, 150)
	#oEditorHeight.SetAttribute(c.siUIWidthPercentage, 10)
	oLayout.EndRow()
	
	oCodeEditor = oLayout.AddItem("MenuItem_Code", "Code", c.siControlTextEditor)
	#oCodeEditor = d.Dispatch( oCodeEditor )	#dispatching does not help either
	#oCodeEditor.SetAttribute(c.siUIHeight, oLayout.Item("CodeEditorHeight").Value)
	Height = 200
	try:
		Height = PPG.CodeEditorHeight.Value
	except:
		pass
	oCodeEditor.SetAttribute(c.siUIHeight, Height)
	oCodeEditor.SetAttribute(c.siUIToolbar, True )
	oCodeEditor.SetAttribute(c.siUILineNumbering, True )
	oCodeEditor.SetAttribute("Folding", True ) #Code folding Broken since XSI7.0
	oCodeEditor.SetAttribute("KeywordFile", getDefaultConfigFilePath ("Python.keywords")) #Code color coding broken since XSI7.0
	oCodeEditor.SetAttribute(c.siUICommentColor, 0xFF00FF) #Comment coloring broken since XSI7.0
	oCodeEditor.SetAttribute(c.siUICapability, c.siCanLoad ) #File Loading menu item broken since XSI7.0
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
	
	oLayout.AddGroup("Assign QMenu Sets to Views")
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
	
	oLayout.AddGroup("Assigned QMenu Set(s) to selected View")
	oSets = oLayout.AddEnumControl ("ViewMenuSets", None, "Menu Sets",c.siControlListBox)
	oSets.SetAttribute(c.siUINoLabel, True)
	oLayout.AddRow()
	oLayout.AddButton ("InsertSetInView", "Insert Menu Set")
	oLayout.AddButton ("RemoveSetInView", "Remove Menu Set")
	oLayout.AddButton ("MoveSetUpInView", "Move Up")
	oLayout.AddButton ("MoveSetDownInView", "Move Down")
	oLayout.EndRow()
	oLayout.EndGroup()

	#oLayout.AddGroup("Assign QMenu Contexts to Menu Sets")
	#oLayout.AddRow() #New Row of Groups
	
	oLayout.AddGroup("Existing QMenu Sets")
	oMenuSets = oLayout.AddEnumControl ("MenuSets", None, "", c.siControlListBox)
	oMenuSets.SetAttribute(c.siUINoLabel, True)
	oMenuSets.SetAttribute(c.siUICY, 152)
	oLayout.AddItem("MenuSetName","Name")
	oLayout.AddRow()
	oLayout.AddButton("CreateMenuSet", "Create Menu Set")
	oLayout.AddButton("DeleteMenuSet", "Delete Menu Set")
	oLayout.EndRow()
	oLayout.EndGroup() #Edit QMenu_MenuSets
	
	
	oLayout.EndRow()
	#oLayout.EndRow() 
	#oLayout.EndGroup() 
	oLayout.EndGroup()
	
	oLayout.AddGroup("Existing QMenu Contexts")
	oDisplayContexts = oLayout.AddEnumControl ("MenuDisplayContexts", None, "Menu Contexts", c.siControlListBox)
	oDisplayContexts.SetAttribute(c.siUINoLabel, True)
	oLayout.AddRow()
	oLayout.AddButton("CreateNewDisplayContext","Create New Context")
	oLayout.AddButton("DeleteDisplayContext","Delete Selected Context")
	oLayout.EndRow()
	
	oLayout.AddRow()
	oLayout.AddItem("MenuDisplayContext_Name", "Name", c.siControlString)
	oLayout.AddEnumControl("MenuDisplayContext_ScriptLanguage", ("Python","Python","JScript","JScript","VBScript","VBScript"), "Language", c.siControlCombo)
	oScanDepth = oLayout.AddItem("MenuDisplayContext_ScanDepth", "Required Scan Depth")
	oScanDepth.SetAttribute(c.siUINoSlider, True)
	#oScanDepth.SetAttribute(c.siUICX, 100)	
	oLayout.AddButton("ExecuteDisplayContextCode", "Execute")
	oLayout.EndRow()
	
	oCodeEditor2 = oLayout.AddItem("MenuDisplayContext_Code", "Code", c.siControlTextEditor)
	#oCodeEditor2.SetAttribute(c.siUIValueOnly, True)
	oCodeEditor2.SetAttribute(c.siUIToolbar, True )
	oCodeEditor2.SetAttribute(c.siUILineNumbering, True )
	oCodeEditor2.SetAttribute(c.siUIFolding, True )
	oCodeEditor2.SetAttribute(c.siUIKeywordFile, getDefaultConfigFilePath ("Python.Keywords"))
	oCodeEditor2.SetAttribute(c.siUICommentColor, 0xFF00FF)
	oCodeEditor2.SetAttribute(c.siUICapability, c.siCanLoad )    #Does not work?
	oLayout.EndGroup()
	
	#================================ Debugging Options Tab ============================================================================================
	oLayout.AddTab("Tools")
	oLayout.AddButton ("Refresh", "Reset/Delete all QMenu configuration data")
	#oLayout.AddGroup("Debug Options")
	#oLayout.AddItem("ShowQMenu_MenuString","Print QMenu Menu String on menu invokation")
	#oLayout.AddItem("ShowQMenuTimes","Print QMenu preparation times")
	#oLayout.EndGroup()

def QMenuConfigurator_CodeEditorHeight_OnChanged():
	oCodeEditor = PPG.PPGLayout.Item("MenuItem_Code")
	intHeight = PPG.CodeEditorHeight.Value
	oCodeEditor.SetAttribute(c.siUIHeight, intHeight)
	PPG.Refresh()

def QMenuPreferences_ShowQMenu_MenuString_OnChanged():
	val = PPG.ShowQMenu_MenuString.Value
	Application.Preferences.SetPreferenceValue("QMenu.ShowQMenu_MenuString",val)
	#print("Setting preference 'QMenu.ShowQMenu_MenuString' to: " + str(val))
	
def QMenuPreferences_ShowQMenuTimes_OnChanged():
	val = PPG.ShowQMenuTimes.Value
	Application.Preferences.SetPreferenceValue("QMenu.ShowQMenuTimes",val)
	#print("Setting preference 'QMenu.ShowQMenuTimes' to: " + str(val))
	
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
	
	if CurrentViewName != "":
		oCurrentView = getQMenu_ViewSignatureByName(CurrentViewName)
		MenuSetIndex = PPG.ViewMenuSets.Value
		if MenuSetIndex > 0:
			oCurrentSet = oCurrentView.MenuSets[MenuSetIndex]

			oCurrentView.removeMenuSet(MenuSetIndex)
			oCurrentView.insertMenuSet(MenuSetIndex -1,oCurrentSet)
			PPG.ViewMenuSets.Value = MenuSetIndex -1
			RefreshViewMenuSets()
			RefreshViewMenuSetsWidgets()
			RefreshMenuSetChooser()
			PPG.Refresh()
		
def QMenuConfigurator_MoveSetDownInView_OnClicked():
	Print("QMenuConfigurator_MoveSetUpInView_OnClicked", c.siVerbose)
	CurrentViewName = PPG.ViewSignatures.Value
	
	if CurrentViewName != "":
		oCurrentView = getQMenu_ViewSignatureByName(CurrentViewName)
		MenuSetIndex = PPG.ViewMenuSets.Value
		if MenuSetIndex < len(oCurrentView.MenuSets)-1:
			oCurrentSet = oCurrentView.MenuSets[MenuSetIndex]

			oCurrentView.removeMenuSet(MenuSetIndex)
			oCurrentView.insertMenuSet(MenuSetIndex +1,oCurrentSet)
			PPG.ViewMenuSets.Value = MenuSetIndex +1
			RefreshViewMenuSets()
			RefreshViewMenuSetsWidgets()
			RefreshMenuSetChooser()
			PPG.Refresh()

def QMenuConfigurator_ViewMenuSet_OnChanged():
	Print ("QMenuConfigurator_ViewMenuSet_OnChanged called",c.siVerbose)
	RefreshViewMenuSetsWidgets()
	PPG.Refresh()

def QMenuConfigurator_MenuItems_OnChanged():
	Print("QMenuConfigurator_MenuItems_OnChanged called", c.siVerbose)
	RefreshMenuSetDetailsWidgets()
	PPG.Refresh()
	
def QMenuConfigurator_AutoSelectMenu_OnChanged():
	Print("QMenuConfigurator_AutoSelectMenu_Onchanged called", c.siVerbose)
	if PPG.AutoSelectMenu.Value == True:
		PPG.MenuContexts.SetCapabilityFlag (c.siReadOnly,False)
		Print("Enabling MenuChooser...")
		#PPG.MenuChooser.SetCapabilityFlag (c.siReadOnly,True)
		#PPG.MenuSetChooser.SetCapabilityFlag ( c.siReadOnly , False)
		PPG.QuadSelector.SetCapabilityFlag ( c.siReadOnly , False)
		PPG.View.SetCapabilityFlag ( c.siReadOnly , False)
		#RefreshMenuChooser()
		RefreshMenuSetDetailsWidgets()
		RefreshMenuItems()
		PPG.Refresh()
	else:
		PPG.MenuContexts.SetCapabilityFlag ( c.siReadOnly , True)
		#PPG.MenuChooser.SetCapabilityFlag ( c.siReadOnly , False)
		#PPG.MenuSetChooser.SetCapabilityFlag ( c.siReadOnly , True)
		PPG.QuadSelector.SetCapabilityFlag ( c.siReadOnly , True)
		PPG.View.SetCapabilityFlag ( c.siReadOnly , True)
		RefreshMenuSetDetailsWidgets()
		PPG.Refresh()

def QMenuConfigurator_MenuChooser_OnChanged():
	Print ("QMenuConfigurator_MenuChooser_OnChanged called",c.siVerbose)
	RefreshMenuItems()
	RefreshMenuSetDetailsWidgets()
	PPG.refresh()
	
def QMenuConfigurator_SaveConfig_OnClicked ():
	Print("QMenuConfigurator_SaveConfig_OnClicked called",c.siVerbose)
	fileName = PPG.QMenuConfigurationFile.Value
	result = saveQMenuConfiguration(fileName)
	if result == False:
		Print("Failed saving QMenu Configuration to '" + fileName + "'! Please check write permissions and try again.",c.siError)
	else:
		Print("Successfully saved QMenu Configuration to '" + fileName + "' ")
	
def QMenuConfigurator_LoadConfig_OnClicked():
	Print("QMenuConfigurator_LoadConfig_OnClicked called",c.siVerbose)
	fileName = PPG.QMenuConfigurationFile.Value
		
	if str(fileName) != "":
		result = False
		result = loadQMenuConfiguration(fileName)
		if result == True:
			Print("Successfully loaded QMenu Configuration.")
			RefreshQMenuConfigurator()
			PPG.Refresh()

def QMenuPreferences_SaveConfig_OnClicked ():
	Print("QMenuPreferences_SaveConfig_OnClicked called",c.siVerbose)
	fileName = PPG.QMenuConfigurationFile.Value
	result = saveQMenuConfiguration(fileName)
	if result == False:
		Print("Failed saving QMenu Configuration to '" + fileName + "'! Please check write permissions and try again.",c.siError)
	else:
		Print("Successfully saved QMenu Configuration to '" + fileName + "' ")
		
def QMenuPreferences_LoadConfig_OnClicked():
	Print("QMenuPreferences_LoadConfig_OnClicked called",c.siVerbose)
	fileName = PPG.QMenuConfigurationFile.Value
		
	if str(fileName) != "":
		result = False
		result = loadQMenuConfiguration(fileName)
		if result == True:
			Print("Successfully loaded QMenu Configuration.")
			
def QMenuConfigurator_QMenuConfigurationFile_OnChanged():
	Print("QMenuConfigurator_QMenuConfigurationFile_OnChanged called",c.siVerbose)
	#When config filename is changed we assume that the user knows what he's doing and do not load default config on next startup
	App.Preferences.SetPreferenceValue("QMenu.FirstStartup",False)
	
	App.Preferences.SetPreferenceValue("QMenu.QMenuConfigurationFile", PPG.QMenuConfigurationFile.Value)
	App.SetValue("Preferences.QMenu.QMenuConfigurationFile", PPG.QMenuConfigurationFile.Value)

def QMenuPreferences_QMenuConfigurationFile_OnChanged():
	Print("QMenuPreferences_QMenuConfigurationFile_OnChanged called",c.siVerbose)
	#When config filename is changed we assume that the user knows what he's doing and do not load default config on next startup
	App.Preferences.SetPreferenceValue("QMenu.FirstStartup",False)
	
	oConfigurator = getQMenuConfiguratorCustomProperty() 
	if oConfigurator != None:
		oConfigurator.QMenuConfigurationFile = App.Preferences.GetPreferenceValue("QMenu.QMenuConfigurationFile")
	
def QMenuConfigurator_CommandCategory_OnChanged():
	Print("CommandCategory_OnChanged called", c.siVerbose)
	RefreshCommandList ()
	PPG.Refresh()

def QMenuConfigurator_CommandFilter_OnChanged():
	Print("CommandFilter_OnChanged called", c.siVerbose)
	RefreshCommandList()
	RefreshMenuItemDetailsWidgets()
	RefreshMenuSetDetailsWidgets()
	PPG.Refresh()

def QMenuConfigurator_CreateNewScriptItem_OnClicked():
	Print ("QMenuConfigurator_CreateNewScriptItem_OnClicked called",c.siVerbose)
	strCaption = "Please choose Scripting Language for the new Scripted Item"
	lsItems = ["Python","JScript","VBScript"]
	Language = userQuery(strCaption, lsItems)
	if Language > -1: #User did not press Cancel?
		globalQMenu_MenuItems = getGlobalObject("globalQMenu_MenuItems")
		newMenuItem = App.QMenuCreateObject("MenuItem")
		
		#Find the Category for the new menu item
		MenuItem_Category = str()
		MenuItem_Category = PPG.MenuItem_Category.Value

		if (MenuItem_Category == "") or (MenuItem_Category == "_ALL_"):
			MenuItem_Category = "Miscellaneous"	

		
		#Find a unique name for the new menu item
		listKnownMenuItem_Names = list()
		for menuItem in globalQMenu_MenuItems.Items:
			listKnownMenuItem_Names.append (menuItem.Name)

		uniqueName = getUniqueName("New Script Item",listKnownMenuItem_Names)
		
		newMenuItem.Name = uniqueName
		newMenuItem.UID = XSIFactory.CreateGuid()
		newMenuItem.Category = MenuItem_Category
		
	
		if Language == 0: newMenuItem.Code = ("def Script_Execute (oContext): #Dont rename this function \n\t#Put your script code here\n\tpass"); newMenuItem.Language = "Python"
		if Language == 1: newMenuItem.Code = ("function Script_Execute (oContext) {\n\t//Put your script code here\n\tdoNothing = true\n}"); newMenuItem.Language = "JScript"
		if Language == 2: newMenuItem.Code = ("Function Script_Execute (oContext) \n\t' Put your script code here\n\tdoNothing = true\nend Function"); newMenuItem.Language = "VBScript"
		
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
	strCaption = "Please choose Scripting Language for the new Switch Item"
	lsItems = ["Python","JScript","VBScript"]	
	LanguageNumber = userQuery(strCaption, lsItems)
	if LanguageNumber > -1:
		Languages = ("Python","JScript","VBScript")
		Language = Languages [LanguageNumber]		
		
		globalQMenu_MenuItems = getGlobalObject("globalQMenu_MenuItems")
		newMenuItem = App.QMenuCreateObject("MenuItem")
		
		#Find the Category for the new menu item
		MenuItem_Category = str()
		MenuItem_Category = PPG.MenuItem_Category.Value
		
		if (MenuItem_Category == "") or (MenuItem_Category == "_ALL_"):
			MenuItem_Category = "Switches"	

		#Find a unique name for the new menu item
		listKnownMenuItem_Names = list()
		for menuItem in globalQMenu_MenuItems.Items:
			listKnownMenuItem_Names.append (menuItem.Name)

		uniqueName = getUniqueName("New Scripted Switch Item",listKnownMenuItem_Names)
		
		newMenuItem.Name = uniqueName
		newMenuItem.UID = XSIFactory.CreateGuid()
		newMenuItem.Category = MenuItem_Category
		newMenuItem.Switch = True
		newMenuItem.Language = Language

		#Set default code
		if Language == "Python": 
			newMenuItem.Code = ("def Switch_Init ( oContext ): #Don't rename this function\n\t#Add your code here, return value must be boolean and represent the current state of the switch (on or off)\n\treturn False\n\n")
			newMenuItem.Code += ("def Switch_Execute ( oContext ): #Don't rename this function\n\t#Add your code here, it gets executed when the switch item is clicked in a QMenu menu \n\tpass\n\n")
		
		if Language == "JScript": 
			newMenuItem.Code = ("function Switch_Init ( oContext ) //Don't rename this function\n{\n\t//Add your code here, return value must be boolean and represent the current state of the switch (on or off)\n\treturn false\n}\n\n")
			newMenuItem.Code += ("function Switch_Execute ( oContext ) //Don't rename this function\n{\n\t//Add your code here, it gets executed when the switch item is clicked in a QMenu menu \n}")
		
		if Language == "VBScript": 
			newMenuItem.Code = ("Function Switch_Init ( oContext ) ' Don't rename this function\n\t' Add your code here, return value must be boolean and represent the current state of the switch (on or off)\n\tSwitch_Init = false\nend Function\n\n")
			newMenuItem.Code += ("Function Switch_Execute ( oContext ) ' Don't rename this function\n\t' Add your code here, it gets executed when the switch item is clicked in a QMenu menu \n\tdoNothing = True\nend Function")
				
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
	Print ("QMenuConfigurator_MenuFilter_OnChanged called",c.siVerbose)
	CurrentSelectedMenuName = PPG.Menus.Value
	RefreshMenuList()
	ListedMenuNames = PPG.PPGlayout.Item("Menus").UIItems
	if CurrentSelectedMenuName not in ListedMenuNames:
		PPG.Menus.Value = ""
	RefreshMenuItemDetailsWidgets()
	RefreshMenuSetDetailsWidgets()
	PPG.Refresh()
		
def QMenuConfigurator_CreateNewMenu_OnClicked():
	Print ("QMenuConfigurator_CreateNewMenu_OnClicked called",c.siVerbose)
	strCaption = "Please choose Scripting Language for the new Menu"
	lsItems = ["Python","JScript","VBScript"]
	LanguageNumber = userQuery(strCaption, lsItems)
	if LanguageNumber > -1:
		globalQMenu_Menus = getGlobalObject("globalQMenu_Menus")
		listKnownQMenu_MenuNames = list()
		for menu in globalQMenu_Menus.Items:
			listKnownQMenu_MenuNames.append(menu.Name)
		
		UniqueMenuName = getUniqueName("NewQMenu_Menu",listKnownQMenu_MenuNames)
			
		oNewMenu = App.QMenuCreateObject("Menu")
		oNewMenu.Name = UniqueMenuName
		
		Languages = ("Python", "JScript", "VBScript")
		Language = Languages[LanguageNumber]
		
		oNewMenu.Language = Language
		
		if 	Language == "Python":
			oNewMenu.Code = ("def QMenu_Menu_Execute( oContext ):  #Don't rename this function\n\t#Add your script code here\n\tpass")
		
		if 	Language == "JScript":
			oNewMenu.Code = ("function QMenu_Menu_Execute( oContext )  //Don't rename this function\n{\n\t//Add your script code here\n}")

		if 	Language == "VBScript":
			oNewMenu.Code = ("sub QMenu_Menu_Execute( oContext )  'Don't rename this function\n\t'Add your script code here\nend Sub")			
		
		globalQMenu_Menus.addMenu(oNewMenu)

		PPG.MenuFilter.Value = ""
		RefreshMenuList()
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
		globalQMenu_MenuItems = getGlobalObject("globalQMenu_MenuItems")
		
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
		globalQMenu_Menus = getGlobalObject("globalQMenu_Menus")
		CurrentMenuIndex = None
		
		MenusEnum = PPG.PPGLayout.Item("Menus").UIItems
		for oMenu in globalQMenu_Menus.Items:
			if oMenu.Name == CurrentMenuName:
				CurrentMenuIndex = MenusEnum.index(CurrentMenuName)
		
		deleteQMenu_Menu(CurrentMenuName)	
		RefreshMenuList()
			
		if CurrentMenuIndex != None:
			if CurrentMenuIndex < 2: #The first menuitem was selected?
				if len(MenusEnum) > 2: # and more than 1 contexts in the enum list left?
					PreviousMenuName = MenusEnum[CurrentMenuIndex +2]
				else: PreviousMenuName = ""
			else: #the first menu was not selected, make the previous one selected after deletion..
				PreviousMenuName = MenusEnum[CurrentMenuIndex - 2]
						
			PPG.Menus.Value = PreviousMenuName
		
		RefreshMenuContexts()
		RefreshMenuChooser()
		RefreshMenuSetDetailsWidgets()
		RefreshMenuItems()
		RefreshMenuItemDetailsWidgets()
		PPG.Refresh()
					
def QMenuConfigurator_RemoveMenu_OnClicked():
	CurrentMenuSetName = str(PPG.MenuSetChooser.Value)
		
	if CurrentMenuSetName != "":
		oCurrentMenuSet = None
		oChosenMenu = None
		oCurrentMenuSet = getQMenu_MenuSetByName(CurrentMenuSetName)
		
		if oCurrentMenuSet != None: #The menu set was found?
			globalQMenu_Menus = getGlobalObject("globalQMenu_Menus")
			
			if PPG.QuadSelector.Value == 0: CurrentMenus = "A"
			if PPG.QuadSelector.Value == 1: CurrentMenus = "B"
			if PPG.QuadSelector.Value == 2: CurrentMenus = "C"
			if PPG.QuadSelector.Value == 3: CurrentMenus = "D"
			
			CurrentMenuNumber = (PPG.MenuContexts.Value)
			oCurrentMenuSet.setMenutAtIndex (CurrentMenuNumber, None, CurrentMenus)
			RefreshMenuContexts()
			RefreshMenuChooser()
			RefreshMenuSetDetailsWidgets()
			RefreshMenuItems()
			PPG.Refresh()
					
def QMenuConfigurator_AssignMenu_OnClicked():
	Print ("QMenuConfigurator_AssignMenu_OnClicked called",c.siVerbose)
	globalQMenu_MenuSets = getGlobalObject("globalQMenu_MenuSets")
	CurrentMenuSetName = str(PPG.MenuSetChooser.Value)
		
	if CurrentMenuSetName != "":
		oCurrentMenuSet = None
		oChosenMenu = None
		oCurrentMenuSet = getQMenu_MenuSetByName(CurrentMenuSetName)
		
		if oCurrentMenuSet != None:
			globalQMenu_Menus = getGlobalObject("globalQMenu_Menus")
			
			if PPG.QuadSelector.Value == 0: CurrentMenus = "A"
			if PPG.QuadSelector.Value == 1: CurrentMenus = "B"
			if PPG.QuadSelector.Value == 2: CurrentMenus = "C"
			if PPG.QuadSelector.Value == 3: CurrentMenus = "D"
			
			CurrentMenuNumber = (PPG.MenuContexts.Value)
			ChosenMenuName = str(PPG.Menus.Value)
			if ((ChosenMenuName != "")  and (CurrentMenuNumber > -1)):
				if (ChosenMenuName != "_NONE_"):
					oChosenMenu = getQMenu_MenuByName(ChosenMenuName )

				oCurrentMenuSet.setMenutAtIndex (CurrentMenuNumber, oChosenMenu, CurrentMenus)
				RefreshMenuContexts()
				PPG.MenuContexts.Value = CurrentMenuNumber
				
	if PPG.AutoSelectMenu.Value == True:
		RefreshMenuChooser()
		RefreshMenuSetDetailsWidgets()
		RefreshMenuItems()
	PPG.Refresh()

def QMenuConfigurator_MenuContexts_OnChanged():
	Print ("QMenuConfigurator_MenuContexts_OnChanged called",c.siVerbose)
		
	#RefreshMenuSetDetailsWidgets()
	if PPG.AutoSelectMenu.Value == True:
		#RefreshMenuChooser() 
		#RefreshMenuItemDetailsWidgets()
		RefreshMenuSetDetailsWidgets()
		RefreshMenuItems()
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
			oItemToInsert.Name = oCmdToInsert.Name
			oItemToInsert.UID = oCmdToInsert.UID

	#Insert a script item in case it was selected	
		if PPG.MenuItemList.Value != "":
			oItemToInsert = getQMenu_MenuItemByName ( PPG.MenuItemList.Value)

	#Insert a menu in case it was selected
		if PPG.Menus.Value != "":
			oItemToInsert = getQMenu_MenuByName ( PPG.Menus.Value )
			

		if oItemToInsert != None:
			oCurrentMenu.insertMenuItem (CurrentMenuItemIndex, oItemToInsert)
			
			RefreshMenuItems()
			PPG.MenuItems.Value = CurrentMenuItemIndex
			RefreshMenuSetDetailsWidgets()
			PPG.Refresh()
	gc.collect()

def QMenuConfigurator_MenuItem_Name_OnChanged():
	Print("QMenuConfigurator_MenuItem_Name_OnChanged called", c.siVerbose)
	
	if PPG.MenuItem_Name.Value != "":
		globalQMenu_MenuItems = getGlobalObject("globalQMenu_MenuItems")
		globalQMenu_Menus = getGlobalObject("globalQMenu_Menus")
		
		NewMenuItem_Name = ""
		Done = False
		KnownMenuItemNames = list()
		oItem = None
		RefreshRequired = False
		
		#Lets see if a Script Item is selected whose name shall be changed
		if PPG.MenuItemList.Value != "":
			for oMenuItem in globalQMenu_MenuItems.Items:
				KnownMenuItemNames.append(oMenuItem.Name) #Get all known Script Items names so we can later find a new uinique name
				
			oItem = getQMenu_MenuItemByName(PPG.MenuItemList.Value)
			Done = True
		
		#A Script item was not selected, lets see if a menu was selected
		if Done == False:
			KnownMenuItemNames = list()
			if PPG.Menus.Value != "":
				for oMenu in globalQMenu_Menus.Items:
					KnownMenuItemNames.append(oMenu.Name) #Get all known Menu names so we can later find a new unique name
				
				oItem = getQMenu_MenuByName(PPG.Menus.Value)
			
		if oItem != None:
			if oItem.Name != PPG.MenuItem_Name.Value:
				NewMenuItem_Name = getUniqueName(PPG.MenuItem_Name.Value, KnownMenuItemNames)
				oItem.Name = NewMenuItem_Name	
		
		#Select the renamed object in the respective list view
		if PPG.MenuItemList.Value != "":
			PPG.MenuItemList.Value = NewMenuItem_Name
			#PPG.Menus.Value = ""
			SelectedMenuItem = PPG.MenuItems.Value
			RefreshMenuItemList()
			RefreshMenuItems()
			PPG.MenuItems.Value = SelectedMenuItem
			RefreshMenuItemDetailsWidgets()
			PPG.Refresh()
			
		if PPG.Menus.Value != "":
			PPG.MenuFilter.Value = ""
			PPG.Menus.Value = NewMenuItem_Name
			PPG.MenuItemList.Value = ""
			
			SelectedMenuItem = PPG.MenuItems.Value
			RefreshMenuContexts()
			RefreshMenuChooser()
			RefreshMenuSetDetailsWidgets()
			
			RefreshMenuItems()
			PPG.MenuItems.Value = SelectedMenuItem
			RefreshMenuList()
			#SelectedMenuContext = PPG.MenuContexts.Value
			#PPG.MenuContexts.Value = SelectedMenuContext
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
	globalQMenu_MenuItems = getGlobalObject("globalQMenu_MenuItems")
	
	NewMenuItem_Category = PPG.NewMenuItem_Category.Value.replace(";","_")

	for menuItem in globalQMenu_MenuItems.Items:
		if menuItem.Name == CurrentMenuItem_Name:
			menuItem.Category = NewMenuItem_Category
			
	RefreshMenuItem_CategoryList()
	
	if CurrentMenuItem_Category != "_ALL_": 
		PPG.MenuItem_Category.Value = NewMenuItem_Category
		
	RefreshMenuItem_CategoryChooserList()
	RefreshMenuItemList()

	RefreshMenuItemDetailsWidgets()
	#PPG.NewMenuItem_Category.Value = menuItem.Category
	PPG.Refresh()

def QMenuConfigurator_MenuItem_Switch_OnChanged():
	Print("QMenuConfigurator_NewMenuItem_Category_OnChanged called", c.siVerbose)
	CurrentMenuItem_Name = PPG.MenuItemList.Value
	MenuItem_Switch = PPG.MenuItem_Switch.Value
	globalQMenu_MenuItems = getGlobalObject("globalQMenu_MenuItems")
	
	for menuItem in globalQMenu_MenuItems.Items:
		if menuItem.Name == CurrentMenuItem_Name:
			menuItem.Switch = MenuItem_Switch
			
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
			oMenuItem.Language = NewScriptLanguage
		
	elif PPG.Menus.Value != "":
		oMenu = getQMenu_MenuByName(PPG.Menus.Value)
		if oMenu != None:
			oMenu.Language = NewScriptLanguage

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
			oMenuItem.Code = PPG.MenuItem_Code.Value
		
	elif PPG.Menus.Value != "":
		oMenu = getQMenu_MenuByName(PPG.Menus.Value)
		if oMenu != None:
			oMenu.Code = PPG.MenuItem_Code.Value
			
def QMenuConfigurator_MenuItem_CategoryChooser_OnChanged():
	Print("QMenuConfigurator_MenuItem_CategoryChooser_OnChanged called", c.siVerbose)
	CurrentMenuItem_Name = PPG.MenuItemList.Value
	CurrentMenuItem_Category = PPG.MenuItem_Category.Value
	NewMenuItem_Category = PPG.MenuItem_CategoryChooser.Value
	
	globalQMenu_MenuItems = getGlobalObject("globalQMenu_MenuItems")
	for menuItem in globalQMenu_MenuItems.Items:
		if menuItem.Name == CurrentMenuItem_Name:
			menuItem.Category = NewMenuItem_Category 
	
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
	
	#globalQMenu_MenuItems = getGlobalObject("globalQMenu_MenuItems")
	globalQMenu_Menus = getGlobalObject("globalQMenu_Menus")
	
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
			oItem.ExecuteCode = PPG.MenuItem_IsActive.Value

def QMenuConfigurator_QuadSelector_OnChanged():
	Print("QMenuConfigurator_QuadSelector_OnChanged called", c.siVerbose)
	#RefreshContextConfigurator()
	RefreshMenuContexts()
	PPG.MenuContexts.Value = -1
	#RefreshMenuChooser()
	RefreshMenuSetDetailsWidgets()
	RefreshMenuItems()
	PPG.Refresh()

def QMenuConfigurator_View_OnChanged():
	Print("QMenuConfigurator_View_OnChanged()", c.siVerbose)
	RefreshMenuSetChooser()
	#RefreshMenuChooser()
	RefreshMenuContexts()
	PPG.MenuContexts.Value = -1
	RefreshMenuSetDetailsWidgets()
	RefreshMenuItems()
	PPG.Refresh()

def QMenuConfigurator_MenuSetChooser_OnChanged():
	Print("QMenu: QMenuConfigurator_MenuSetChooser_OnChanged called", c.siVerbose)
	RefreshMenuContexts()
	PPG.MenuContexts.Value = -1
	RefreshMenuChooser()
	RefreshMenuSetDetailsWidgets()
	RefreshMenuItems()
	PPG.Refresh()
	
def QMenuConfigurator_CreateMenuSet_OnClicked():
	Print("QMenuConfigurator_CreateMenuSet_OnClicked called", c.siVerbose)
	globalQMenu_MenuSets = getGlobalObject("globalQMenu_MenuSets")
	globalQMenu_MenuSetNamesList = list()
	for Set in globalQMenu_MenuSets.Items:
		globalQMenu_MenuSetNamesList.append(Set.Name)
	
	newSetName = getUniqueName("NewQMenu_MenuSet",globalQMenu_MenuSetNamesList)
	
	newSet = App.QMenuCreateObject("MenuSet")
	newSet.Name = newSetName
	
	globalQMenu_MenuSets.addSet(newSet)
	RefreshMenuSets()
	PPG.MenuSets.Value = newSetName
	PPG.MenuSetName.Value = newSetName
	PPG.MenuSetName.SetCapabilityFlag(c.siReadOnly, False)
	PPG.PPGLayout.Item("DeleteMenuSet").SetAttribute (c.siUIButtonDisable, False)
	
	RefreshViewMenuSetsWidgets()
	RefreshMenuSetChooser()
	PPG.Refresh()
	
def QMenuConfigurator_MenuSets_OnChanged():
	Print("QMenuConfigurator_MenuSets_OnChanged called", c.siVerbose)
	PPG.PPGLayout.Item("DeleteMenuSet").SetAttribute (c.siUIButtonDisable, True)
	#PPG.PPGLayout.Item("CreateMenuSet").SetAttribute (c.siUIButtonDisable, True)
	
	PPG.MenuSetName.Value = PPG.MenuSets.Value
	if PPG.MenuSets.Value != "":
		PPG.PPGLayout.Item("DeleteMenuSet").SetAttribute (c.siUIButtonDisable, False)
		PPG.MenuSetName.SetCapabilityFlag(c.siReadOnly, False)
	#RefreshContextConfigurator()
	RefreshViewMenuSetsWidgets()
	PPG.Refresh()

def QMenuConfigurator_MenuSetName_OnChanged():
	Print("QMenuConfigurator_MenuSetName_OnChanged called", c.siVerbose)
	NewMenuSetName = PPG.MenuSetName.Value
	CurrentMenuSetName = PPG.MenuSets.Value
	#Disable name field and delete button
	PPG.MenuSetName.SetCapabilityFlag(c.siReadOnly, True)
	PPG.PPGLayout.Item("DeleteMenuSet").SetAttribute (c.siUIButtonDisable, True)

	if NewMenuSetName != "" :
		if NewMenuSetName != CurrentMenuSetName:		
			globalQMenu_MenuSets = getGlobalObject("globalQMenu_MenuSets")
			globalQMenu_MenuSetNames = list()
			for oMenuSet in globalQMenu_MenuSets.Items:
				globalQMenu_MenuSetNames.append(oMenuSet.Name)
			
			uniqueMenuSetName = getUniqueName(NewMenuSetName, globalQMenu_MenuSetNames)

			
			for oMenuSet in globalQMenu_MenuSets.Items:
				if oMenuSet.Name == PPG.MenuSets.Value:
					oMenuSet.Name = uniqueMenuSetName
					# = oMenuSet.Name
			
			RefreshMenuSets()
			PPG.MenuSets.Value = uniqueMenuSetName
			PPG.MenuSetName.Value = uniqueMenuSetName
			#Re-enable name field and delete button
			PPG.MenuSetName.SetCapabilityFlag(c.siReadOnly, False)
			PPG.PPGLayout.Item("DeleteMenuSet").SetAttribute (c.siUIButtonDisable, False)
			
			RefreshViewMenuSets()
			RefreshViewMenuSetsWidgets()
			RefreshMenuSetChooser()
			PPG.Refresh()
	else:
		Print("QMenu Menu Set names must not be empty!", c.siWarning)
	
def QMenuConfigurator_DeleteMenuSet_OnClicked():
	Print("QMenuConfigurator_DeleteMenuSet_OnClicked called", c.siVerbose)
	globalQMenu_MenuSets = getGlobalObject("globalQMenu_MenuSets")
	globalQMenu_ViewSignatures = getGlobalObject("globalQMenu_ViewSignatures")
	currentMenuSetName = str(PPG.MenuSets.Value)
	
	#Disable Name field and delete button
	PPG.MenuSetName.SetCapabilityFlag(c.siReadOnly, True) 
	PPG.PPGLayout.Item("DeleteMenuSet").SetAttribute (c.siUIButtonDisable, True)
	
	menuSetNamesEnum = PPG.PPGLayout.Item ("MenuSets").UIItems
	currentMenuSetIndex = None
	
	if currentMenuSetName != "": 
		if len(menuSetNamesEnum) > 0:
			currentMenuSetIndex = menuSetNamesEnum.index(currentMenuSetName)
		
		oCurrentMenuSet = None
		oCurrentMenuSet = getQMenu_MenuSetByName (currentMenuSetName)
		
		if oCurrentMenuSet != None:
			globalQMenu_MenuSets.deleteSet(oCurrentMenuSet)
			for oViewSignature in globalQMenu_ViewSignatures.Items:
				for oSet in oViewSignature.MenuSets:
					if oSet == oCurrentMenuSet:
						oViewSignature.removeMenuSet( oViewSignature.MenuSets.index(oSet))

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
		if PPG.MenuSets.Value != "":
			PPG.MenuSetName.SetCapabilityFlag(c.siReadOnly, False) #Re-enable name field
			PPG.PPGLayout.Item("DeleteMenuSet").SetAttribute (c.siUIButtonDisable, False)
			
		#RefreshContextConfigurator()
		RefreshViewMenuSetsWidgets()
		RefreshMenuSetChooser()
		RefreshMenuContexts()
		RefreshMenuSetDetailsWidgets()
		RefreshMenuItems()
		PPG.Refresh()

def QMenuConfigurator_ViewSignature_OnChanged():
	Print("QMenuConfigurator_ViewSignature_OnChanged", c.siVerbose)
	globalQMenu_ViewSignatures = getGlobalObject("globalQMenu_ViewSignatures")
	currentSignatureName = str(PPG.ViewSignatures.Value)
	
	if currentSignatureName != "":
		for oSignature in globalQMenu_ViewSignatures.Items:
			if oSignature.Name == currentSignatureName:
				oCurrentSignature = oSignature
				oCurrentSignature.Signature = PPG.ViewSignature.Value

def QMenuConfigurator_ViewSignatures_OnChanged():
	Print("QMenuConfigurator_ViewSignatures_OnChanged called", c.siVerbose)
	PPG.ViewMenuSets.Value = -1
	RefreshViewDetailsWidgets()
	RefreshViewMenuSets()
	RefreshViewMenuSetsWidgets()
	PPG.Refresh()
		
def QMenuConfigurator_ViewSignatureName_OnChanged():
	Print("QMenuConfigurator_ViewSignatureName_OnChanged", c.siVerbose)
	currentSignatureName = PPG.ViewSignatures.Value
	newSignatureName = str(PPG.ViewSignatureName.Value)
	
	if newSignatureName != "" :
		if currentSignatureName != newSignatureName:
			globalQMenu_ViewSignatures = getGlobalObject("globalQMenu_ViewSignatures")
			listKnownViewSignatureNames = list()
			
			currentSignatureName = PPG.ViewSignatures.Value
			if str(currentSignatureName) != "":
				for signature in globalQMenu_ViewSignatures.Items:
					listKnownViewSignatureNames.append(signature.Name)
						
				oCurrentSignature = getQMenu_ViewSignatureByName(currentSignatureName)
				if oCurrentSignature != None:
		
					newSignatureName = getUniqueName(newSignatureName,listKnownViewSignatureNames)
					oCurrentSignature.Name = newSignatureName

					RefreshViewSignaturesList()
					RefreshViewChooser()
					#PPG.View.Value = newSignatureName
					PPG.ViewSignatures.Value = oCurrentSignature.Name
					PPG.ViewSignatureName.Value = oCurrentSignature.Name
					PPG.ViewSignature.Value = oCurrentSignature.Signature
	else:
		Print("QMenu View Signture names must not be empty!", c.siWarning)
	
	PPG.ViewSignatureName.Value = PPG.ViewSignatures.Value	

def QMenuConfigurator_AddQMenuViewSignature_OnClicked():
	Print("QMenuConfigurator_AddQMenuViewSignature_OnClicked called", c.siVerbose)
	globalQMenu_ViewSignatures = getGlobalObject("globalQMenu_ViewSignatures")
	
	newSignature = App.QMenuCreateObject("ViewSignature")
	listKnownViewSignatureNames = list()
	for signature in globalQMenu_ViewSignatures.Items:
		listKnownViewSignatureNames.append(signature.Name)
		
	newSignatureName = getUniqueName("NewView",listKnownViewSignatureNames)
	newSignatureString = "Viewer;DS_ChildViewManager;DS_ChildRelationalView;TrayClientWindow;"
	newSignature.Name = newSignatureName
	newSignature.Signature = newSignatureString	
	globalQMenu_ViewSignatures.addSignature(newSignature)
	
	RefreshViewSignaturesList()
	
	PPG.ViewSignatures.Value = newSignatureName
	PPG.ViewSignature.Value = newSignatureString
	PPG.ViewSignatureName.Value = newSignatureName
	
	RefreshViewChooser()
	RefreshViewMenuSets()
	RefreshViewMenuSetsWidgets()
	RefreshViewDetailsWidgets()
	PPG.Refresh()
	
	"""
	PPG.ViewSignatures.Value = previousViewSignatureName
	RefreshViewDetailsWidgets()
	RefreshViewMenuSets()
	RefreshViewMenuSetsWidgets()
	RefreshViewChooser()
	RefreshMenuSetChooser()
	PPG.Refresh()
	"""
		
def QMenuConfigurator_DelQMenuViewSignature_OnClicked():
	Print("QMenuConfigurator_DelQMenuViewSignature_OnClicked called", c.siVerbose)
	
	if str(PPG.ViewSignatures.Value) != "":
		globalQMenu_ViewSignatures = getGlobalObject("globalQMenu_ViewSignatures")
		currentSignatureName = PPG.ViewSignatures.Value
		currentViewIndex = None
		viewSignatureNamesEnum = list()
		
		viewSignatureNamesEnum = PPG.PPGLayout.Item ("ViewSignatures").UIItems
		if len(viewSignatureNamesEnum) > 0:
			currentViewIndex = viewSignatureNamesEnum.index(PPG.ViewSignatures.Value)
			
		for signature in globalQMenu_ViewSignatures.Items:
			if signature.Name == currentSignatureName:
				globalQMenu_ViewSignatures.deleteSignature(signature)
		
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
		RefreshViewMenuSetsWidgets()
		RefreshViewChooser()
		RefreshMenuSetChooser()
		PPG.Refresh()
	
def QMenuConfigurator_RecordViewSignature_OnChanged():
	if PPG.RecordViewSignature.Value == True:
		Print("Please move the mouse cursor over the desired window area and press any key on the keyboard", c.siWarning)
		
def QMenuConfigurator_CreateNewDisplayContext_OnClicked():
	Print("QMenuConfigurator_CreateNewDisplayContext_OnClicked called", c.siVerbose)
	strCaption = "Please choose Scripting Language for the new Display Context"
	lsItems = ["Python","JScript","VBScript"]
	LanguageNumber = userQuery(strCaption, lsItems)

	if LanguageNumber > -1:
		Languages = ("Python","JScript","VBScript")
		Language = Languages[LanguageNumber]
		globalQMenu_DisplayContexts = getGlobalObject("globalQMenu_DisplayContexts")
		
		uniqueDisplayContextName = "NewDisplayContext"
		DisplayContextNames = list()
		for oDisplayContext in globalQMenu_DisplayContexts.Items:
			DisplayContextNames.append(oDisplayContext.Name)
		
		uniqueDisplayContextName = getUniqueName(uniqueDisplayContextName,DisplayContextNames)
		
		oNewDisplayContext = App.QMenuCreateObject("MenuDisplayContext")
		oNewDisplayContext.Name = uniqueDisplayContextName
		oNewDisplayContext.Language = Language
		
		if Language == "Python":
			oNewDisplayContext.Code = ("def QMenuContext_Execute( oContext ): #This function must not be renamed!\n\t#Add your code here\n\treturn True\t#This function must return a boolean")
		if Language == "JScript":
			oNewDisplayContext.Code = ("function QMenuContext_Execute( oContext ) //This function must not be renamed!\n{\n\t//Add your code here\n\treturn true\t//This function must return a boolean\n}")
		if Language == "VBScript":
			oNewDisplayContext.Code = ("Function QMenuContext_Execute( oContext ) 'This function must not be renamed!\n\t'Add your code here\n\tQMenuContext_Execute = True\t'This function must return a boolean\n end Function")
		
		globalQMenu_DisplayContexts.addContext(oNewDisplayContext)
		RefreshMenuDisplayContextsList()
		PPG.MenuDisplayContexts.Value = uniqueDisplayContextName
		RefreshMenuDisplayContextDetailsWidgets()
		PPG.Refresh()

def QMenuConfigurator_DeleteDisplayContext_OnClicked():
	Print("QMenuConfigurator_DeleteDisplayContext_OnClicked called", c.siVerbose)
	CurrentMenuDisplayContextName = PPG.MenuDisplayContexts.Value
	if str(CurrentMenuDisplayContextName) != "":
		globalQMenu_DisplayContexts = getGlobalObject("globalQMenu_DisplayContexts")
		globalQMenu_MenuSets = getGlobalObject("globalQMenu_MenuSets")

		CurrentContextIndex = None
		MenuDisplayContextsEnum = PPG.PPGLayout.Item("MenuDisplayContexts").UIItems
		
		oCurrentDisplayContext = None
		for oDisplayContext in globalQMenu_DisplayContexts.Items:
			if oDisplayContext.Name == CurrentMenuDisplayContextName:
				oCurrentDisplayContext = oDisplayContext
				
		#Delete Context from MenuSets
		if oCurrentDisplayContext != None:
			for oMenuSet in globalQMenu_MenuSets.Items:
				try:
					Index = oMenuSet.AContexts.index(oCurrentDisplayContext)
					oMenuSet.removeContextAtIndex(Index, "A")
					oMenuSet.removeMenuAtIndex(Index,"A")
				except:
					DoNothin = true
				try:
					Index = oMenuSet.BContexts.index(oCurrentDisplayContext)
					oMenuSet.removeContextAtIndex(Index, "B")
					oMenuSet.removeMenuAtIndex(Index,"B")
				except:
					DoNothin = true
				try:
					Index = oMenuSet.CContexts.index(oCurrentDisplayContext)
					oMenuSet.removeContextAtIndex(Index, "C")
					oMenuSet.removeMenuAtIndex(Index,"C")
				except:
					DoNothin = true
				try:
					Index = oMenuSet.DContexts.index(oCurrentDisplayContext)
					oMenuSet.removeContextAtIndex(Index, "D")
					oMenuSet.removeMenuAtIndex(Index,"D")
				except:
					DoNothin = true

		#Delete Context from globals
		globalQMenu_DisplayContexts.deleteContext(oCurrentDisplayContext)
		CurrentContextIndex = MenuDisplayContextsEnum.index(CurrentMenuDisplayContextName)
		
		RefreshMenuDisplayContextsList()
		#RefreshContextConfigurator()
			
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
	oCurrentMenuDisplayContext = getQMenu_MenuDisplayContextByName (PPG.MenuDisplayContexts.Value)
	
	if oCurrentMenuDisplayContext != None:
		#PPG.MenuDisplayContext_Name.Value = oCurrentMenuDisplayContext.Name
		#PPG.MenuDisplayContext_Code.Value = oCurrentMenuDisplayContext.Code
		#PPG.MenuDisplayContext_ScriptLanguage.Value = oCurrentMenuDisplayContext.Language
		#PPG.MenuDisplayContext_ScanDepth.Value = oCurrentMenuDisplayContext.ScanDepth
		RefreshMenuDisplayContextDetailsWidgets()
	
def QMenuConfigurator_MenuDisplayContext_Name_OnChanged():
	Print("QMenuConfigurator_MenuDisplayContext_Name_OnChanged called", c.siVerbose)
	NewMenuDisplayContextName = PPG.MenuDisplayContext_Name.Value
	CurrentMenuDisplayContextName = PPG.MenuDisplayContexts.Value
	
	if str(NewMenuDisplayContextName) != "":
		if NewMenuDisplayContextName != CurrentMenuDisplayContextName:
			globalQMenu_DisplayContexts = getGlobalObject("globalQMenu_DisplayContexts")
			oCurrentMenuDisplayContext = None
			CurrentMenuDisplayContextName = PPG.MenuDisplayContexts.Value
			DisplayContextNames = list()
			for oDisplayContext in globalQMenu_DisplayContexts.Items:
				DisplayContextNames.append(oDisplayContext.Name)
				if oDisplayContext.Name == CurrentMenuDisplayContextName:
					oCurrentMenuDisplayContext = oDisplayContext
			
			if oCurrentMenuDisplayContext != None:
				UniqueMenuDisplayContextName = getUniqueName(NewMenuDisplayContextName, DisplayContextNames)
				oCurrentMenuDisplayContext.Name = UniqueMenuDisplayContextName
				RefreshMenuDisplayContextsList()
				PPG.MenuDisplayContexts.Value = UniqueMenuDisplayContextName
				#RefreshContextConfigurator()
				RefreshMenuDisplayContextDetailsWidgets()
				RefreshMenuContexts()
				PPG.Refresh()
	else:
		Print("QMenu Menu Display Context names must not be empty!", c.siWarning)
		PPG.MenuDisplayContext_Name.Value = PPG.MenuDisplayContexts.Value
	
def QMenuConfigurator_MenuDisplayContext_ScriptLanguage_OnChanged():
	Print("QMenuConfigurator_MenuDisplayContext_ScriptLanguage_OnChanged called", c.siVerbose)
	globalQMenu_DisplayContexts = getGlobalObject("globalQMenu_DisplayContexts")
	oCurrentMenuDisplayContext = None
	CurrentMenuDisplayContextName = PPG.MenuDisplayContexts.Value
	MenuDisplayContextLanguage = PPG.MenuDisplayContext_ScriptLanguage.Value
	oCurrentMenuDisplayContext = getQMenu_MenuDisplayContextByName (CurrentMenuDisplayContextName)
	
	#for oDisplayContext in globalQMenu_DisplayContexts.Items:
		#if oDisplayContext.Name == CurrentMenuDisplayContextName:
			#oCurrentMenuDisplayContext = oDisplayContext
	
	if oCurrentMenuDisplayContext != None:
		oCurrentMenuDisplayContext.Language = MenuDisplayContextLanguage
	
	#TODO: implement text widget feature switching as a vbs or JScript function, python does not seem to work
	#oTextWidget = PPG.PPGLayout.Item("MenuDisplayContext_Code")
	#oTextWidget.SetAttribute(c.siUIKeywords , "for in def print if" )
	#oTextWidget.SetAttribute(c.siUIKeywordFile , "C:\users\Administrator\Autodesk\Softimage_7.5\Addons\QMenu\Data\Preferences\Python.Keywords" )

def QMenuConfigurator_MenuDisplayContext_ScanDepth_OnChanged():
	Print("QMenuConfigurator_MenuDisplayContext_ScriptLanguage_OnChanged called", c.siVerbose)
	globalQMenu_DisplayContexts = getGlobalObject("globalQMenu_DisplayContexts")
	oCurrentMenuDisplayContext = None
	CurrentMenuDisplayContextName = PPG.MenuDisplayContexts.Value

	oCurrentMenuDisplayContext = getQMenu_MenuDisplayContextByName (CurrentMenuDisplayContextName)
	
	#for oDisplayContext in globalQMenu_DisplayContexts.Items:
		#if oDisplayContext.Name == CurrentMenuDisplayContextName:
			#oCurrentMenuDisplayContext = oDisplayContext
	
	if oCurrentMenuDisplayContext != None:
		oCurrentMenuDisplayContext.ScanDepth = PPG.MenuDisplayContext_ScanDepth.Value

def QMenuConfigurator_MenuDisplayContext_Code_OnChanged():
	Print("QMenuConfigurator_MenuDisplayContext_Code_OnChanged called", c.siVerbose)
	globalQMenu_DisplayContexts = getGlobalObject("globalQMenu_DisplayContexts")
	oCurrentMenuDisplayContext = None
	CurrentMenuDisplayContextName = PPG.MenuDisplayContexts.Value
	Code = PPG.MenuDisplayContext_Code.Value

	Code = Code.rstrip() #Lets get rid of trailling whitespaces
	Code = Code.replace("\r","") #Lets get rid of carriage returns as these result in extra lines when read back from the config file

	for oDisplayContext in globalQMenu_DisplayContexts.Items:
		if oDisplayContext.Name == CurrentMenuDisplayContextName:
			oCurrentMenuDisplayContext = oDisplayContext
	
	if oCurrentMenuDisplayContext != None:
		oCurrentMenuDisplayContext.Code = Code
		PPG.MenuDisplayContext_Code.Value = oCurrentMenuDisplayContext.Code
		
def QMenuConfigurator_InsertMenuContext_OnClicked():
	Print("QMenuConfigurator_InsertMenuContext_OnClicked called", c.siVerbose)
	
	#Query user for a display context to insert
	globalQmenu_DisplayContexts = getGlobalObject("globalQMenu_DisplayContexts")
	strCaption = ("Choose a Menu Context to insert...")
	lsItems = list()
	for ctxt in globalQmenu_DisplayContexts.Items:
		lsItems.append (ctxt.Name)
	
	#print (str(lsItems))
	#print "=========="
	lsItems.sort()
	#print (str(lsItems))
	
	ContextNumberToInsert = userQuery(strCaption, lsItems)
	if ContextNumberToInsert > -1:
		chosenContextName = lsItems[ContextNumberToInsert]
		#Print ("Context numer chosen: " + str(ContextNumberToInsert))
		oChosenContext = getQMenu_MenuDisplayContextByName(chosenContextName)
		#Print("Chosen Context's Name is: " + str(oChosenContext.Name))
		
		if oChosenContext != None:
			#oContextToInsert = globalQmenu_DisplayContexts.Items[ContextNumberToInsert]
		
			CurrentContextNumber = PPG.MenuContexts.Value
			if CurrentContextNumber < 0: CurrentContextNumber = 0
				
			CurrentMenuSetName = PPG.MenuSetChooser.Value
			CurrentQuadrantNumber = PPG.QuadSelector.Value
			
			oCurrentMenuSet = getQMenu_MenuSetByName(CurrentMenuSetName)

			if CurrentQuadrantNumber == 0: Quadrant = "A" 
			if CurrentQuadrantNumber == 1: Quadrant = "B" 
			if CurrentQuadrantNumber == 2: Quadrant = "C" 
			if CurrentQuadrantNumber == 3: Quadrant = "D" 
			
			oCurrentMenuSet.insertContextAtIndex(CurrentContextNumber, oChosenContext, Quadrant )
			oCurrentMenuSet.insertMenuAtIndex(CurrentContextNumber, None, Quadrant)
			
			RefreshMenuContexts()
			PPG.MenuContexts.Value = CurrentContextNumber
			RefreshMenuSetDetailsWidgets()
			RefreshMenuChooser()
			RefreshMenuItems()
			RefreshMenuSetDetailsWidgets()
			RefreshMenuItemDetailsWidgets()
			PPG.Refresh()

def QMenuConfigurator_ReplaceMenuContext_OnClicked():
	Print("QMenuConfigurator_InsertMenuContext_OnClicked called", c.siVerbose)
	
	#Query user for a display context to insert
	globalQmenu_DisplayContexts = getGlobalObject("globalQMenu_DisplayContexts")
	strCaption = ("Choose a Menu Context that shall replace the currently selected one...")
	lsItems = list()
	for ctxt in globalQmenu_DisplayContexts.Items:
		lsItems.append (ctxt.Name)
	
	lsItems.sort()
	ChosenContextNumber = userQuery(strCaption, lsItems)
	
	if ChosenContextNumber > -1:
		ChosenContextsName = lsItems[ChosenContextNumber]
		oContextToInsert = getQMenu_MenuDisplayContextByName(ChosenContextsName)
	
		CurrentContextNumber = PPG.MenuContexts.Value
		if CurrentContextNumber < 0: CurrentContextNumber = 0
			
		CurrentMenuSetName = PPG.MenuSetChooser.Value
		CurrentQuadrantNumber = PPG.QuadSelector.Value
		
		oCurrentMenuSet = getQMenu_MenuSetByName(CurrentMenuSetName)

		if CurrentQuadrantNumber == 0: Quadrant = "A" 
		if CurrentQuadrantNumber == 1: Quadrant = "B" 
		if CurrentQuadrantNumber == 2: Quadrant = "C" 
		if CurrentQuadrantNumber == 3: Quadrant = "D" 
		
		oCurrentMenuSet.setContextAtIndex (CurrentContextNumber, oContextToInsert, Quadrant )
		#oCurrentMenuSet.setMenuAtIndex(CurrentContextNumber, None, Quadrant)
		
		RefreshMenuContexts()
		PPG.MenuContexts.Value = CurrentContextNumber
		#RefreshMenuSetDetailsWidgets()
		RefreshMenuChooser()
		RefreshMenuItems()
		RefreshMenuSetDetailsWidgets()
		RefreshMenuItemDetailsWidgets()
		PPG.Refresh()
					
def QMenuConfigurator_RemoveMenuContext_OnClicked():
	Print("QMenuConfigurator_RemoveMenuContext_OnClicked called", c.siVerbose)
		
	CurrentContextNumber = PPG.MenuContexts.Value
	if CurrentContextNumber > -1:
		CurrentMenuSetName = PPG.MenuSetChooser.Value
		CurrentQuadrantNumber = PPG.QuadSelector.Value
		
		oCurrentMenuSet = getQMenu_MenuSetByName(CurrentMenuSetName)

		if CurrentQuadrantNumber == 0: Quadrant = "A" 
		if CurrentQuadrantNumber == 1: Quadrant = "B"
		if CurrentQuadrantNumber == 2: Quadrant = "C" 
		if CurrentQuadrantNumber == 3: Quadrant = "D"

		oCurrentMenuSet.removeContextAtIndex (CurrentContextNumber , Quadrant)
		oCurrentMenuSet.removeMenuAtIndex( CurrentContextNumber , Quadrant)

		RefreshMenuContexts()
		#Application.LogMessage ("len of UI items is: " + str(len(PPG.PPGLayout.Item("MenuContexts").UIItems)))
		if len(PPG.PPGLayout.Item("MenuContexts").UIItems) > CurrentContextNumber*2:
			PPG.MenuContexts.Value = CurrentContextNumber
		else:
			PPG.MenuContexts.Value = CurrentContextNumber -1
			
		RefreshMenuChooser()
		RefreshMenuSetDetailsWidgets()
		RefreshMenuItemDetailsWidgets()
		RefreshMenuItems()
		PPG.Refresh()

def QMenuConfigurator_CtxUp_OnClicked():
	Print("QMenuConfigurator_CtxUp_OnClicked called", c.siVerbose)
	CurrentContextNumber = PPG.MenuContexts.Value
	if CurrentContextNumber > -1:
		CurrentMenuSetName = PPG.MenuSetChooser.Value
		CurrentQuadrantNumber = PPG.QuadSelector.Value
		
		oCurrentMenuSet = getQMenu_MenuSetByName(CurrentMenuSetName)

		if CurrentQuadrantNumber == 0: Quadrant = "A" ; Contexts = oCurrentMenuSet.AContexts; Menus = oCurrentMenuSet.AMenus
		if CurrentQuadrantNumber == 1: Quadrant = "B" ; Contexts = oCurrentMenuSet.BContexts; Menus = oCurrentMenuSet.BMenus
		if CurrentQuadrantNumber == 2: Quadrant = "C" ; Contexts = oCurrentMenuSet.CContexts; Menus = oCurrentMenuSet.CMenus
		if CurrentQuadrantNumber == 3: Quadrant = "D" ; Contexts = oCurrentMenuSet.DContexts; Menus = oCurrentMenuSet.DMenus

		if CurrentContextNumber > 0:
			NewContextNumber = (CurrentContextNumber -1)
			SavedContext = Contexts[CurrentContextNumber]
			SavedMenu = Menus[CurrentContextNumber]
			
			oCurrentMenuSet.removeContextAtIndex (CurrentContextNumber, Quadrant )
			oCurrentMenuSet.removeMenuAtIndex (CurrentContextNumber , Quadrant )
			
			oCurrentMenuSet.insertContextAtIndex (NewContextNumber, SavedContext, Quadrant )
			oCurrentMenuSet.insertMenuAtIndex (NewContextNumber , SavedMenu, Quadrant )

			#RefreshContextConfigurator()
			RefreshMenuContexts()
			PPG.MenuContexts.Value = NewContextNumber
			RefreshMenuSetDetailsWidgets()
			RefreshMenuItems()
			RefreshMenuItemDetailsWidgets()
			PPG.Refresh()
	
def QMenuConfigurator_CtxDown_OnClicked():
	Print("QMenuConfigurator_CtxDown_OnClicked called", c.siVerbose)
	CurrentContextNumber = PPG.MenuContexts.Value
	if CurrentContextNumber > -1:
		CurrentMenuSetName = PPG.MenuSetChooser.Value
		CurrentQuadrantNumber = PPG.QuadSelector.Value
		
		oCurrentMenuSet = getQMenu_MenuSetByName(CurrentMenuSetName)

		if CurrentQuadrantNumber == 0: Quadrant = "A" ; Contexts = oCurrentMenuSet.AContexts; Menus = oCurrentMenuSet.AMenus
		if CurrentQuadrantNumber == 1: Quadrant = "B" ; Contexts = oCurrentMenuSet.BContexts; Menus = oCurrentMenuSet.BMenus
		if CurrentQuadrantNumber == 2: Quadrant = "C" ; Contexts = oCurrentMenuSet.CContexts; Menus = oCurrentMenuSet.CMenus
		if CurrentQuadrantNumber == 3: Quadrant = "D" ; Contexts = oCurrentMenuSet.DContexts; Menus = oCurrentMenuSet.DMenus

		if CurrentContextNumber < len(Contexts):
			NewContextNumber = (CurrentContextNumber +1)
			SavedContext = Contexts[CurrentContextNumber]
			SavedMenu = Menus[CurrentContextNumber]
			
			oCurrentMenuSet.removeContextAtIndex (CurrentContextNumber, Quadrant )
			oCurrentMenuSet.removeMenuAtIndex (CurrentContextNumber , Quadrant )
			
			oCurrentMenuSet.insertContextAtIndex (NewContextNumber, SavedContext, Quadrant )
			oCurrentMenuSet.insertMenuAtIndex (NewContextNumber , SavedMenu, Quadrant )

			#RefreshContextConfigurator()
			RefreshMenuContexts()
			PPG.MenuContexts.Value = NewContextNumber
			RefreshMenuSetDetailsWidgets()
			RefreshMenuItems()
			RefreshMenuItemDetailsWidgets()
			PPG.Refresh()
		
def QMenuConfigurator_InsertSetInView_OnClicked():
	Print("QMenuConfigurator_InsertSetInView_OnClicked called", c.siVerbose)
	
	#Get the currently selected view
	SelectedViewSignatureName = str(PPG.ViewSignatures.Value)
	oSelectedViewSignature = getQMenu_ViewSignatureByName(SelectedViewSignatureName)
	
	#Get the number of the selected Menu Set in the Currently selected View
	MenuSetIndex = PPG.ViewMenuSets.Value

	#Get Menu Set selected in Existing QMenu Menu Sets
	NameOfSelectedMenuSet = PPG.MenuSets.Value
	oSelectedMenuSet = getQMenu_MenuSetByName(NameOfSelectedMenuSet)
	
	if oSelectedViewSignature != None and oSelectedMenuSet!= None:
		if MenuSetIndex < 0:
			MenuSetIndex = 0

		MenuSets = oSelectedViewSignature.MenuSets
		if oSelectedMenuSet not in MenuSets:
			oSelectedViewSignature.insertMenuSet(MenuSetIndex, oSelectedMenuSet)
			PPG.ViewMenuSets.Value = MenuSetIndex
			
		RefreshViewMenuSets()
		RefreshViewMenuSetsWidgets()
		
		RefreshViewChooser()
		RefreshMenuSetChooser()
		RefreshMenuContexts()
		RefreshMenuSetDetailsWidgets()
		PPG.Refresh()
			
def QMenuConfigurator_RemoveSetInView_OnClicked():
	Print("QMenu: QMenuConfigurator_RemoveSetInView_OnClicked called", c.siVerbose)
	#globalQMenu_MenuSets = getGlobalObject("globalQMenu_MenuSets")
	#globalQMenu_ViewSignatures = getGlobalObject("globalQMenu_ViewSignatures")
	
	#Get the currently selected view
	SelectedViewSignatureName = str(PPG.ViewSignatures.Value)
	oSelectedViewSignature = getQMenu_ViewSignatureByName(SelectedViewSignatureName)
	
	#Get the number of the selected Menu Set in the Currently selected View
	MenuSetIndex = PPG.ViewMenuSets.Value
	
	if MenuSetIndex > -1 and oSelectedViewSignature != None:
		oSelectedViewSignature.removeMenuSet(MenuSetIndex) #Delete the menu set
	RemainingMenuSetCountInView = len(oSelectedViewSignature.MenuSets)
	if MenuSetIndex > RemainingMenuSetCountInView -1:
		PPG.ViewMenuSets.Value = RemainingMenuSetCountInView -1
		RefreshViewMenuSets()
		RefreshViewMenuSetsWidgets()
		RefreshMenuSetChooser()
		RefreshMenuContexts()
		RefreshMenuSetDetailsWidgets()
		PPG.Refresh()		

def QMenuConfigurator_ViewMenuSets_OnChanged():
	Print("QMenu: QMenuConfigurator_ViewMenuSets_OnChanged called", c.siVerbose)
	RefreshViewMenuSetsWidgets()
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
	gc.collect()

def QMenuConfigurator_ExecuteCommand_OnClicked():
	Print("QMenuConfigurator_InspectCommand_OnClicked called", c.siVerbose)
	CurrentCommandUID = PPG.CommandList.Value
	CurrentCommand = getCommandByUID(CurrentCommandUID)
	#CurrentCommand = App.Commands(CurrentCommandName)
	#Print(CurrentCommandName)
	if CurrentCommand != None:
		if CurrentCommand.Name != "":
			CurrentCommand.Execute()
	gc.collect()
										
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
	gc.collect()
	
def QMenuConfigurator_ShowScriptingNameInBrackets_OnChanged():
	Print("QMenuConfigurator_ShowScriptingNameInBrackets_OnChanged called", c.siVerbose)
	RefreshCommandList()
	PPG.Refresh()


# PrepareContextObject fills the global context object, which already stores all selection-relevant information, with the remaining
# information that could be interesting, like the current object into which the context object is passed (ThisQMenuObject, menus, items, commands,...
def PrepareContextObject(oItem):
	QMenuGlobals = getDictionary()
	oContext = getGlobalObject("globalQMenu_ContextObject")
	oContext.storeQMenuObject(oItem)
	oContext.storeMenuItems ( QMenuGlobals("globalQMenu_MenuItems"))
	oContext.storeMenus (QMenuGlobals("globalQMenu_Menus"))
	oContext.storeMenuSets (QMenuGlobals("globalQMenu_MenuSets"))
	oContext.storeDisplayContexts (QMenuGlobals("globalQMenu_DisplayEvents"))
	oContext.storeMenuContexts (QMenuGlobals("globalQMenu_DisplayContexts"))
	return oContext
	
def QMenuConfigurator_ExecuteItemCode_OnClicked():
	Print("QMenuConfigurator_ExecuteItemCode_OnClicked called", c.siVerbose)

	#Is a menu selected?
	#gc.collect()
	QMenuGetSelectionDetails(999999999)
	if PPG.Menus.Value != "":
		oSelectedItem = getQMenu_MenuByName(PPG.Menus.Value)
		if oSelectedItem != None:
			oContext = PrepareContextObject(oSelectedItem)
			
			Language = oSelectedItem.Language
			Code = oSelectedItem.Code
			if Code != "":
				try:
					App.ExecuteScriptCode(Code, Language,"QMenu_Menu_Execute", [oContext])
				except:
					#Print("An Error occured executing the script code of QMenu Menu '" + oSelectedItem.Name + "', please see script editor for details!", c.siError)
					#pass
					raise
				return
	
	#Is a Menu Item selected?
	if PPG.MenuItemList.Value != "":
		oSelectedItem = getQMenu_MenuItemByName(PPG.MenuItemList.Value)
		if oSelectedItem != None:
			bVerboseErrorReporting = True
			Application.QMenuExecuteMenuItem( oSelectedItem , bVerboseErrorReporting )
	#gc.collect()

def QMenuConfigurator_ExecuteDisplayContextCode_OnClicked():
	Print("QMenuConfigurator_ExecuteDisplayContextCode_OnClicked called", c.siVerbose)

	if PPG.MenuDisplayContexts.Value != "":
		oQMenuDisplayContext = getQMenu_MenuDisplayContextByName(PPG.MenuDisplayContexts.Value)
		if oQMenuDisplayContext != None:
			QMenuGetSelectionDetails(999999999) #Refresh global context object
			#Collect some data before we execute the Display context code
			oContext = PrepareContextObject(oQMenuDisplayContext)
			notSilent = False
			ExecuteDisplayContext (oQMenuDisplayContext, oContext, notSilent)

def ExecuteDisplayContext (oQMenuDisplayContext, oContext, silent):
	DisplayMenu = False #Let's assume the function will evaluate to false
	ErrorOccured = False
	if oQMenuDisplayContext != None:
		Code = oQMenuDisplayContext.Code
		Language = oQMenuDisplayContext.Language

		if Language == "Python":
			PyCode = Code + ("\nDisplayMenu = QMenuContext_Execute(oContext)")
			try:
				exec (PyCode) #Execute Python code natively within the context of this function, all passed function variables are known
			except Exception as ContextError:
				Print("An Error occurred executing the QMenu_MenuDiplayContext '" + oQMenuDisplayContext.Name +"', use QMenu Configurator for manual execution and debugging.", c.siError)
				DisplayMenu = False
				ErrorOccured = True

		else: #Language is not Python, use Softimages ExecuteScriptCode Command to execute the code
			DisplayMenu = App.ExecuteScriptCode( Code, Language, "QMenuContext_Execute",[oContext]) #This function returns a variant containing the result of the executed function and...something else we don't care about 
			DisplayMenu = DisplayMenu[0]
		if silent != True: 
			if ErrorOccured == True:
				raise ContextError
			if type(DisplayMenu) != bool:
				Print("QMenu_MenuDisplayContext '" + oQMenuDisplayContext.Name + "' evaluates to: " + str(DisplayMenu) + ", which is not a boolean value!", c.siWarning)
			if type(DisplayMenu) == bool:
				Print("QMenu_MenuDisplayContext '" + oQMenuDisplayContext.Name + "' evaluates to: " + str(DisplayMenu))

	return DisplayMenu

def QMenuConfigurator_RemoveMenuItem_OnClicked():
	Print("QMenuConfigurator_RemoveMenuItem_OnClicked called", c.siVerbose)
	SelectedMenuItemNumber = PPG.MenuItems.Value
	oSelectedMenu = getQMenu_MenuByName(PPG.MenuChooser.Value)
	if oSelectedMenu != None:
		numItems = len(oSelectedMenu.Items)
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
	oMenuItem = oMenu.Items[MenuItemIndex] #Get the actual menu item object from the index

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
	oMenuItem = oMenu.Items[MenuItemIndex]
	if oMenu != None and oMenuItem != None:
		if MenuItemIndex != ((len(oMenu.Items))-1): #If the last one's not selected..
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
		oSelectedItem = oSelectedMenu.Items[PPG.MenuItems.Value]
		if oSelectedItem != None:
			#if oSelectedItem.Type != "Separator":
			if oSelectedItem.Type == "CommandPlaceholder":
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
				
			if oSelectedItem.Type == "QMenu_Menu":
				PPG.Menus.Value = oSelectedItem.Name
				PPG.CommandList.Value = ""
				PPG.MenuItemList.Value = ""
				RefreshMenuItemDetailsWidgets()
				
			if oSelectedItem.Type == "QMenu_MenuItem":
				PPG.MenuItem_Category.Value = oSelectedItem.Category
				PPG.ShowItemType.Value = False
				RefreshMenuItemList ( )
				if oSelectedItem.Name in PPG.PPGLayout.Item("MenuItemList").UIItems:
					PPG.MenuItemList.Value = oSelectedItem.Name
				else:
					PPG.MenuItemList.Value = ""
				#PPG.MenuItemList.Value = oSelectedItem.Name
				PPG.Menus.Value = ""
				PPG.CommandList.Value = ""
				RefreshMenuItemDetailsWidgets()

			PPG.Refresh()
	gc.collect()

def QMenuConfigurator_InsertSeparator_OnClicked():
	Print("QMenuConfigurator_InsertSeparator_OnClicked called", c.siVerbose)
	oCurrentMenu = getQMenu_MenuByName(PPG.MenuChooser.Value)
	oGlobalSeparators = getGlobalObject("globalQMenu_Separators")
	oGlobalSeparator = oGlobalSeparators.Items[0]
			
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
	initializeQMenuGlobals(True)
	RefreshQMenuConfigurator()
	#App.Preferences.SetPreferenceValue("QMenu.FirstStartup",False)
	PPG.Refresh()

def QMenuConfigurator_AddDisplayEvent_OnClicked():
	Print("QMenuConfigurator_AddDisplayEvent_OnClicked called", c.siVerbose)
	oglobalQMenu_DisplayEvents = getGlobalObject("globalQMenu_DisplayEvents")
	globalQMenu_DisplayEvents = oglobalQMenu_DisplayEvents.Items
	#Find the Display event with the highest number
	HighestNumber = (len(globalQMenu_DisplayEvents)) -1
	
	oNewDisplayEvent = App.QMenuCreateObject("DisplayEvent")
	oglobalQMenu_DisplayEvents.addEvent(oNewDisplayEvent)
	RefreshDisplayEvents()
	PPG.DisplayEvent.Value = HighestNumber +1
	RefreshDisplayEventsKeys()
	
	PPG.Refresh()
	
def QMenuConfigurator_DeleteDisplayEvent_OnClicked():
	Print("QMenuConfigurator_DeleteDisplayEvent_OnClicked called", c.siVerbose)
	globalQMenu_DisplayEvents = getGlobalObject("globalQMenu_DisplayEvents")
	EventIndex = PPG.DisplayEvent.Value
	oDisplayEvent = None
	globalQMenu_DisplayEvents.deleteEvent(EventIndex)

	#Uncheck the record checkbox again
	PPG.DisplayEventKeys_Record.Value = False 
	#App.Preferences.SetPreferenceValue("QMenu.DisplayEventKeys_Record", False)
	
	RefreshDisplayEvents()

	if EventIndex == len(globalQMenu_DisplayEvents.Items):
		PPG.DisplayEvent.Value = EventIndex -1
		RefreshDisplayEventsKeys()
	PPG.Refresh()
	
def QMenuConfigurator_DisplayEvent_OnChanged():
	Print("QMenuConfigurator_DisplayEvent_OnCanged", c.siVerbose)
	globalQMenu_DisplayEvents = getGlobalObject("globalQMenu_DisplayEvents")

	if PPG.DisplayEvent.Value > -1:
		oSelectedEvent = globalQMenu_DisplayEvents.Items[PPG.DisplayEvent.Value]
	
	#Uncheck the record checkbox again
	PPG.DisplayEventKeys_Record.Value = False 
	#App.Preferences.SetPreferenceValue("QMenu.DisplayEventKeys_Record", False)
	RefreshDisplayEventsKeys()
	
def QMenuConfigurator_DisplayEventKey_OnChanged():
	Print("QMenuConfigurator_DisplayEventKey_OnCanged", c.siVerbose)
	if (str(PPG.DisplayEventKey.Value) != None):
		#Print("Display event key code entered is: " + str(PPG.DisplayEventKey.Value))
		globalQMenu_DisplayEvents = getGlobalObject("globalQMenu_DisplayEvents")
		try:
			oSelectedEvent = globalQMenu_DisplayEvents.Items[PPG.DisplayEvent.Value]
		except:
			oSelectedEvent = None
		if oSelectedEvent != None:
			oSelectedEvent.Key = PPG.DisplayEventKey.Value
	
	#Uncheck the record checkbox again
	PPG.DisplayEventKeys_Record.Value = False 
	#App.Preferences.SetPreferenceValue("QMenu.DisplayEventKeys_Record", False)
	RefreshDisplayEventsKeys()
	
def QMenuConfigurator_DisplayEventKeyMask_OnChanged():
	Print("QMenuConfigurator_DisplayEventKey_OnCanged", c.siVerbose)
	if (str(PPG.DisplayEventKey.Value) != None):
		globalQMenu_DisplayEvents = getGlobalObject("globalQMenu_DisplayEvents")
		try:
			oSelectedEvent = globalQMenu_DisplayEvents.Items[PPG.DisplayEvent.Value]
		except:
			oSelectedEvent = None
		if oSelectedEvent != None:
			oSelectedEvent.KeyMask = PPG.DisplayEventKeyMask.Value

	#Uncheck the record checkbox again
	PPG.DisplayEventKeys_Record.Value = False 
	#App.Preferences.SetPreferenceValue("QMenu.DisplayEventKeys_Record", False)
	RefreshDisplayEventsKeys()
				
def QMenuConfigurator_DisplayEvents_OnTab():
	Print ("QMenuConfigurator_DisplayEvents_OnTab called",c.siVerbose)
	PPG.DisplayEventKeys_Record.Value = False
	PPG.RecordViewSignature.Value = False	

def QMenuConfigurator_LowLevelSettings_OnTab():
	Print ("QMenuConfigurator_LowLevelSettings_OnTab called",c.siVerbose)
	PPG.RecordViewSignature.Value = False
	PPG.DisplayEventKeys_Record.Value = False

def QMenuConfigurator_Tools_OnTab():
	Print ("QMenuConfigurator_Reset_OnTab called",c.siVerbose)
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
	PPG.MenuChooser.SetCapabilityFlag(c.siReadOnly, True)
	
	PPG.PPGLayout.Item("AssignMenu").SetAttribute (c.siUIButtonDisable, True)
	PPG.PPGLayout.Item("RemoveMenu").SetAttribute (c.siUIButtonDisable, True)
	PPG.PPGLayout.Item("CtxUp").SetAttribute (c.siUIButtonDisable, True)
	PPG.PPGLayout.Item("CtxDown").SetAttribute (c.siUIButtonDisable, True)
	PPG.PPGLayout.Item("InsertMenuContext").SetAttribute (c.siUIButtonDisable, True)
	PPG.PPGLayout.Item("RemoveMenuContext").SetAttribute (c.siUIButtonDisable, True)
	PPG.PPGLayout.Item("ReplaceMenuContext").SetAttribute (c.siUIButtonDisable, True)
	
	PPG.PPGLayout.Item("ItemInsert").SetAttribute (c.siUIButtonDisable, True)
	PPG.PPGLayout.Item("InsertSeparator").SetAttribute (c.siUIButtonDisable, True)
	PPG.PPGLayout.Item("ItemUp").SetAttribute (c.siUIButtonDisable, True)
	PPG.PPGLayout.Item("ItemDown").SetAttribute (c.siUIButtonDisable, True)
	PPG.PPGLayout.Item("RemoveMenuItem").SetAttribute (c.siUIButtonDisable, True)
	PPG.PPGLayout.Item("FindItem").SetAttribute (c.siUIButtonDisable, True)

	#Start re-enabling buttons
	#Check if a view was selected:
	oCurrentMenu = None
	oCurrentMenuSet = None
	if PPG.AutoSelectMenu.Value == True:
		CurrentContextNumber = PPG.MenuContexts.Value
		#PPG.MenuChooser.Value = "None"
	
		if PPG.View.Value != "": #Is a view selected? Enable Menu Set Selector...
			#Print("View.Value is not empty, enabling MenuSetChooser...")
			PPG.MenuSetChooser.SetCapabilityFlag(c.siReadOnly, False)
		
			#Check if a Context was selected
			if PPG.MenuSetChooser.Value != "":
				oCurrentMenuSet = getQMenu_MenuSetByName(PPG.MenuSetChooser.Value)
				if oCurrentMenuSet != None and PPG.MenuContexts.Value > -1:				
					try:
						if PPG.QuadSelector.Value == 0: oCurrentMenu = oCurrentMenuSet.AMenus[CurrentContextNumber]
						if PPG.QuadSelector.Value == 1: oCurrentMenu = oCurrentMenuSet.BMenus[CurrentContextNumber]
						if PPG.QuadSelector.Value == 2: oCurrentMenu = oCurrentMenuSet.CMenus[CurrentContextNumber]
						if PPG.QuadSelector.Value == 3: oCurrentMenu = oCurrentMenuSet.DMenus[CurrentContextNumber]
						#Print("name of the menu is: " + str(oCurrentMenu.Name))
					except:
						oCurrentMenu = None
						#Print("QMenu function 'RefreshMenuSetDetailsWidgets' says: Could not determine current menu!", c.siError)
					
					#Refresh Context manipulation widgets...
					if oCurrentMenu != None: #Is a menu assigned to the selected context?
						PPG.PPGLayout.Item("RemoveMenu").SetAttribute (c.siUIButtonDisable, False)
						PPG.MenuChooser.Value = oCurrentMenu.Name
						#Print ("RefreshMenuSetDetailsWidgets: Menu Chooser Value is now :" + str(PPG.MenuChooser.Value))
					else:
						PPG.MenuChooser.Value = "None"

					
					if PPG.MenuContexts.Value > -1:
						PPG.PPGLayout.Item("RemoveMenuContext").SetAttribute (c.siUIButtonDisable, False) #Enable the button
						PPG.PPGLayout.Item("ReplaceMenuContext").SetAttribute (c.siUIButtonDisable, False)
						if PPG.Menus.Value != "": #Is a menu selected that could be assigned to the context?
							PPG.PPGLayout.Item("AssignMenu").SetAttribute (c.siUIButtonDisable, False) #Enable the button

					if PPG.MenuContexts.Value > 0:
						PPG.PPGLayout.Item("CtxUp").SetAttribute (c.siUIButtonDisable, False)
					if PPG.MenuContexts.Value < ((len(PPG.PPGLayout.Item("MenuContexts").UIItems )/2)-1):
						PPG.PPGLayout.Item("CtxDown").SetAttribute (c.siUIButtonDisable, False)
				else:
					PPG.MenuChooser.Value = "None"
				
				PPG.PPGLayout.Item("InsertMenuContext").SetAttribute (c.siUIButtonDisable, False) #Enable the button
	else:
		PPG.MenuChooser.SetCapabilityFlag(c.siReadOnly, False)
	#Refresh Menu manipulation widgets...
	#A Menu's items are currently displayed?
	if PPG.MenuChooser.Value != "None":
		oCurrentMenu = getQMenu_MenuByName(PPG.MenuChooser.Value)
		if oCurrentMenu != None:
			PPG.PPGLayout.Item("InsertSeparator").SetAttribute (c.siUIButtonDisable, False)
			if (PPG.Menus.Value != "") or (PPG.MenuItemList.Value != "") or (PPG.CommandList.Value != ""): #Is some assignable item selected in one of the combo boxes?
				PPG.PPGLayout.Item("ItemInsert").SetAttribute (c.siUIButtonDisable, False) #Enable the Insert Item button again
		
		if PPG.MenuItems.Value > -1: #A menu item is currently selected?
			if oCurrentMenu != None:
				oCurrentMenuItem = None
				try:
					oCurrentMenuItem = oCurrentMenu.Items[PPG.MenuItems.Value]
				except:
					pass
				if oCurrentMenuItem != None:
					PPG.PPGLayout.Item("ItemUp").SetAttribute (c.siUIButtonDisable, False)
					PPG.PPGLayout.Item("ItemDown").SetAttribute (c.siUIButtonDisable, False)
					PPG.PPGLayout.Item("RemoveMenuItem").SetAttribute (c.siUIButtonDisable, False)
					if oCurrentMenuItem.Type != "Separator":
						PPG.PPGLayout.Item("FindItem").SetAttribute (c.siUIButtonDisable, False)
													
def RefreshMenuItemDetailsWidgets():
	Print("QMenu: RefreshMenuItemDetailsWidgets called", c.siVerbose)

#Disable all widgets first
	#PPG.MenuName.SetCapabilityFlag (c.siReadOnly,False)
	PPG.PPGLayout.Item("InspectCommand").SetAttribute (c.siUIButtonDisable, True)
	PPG.PPGLayout.Item("ExecuteCommand").SetAttribute (c.siUIButtonDisable, True)
	PPG.PPGLayout.Item("ExecuteItemCode").SetAttribute (c.siUIButtonDisable, True)
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
			ItemName = oItem.Name
			PPG.PPGLayout.Item("InspectCommand").SetAttribute (c.siUIButtonDisable, False)
			#PPG.PPGLayout.Item("ConvertCommandToMenuItem").SetAttribute (c.siUIButtonDisable, False)
			PPG.PPGLayout.Item("ExecuteCommand").SetAttribute (c.siUIButtonDisable, False)
			PPG.PPGLayout.Item("ExecuteItemCode").SetAttribute (c.siUIButtonDisable, False)
			
			PPG.NewMenuItem_Category.Value = ""
			PPG.MenuItem_CategoryChooser.Value = ""
			PPG.MenuItem_Code.Value =  ""
		
#Check if a script item was selected:		
	if PPG.MenuItemList.Value != "":
		ItemName = PPG.MenuItemList.Value
		oItem = getQMenu_MenuItemByName(ItemName)
		if oItem != None:
			#PPG.MemuItem_CategoryChooser.Value = 
			PPG.MenuItem_Name.Value = oItem.Name
			PPG.NewMenuItem_Category.Value = oItem.Category
			RefreshMenuItem_CategoryChooserList()
			PPG.MenuItem_CategoryChooser.Value = oItem.Category
			PPG.MenuItem_Code.Value = oItem.Code
			PPG.MenuItem_ScriptLanguage.Value = oItem.Language
			PPG.MenuItem_Switch.Value = oItem.Switch
			
			PPG.PPGLayout.Item("ExecuteItemCode").SetAttribute (c.siUIButtonDisable, False)
			PPG.MenuItem_Name.SetCapabilityFlag (c.siReadOnly,False)
			PPG.NewMenuItem_Category.SetCapabilityFlag (c.siReadOnly,False)
			PPG.MenuItem_CategoryChooser.SetCapabilityFlag (c.siReadOnly,False)
			PPG.MenuItem_ScriptLanguage.SetCapabilityFlag (c.siReadOnly,False)
			PPG.MenuItem_Code.SetCapabilityFlag (c.siReadOnly,False)
			PPG.MenuItem_Switch.SetCapabilityFlag (c.siReadOnly,False)
			
			#PPG.PPGLayout.Item("CreateNewScriptItem").SetAttribute (c.siUIButtonDisable, False)
			PPG.PPGLayout.Item("DeleteScriptItem").SetAttribute (c.siUIButtonDisable, False)
	gc.collect()

#Check if a menu was selected			
	if PPG.Menus.Value != "":
		ItemName = PPG.Menus.Value
		oItem = getQMenu_MenuByName(ItemName)
		if oItem != None:
			#PPG.PPGLayout.Item("CreateNewMenu").SetAttribute (c.siUIButtonDisable, True)
			PPG.PPGLayout.Item("DeleteMenu").SetAttribute (c.siUIButtonDisable, False)	
			PPG.MenuItem_Name.Value = oItem.Name
			PPG.NewMenuItem_Category.Value = ""
			PPG.MenuItem_CategoryChooser.Value = ""
			PPG.MenuItem_ScriptLanguage.Value = ""
			PPG.MenuItem_ScriptLanguage.Value = oItem.Language
			PPG.MenuItem_Code.Value = oItem.Code
			PPG.MenuItem_IsActive.Value = oItem.ExecuteCode
			
			PPG.PPGLayout.Item("DeleteMenu").SetAttribute (c.siUIButtonDisable, False)	
			PPG.PPGLayout.Item("ExecuteItemCode").SetAttribute (c.siUIButtonDisable, False)
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
	PPG.QuadSelector.Value = 0
	PPG.MenuContexts.Value = -1
	PPG.MenuChooser.Value = "None"
	#PPG.AutoSelectMenu.Value = True
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
	PPG.DisplayEventKey.Value = 0
	PPG.DisplayEventKeyMask.Value = 0
	
	PPG.MenuDisplayContext_ScanDepth.Value = 0
	
def RefreshQMenuConfigurator():
	Print("QMenu: RefreshQMenuConfigurator called", c.siVerbose)
	ResetToDefaultValues()
	RefreshDisplayEvents()
	RefreshDisplayEventsKeys()
	RefreshMenuDisplayContextsList()
	RefreshMenuDisplayContextDetailsWidgets()
	RefreshMenuItem_CategoryList()
	RefreshCommandCategoryList()
	RefreshCommandList()
	RefreshMenuItemList()
	RefreshMenuList()
	RefreshViewChooser()
	RefreshViewSignaturesList()
	RefreshViewDetailsWidgets()
	RefreshMenuSets()

	RefreshViewMenuSets()
	RefreshViewMenuSetsWidgets()
	RefreshMenuSetChooser()
	RefreshMenuContexts()
	RefreshMenuChooser()
	
	RefreshMenuItems()
	RefreshMenuItemDetailsWidgets()
	RefreshMenuSetDetailsWidgets()
	
def RefreshMenuList():
	Print("QMenu: RefreshMenus called", c.siVerbose)
	globalQMenu_Menus = getGlobalObject("globalQMenu_Menus")
	MenuNameFilter = PPG.MenuFilter.Value
	MenusEnum = list()
	MenuNames = list()
	
	for oMenu in globalQMenu_Menus.Items:
		MenuNames.append(oMenu.Name)
	
	MenuNames.sort() #Sort Menu names alphabetically

	for MenuName in MenuNames:
		if MenuNameFilter != "":
			if MenuName.lower().find (MenuNameFilter.lower()) > -1:
				MenusEnum.append("(m) " + MenuName)
				MenusEnum.append(MenuName)
		else:
			MenusEnum.append("(m) " + MenuName)
			MenusEnum.append(MenuName)

	PPG.PPGLayout.Item("Menus").UIItems = MenusEnum
	PPG.Refresh()

def RefreshMenuChooser():
	Print("QMenu: RefreshMenuChooser called", c.siVerbose)
	globalQMenu_Menus = getGlobalObject("globalQMenu_Menus")
	MenusTempEnum = list()
	MenusEnum = list()
	
	for oMenu in globalQMenu_Menus.Items:
		MenusTempEnum.append(oMenu.Name)
	
	MenusTempEnum.sort()
	
	MenusEnum.append("None")
	MenusEnum.append("None")
	for MenuName in MenusTempEnum:
		MenusEnum.append(MenuName)
		MenusEnum.append(MenuName)
	
	PPG.PPGLayout.Item("MenuChooser").UIItems = MenusEnum
	
def RefreshMenuContexts():
	Print("QMenu: RefreshMenuContexts called", c.siVerbose)
	CurrentMenuSetName = str(PPG.MenuSetChooser.Value)
	oCurrentMenuSet = None
	CurrentContexts = None
	CurrentMenus = None
	CurrentContextsEnum = list()
	CurrentContext = PPG.MenuContexts.Value
	
	if CurrentMenuSetName != "":
		oCurrentMenuSet = getQMenu_MenuSetByName(CurrentMenuSetName)
		if oCurrentMenuSet != None:
			if PPG.QuadSelector.Value == 0: CurrentContexts = oCurrentMenuSet.AContexts; CurrentMenus = oCurrentMenuSet.AMenus
			if PPG.QuadSelector.Value == 1: CurrentContexts = oCurrentMenuSet.BContexts; CurrentMenus = oCurrentMenuSet.BMenus
			if PPG.QuadSelector.Value == 2: CurrentContexts = oCurrentMenuSet.CContexts; CurrentMenus = oCurrentMenuSet.CMenus
			if PPG.QuadSelector.Value == 3: CurrentContexts = oCurrentMenuSet.DContexts; CurrentMenus = oCurrentMenuSet.DMenus
		
			startrange = 0
			endrange = (len(CurrentContexts))
			
			if ((CurrentContexts != None) and (CurrentMenus != None)):
				for i in range(startrange , endrange):
					ContextString = str(CurrentContexts[i].Name)
					MenuString = "NONE"
					if len(CurrentMenus) > 0:
						if CurrentMenus[i] != None:
							MenuString = str(CurrentMenus[i].Name)
					
					ContextAndMenuString = ("(ctx) " + ContextString + " - " + "(m) " + MenuString)
					#Print(ContextAndMenuString)
					CurrentContextsEnum.append(ContextAndMenuString)
					#CurrentContextsEnum.append(ContextAndMenuString)
					CurrentContextsEnum.append(i)
	PPG.PPGLayout.Item ("MenuContexts").UIItems = CurrentContextsEnum

	try:
		if endrange >= CurrentContext: 
			PPG.MenuContexts.Value = CurrentContext
		else:
			PPG.MenuContexts.Value = -1
			
	except:
		PPG.MenuContexts.Value = -1
		
def RefreshMenuSetChooser():
	Print("QMenu: RefreshMenuSetChooser called", c.siVerbose)
	CurrentChosenMenuSetName = str(PPG.MenuSetChooser.Value)
	CurrentViewName = str(PPG.View.Value)
	oCurrentViewSignature = None
	MenuSetChooserEnum = list()
	
	if CurrentViewName != "":
		globalQMenu_ViewSignatures = getGlobalObject("globalQMenu_ViewSignatures")
		for oViewSignature in globalQMenu_ViewSignatures.Items:
			if oViewSignature.Name == CurrentViewName:
				oCurrentViewSignature = oViewSignature
				#break
		
		if oCurrentViewSignature != None:
			MenuSets = oCurrentViewSignature.MenuSets
			for oMenuSet in MenuSets:
				MenuSetChooserEnum.append("(ms-" + str(oCurrentViewSignature.MenuSets.index(oMenuSet)) + ") " + oMenuSet.Name)
				MenuSetChooserEnum.append(oMenuSet.Name)

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
	#globalQMenu_ViewSignatures = getGlobalObject("globalQMenu_ViewSignatures")
	
	CurrentViewSignatureName = PPG.ViewSignatures.Value
	oCurrentViewSignature = None
	CurrentViewMenuSets = list()
	CurrentViewMenuSetsEnum = list()
	
	if CurrentViewSignatureName == "":  #When no signature is selected empty the combo box
		PPG.PPGLayout.Item("ViewMenuSets").UIItems = list()
		PPG.ViewMenuSets.Value = -1
	
	if CurrentViewSignatureName != "":
		oCurrentViewSignature = getQMenu_ViewSignatureByName(CurrentViewSignatureName)

		if oCurrentViewSignature != None:
			CurrentViewMenuSets = oCurrentViewSignature.MenuSets
		if (len(CurrentViewMenuSets) > 0):
			#Print(oCurrentViewSignature.Name + " contains " + str(len(CurrentViewMenuSets)) +" menusets")
			for oMenuSet in CurrentViewMenuSets:
				CurrentViewMenuSetsEnum.append("(ms-" + str(oCurrentViewSignature.MenuSets.index(oMenuSet)) + ") " + oMenuSet.Name)
				#CurrentViewMenuSetsEnum.append(oMenuSet.Name)
				CurrentViewMenuSetsEnum.append(CurrentViewMenuSets.index(oMenuSet))
			PPG.PPGLayout.Item("ViewMenuSets").UIItems = CurrentViewMenuSetsEnum
		else:
			PPG.PPGLayout.Item("ViewMenuSets").UIItems = list()
	
def RefreshViewMenuSetsWidgets():
	Print("QMenu: RefreshViewMenuSetsWidgets called", c.siVerbose)
	PPG.PPGLayout.Item("InsertSetInView").SetAttribute (c.siUIButtonDisable, True)
	PPG.PPGLayout.Item("RemoveSetInView").SetAttribute (c.siUIButtonDisable, True)
	PPG.PPGLayout.Item("MoveSetUpInView").SetAttribute (c.siUIButtonDisable, True)
	PPG.PPGLayout.Item("MoveSetDownInView").SetAttribute (c.siUIButtonDisable, True)

	SelectedViewSignatureName = PPG.ViewSignatures.Value
	if SelectedViewSignatureName != "":
		oSelectedView = getQMenu_ViewSignatureByName(SelectedViewSignatureName)
		if oSelectedView != None:
			ViewMenuSets = oSelectedView.MenuSets
			#print PPG.ViewMenuSets.Value
			#print len(ViewMenuSets)
			
			if PPG.ViewSignatures.Value != "" and PPG.MenuSets.Value != "":
				PPG.PPGLayout.Item("InsertSetInView").SetAttribute (c.siUIButtonDisable, False)
				
			if PPG.ViewMenuSets.Value > -1:
				PPG.PPGLayout.Item("RemoveSetInView").SetAttribute (c.siUIButtonDisable, False)
				
			if PPG.ViewMenuSets.Value > 0:
				PPG.PPGLayout.Item("MoveSetUpInView").SetAttribute (c.siUIButtonDisable, False)
					
			if PPG.ViewMenuSets.Value > -1 and PPG.ViewMenuSets.Value < (len (ViewMenuSets)-1):
				PPG.PPGLayout.Item("MoveSetDownInView").SetAttribute (c.siUIButtonDisable, False)
					
def RefreshMenuDisplayContextsList():
	Print("QMenu: RefreshMenuDisplayContextsList called", c.siVerbose)
	globalQMenu_DisplayContexts = getGlobalObject("globalQMenu_DisplayContexts")
	DisplayContextList = list()
	DisplayContextEnum = list()
	for oDisplayContext in globalQMenu_DisplayContexts.Items:
		DisplayContextList.append(oDisplayContext.Name)

	DisplayContextList.sort()
	
	for name in DisplayContextList:
		DisplayContextEnum.append("(ctx) " + name)
		DisplayContextEnum.append(name)
		
	PPG.PPGLayout.Item("MenuDisplayContexts").UIItems = DisplayContextEnum
	
def RefreshMenuDisplayContextDetailsWidgets():
	Print("QMenu: RefreshMenuDisplayContextDetailsWidgets called", c.siVerbose)
	CurrentMenuDisplayContextName = PPG.MenuDisplayContexts.Value
	oCurrentMenuDisplayContext = getQMenu_MenuDisplayContextByName (CurrentMenuDisplayContextName)
	
	#We assume nothing is selected -> disable widgets
	PPG.MenuDisplayContext_Name.SetCapabilityFlag (c.siReadOnly, True)
	PPG.MenuDisplayContext_ScriptLanguage.SetCapabilityFlag (c.siReadOnly, True)
	PPG.MenuDisplayContext_ScanDepth.SetCapabilityFlag (c.siReadOnly, True)
	PPG.PPGLayout.Item("DeleteDisplayContext").SetAttribute (c.siUIButtonDisable, True)
				
	#Set Defaulkt values in case nothing is selected
	PPG.MenuDisplayContext_Name.Value = ""
	PPG.MenuDisplayContext_Code.Value = ""
	PPG.MenuDisplayContext_ScanDepth.Value = 0
	
	#Set values and widget states in case a context is selected
	if oCurrentMenuDisplayContext != None:
		PPG.MenuDisplayContext_Name.Value = oCurrentMenuDisplayContext.Name
		PPG.MenuDisplayContext_Code.Value = oCurrentMenuDisplayContext.Code
		PPG.MenuDisplayContext_ScriptLanguage.Value = oCurrentMenuDisplayContext.Language
		PPG.MenuDisplayContext_ScanDepth.Value = oCurrentMenuDisplayContext.ScanDepth
		
		#Re-enable Widgets
		PPG.MenuDisplayContext_Name.SetCapabilityFlag (c.siReadOnly,False)
		PPG.MenuDisplayContext_ScriptLanguage.SetCapabilityFlag (c.siReadOnly,False)
		PPG.MenuDisplayContext_ScanDepth.SetCapabilityFlag (c.siReadOnly,False)
		PPG.PPGLayout.Item("DeleteDisplayContext").SetAttribute (c.siUIButtonDisable, False)
	
def RefreshContextConfigurator():
	Print("QMenu: RefreshContextConfigurator called", c.siVerbose)
	globalQMenu_MenuSets = getGlobalObject("globalQMenu_MenuSets")
	
	oCurrentMenuSet = None
	CurrentContexts = None
	CurrentContextsEnum = list()
	currentMenuSetName = PPG.MenuSets.Value
	for oMenuSet in globalQMenu_MenuSets.Items:
		if oMenuSet.Name == currentMenuSetName:
			oCurrentMenuSet = oMenuSet
	
	if oCurrentMenuSet != None:
		if PPG.QuadSelector.Value == 0: CurrentContexts = oCurrentMenuSet.AContexts
		if PPG.QuadSelector.Value == 1: CurrentContexts = oCurrentMenuSet.BContexts
		if PPG.QuadSelector.Value == 2: CurrentContexts = oCurrentMenuSet.CContexts
		if PPG.QuadSelector.Value == 3: CurrentContexts = oCurrentMenuSet.DContexts
	
	if CurrentContexts != None:
		for oContext in CurrentContexts:
			CurrentContextsEnum.append("(ctx) " + oContext.Name)
			CurrentContextsEnum.append(oContext.Name)
	PPG.PPGLayout.Item ("ContextConfigurator").UIItems = CurrentContextsEnum
				
def RefreshViewSignaturesList():
	Print("QMenu: RefreshViewSignaturesList called", c.siVerbose)
	globalQMenu_ViewSignatures = getGlobalObject("globalQMenu_ViewSignatures")
	viewSignatureNameListEnum = list()
	
	for signature in globalQMenu_ViewSignatures.Items:
		viewSignatureNameListEnum.append("(v) " + signature.Name)
		viewSignatureNameListEnum.append(signature.Name)
	
	
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
			PPG.ViewSignatureName.Value = oCurrentView.Name
			PPG.ViewSignature.Value = oCurrentView.Signature
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
	gc.collect()
	
def RefreshViewChooser():
	Print("QMenu: RefreshViewSelector called", c.siVerbose)
	PPG.View.SetCapabilityFlag(c.siReadOnly, True)
	CurrentViewName = PPG.View.Value
	CurrentViewSignature = ""
	oCurrentView = None
	globalQMenu_ViewSignatures = getGlobalObject("globalQMenu_ViewSignatures")
	viewSelectorEnumList = list()
	KnownViews = globalQMenu_ViewSignatures.Items
	FirstKnownViewName = ""
	
	#Refresh the view selector list box
	for view in KnownViews:
		viewSelectorEnumList.append(view.Name)
		viewSelectorEnumList.append(view.Name)
	
	if len(KnownViews) > 0:
		PPG.View.SetCapabilityFlag(c.siReadOnly, False)
		FirstKnownViewName = str(KnownViews[0].Name)

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
	globalQMenu_MenuItems = getGlobalObject("globalQMenu_MenuItems")
	#Print ("globalQMenu_MenuItems knows those menuItems: " + str(globalQMenu_MenuItems.Items))
	
	for menuItem in globalQMenu_MenuItems.Items:
		listMenuItemCategories.append (menuItem.Category)
	
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
	globalQMenu_MenuItems = getGlobalObject("globalQMenu_MenuItems")
	
	listMenuItemCategories = list()
	listMenuItemCategoriesEnum = list()

	for menuItem in globalQMenu_MenuItems.Items:
		listMenuItemCategories.append (menuItem.Category)
	
	listMenuItemCategories = list(set(listMenuItemCategories)) #get rid of duplicates
	listMenuItemCategories.sort()


	for Category in listMenuItemCategories:
		listMenuItemCategoriesEnum.append(Category)
		listMenuItemCategoriesEnum.append(Category)

	PPG.PPGLayout.Item ("MenuItem_CategoryChooser").UIItems = listMenuItemCategoriesEnum #Populate the ListControl with the known MenuItemCategories
		
def RefreshMenuItems():
	Print ("QMenu: RefreshMenuItems called",c.siVerbose)
	globalQMenu_Menus = getGlobalObject("globalQMenu_Menus")
	CurrentMenuItemNumber = str(PPG.MenuItems.Value)
	CurrentMenuName = PPG.MenuChooser.Value
	listMenuItemsEnum = list()
	oCurrentMenu = None
	oCurrentMenu = getQMenu_MenuByName(CurrentMenuName)
	
	if oCurrentMenu != None:
		listMenuItems = oCurrentMenu.Items
		Counter = 0
		for oItem in listMenuItems:
			prefix = "      "
			if str(oItem.Type) == "CommandPlaceholder" or str(oItem.Type) == "MissingCommand":
				prefix = "(c)  "
			if str(oItem.Type) == "QMenu_MenuItem":
				if oItem.Switch:
					prefix = "(sw)  "
				else:
					prefix = "(s)  "
			if str(oItem.Type) == "QMenu_Menu":
				prefix = "(m) "
			MissingName = ("_DELETED ITEM_")
			if oItem.Name == "":
				NameInList = (prefix + MissingName)
			else:
				NameInList = (prefix + oItem.Name)
			if oItem.Type == "QMenuSeparator":
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
	globalQMenu_MenuSets = getGlobalObject("globalQMenu_MenuSets")
	MenuSetsNameList = list()
	MenuSetsNameListEnum = list()
	#Clear the combo box
	PPG.PPGLayout.Item ("MenuSets").UIItems = MenuSetsNameListEnum
	PPG.MenuSets.Value = ""
	#Clear the name field
	PPG.MenuSetName.Value = ""
	#Disable name field
	PPG.MenuSetName.SetCapabilityFlag(c.siReadOnly, True)
	#Disable delete button
	PPG.PPGLayout.Item("DeleteMenuSet").SetAttribute (c.siUIButtonDisable, True)
	
	for oSet in globalQMenu_MenuSets.Items:
		MenuSetsNameList.append(oSet.Name)
	
	MenuSetsNameList.sort()
	
	for SetName in MenuSetsNameList:
		MenuSetsNameListEnum.append("(ms) " + SetName)
		MenuSetsNameListEnum.append(SetName)
	
	PPG.PPGLayout.Item ("MenuSets").UIItems = MenuSetsNameListEnum

	#Re-enable name field and delete button
	if PPG.MenuSets.Value != "":
		PPG.PPGLayout.Item("DeleteMenuSet").SetAttribute (c.siUIButtonDisable, False)
		PPG.MenuSetName.SetCapabilityFlag(c.siReadOnly, False)
		
def RefreshMenuItemList():
	Print("QMenu: RefreshMenuItemList called",c.siVerbose)
	globalQMenu_MenuItems = getGlobalObject("globalQMenu_MenuItems")
	listKnownMenuItems = list(globalQMenu_MenuItems.Items)
	
	listMenuItem_Names = list()
	listMenuItem_NamesEnum = list()
	
	
	MenuItem_Category =  (PPG.MenuItem_Category.Value) #Get the currently selected menu item category value from the category selector in the PPG's UI

	for menuItem in listKnownMenuItems:
		if MenuItem_Category == "_ALL_" or menuItem.Category == MenuItem_Category:
			listMenuItem_Names.append(menuItem.Name)
	
	listMenuItem_Names.sort()
	menuItem = None		
	
	TypeToList = PPG.ShowItemType.Value
	
	for menuItemName in listMenuItem_Names:
		menuItem = getQMenu_MenuItemByName(menuItemName)
		
		if TypeToList == 0:
			if menuItem.Switch == True:
				listMenuItem_NamesEnum.append("(sw) " + menuItemName)
				listMenuItem_NamesEnum.append(menuItemName)
			else:
				listMenuItem_NamesEnum.append("(s) " + menuItemName)
				listMenuItem_NamesEnum.append(menuItemName)
				
		elif TypeToList == 1 and menuItem.Switch == True:
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
			#Search lower-case only
			SearchName = NameInList.lower()
			SearchString = strCommandFilter.lower()
			
			if SearchName.find(SearchString) > -1:
				CommandListEnum.append("(c) " + NameInList) #Mark item as command by prefixing it with (c) and add the uique name to it
				CommandListEnum.append(GUID) #Append with the GUID
		else: #We are not filtering command names, just append the item to the list
			CommandListEnum.append("(c) " + NameInList) #Append name
			CommandListEnum.append(GUID) #Append GUID
	
	PPG.PPGLayout.Item ("CommandList").UIItems = CommandListEnum
	PPG.CommandList.Value = ""
	gc.collect()
	
def RefreshDisplayEventsKeys():
	Print("QMenu: RefreshDisplayEventsKeys called", c.siVerbose)
	globalQMenu_DisplayEvents = getGlobalObject("globalQMenu_DisplayEvents").Items
	if (len(globalQMenu_DisplayEvents) > 0) and (PPG.DisplayEvent.Value > -1):
		oSelectedEvent = globalQMenu_DisplayEvents[PPG.DisplayEvent.Value]
	else:
		#Print("An error occured trying to determine currently selected event...")
		oSelectedEvent = None
	
	if oSelectedEvent != None:
		#Print("Selected event is not None...")
		PPG.DisplayEventKey.Value = oSelectedEvent.Key
		PPG.DisplayEventKeyMask.Value = oSelectedEvent.KeyMask
		
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
	globalQMenu_DisplayEvents = getGlobalObject("globalQMenu_DisplayEvents").Items
	DisplayEventsEnumList = list()
	Counter = 0
	for oDisplayEvent in globalQMenu_DisplayEvents:
		DisplayEventsEnumList.append ("Display QMenu Menu Set " + str(Counter))
		DisplayEventsEnumList.append (Counter)
		Counter +=1
	
	PPG.PPGLayout.Item("DisplayEvent").UIItems = DisplayEventsEnumList
	if len(globalQMenu_DisplayEvents) == 0:
		PPG.DisplayEvent.Value = -1
	
	
#=========================================================================================================================
#===================================== Command Callback Functions ========================================================
#=========================================================================================================================

#This is the main function that creates the string describing the Menu to render
def DisplayMenuSet( MenuSetIndex ):
	#Print("DisplayMenuSet called", c.siVerbose)
	globalQMenu_ViewSignatures = getGlobalObject("globalQMenu_ViewSignatures")
	ViewSignatures = (getView(True)) #Get the short/nice view signature silently (without printing it)
	ViewSignature = ViewSignatures[0]
	oXSIView = ViewSignatures[2] #The getView() function has built-in heuristic to get the view object under the mnouse as reliably as possible. It returns the view object as third item of the return value array.
	#Print (ViewSignature)
	
	"""
	#Test code to find floating window the user is currently working in by screen coordinates (unreliably :-(
	#======= Handle cases in which the mouse cursor is over the view manager (any of the four main 3D view areas) =======
	
	#Lets find the current viewport under the mouse and activate it so we can work with a specific view further down.
	#This makes view operations more predictable in case the user clicks on a menu entry in a long menu that overlaps another view
	#In which case the wrong view would be affected.
	if ViewSignature.find("ViewManager") > -1: #Mouse is over one of the view managers windows (3D View or an editor window docked in A,B,C or D view?)		
		ViewIndices = {"A":0,"B":1,"C":2,"D":3}
		ViewportUnderMouse = oVM.GetAttributeValue("viewportundermouse")
		#print ViewportUnderMouse
		#Activate the 3D view currently under the mouse so viewport operations triggered affect that view and not the one that was active before the menu was opened from 
		oVM.SetAttributeValue("focusedviewport",ViewportUnderMouse)
		oXSIView = oVM.Views[ViewIndices[str(ViewportUnderMouse)]]
		#print ("View under mouse is: ")
		#print oXSIView
	"""
	
	t0 = time.clock() #Record time before we start getting the first 4 menus

	
	CmdLog = Application.Preferences.GetPreferenceValue("scripting.cmdlog")
	Application.Preferences.SetPreferenceValue("scripting.cmdlog", False)
	#Look through all defined View signatures known to QMenu and find the first that fits
	if globalQMenu_ViewSignatures != None:
		oCurrentView = None
		for oView in globalQMenu_ViewSignatures.Items:
			#if oView.Signature == ViewSignature:
			if ViewSignature.find(oView.Signature) > -1: #
				oCurrentView = oView
				break  #Lets take the first matching view signature we find (there should not be duplicates anyway)
		
		oMenuSet = None
		if oCurrentView != None:
			try:
				oMenuSet = oCurrentView.MenuSets[MenuSetIndex]
			except:
				Print("There is currently no QMenu Menu Set " + str(MenuSetIndex) + " defined for view '" + oCurrentView.Name + "!", c.siVerbose)
		
		if oMenuSet != None:

			oContext = PrepareContextObject(None) #Lets fill our generic context object with all the data we have at hand for this session.
				#so that only the little remaining required data needs to be filled in on every menu or menu item object we iterate over -> faster.
			oContext.storeCurrentXSIView (oXSIView)
			
			oAMenu = None; #AMenuItemList = list()
			oBMenu = None; #BMenuItemList = list()
			oCMenu = None; #CMenuItemList = list()
			oDMenu = None; #DMenuItemList = list()
			oMenus = list()
				
			silent = True #Don't report verbose errors when working with QMenu. Only give hints something went wrong.
			MaxScanDepth = 0
			
			for RuleIndex in range(0,len(oMenuSet.AContexts)):
				oQMenuDisplayContext = oMenuSet.AContexts[RuleIndex]
				ScanDepth = oQMenuDisplayContext.ScanDepth
				if ScanDepth > MaxScanDepth:
					MaxScanDepth = ScanDepth
			for RuleIndex in range(0,len(oMenuSet.BContexts)):
				oQMenuDisplayContext = oMenuSet.BContexts[RuleIndex]
				ScanDepth = oQMenuDisplayContext.ScanDepth
				if ScanDepth > MaxScanDepth:
					MaxScanDepth = ScanDepth
			for RuleIndex in range(0,len(oMenuSet.CContexts)):
				oQMenuDisplayContext = oMenuSet.CContexts[RuleIndex]
				ScanDepth = oQMenuDisplayContext.ScanDepth
				if ScanDepth > MaxScanDepth:
					MaxScanDepth = ScanDepth
			for RuleIndex in range(0,len(oMenuSet.DContexts)):
				oQMenuDisplayContext = oMenuSet.DContexts[RuleIndex]
				ScanDepth = oQMenuDisplayContext.ScanDepth
				if ScanDepth > MaxScanDepth:
					MaxScanDepth = ScanDepth
					
			QMenuGetSelectionDetails(MaxScanDepth) #Assemble information about current selection
					
			for RuleIndex in range(0,len(oMenuSet.AContexts)):
				oQMenuDisplayContext = oMenuSet.AContexts[RuleIndex]
				oContext.storeQMenuObject(oQMenuDisplayContext)
				DisplayMenu = False
				DisplayMenu = ExecuteDisplayContext ( oQMenuDisplayContext, oContext , silent)
				if DisplayMenu == True: #We have found a matching context rule, we will display the associated menu
					oAMenu = oMenuSet.AMenus[RuleIndex]
					break
			
			oMenus.append(oAMenu) #Add the found menu to the Menus list
			
			#Find menu B by evaluating all of the B-quadrant menu's context functions and taking the first one that returns True
			for RuleIndex in range(0,len(oMenuSet.BContexts)):
				oQMenuDisplayContext = oMenuSet.BContexts[RuleIndex]
				oContext.storeQMenuObject(oQMenuDisplayContext)
				DisplayMenu = False
				DisplayMenu = ExecuteDisplayContext ( oQMenuDisplayContext, oContext , silent)
				
				if DisplayMenu == True: #We have found a matching context rule, we will display the associated menu
					oBMenu = oMenuSet.BMenus[RuleIndex]
					break
			
			oMenus.append(oBMenu) #Add the found menu to the Menus list
			
			#Find menu C by evaluating all of the C-quadrant menu's context functions and taking the first one that returns True
			for RuleIndex in range(0,len(oMenuSet.CContexts)):
				oQMenuDisplayContext = oMenuSet.CContexts[RuleIndex]
				oContext.storeQMenuObject(oQMenuDisplayContext)
				DisplayMenu = False
				DisplayMenu = ExecuteDisplayContext ( oQMenuDisplayContext, oContext , silent)
				
				if DisplayMenu == True:
					oCMenu = oMenuSet.CMenus[RuleIndex]
					break
			
			oMenus.append(oCMenu) #Add the found menu to the Menus list
			
			#Find menu D by evaluating all of the D-quadrant menu's context functions and taking the first one that returns True
			for RuleIndex in range(0,len(oMenuSet.DContexts)):
				oQMenuDisplayContext = oMenuSet.DContexts[RuleIndex]
				oContext.storeQMenuObject(oQMenuDisplayContext)
				DisplayMenu = False
				DisplayMenu = ExecuteDisplayContext ( oQMenuDisplayContext, oContext, silent )
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
						Code = unicode(oMenu.Code)
						if Code != "" and oMenu.ExecuteCode == True:
							#ArgList = list(); ArgList.append(oMenu) #QMenu_Menu_Execute function takes it's own menu as an argument 
							#Print(oMenu.Name)
							#Print(oMenu.Code)
							oContext.storeQMenuObject(oMenu)
							Application.ExecuteScriptCode(Code, oMenu.Language, "QMenu_Menu_Execute", [oContext]) #Execute the menu's script code (maybe it creates more menu items or even more submenus)
							#except:
								#raise
								#Print("An Error occured executing QMenu Menu's '" + oMenu.Name + "' script code, please see script editor for details!", c.siError)
						
						#Lets find regular submenus					
						for oMenuItem in oMenu.Items:
							if oMenuItem.Type == "QMenu_Menu":
								if not (oMenuItem in oMenus):
									oMenus.append(oMenuItem)
									NewMenuFound = True

						#Lets find temporary submenus	
						for oMenuItem in oMenu.TempItems:
							if oMenuItem.Type == "QMenu_Menu":
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
						if (len(oMenu.Items) == 0) and (len(oMenu.TempItems) == 0):
							MenuString = MenuString + "[[" + oMenu.Name + "]" +  "[-1]" + "[3]" + "]"
						else:
							if MenuCounter == 2 or MenuCounter == 3: #Add the title at the beginning of the menu in case it's menu 2 or 3
								MenuString = MenuString + "[[" + oMenu.Name + "]"  + "[-1]" + "[3]" + "]" 
							
							#Add regular menu items to the display string
							for oItem in oMenu.Items:
								if oItem.Type == "CommandPlaceholder":
									MenuString = MenuString + "[[" + oItem.Name + "]"  + "[-1]" + "[1]" + "]" 
								if oItem.Type == "QMenu_MenuItem":
									#Print(oItem.Name + " is a switch: " + str(oItem.Switch))
									if oItem.Switch == True:
										Language = oItem.Language
										oContext.storeQMenuObject(oItem)
										if Language == "Python": #Execute Python code natively, it's faster this way
											Code = (oItem.Code + ("\nresult = Switch_Init( oContext )"))
											exec (Code)
										else:
											results = App.ExecuteScriptCode(oItem.Code, Language, "Switch_Init",[oContext])
											result = results[0]
										if result == True:
											MenuString = MenuString + "[[" + oItem.Name + "]"  + "[-1]" + "[5]" + "]"
										else:
											MenuString = MenuString + "[[" + oItem.Name + "]"  + "[-1]" + "[1]" + "]"
										#except:
											#Print ("An Error occured evaluating the Switch_Eval function of menu item '" + oItem.Name + "'. Please see script editor for details", c.siVerbose)	
											#raise
									else: #Item is not a switch, must be a normal menu item
										MenuString = MenuString + "[[" + oItem.Name + "]"  + "[-1]" + "[1]" + "]"
										
								if oItem.Type == "QMenu_Menu":
									#try:
									MenuIndex = oMenus.index(oItem)
									MenuString = MenuString + "[[" + oItem.Name + "]" + "[" + str(MenuIndex) + "]" + "[1]" + "]" 
									#except:
										#pass
								if oItem.Type == "QMenuSeparator":
									MenuString = MenuString + "[]"
								if oItem.Type == "MissingCommand":
									MenuString = MenuString + "[[" + oItem.Name + "]"  + "[-1]" + "[0]" + "]"

							#Add temporary menu items to the display string
							for oItem in oMenu.TempItems:
								if oItem.Type == "Command":
									MenuString = MenuString + "[[" + oItem.Name + "]"  + "[-1]" + "[1]" + "]" 
								if oItem.Type == "QMenu_MenuItem":
									MenuString = MenuString + "[[" + oItem.Name + "]"  + "[-1]" + "[1]" + "]" 
								if oItem.Type == "QMenu_Menu":
									#try:
										MenuIndex = oMenus.index(oItem)
										MenuString = MenuString + "[[" + oItem.Name + "]"  + "[" + str(MenuIndex) + "]" + "[1]" + "]" 
									#except:
										#DoNothing = True
								if oItem.Type == "QMenuSeparator":
									MenuString = MenuString + "[[]"  + "[-1]" + "[0]" + "]" 
							#Add the title at the end of the menu in case it's menu 0 or 1
							if MenuCounter == 0 or MenuCounter == 1:
								MenuString = MenuString + "[[" + oMenu.Name + "]"  + "[-1]" + "[3]" + "]" 
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
				
				#CursorPos = win32gui.GetCursorPos()
				#WinUnderMouse = win32gui.WindowFromPoint (CursorPos) #Get window under mouse
				
				MenuItemToExecute = App.QMenuRender(MenuString) #Display the menu, get clicked menu item from user
				Application.Preferences.SetPreferenceValue("scripting.cmdlog", CmdLog) #Re-enable command logging
				
				#win32gui.SetFocus(WinUnderMouse) #Set focus back to window under mouse
				#===========================================================================
				#===========  Find the clicked menu item from the returned value ===========
				#===========================================================================
				#print MenuItemToExecute
				oClickedMenuItem = None
				if (MenuItemToExecute != None) and (MenuItemToExecute[0] != -1) and (MenuItemToExecute[1] != -1): #Was something clicked in any of the menus?
					#Print("MenuItemToExecute is: " + str(MenuItemToExecute))
					oClickedMenu = oMenus[MenuItemToExecute[0]] #get the clicked QMenu_Menu object
					if oClickedMenu != None:
						
						#Was one of the upper two menus selected?
						if MenuItemToExecute[0] == 0 or MenuItemToExecute[0] == 1: 
							#Was the menu Title selected?
							if MenuItemToExecute[1] == len(oClickedMenu.Items) + len(oClickedMenu.TempItems): 
								globalQMenu_LastUsedItem = getGlobalObject("globalQMenu_LastUsedItem")
								oClickedMenuItem = globalQMenu_LastUsedItem.item #When clicking on any of the Menu Titles repeat the last command
							else:
								#Was one of the temp menu items clicked on? (Temp menu items are always listed after permanent menu items)
								if MenuItemToExecute[1] > (len(oClickedMenu.Items)-1): 
									oClickedMenuItem = oClickedMenu.TempItems[MenuItemToExecute[1]-(len(oClickedMenu.Items))]
								#No, one of the normal menu items was selected...
								else: 
									oClickedMenuItem = oClickedMenu.Items[MenuItemToExecute[1]]
									
						#Was one of the lower two menus selected?
						if MenuItemToExecute[0] == 2 or MenuItemToExecute[0] == 3: 
							if MenuItemToExecute[1] == 0: #Was the menu Title selected?
								globalQMenu_LastUsedItem = getGlobalObject("globalQMenu_LastUsedItem")
								oClickedMenuItem = globalQMenu_LastUsedItem.item 
							else:
								#Was one of the temp menu items clicked on?
								if MenuItemToExecute[1] > (len(oClickedMenu.Items)): 
									oClickedMenuItem = oClickedMenu.TempItems[MenuItemToExecute[1]-(len(oClickedMenu.Items)+1)] #get the clicked temp menu item
								#No, one of the normal menu items was selected...
								else: 
									oClickedMenuItem = oClickedMenu.Items[MenuItemToExecute[1]-1] #Subtract the menu title entry 
						
						#Was any of the sub-menus selected?
						if MenuItemToExecute[0] > 3:
							if len(oClickedMenu.Items) > 0: #Are there any menu items to check for in the first place?
								if MenuItemToExecute[1] > (len(oClickedMenu.Items)-1): #Was one of the temp menu items clicked on?
									oClickedMenuItem = oClickedMenu.TempItems[MenuItemToExecute[1]-(len(oClickedMenu.Items))]
								else:
									oClickedMenuItem = oClickedMenu.Items[MenuItemToExecute[1]]
							elif len(oClickedMenu.TempItems) > 0: #No Menu items, but maybe there are temp menu items..
								oClickedMenuItem = oClickedMenu.TempItems[MenuItemToExecute[1]]
				
				if oClickedMenuItem != None:
					oContext.storeClickedMenu (oClickedMenu)
					oContext.storeClickedMenuItemNumber (MenuItemToExecute[1])
					return oClickedMenuItem
				else:
					return None

def QMenuRepeatLastCommand_Init(in_Ctxt):
	oCmd = in_Ctxt.Source
	oCmd.SetFlag(c.siSupportsKeyAssignment,  True)
	oCmd.SetFlag(c.siCannotBeUsedInBatch, True)
	oCmd.SetFlag(c.siNoLogging, False)
	oCmd.SetFlag(c.siAllowNotifications, True) #It's important this is false otherwise XSI becomes unstable when undoing the command (forgets about existing commands, but not always about the last executed one)
	return True	

def QMenuRepeatLastCommand_Execute():
	Print("QMenuRepeatLastCommand_Execute called", c.siVerbose)
	globalQMenu_LastUsedItem = getGlobalObject("globalQMenu_LastUsedItem")
	oQMenu_MenuItem = globalQMenu_LastUsedItem.item
	if oQMenu_MenuItem != None:
		bNonVerboseErrorReporting = False
		QMenuExecuteMenuItem_Execute ( oQMenu_MenuItem , bNonVerboseErrorReporting )

def QMenuGetByName_Init(in_Ctxt):
	oCmd = in_Ctxt.Source
	oCmd.ReturnValue = True
	oArgs = oCmd.Arguments
	oArgs.Add("strQMenuObjectType")
	oArgs.Add("strQMenuObjectName")
	oCmd.SetFlag(c.siSupportsKeyAssignment, False)
	oCmd.SetFlag(c.siCannotBeUsedInBatch, False)
	oCmd.SetFlag(c.siNoLogging, True)
	oCmd.SetFlag(c.siAllowNotifications, False) #It's important this is "False" otherwise XSI becomes unstable when undoing the command (forgets about existing commands, but not always about the last executed one)
	return True
	
def QMenuGetByName_Execute( strQMenuObjectType ,  strQMenuObjectName):
	SupportedObjects = ["MenuItem", "Menu", "Context", "MenuSet", "View" ]
	oObject = None
	if strQMenuObjectType in SupportedObjects:
		if strQMenuObjectType == "MenuItem":
			oObject = getQMenu_MenuItemByName(strQMenuObjectName)
		if strQMenuObjectType == "Menu":
			oObject = getQMenu_MenuByName(strQMenuObjectName)
		if strQMenuObjectType == "MenuSet":
			oObject = getQMenu_MenuSetByName(strQMenuObjectName)
		if strQMenuObjectType == "Context":
			oObject = getQMenu_MenuDisplayContextByName(strQMenuObjectName)
		if strQMenuObjectType == "View":
			oObject = getQMenu_ViewSignatureByName(strQMenuObjectName)
		return oObject
	else:
		Print("QMenu: " + str(strQMenuObjectType) + " is an unknown Object Type", c.siError)
	
def QMenuDisplayMenuSet_0_Init( in_Ctxt ):
	oCmd = in_Ctxt.Source
	oCmd.SetFlag(c.siSupportsKeyAssignment, True)
	oCmd.SetFlag(c.siCannotBeUsedInBatch, True)
	oCmd.SetFlag(c.siNoLogging, True)
	oCmd.SetFlag(c.siAllowNotifications, True) #It's important this is false otherwise XSI becomes unstable when undoing the command (forgets about existing commands, but not always about the last executed one)
	return True				

def QMenuDisplayMenuSet_0_Execute():
	#Print("QMenuDisplayMenuSet_0_Execute called", c.siVerbose)
	if App.Preferences.GetPreferenceValue("QMenu.QMenuEnabled"):
		oQMenu_MenuItem = DisplayMenuSet(0)
		if oQMenu_MenuItem != None:
			globalQMenu_LastUsedItem = getGlobalObject("globalQMenu_LastUsedItem")
			globalQMenu_LastUsedItem.set(oQMenu_MenuItem)
			bNonVerboseErrorReporting = False
			XSIVersion = getXSIMainVersion()
			if XSIVersion < 10: #Pre 2012 version of Softimage? Use old-style method of menu item execution 
				QMenuExecuteMenuItem_Execute(oQMenu_MenuItem , bNonVerboseErrorReporting)
			else:
				QMenuTimer = Application.EventInfos( "QMenuExecution" ) #Find the execution timer
				QMenuTimer.Reset( 0, 1 ) # Reset the timer with a millisecond until execution and with just a single repetition
									     # It will execute the chosen MenuItem with no noticeable delay.
									     # We are using this timer event to ensure that, no matter what has happened before, the chosen menu item
									     # is the last piece of code that's executed by this plugin so it properly appears as repeatable in Softimage's Edit menu
				
def QMenuDisplayMenuSet_1_Init( in_Ctxt ):
	oCmd = in_Ctxt.Source
	oCmd.SetFlag(c.siSupportsKeyAssignment, True)
	oCmd.SetFlag(c.siCannotBeUsedInBatch, True)
	oCmd.SetFlag(c.siNoLogging, True)
	oCmd.SetFlag(c.siAllowNotifications, False) #It's important this is false otherwise XSI becomes unstable when undoing the command (forgets about existing commands, but not always about the last executed one)
	return True				

def QMenuDisplayMenuSet_1_Execute():
	#Print("QMenuDisplayMenuSet_1_Execute called", c.siVerbose)
	if App.Preferences.GetPreferenceValue("QMenu.QMenuEnabled"):
		oQMenu_MenuItem = DisplayMenuSet(1)
		if oQMenu_MenuItem != None:
			globalQMenu_LastUsedItem = getGlobalObject("globalQMenu_LastUsedItem")
			globalQMenu_LastUsedItem.set(oQMenu_MenuItem)
			bNonVerboseErrorReporting = False
			XSIVersion = getXSIMainVersion()
			if XSIVersion < 10: #Pre 2012 version of Softimage? Use old-style method of menu item execution 
				QMenuExecuteMenuItem_Execute(oQMenu_MenuItem , bNonVerboseErrorReporting)
			else:
				QMenuTimer = Application.EventInfos( "QMenuExecution" ) #Find the execution timer
				QMenuTimer.Reset( 0, 1 ) # Reset the timer with a millisecond until execution and with just a single repetition
									     # It will execute the chosen MenuItem with no noticeable delay.
									     # We are using this timer event to ensure that, no matter what has happened before, the chosen menu item
									     # is the last piece of code that's executed by this plugin so it properly appears as repeatable in Softimage's Edit menu

def QMenuDisplayMenuSet_2_Init( in_Ctxt ):
	oCmd = in_Ctxt.Source
	oCmd.SetFlag(c.siSupportsKeyAssignment, True)
	oCmd.SetFlag(c.siCannotBeUsedInBatch, True)
	oCmd.SetFlag(c.siNoLogging, True)
	oCmd.SetFlag(c.siAllowNotifications, False) #It's important this is false otherwise XSI becomes unstable when undoing the command (forgets about existing commands, but not always about the last executed one)
	return True				

def QMenuDisplayMenuSet_2_Execute():
	#Print("QMenuDisplayMenuSet_2_Execute called", c.siVerbose)
	if App.Preferences.GetPreferenceValue("QMenu.QMenuEnabled"):
		oQMenu_MenuItem = DisplayMenuSet(2)
		if oQMenu_MenuItem != None:
			globalQMenu_LastUsedItem = getGlobalObject("globalQMenu_LastUsedItem")
			globalQMenu_LastUsedItem.set(oQMenu_MenuItem)
			bNonVerboseErrorReporting = False
			XSIVersion = getXSIMainVersion()
			if XSIVersion < 10: #Pre 2012 version of Softimage? Use old-style method of menu item execution 
				QMenuExecuteMenuItem_Execute(oQMenu_MenuItem , bNonVerboseErrorReporting)
			else:
				QMenuTimer = Application.EventInfos( "QMenuExecution" ) #Find the execution timer
				QMenuTimer.Reset( 0, 1 ) # Reset the timer with a millisecond until execution and with just a single repetition
									     # It will execute the chosen MenuItem with no noticeable delay.
									     # We are using this timer event to ensure that, no matter what has happened before, the chosen menu item
									     # is the last piece of code that's executed by this plugin so it properly appears as repeatable in Softimage's Edit menu

def QMenuDisplayMenuSet_3_Init( in_Ctxt ):
	oCmd = in_Ctxt.Source
	oCmd.SetFlag(c.siSupportsKeyAssignment, True)
	oCmd.SetFlag(c.siCannotBeUsedInBatch, True)
	oCmd.SetFlag(c.siNoLogging, True)
	oCmd.SetFlag(c.siAllowNotifications, False) #It's important this is false otherwise XSI becomes unstable when undoing the command (forgets about existing commands, but not always about the last executed one)
	return True				

def QMenuDisplayMenuSet_3_Execute():
	#Print("QMenuDisplayMenuSet_3_Execute called", c.siVerbose)
	if App.Preferences.GetPreferenceValue("QMenu.QMenuEnabled"):
		oQMenu_MenuItem = DisplayMenuSet(3)
		if oQMenu_MenuItem != None:
			globalQMenu_LastUsedItem = getGlobalObject("globalQMenu_LastUsedItem")
			globalQMenu_LastUsedItem.set(oQMenu_MenuItem)
			bNonVerboseErrorReporting = False
			XSIVersion = getXSIMainVersion()
			if XSIVersion < 10: #Pre 2012 version of Softimage? Use old-style method of menu item execution 
				QMenuExecuteMenuItem_Execute(oQMenu_MenuItem , bNonVerboseErrorReporting)
			else:
				QMenuTimer = Application.EventInfos( "QMenuExecution" ) #Find the execution timer
				QMenuTimer.Reset( 0, 1 ) # Reset the timer with a millisecond until execution and with just a single repetition
									     # It will execute the chosen MenuItem with no noticeable delay.
									     # We are using this timer event to ensure that, no matter what has happened before, the chosen menu item
									     # is the last piece of code that's executed by this plugin so it properly appears as repeatable in Softimage's Edit menu

						
def QMenuExecuteMenuItem_Init( in_ctxt ):
	oCmd = in_ctxt.Source
	oCmd.ReturnValue = False
	oArgs = oCmd.Arguments
	oArgs.Add("oQMenu_MenuItem")
	oArgs.Add("verbosity")
	oCmd.SetFlag(c.siSupportsKeyAssignment, False)
	oCmd.SetFlag(c.siCannotBeUsedInBatch, True)
	oCmd.SetFlag(c.siNoLogging, True)
	oCmd.SetFlag(c.siAllowNotifications, True) #It's important this is "False" otherwise XSI becomes unstable when undoing the command (forgets about existing commands, but not always about the last executed one)
	return True
	
def QMenuExecuteMenuItem_Execute ( oQMenu_MenuItem , verbosity ):
	Print("QMenuExecuteMenuItem_Execute called", c.siVerbose)

	if oQMenu_MenuItem != None:
		#Instead of the actual command only a dummy command object carrying the original command name is given because Softimage has the tendency 
		#to "forget" commands (not always the same command that was referenced) after undoing it when the command is referenced by a python object (e.g. a list or custom ActiveX class). 
		#Therefore we only work with command names instead and look up the command for execution again, which imposes only a minimal speed penalty.

		if oQMenu_MenuItem.Type == "CommandPlaceholder": #We use the commandplaceholder class to store the name of the command to execute because storing the command directly causes problems in XSI
			try:
				#Print("Executing command with UID of: " + str(oQMenu_MenuItem.UID)) 
				#oCmd =  App.GetCommandByUID(oQMenu_MenuItem.UID) #We used a compiled command now fast enough to look up commands by their UID, we avoid executing the false one with the same name (there are duplicates of commands in softimage sharing the same name)
				oCmd= App.Commands(oQMenu_MenuItem.Name) #We use the name to identify the command because finding by UID would be too slow 
				oCmd.Execute()
				gc.collect()
				return True
			except:
				if verbosity == True:
					raise
				else:
					Print("An Error occured while QMenu executed the command '" + oQMenu_MenuItem.Name + "', please see script editor for details!", c.siError)
					gc.collect()
			
		if oQMenu_MenuItem.Type == "QMenu_MenuItem":
			oContext = PrepareContextObject( oQMenu_MenuItem )
				
			Code = (oQMenu_MenuItem.Code)
			if Code != "":
				Language = (oQMenu_MenuItem.Language)
				if oQMenu_MenuItem.Switch == True:
					try:
						App.ExecuteScriptCode(Code, Language, "Switch_Init", [oContext] )		
					except:
						if verbosity == True:
							raise
						else:
							Print("An Error occured executing the Switch_Init function of '" + oQMenu_MenuItem.Name + "', please see script editor for details!", c.siError)
					try:
						App.ExecuteScriptCode(Code, Language, "Switch_Execute", [oContext] )		
					except:
						if verbosity == True:
							raise
						else:
							Print("An Error occured executing the Switch_Execute function of '" + oQMenu_MenuItem.Name + "', please see script editor for details!", c.siError)

						
				else:
					try:
						App.ExecuteScriptCode( Code, Language , "Script_Execute", [oContext] )
					except:
						if verbosity == True:
							raise
						else:
							Print("An Error occured while QMenu executed the script item '" + oQMenu_MenuItem.Name + "', please see script editor for details!", c.siError)
			else:
				Print("QMenu Menu item '" + oQMenu_MenuItem.Name + "' has no code to execute!",c.siWarning)

def QMenuRefreshSelectionContextObject_Init(in_ctxt):
	oCmd = in_ctxt.Source
	oCmd.ReturnValue = False
	oArgs = oCmd.Arguments
	oArgs.Add("ScanDepth")
	oCmd.SetFlag(c.siSupportsKeyAssignment, False)
	oCmd.SetFlag(c.siCannotBeUsedInBatch, False)
	oCmd.SetFlag(c.siNoLogging, True)
	oCmd.SetFlag(c.siAllowNotifications, True) 
	return True

def QMenuRefreshSelectionContextObject_Execute ( intScanDepth ):
	Print("QMenuRefreshSelectionContextObject_Execute called", c.siVerbose)
	QMenuGetSelectionDetails(intScanDepth)

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
	if QMenuType == "Context":
		QMenuElement = QMenuContext()
	if QMenuType == "RecentlyCreatedICENode":
		QMenuElement = QMenuRecentlyCreatedICENode()
	#if QMenuType == "RecentlyCreatedICENodes":
		#QMenuElement = QMenuRecentlyCreatedICENodes()
		
	# Class MUST be wrapped before being returned:
	if QMenuElement != None:
		return win32com.server.util.wrap(QMenuElement)
	else:
		return None
 
def OpenQMenuEditor_Init( in_ctxt ):
	oCmd = in_ctxt.Source
	oCmd.Description = "Create QMenuConfigurator custom property at scene root level"
	oCmd.Tooltip = "Create QMenuCreateConfigurator custom property at scene root level"
	oCmd.ReturnValue = true
	oArgs = oCmd.Arguments
	oCmd.SetFlag(c.siSupportsKeyAssignment, False)
	oCmd.SetFlag(c.siCannotBeUsedInBatch, True)
	oCmd.SetFlag(c.siNoLogging, True)
	return true
    
def OpenQMenuEditor_Execute(bCheckSingle = true): 
    Print("OpenQMenuEditor_Execute called",c.siVerbose)
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
        #"Python Example: Working with the ISIVTCollection returned from a Command". Yuk.
        return a
    
    if boolTest == true:
        #Print("QMenuConfigurator Property already defined - Inspecting existing Property instead of creating a new one")
        App.AutoInspect (colQMenuConfigurator(0))
        return false

def QMenuCreatePreferencesCustomProperty_Init( in_ctxt ):
	oCmd = in_ctxt.Source
	oCmd.Description = "Creates QMenuPreferences custom property at scene root level"
	oCmd.Tooltip = "Create QMenuPreferences custom property at scene root level"
	oCmd.ReturnValue = True
	oArgs = oCmd.Arguments
	oCmd.SetFlag(c.siSupportsKeyAssignment, False)
	oCmd.SetFlag(c.siCannotBeUsedInBatch, True)
	oCmd.SetFlag(c.siNoLogging, True)
	return true
    
def QMenuCreatePreferencesCustomProperty_Execute(bCheckSingle = true): 
    Print("QMenuCreatePreferencesCustomProperty_Execute called",c.siVerbose)
    boolTest = false
    
    if bCheckSingle == true:
        colQMenuPreferences = XSIFactory.CreateActiveXObject( "XSI.Collection" )
        A = App.FindObjects( "", "{76332571-D242-11d0-B69C-00AA003B3EA6}" ) #Find all Custom Properties
        
        for o in A:
            if o.Type == ("QMenuPreferences"): #Find all Custom Properties of Type "QMenuPreferences"
                colQMenuPreferences.Add (o) #And store them in a Collection
        if colQMenuPreferences.Count > 0: boolTest = true
                
    if boolTest == false:
        a = App.AddProp( "QMenuPreferences", App.ActiveSceneRoot, 0, "QMenuPreferences", "" )
        #Add the Custom property to the scene root. AddProp returns a ISIVTCollection that contains
        # 2 elements: The created Custom Property type and the Created Custom Properties as an XSICollection
        #This is not documented in the AddProp command help page, but in a separate page called
        #"Python Example: Working with the ISIVTCollection returned from a Command". Yuk.
        return a
    
    if boolTest == true:
        Print("QMenuPreferences custom property is already defined - Inspecting existing property instead of creating a new one")
        App.InspectObj (colQMenuPreferences(0))
        return false
	
def QMenuGetConfiguratorCustomProperty_Init( in_Ctxt ):
	oCmd = in_Ctxt.Source
	oCmd.SetFlag(c.siSupportsKeyAssignment, False)
	oCmd.SetFlag(c.siCannotBeUsedInBatch, True)
	oCmd.SetFlag(c.siNoLogging, True)
	oCmd.SetFlag(c.siAllowNotifications, False) #It's important this is false otherwise XSI becomes unstable when undoing the command (forgets about existing commands, but not always about the last executed one)
	oCmd.ReturnValue = True
	return True				

def QMenuGetConfiguratorCustomProperty_Execute():
	#Print(" QMenuGetConfiguratorCustomProperty_Execute called", c.siVerbose)
	return getQMenuConfiguratorCustomProperty() 

def QMenuGetPreferencesCustomProperty_Init( in_Ctxt ):
	oCmd = in_Ctxt.Source
	oCmd.SetFlag(c.siSupportsKeyAssignment, False)
	oCmd.SetFlag(c.siCannotBeUsedInBatch, True)
	oCmd.SetFlag(c.siNoLogging, True)
	oCmd.SetFlag(c.siAllowNotifications, False) #It's important this is false otherwise XSI becomes unstable when undoing the command (forgets about existing commands, but not always about the last executed one)
	oCmd.ReturnValue = True
	return True				

def QMenuGetPreferencesCustomProperty_Execute():
	#Print(" QMenuGetConfiguratorCustomProperty_Execute called", c.siVerbose)
	return getQMenuPreferencesCustomProperty() 
	
#=========================================================================================================================		
# ========================================= Event Callback Functions =====================================================
#=========================================================================================================================
#"On selection changed" event to collect information about currently selected Objects

def QMenu_NewSceneHandler_OnEvent(in_ctxt):
	QMenuGetSelectionDetails(0)
	
def QMenuGetSelectionDetails_OnEvent(in_ctxt):
	#Print("QMenu: QMenuGetSelectionDetails_OnEvent called",c.siVerbose)
	
	t0 = time.clock()
	QMenuGetSelectionDetails(0)
	t1 = time.clock()
	timeTaken = (t1 - t0)#/1000
	if App.Preferences.GetPreferenceValue("QMenu.ShowQMenuTimes"):
		Print("QMenuGetSelectionDetails event took: " + str(timeTaken) + "seconds")

def QMenuGetSelectionDetails(MaxScanDepth):
	#Print("QMenu: QMenuGetSelectionDetails called",c.siVerbose)
	#t1 = time.clock() #Get Start time
	
	oSelDetails = getGlobalObject("globalQMenu_ContextObject")
	
	if oSelDetails != None:
		
		oSelection = Application.Selection
		SelCount = oSelection.Count
		
		lsX3DObjects = list()
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
			ScanDepth = 0
			for oSel in oSelection:
				if ScanDepth < MaxScanDepth:
					#Lets also collect all X3DObjects (those directly selected _and_ those of selected components
					siX3DObjectID = c.siX3DObjectID 
					 
					try:
						if oSel.IsClassOf(siX3DObjectID):
							if oSel not in lsX3DObjects:
								lsX3DObjects.append(oSel) #Collect directly selected X3DObjects
					except:
						pass
					
					SelectionType = oSel.Type
					SelectionClassName = getClassName(oSel)
					#print("Got the following Class Name: " + str(SelectionClassName))
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
							try:
								if SelectionComponentParent.IsClassOf(siX3DObjectID) : #Collect X3DObjects of selected components
									if SelectionComponentParent not in lsX3DObjects: 
										lsX3DObjects.append(SelectionComponentParent)
							except:
								pass
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
		
				ScanDepth += 1
				
		#Fill the SelectionInfo Object with the Data we have aquired
		
		#Print("Recording X3DObjects: " + str(lsX3DObjects))
		oSelDetails.storeX3DObjects(lsX3DObjects)
		
		#Print("Recording Selection Types: " + str(lsSelectionTypes))
		oSelDetails.storeSelectionTypes (lsSelectionTypes)
		
		#Print("Recording Selection Class Names: " + str(lsSelectionClassNames))
		oSelDetails.storeSelectionClassNames (lsSelectionClassNames)
		
		#Print("Recording Component Class Names: " + str(lsSelectionComponentClassNames))
		oSelDetails.storeSelectionComponentClassNames (lsSelectionComponentClassNames)
		
		#Print("Recording Component Parents: " + str(lsSelectionComponentParents))
		oSelDetails.storeSelectionComponentParents (lsSelectionComponentParents)
		
		#Print("Recording Component Parent Types: " + str(lsSelectionComponentParentTypes))
		oSelDetails.storeSelectionComponentParentTypes (lsSelectionComponentParentTypes)
		
		#Print("Recording Component Parent Class Names: " + str(lsSelectionComponentParentClassNames))
		oSelDetails.storeSelectionComponentParentClassNames (lsSelectionComponentParentClassNames)
		#t2 = time.clock()
		#TotalTime = t2 - t1
		#Print("Time taken to assemble selection info: " + str(TotalTime));


def QMenuPrintValueChanged_OnEvent( in_ctxt):
	Object = in_ctxt.GetAttribute("Object")
	Print ("Changed Object is: " + str(Object))
	Print ("Full Name is: " + in_ctxt.GetAttribute("FullName") )
	Print (Object.Type)

# Key down event that searches through defined QMenu view signatures to find one matching the window under the mouse
def QMenuCheckDisplayEvents_OnEvent( in_ctxt ):  
	#Print("QMenuCheckDisplayEvents_OnEvent called",c.siVerbose)
	XSIVersion = getXSIMainVersion()
	globalQMenuDisplayEventContainer = getGlobalObject("globalQMenu_DisplayEvents")
	if globalQMenuDisplayEventContainer != None:
		globalQMenu_DisplayEvents = globalQMenuDisplayEventContainer.Items

		KeyPressed = in_ctxt.GetAttribute("KeyCode")
		KeyMask = in_ctxt.GetAttribute("ShiftMask")
		#Print ("Pressed Key is: " + str(KeyPressed))
		#Print ("Mask Key is: " + str(KeyMask))
		Consumed = False #Event hasn't been consumed yet
		IlligalKeyPressedValues = (16,17,18) #Mask Keys not allowed as single key assignments (Strg, Alt and Shift keys)
		if KeyPressed not in IlligalKeyPressedValues: #Not only a modifier key was pressed?
			QMenuConfigurator = getQMenuConfiguratorCustomProperty() #App.QMenuGetConfiguratorCustomProperty()

			if QMenuConfigurator != None:
				if QMenuConfigurator.RecordViewSignature.Value == True:
					ViewSignature = (getView(False))[0] #Get the nice version of the View's signature non-silently, seeing the view signatures could be useful when recording it
					QMenuConfigurator.ViewSignature.Value = ViewSignature
					QMenuConfigurator.RecordViewSignature.Value = False
					#Print("QMenu View Signature of picked window is: " + str(ViewSignature), c.siVerbose)
					Consumed = True
				
				if QMenuConfigurator.DisplayEventKeys_Record.Value == True:
					oSelectedEvent = None
					oSelectedEvent = globalQMenu_DisplayEvents[QMenuConfigurator.DisplayEvent.Value] #Get the currently selected display event by looking at the selected number in the Configurator'S list of display events
				
					if oSelectedEvent != None:
						oSelectedEvent.Key = KeyPressed
						oSelectedEvent.KeyMask = KeyMask
					
						QMenuConfigurator.DisplayEventKey.Value = KeyPressed
						QMenuConfigurator.DisplayEventKeyMask.Value = KeyMask
						QMenuConfigurator.DisplayEventKeys_Record.Value = False
			
			QMenuEnabled = App.Preferences.GetPreferenceValue("QMenu.QMenuEnabled")
			if (QMenuEnabled == True) or (QMenuEnabled == 1) or (QMenuEnabled == 'True') and (Consumed == False): #Is QMenu enabled and the event hasn't been consumed yet?
				#Check known display events whether there is one that should react to the currently pressed key(s)
				for oDispEvent in globalQMenu_DisplayEvents:
					if ((oDispEvent.Key == KeyPressed) and (oDispEvent.KeyMask == KeyMask )): #We have found a display event that matches the key(s) that were just pressed
						Consumed = True
						
						#Finally display the corresponding menu set associated with the display event and get the users input
						oChosenMenuItem = DisplayMenuSet( globalQMenuDisplayEventContainer.getEventNumber(oDispEvent))
						#Now after user has clicked on something...
						if oChosenMenuItem != None:
							globalQMenu_LastUsedItem = getGlobalObject("globalQMenu_LastUsedItem")
							globalQMenu_LastUsedItem.set(oChosenMenuItem)
							bNonVerboseErrorReporting = False

							if XSIVersion < 10: #Use old method to execute the picked menu item directly in case Softimage version is older than 2012
								QMenuExecuteMenuItem_Execute (oChosenMenuItem, bNonVerboseErrorReporting)
							
							else: #We have Softimage 2012 or younger?
								QMenuTimer = Application.EventInfos( "QMenuExecution" ) #Find the execution timer
								QMenuTimer.Reset( 0, 1 )# Reset the timer with a millisecond until execution and with just a single repetition
														# It will execute the chosen MenuItem with no noticeable delay.
														# We are using this timer event to ensure that, no matter what has happened before, the chosen menu item
														# is the last piece of code that's executed by this plugin so it properly appears a repeatable menu item in Softimage's Edit menu in the main menu bar
					
						break #We only care for the first found display event assuming there are no duplicates (and even if there are it's not our fault)
					
			# Finally tell Softimage that the event has been consumed (which prevents commands bound to the same hotkey to be executed)
			in_ctxt.SetAttribute("Consumed", Consumed)
		else:
			#Print("Only Modifier Key was pressed!")
			in_ctxt.SetAttribute("Consumed", Consumed)


# Timer event that prevents a race condition between init code and custom preference that might not yet be installed when Softimage starts up.
# The timer event code is executed once Softimage has stopped staring up (hence the custom preference is then already installed) and there is time
# to execute the code.
def QMenuExecution_OnEvent (in_ctxt):
	Print("QMenu: QMenuExecution_OnEvent called",c.siVerbose)
	globalQMenu_LastUsedItem = getGlobalObject("globalQMenu_LastUsedItem")
	
	if globalQMenu_LastUsedItem != None:	
		if globalQMenu_LastUsedItem.item != None:
			oItem = globalQMenu_LastUsedItem.item
			bNonVerboseErrorReporting = False
			QMenuExecuteMenuItem_Execute (oItem, bNonVerboseErrorReporting)
	

# Legacy event that hosted the init code previously. We now use	the timer event above.
def QMenuInitialize_OnEvent (in_ctxt):
	Print ("QMenu: QMenu Startup event called",c.siVerbose)
	InitQMenu()
	
def InitQMenu():
	initializeQMenuGlobals(True)
	FirstStartup = False
	#Load the QMenu Config File
	QMenuConfigFile = ""
	try:
		FirstStartup = Application.Preferences.GetPreferenceValue("QMenu.FirstStartup")
	except:
		#Print("Could not retrieve state of FirstStartup QMenu preference value, assuming it is the first startup...", c.siVerbose)
		FirstStartup = True
	
	if (FirstStartup == "False") or (FirstStartup == "0") or (FirstStartup == False) or (FirstStartup == 0) or FirstStartup == None:
		QMenuConfigFile = App.Preferences.GetPreferenceValue("QMenu.QMenuConfigurationFile")
	
	if (FirstStartup == "True") or (FirstStartup == "1") or (FirstStartup == True) or (FirstStartup == 1):
		#Print("FirstStartup is actually: " + str(FirstStartup) + ". -> getting default config file path")
		QMenuConfigFile = getDefaultConfigFilePath("QMenuConfiguration_Default.xml") #Get the file path as string of the QMenu default configuration file.
		App.Preferences.SetPreferenceValue("QMenu.ShowQMenu_MenuString", False)
		#App.SetValue("Preferences.QMenu.ShowQMenu_MenuString", False)
		App.Preferences.SetPreferenceValue("QMenu.ShowQMenuTimes", False)
		#App.SetValue("Preferences.QMenu.ShowQMenuTimes", False)
		
	if (str(QMenuConfigFile) != ""):
		Print("Attempting to load QMenu Configuration from: " + str(QMenuConfigFile), c.siVerbose)
		result = loadQMenuConfiguration(QMenuConfigFile)
		if result:
			Print("Successfully loaded QMenu Config file from: " + str(QMenuConfigFile) , c.siVerbose)
			try:
				Application.SetValue("preferences.QMenu.QMenuConfigurationFile", QMenuConfigFile,"")
			except:
				Print("Could not set preferences.QMenu.QMenuConfigurationFile!", c.siVerbose)
			App.Preferences.SetPrefeRenceValue("QMenu.QMenuConfigurationFile", str(QMenuConfigFile))
			App.Preferences.SetPreferenceValue("QMenu.FirstStartup", False)
		else:
			Print("Failed loading QMenu Config file from: " + str(QMenuConfigFile) , c.siError)
	else:
		Print("QMenu configuration file could not be found, check QMenu preferences. -> QMenu is disabled.", c.siWarning)
		App.Preferences.SetPreferenceValue("QMenu.QMenuEnabled", False)
	
	#App.Preferences.SaveChanges()
	Application.ExecuteScriptCode("DoNothing = True", "Python") #Dummy script code execution call to prevent stupid Softimage bug causing error messages upon calling this command on code stored in a menu item code attribute for the first time
	App.QMenuRender("") #Call QMenu to load the required .Net components to avoid having to wait when it's actually called manually for the first time after startup

# Ask user to safe the config file before XSI quits
def QMenuDestroy_OnEvent (in_ctxt): 
	globalQMenu_ConfigStatus = getGlobalObject("globalQMenu_ConfigStatus")
	if globalQMenu_ConfigStatus.Changed == True:
		Message = ("The QMenu configuration has been changed - would you like to save it?")
		Caption = ("Save QMenu configuration?")
		DoSaveFile = XSIUIToolkit.MsgBox( Message, 36, Caption )
		if DoSaveFile == True:
			QMenuConfigFile = App.Preferences.GetPreferenceValue("QMenu.QMenuConfigurationFile")
			Result = saveQMenuConfiguration(QMenuConfigFile)
			if Result == False:  #Something went wrong
				#Message = ("The QMenu configuration file could not be written - would you like to save to the dafault backup file?")
				#Caption = ("Saving failed, save a QMenu Configuration backup file?")
				#TODO: Add backup function that saves file to a default position in case the previous save attempt failed			
				Message = ("Sorry, the QMenu configuration file could not be written.\n\nMaybe the folder does not exist or you don't have write permission?")
				Caption = ("Saving failed!")
				FailedMessage = XSIUIToolkit.MsgBox( Message, 16, Caption )

		
			

#=========================================================================================================================					
#===================================== Custom Property Menu Callback Functions ===========================================
#=========================================================================================================================
def getXSIMainVersion():
	Version = Application.Version()
	VersionList = Version.split(".")
	VersionMain = int(VersionList[0])
	return VersionMain

#QMenu Menu initialisation
def QMenu_Init( in_ctxt ):
	oMenu = in_ctxt.Source
	VersionMain = getXSIMainVersion()
	#print VersionMain
	#print type(VersionMain)
	
	enabled = False
	continyou = True
	try:
		enabled = Application.GetValue("preferences.QMenu.QMenuEnabled")
	except:
		continyou = False
		Print("QMenu Preferences not found! If you just installed the QMenu addon you need to restart Softimage.", c.siWarning)
		oMenu.AddCallbackItem("QMenu Preferences not found!","QMenuPreferenceNotFoundClicked")
	
	if continyou == True:
		oMenu.AddCallbackItem("Inspect QMenu Preferences","QMenuPreferencesMenuClicked")
		oMenu.AddCallbackItem("Open QMenu Editor","QMenuConfiguratorMenuClicked")

		if VersionMain < 10:
			if enabled == False:
				oMenu.AddCallbackItem("Enable QMenu","QMenuEnableClicked")
			else:
				oMenu.AddCallbackItem("Disable QMenu","QMenuDisableClicked")
		else:
			oMenuItem = oMenu.AddCallbackItem("QMenu Enabled","QMenuEnableClicked")
			if enabled == False:
				oMenuItem.Checked = False
			else:
				oMenuItem.Checked = True	
	return True

def QMenuPreferenceNotFoundClicked(in_ctxt):
	Print("QMenu Preferences not found! If you just installed the QMenu addon you need to restart Softimage.", c.siError)
	
def QMenuConfiguratorMenuClicked( in_ctxt ):
    App.OpenQMenuEditor()
    return True
	
def QMenuPreferencesMenuClicked(in_ctxt):
    App.QMenuCreatePreferencesCustomProperty()
    return True
	
def QMenuDisableClicked(in_ctxt):
	Application.SetValue("preferences.QMenu.QMenuEnabled", False, "")
	Application.Preferences.SetPreferenceValue("QMenu.QMenuEnabled", False)
	
def QMenuEnableClicked(in_ctxt):
	Version = Application.Version()
	VersionList = Version.split(".")
	VersionMain = int(VersionList[0])
	QMenuEnabled = Application.GetValue("preferences.QMenu.QMenuEnabled")
	
	Application.SetValue("preferences.QMenu.QMenuEnabled", not QMenuEnabled, "")
	
	if VersionMain >= 10:
		MenuItem = in_ctxt.Source
		MenuItem.Checked = not QMenuEnabled
		#Application.Preferences.SetPreferenceValue("QMenu.QMenuEnabled", True)
		

#=========================================================================================================================	
#=========================================== Helper functions ============================================================
#=========================================================================================================================	
def saveQMenuConfiguration(fileName):
	Print("QMenu: saveQMenuConfiguration called", c.siVerbose)
	
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
		
		globalQMenu_MenuItems = getGlobalObject("globalQMenu_MenuItems").Items
		globalQMenu_Menus = getGlobalObject("globalQMenu_Menus").Items
		globalQMenu_MenuSets = getGlobalObject("globalQMenu_MenuSets").Items
		globalQMenu_DisplayContexts = getGlobalObject("globalQMenu_DisplayContexts").Items
		globalQMenu_ViewSignatures = getGlobalObject("globalQMenu_ViewSignatures").Items
		globalQMenu_DisplayEvents = getGlobalObject("globalQMenu_DisplayEvents").Items

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
			MenuItemNode.setAttribute("name", oMenuItem.Name)
			MenuItemNode.setAttribute("type", oMenuItem.Type)
			MenuItemNode.setAttribute("category", oMenuItem.Category)
			MenuItemNode.setAttribute("language", oMenuItem.Language)
			if oMenuItem.Switch:
				MenuItemNode.setAttribute("switch", "True")
			else:
				MenuItemNode.setAttribute("switch", "False")
			
			oMenuItemCode = oConfigDoc.createTextNode (oMenuItem.Code)
			if oMenuItem.Code == "": oMenuItemCode.nodeValue = " "
			MenuItemNode.appendChild(oMenuItemCode)
			
			#Test setting code as an attribute...
			#MenuItemNode.setAttribute("code", oMenuItem.Code)
			MenuItemsNode.appendChild(MenuItemNode)	
		
	# === Save Menus ===
		for oMenu in globalQMenu_Menus:
			MenuNode = oConfigDoc.createElement("QMenu_Menu")
			MenuNode.setAttribute("name", str(oMenu.Name))
			MenuNode.setAttribute("type", oMenu.Type)
			MenuNode.setAttribute("language", oMenu.Language)
			if oMenu.ExecuteCode == True:
				MenuNode.setAttribute("executeCode", "True")
			if oMenu.ExecuteCode == False:
				MenuNode.setAttribute("executeCode", "False")
				
			oMenuCode = oConfigDoc.createTextNode (oMenu.Code)
			#oMenuCode.nodeValue = str(oMenu.Code)
			if oMenu.Code == "": oMenuCode.nodeValue = " "
			MenuNode.appendChild(oMenuCode)	
			
			MenuItems = getattr(oMenu, "items")
			NameList = list()
			for MenuItem in MenuItems:
				if MenuItem.Type == "MissingCommand":
					NameList.append("Command")
				elif MenuItem.Type == "CommandPlaceholder":
					NameList.append("Command")
				else:
					NameList.append(str(MenuItem.Type)) #Finally this could only be a command or a scripted menu item
				NameList.append(str(MenuItem.Name))
				NameList.append(str(MenuItem.UID))
			
			MenuItemsNames = convertListToString(NameList)
			MenuNode.setAttribute("items", MenuItemsNames)
			MenusNode.appendChild(MenuNode)
		
	# === Save Menu Sets ===
		for oMenuSet in globalQMenu_MenuSets:
			MenuSetNode = oConfigDoc.createElement("QMenu_MenuSet")
			MenuSetNode.setAttribute("name", oMenuSet.Name)
			MenuSetNode.setAttribute("type", oMenuSet.Type)
			
			Attributes = ["AMenus","AContexts","BMenus","BContexts","CMenus","CContexts","DMenus","DContexts"]
			for Attr in Attributes:
				AttrList = list()
				oItems = getattr(oMenuSet, Attr)
				#Print(Attr + ": " + str(oItems))
				for oItem in oItems:
					if oItem != None:
						AttrList.append (str(oItem.Name))
					else:
						AttrList.append("None")
				AttrString = convertListToString(AttrList)
				#Print(AttrString)
				MenuSetNode.setAttribute(Attr, AttrString)
			MenuSetsNode.appendChild(MenuSetNode)
	
	# === Save Menu Contexts ===
		for oDisplayContext in globalQMenu_DisplayContexts:
			DisplayContextNode = oConfigDoc.createElement("QMenu_MenuDisplayContext")
			DisplayContextNode.setAttribute("name", oDisplayContext.Name)
			DisplayContextNode.setAttribute("type", oDisplayContext.Type)
			DisplayContextNode.setAttribute("language", oDisplayContext.Language)
			DisplayContextNode.setAttribute("scandepth", str(oDisplayContext.ScanDepth))	
			
			
			oDisplayContextCode = oConfigDoc.createTextNode (oDisplayContext.Code)
			if oDisplayContext.Code == "": oDisplayContextCode.nodeValue = " "
			DisplayContextNode.appendChild(oDisplayContextCode)
			MenuDisplayContextsNode.appendChild(DisplayContextNode)
		
	# === Save View Signatures ===
		for oSignature in globalQMenu_ViewSignatures:
			ViewSignatureNode = oConfigDoc.createElement("QMenuViewSignature")
			ViewSignatureNode.setAttribute("name",oSignature.Name)
			ViewSignatureNode.setAttribute("type", oSignature.Type)
			ViewSignatureNode.setAttribute("signature", str(oSignature.Signature))
			MenuSetNames = list()
			for MenuSet in oSignature.MenuSets:
				MenuSetNames.append(MenuSet.Name)
			MenuSetNamesString = convertListToString(MenuSetNames)
			
			ViewSignatureNode.setAttribute("menuSets", MenuSetNamesString)
			ViewsNode.appendChild(ViewSignatureNode)

	# === Save Display Events ===
		for oDisplayEvent in globalQMenu_DisplayEvents:
			#Print("Saving Display events")
			DisplayEventNode = oConfigDoc.createElement("QMenuDisplayEvent")
			DisplayEventNode.setAttribute("number", str(oDisplayEvent.Number))
			DisplayEventNode.setAttribute("type", oDisplayEvent.Type)
			DisplayEventNode.setAttribute("key", str(oDisplayEvent.Key))
			DisplayEventNode.setAttribute("keyMask", str(oDisplayEvent.KeyMask))
			DisplayEventsNode.appendChild(DisplayEventNode)	
			#Print("\nDisplayeventsnode with number " + str(oDisplayEvent.Number) + " saved\n")

		#Finally write out the whole configuration document as an xml file
		try:
			ConfigDocFile = open(fileName,"w")
			oConfigDoc.writexml(ConfigDocFile,indent = "",addindent = "", newl = "")
			ConfigDocFile.close()
			#Print ("XML written to: " + str(fileName))
			return True
		except:
			Print("An Error occured while attempting to write the QMenu configuration to " + filename)
			return False
	else:
		Print("Cannot save QMenu configuration to '" + fileName + "' because the folder does not exist. Please correct the file path and try again.", c.siError)
		return False
		
def loadQMenuConfiguration(fileName):
	Print("QMenu: loadQMenuConfiguration called", c.siVerbose)

	if fileName != "":
		if os.path.isfile(fileName) == True:
			QMenuConfigFile = DOM.parse(fileName)
			#In case the file could be loaded and parsed we can destroy the existing configuration in memory and refill it with the new data from the file
			initializeQMenuGlobals(True)
			globalQMenu_Separators = getGlobalObject("globalQMenu_Separators")
			globalQMenu_MenuItems = getGlobalObject("globalQMenu_MenuItems")
			globalQMenu_Menus = getGlobalObject("globalQMenu_Menus")
			globalQMenu_MenuSets = getGlobalObject("globalQMenu_MenuSets")
			globalQMenu_DisplayContexts = getGlobalObject("globalQMenu_DisplayContexts")
			globalQMenu_ViewSignatures = getGlobalObject("globalQMenu_ViewSignatures")
			globalQMenu_DisplayEvents = getGlobalObject("globalQMenu_DisplayEvents")
			
		#=== Start creating QMenu objects from the file data ===
			Components = QMenuConfigFile.getElementsByTagName("QMenuComponents")

			for Component in Components[0].childNodes:
				if Component.localName == "QMenu_MenuItems":
					QMenu_MenuItems = Component.childNodes
					for MenuItem in QMenu_MenuItems:
						if str(MenuItem.localName) != "None":
							#Print("MenuItemLocalName is: " + MenuItem.localName)
							NewMenuItem = App.QMenuCreateObject("MenuItem")
							NewMenuItem.Name = MenuItem.getAttribute("name")
							NewMenuItem.Category = MenuItem.getAttribute("category")
							NewMenuItem.Language = MenuItem.getAttribute("language")
							if MenuItem.getAttribute("switch") == "True":
								NewMenuItem.Switch = True
							
							CodeNode = MenuItem.childNodes[0]
							if CodeNode.nodeValue != " ":
								NewMenuItem.Code = CodeNode.nodeValue
							
							#Test reading code from code attribute
							#NewMenuItem.Code = MenuItem.getAttribute("code")
	
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
							oNewMenu.Name = Menu.getAttribute("name")
							oNewMenu.Language = Menu.getAttribute("language")
							executeCode = Menu.getAttribute("executeCode")
							if executeCode == "True":
								oNewMenu.ExecuteCode = True
							if executeCode == "False":
								oNewMenu.ExecuteCode = False
							CodeNode = Menu.childNodes[0]
							if CodeNode.nodeValue != " ":
								oNewMenu.Code = CodeNode.nodeValue
					
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
										oNewMenu.insertMenuItem (len(oNewMenu.Items), oMenuItem)
								if MenuItemNamesList[i] == "QMenu_Menu":
									oMenuItem = getQMenu_MenuByName(MenuItemNamesList[i+1])
									if oMenuItem != None:
										oNewMenu.insertMenuItem (len(oNewMenu.Items), oMenuItem)
								if MenuItemNamesList[i] == "Command":
									oMenuItem = App.Commands(MenuItemNamesList[i+1]) #Get Command by name
									#oMenuItem = getCommandByUID(MenuItemNamesList[i+2]) #Get Command by UID through a Python function, which is slower but safer
									#oMenuItem = App.GetCommandByUID(MenuItemNamesList[i+2]) #Get Command by UID through custom c++ command, which is much faster than Python but still slow
									
									if oMenuItem != None:
										oDummyCmd = App.QMenuCreateObject("CommandPlaceholder")
										oDummyCmd.Name = (MenuItemNamesList[i+1])
										
										oDummyCmd.UID = (MenuItemNamesList[i+2])
										oNewMenu.insertMenuItem (len(oNewMenu.Items), oDummyCmd)
									else: #Command could not be found? Insert Dummy command instead, it might become available at a later session
										#Print("A command named '" + str(MenuItemNamesList[i+1]) + "' could not be found!", c.siWarning)
										oMissingCmd = App.QMenuCreateObject("MissingCommand")
										oMissingCmd.Name = (MenuItemNamesList[i+1])
										
										oMissingCmd.UID = (MenuItemNamesList[i+2])
										oNewMenu.insertMenuItem (len(oNewMenu.Items), oMissingCmd)
										
								if MenuItemNamesList[i] == "QMenuSeparator":
									oMenuItem = getQMenuSeparatorByName(MenuItemNamesList[i+1])
									if oMenuItem != None:
										oNewMenu.insertMenuItem (len(oNewMenu.Items), oMenuItem)
								i = i+3 #Increase counter by 3 to get to the next item (we save 3 properties per item: type, name, UID)
				
			for Component in Components[0].childNodes:
				if Component.localName == "QMenu_MenuDisplayContexts":
					QMenuContexts = Component.childNodes
					for Context in QMenuContexts:
						if str(Context.localName) == "QMenu_MenuDisplayContext":
							oNewContext = App.QMenuCreateObject("MenuDisplayContext")
							oNewContext.Name = Context.getAttribute("name")
							oNewContext.Language = Context.getAttribute("language")
							oNewContext.ScanDepth = int(Context.getAttribute("scandepth"))
							CodeNode = Context.childNodes[0]
							if CodeNode.nodeValue != " ":
								oNewContext.Code = CodeNode.nodeValue
							result = globalQMenu_DisplayContexts.addContext(oNewContext)

								
			for Component in Components[0].childNodes:
				if Component.localName == "QMenu_MenuSets":
					QMenu_MenuSets = Component.childNodes
					for Set in QMenu_MenuSets:
						if str(Set.localName) == ("QMenu_MenuSet"):
							oNewMenuSet = App.QMenuCreateObject("MenuSet")
							oNewMenuSet.Name = Set.getAttribute("name")
							
							AContextNames = ((Set.getAttribute("AContexts")).split(";"))
							AMenuNames = ((Set.getAttribute("AMenus")).split(";"))

							if len(AContextNames) == len(AMenuNames):
								for AContextName in AContextNames:
									oAContext = getQMenu_MenuDisplayContextByName(str(AContextName))
									if oAContext != None:
										ContextIndex = AContextNames.index(AContextName)
										AMenuName = AMenuNames[ContextIndex]
										oAMenu = getQMenu_MenuByName(AMenuName)
										oNewMenuSet.insertContextAtIndex (len(oNewMenuSet.AContexts), oAContext, "A")
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
										oNewMenuSet.insertContextAtIndex (len(oNewMenuSet.BContexts), oBContext, "B")
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
										oNewMenuSet.insertContextAtIndex (len(oNewMenuSet.CContexts), oCContext, "C")
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
										oNewMenuSet.insertContextAtIndex (len(oNewMenuSet.DContexts), oDContext, "D")
										oNewMenuSet.insertMenuAtIndex (len(oNewMenuSet.DMenus), oDMenu, "D")
							globalQMenu_MenuSets.addSet(oNewMenuSet)

							
			for Component in Components[0].childNodes:
				if Component.localName == "QMenuViewSignatures":
					QMenuSignatures = Component.childNodes
					for Signature in QMenuSignatures:
						if str(Signature.localName) == "QMenuViewSignature":
							oNewSignature = App.QMenuCreateObject("ViewSignature")
							oNewSignature.Name = Signature.getAttribute("name")

							oNewSignature.Signature = Signature.getAttribute("signature")

							MenuSets = Signature.getAttribute("menuSets").split(";")

							for MenuSet in MenuSets:
								oMenuSet = getQMenu_MenuSetByName(MenuSet)
								if oMenuSet != None:
									oNewSignature.insertMenuSet(len(oNewSignature.MenuSets), oMenuSet)

							result = globalQMenu_ViewSignatures.addSignature(oNewSignature)
								
			for Component in Components[0].childNodes:
				if Component.localName == "QMenuDisplayEvents":
					QMenuDisplayEvents = Component.childNodes
					for Event in QMenuDisplayEvents:
						if str(Event.localName) == "QMenuDisplayEvent":
							oNewDisplayEvent = App.QMenuCreateObject("DisplayEvent")
							oNewDisplayEvent.Number = int(Event.getAttribute("number"))
							#Print("\nFound Display Event Number " + str(oNewDisplayEvent.Number))
							oNewDisplayEvent.Key = int(Event.getAttribute("key"))
							oNewDisplayEvent.KeyMask = int(Event.getAttribute("keyMask"))
							result = globalQMenu_DisplayEvents.addEvent(oNewDisplayEvent)
			gc.collect()
			return True
		else:
			Print("Could not load QMenu Configuration from '" + str(fileName) + "' because the file could not be found!", c.siError)
			gc.collect()
			return False

def getView( Silent = False):
	CursorPos = win32gui.GetCursorPos()
	#WindowPos = win32gui.GetWindowPlacement(hwnd)
	
	WinUnderMouse = win32gui.WindowFromPoint (CursorPos)
	WindowSignature = getDS_ChildName(WinUnderMouse)
	oXSIView = None
	Views = Application.Desktop.ActiveLayout.Views
	
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
			
	#The following is a workaround for a Softimage limitation: it does not name ICE Trees properly, win32com sees them as "Render Tree".
	#So we figure out if we find Render Tree in the signature and check if the view is docked in the View manager. 
	#If so, we replace "Render Tree" with "ICE Tree" in case the view is of type ICE Tree.
	if WindowSignatureShort.find("ViewManager") > -1: #Mouse is over one of the view managers windows (3D View or an editor window docked in A,B,C or D view?)		
		ViewIndices = {"A":0,"B":1,"C":2,"D":3}
		oVM = Views("vm")
		ViewportUnderMouse = oVM.GetAttributeValue("viewportundermouse")
		oVM.SetAttributeValue("focusedviewport",ViewportUnderMouse)
		oXSIView = oVM.Views[ViewIndices[str(ViewportUnderMouse)]]
		if oXSIView != None:
			if oXSIView.Type == "ICE Tree":
				WindowSignatureShort = WindowSignatureShort.replace("RenderTree", "ICETree")
				WindowSignature = WindowSignature.replace("RenderTree", "ICETree")
	
	#We are not over the view manager (e.g. mouse is over a floating view). Because there is no 100% reliable way to get the floating view object under the mouse
	#we simply look for the first valid view (open and not embedded in another view) of it's type in the list of all known views.
	#Implication: QMenu will not work over the e.g. the second floating Render Tree or OCE Tree or..., only the first one. For now we'll need to live with that
	#until Autodesk implements a method to get the floating view object under the mouse directly and reliably.
	
	else:
		if WindowSignatureShort.find("ICETree") > -1:
			oXSIView = getFirstValidViewOfType(Views, "ICE Tree")
		if WindowSignatureShort.find("RenderTree") > -1:
			oXSIView = getFirstValidViewOfType(Views, "Render Tree")
		if WindowSignatureShort.find("TextureEditor") > -1:
			oXSIView = getFirstValidViewOfType(Views, "Texture Editor")
		
	#Yuk, lets carry on...
	if Silent != True:
		Print ("Picked Window has the following short QMenu View Signature: " + str(WindowSignatureShort), c.siVerbose)
		Print ("Picked Window has the following long QMenu View Signature: " + str(WindowSignature), c.siVerbose)
		
	Signatures = list()
	Signatures.append (WindowSignatureShort)
	Signatures.append (WindowSignature)
	Signatures.append (oXSIView)
	#Signatures.append (WindowPos)
	#Print(Signatures)
	return Signatures

def getFirstValidViewOfType(ViewCollection, ViewType):
	oView = None
	for oView in ViewCollection:
		if (oView.Type == ViewType):
			if (oView.Floating == True) and (oView.State == 0): #View is not embedded nor closed/minimized?
				return oView
	
def getDefaultConfigFilePath(FileNameToAppend):
	DefaultConfigFile = ""
	for plug in App.Plugins:
		if plug.Name == ("QMenuConfigurator"):
			DefaultConfigFolder = (plug.OriginPath.rsplit("\\",3)[0] + "\\Data\\Preferences\\")#Get the left side of the path before "Data"
			#Print("DefaultConfigFolder: " + str(DefaultConfigFolder))
			DefaultConfigFilePath =  (DefaultConfigFolder + FileNameToAppend)
			return DefaultConfigFilePath

def getCustomGFXFilesPath():
	CustomGFXFolder = ""
	for plug in App.Plugins:
		if plug.Name == ("QMenuConfigurator"):
			CustomGFXFolder = (plug.OriginPath.rsplit("\\",3)[0] + "\\Data\\Images\\")#Get the left side of the path before "Data"
			return CustomGFXFolder

def initializeQMenuGlobals(force = False):
	Print("QMenu: initializeQMenuGlobals called", c.siVerbose)
	#if force == False:
	if getGlobalObject ("globalQMenu_LastUsedItem") == None or force == True:
		setGlobalObject ("globalQMenu_LastUsedItem", App.QMenuCreateObject("LastUsedItem"))

	if getGlobalObject ("globalQMenu_Separators") == None or force == True:
		setGlobalObject ("globalQMenu_Separators",App.QMenuCreateObject("Separators"))
		#For simplicities sake we create the menu separator object here directly, there is currently only this single one anyway
		oGlobalSeparators = getGlobalObject("globalQMenu_Separators")
		oGlobalSeparators.addSeparator(App.QMenuCreateObject("Separator"))	
		
	if (getGlobalObject ("globalQMenu_MenuItems") == None) or force == True:
		setGlobalObject ("globalQMenu_MenuItems", App.QMenuCreateObject("MenuItems"))	

	if (getGlobalObject ("globalQMenu_Menus") == None) or force == True:
		setGlobalObject ("globalQMenu_Menus", App.QMenuCreateObject("Menus"))	

	if (getGlobalObject ("globalQMenu_MenuSets") == None) or force == True:
		setGlobalObject ("globalQMenu_MenuSets", App.QMenuCreateObject("MenuSets"))
		
	if (getGlobalObject ("globalQMenu_DisplayContexts") == None) or force == True:
		setGlobalObject ("globalQMenu_DisplayContexts", App.QMenuCreateObject("MenuDisplayContexts"))
		
	if (getGlobalObject ("globalQMenu_ViewSignatures") == None) or force == True:
		setGlobalObject ("globalQMenu_ViewSignatures", App.QMenuCreateObject("ViewSignatures"))
		
	if (getGlobalObject ("globalQMenu_DisplayEvents") == None) or force == True:
		setGlobalObject ("globalQMenu_DisplayEvents", App.QMenuCreateObject("DisplayEvents"))

	if (getGlobalObject ("globalQMenu_ConfigStatus") == None) or force == True:
		setGlobalObject ("globalQMenu_ConfigStatus", App.QMenuCreateObject("ConfigStatus"))
	
	if (getGlobalObject ("globalQMenu_ContextObject") == None) or force == True:
		setGlobalObject ("globalQMenu_ContextObject", App.QMenuCreateObject("Context"))

	#if (getGlobalObject ("globalQMenu_RecentlyCreatedICENodes") == None) or force == True:
		#setGlobalObject ("globalQMenu_RecentlyCreatedICENodes", App.QMenuCreateObject("RecentlyCreatedICENodes"))
			
	QMenuGetSelectionDetails(0)
	
def deleteQMenu_Menu(MenuName):
	Print("Deleting Menu named: " + MenuName)
	if MenuName != "":
		globalQMenu_Menus = getGlobalObject("globalQMenu_Menus")
		oMenuToDelete = getQMenu_MenuByName(MenuName)
		
		#Delete Menu from global QMenu menus
		for oMenu in globalQMenu_Menus.Items:
			if oMenu == oMenuToDelete:
				globalQMenu_Menus.deleteMenu(oMenu)
			
		
		#Delete Menu from global QMenu menu Sets too (Python does not allow for global object destruction :-( )
		globalQMenu_MenuSets = getGlobalObject("globalQMenu_MenuSets").Items
		for oMenuSet in globalQMenu_MenuSets:
			for oMenu in oMenuSet.AMenus:
				if oMenu == oMenuToDelete:
					try:
						MenuIndex = oMenuSet.AMenus.index(oMenu)
						oMenuSet.removeMenuAtIndex (MenuIndex,"A")
					except:
						pass
			for oMenu in oMenuSet.BMenus:
				if oMenu == oMenuToDelete:
					try:
						MenuIndex = oMenuSet.BMenus.index(oMenu)
						oMenuSet.removeMenuAtIndex (MenuIndex,"B")
					except:
						pass
			for oMenu in oMenuSet.CMenus:
				if oMenu == oMenuToDelete:
					try:
						MenuIndex = oMenuSet.CMenus.index(oMenu)
						oMenuSet.removeMenuAtIndex (MenuIndex, "C")
					except:
						pass
			for oMenu in oMenuSet.DMenus:
				if oMenu == oMenuToDelete:
					try:
						MenuIndex = oMenuSet.DMenus.index(oMenu)
						oMenuSet.removeMenuAtIndex (MenuIndex, "D")
					except:
						pass
						
		for oMenu in globalQMenu_Menus.Items:
			for oItem in oMenu.Items:
				if oItem == oMenuToDelete:
					oMenu.removeMenuItem(oMenuToDelete)			

def deleteQMenu_MenuItem(MenuItemName):				
	Print ("QMenu: deleteQMenu_MenuItem called",c.siVerbose)

	globalQMenu_MenuItems = getGlobalObject("globalQMenu_MenuItems")
	globalQMenu_Menus = getGlobalObject("globalQMenu_Menus")
	
	for oMenuItem in globalQMenu_MenuItems.Items:
		if oMenuItem.Name == MenuItemName:
			globalQMenu_MenuItems.deleteMenuItem(oMenuItem)
	
	for oMenu in globalQMenu_Menus.Items:
		for oMenuItem in oMenu.Items:
			if oMenuItem.Name == MenuItemName:
				oMenu.removeMenuItem (oMenuItem)
					
def convertListToString(List):
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
	globalQMenu_Menus = getGlobalObject("globalQMenu_Menus")
	for menu in globalQMenu_Menus.Items:
		if menu.Name == menuName:
			return menu

def getQMenu_MenuByUID (menuUID):
	globalQMenu_Menus = getGlobalObject("globalQMenu_Menus")
	for menu in globalQMenu_Menus.Items:
		if menu.UID == menuUID:
			return menu

def getQMenu_MenuSetByName (menuSetName):
	globalQMenu_MenuSets = getGlobalObject("globalQMenu_MenuSets")
	for oMenuSet in globalQMenu_MenuSets.Items:
		if oMenuSet.Name == menuSetName:
			return oMenuSet

def getQMenu_MenuDisplayContextByName (menuDisplayContextName):
	globalQMenu_DisplayContexts = getGlobalObject("globalQMenu_DisplayContexts")
	for oContext in globalQMenu_DisplayContexts.Items:
		if oContext.Name == menuDisplayContextName:
			return oContext
			
def getQMenu_MenuItemByName (menuItemName):
	globalQMenu_Menus = getGlobalObject("globalQMenu_MenuItems")
	oMenuItem = None
	for oMenuItem in globalQMenu_Menus.Items:
		if oMenuItem.Name == menuItemName:
			break
	return oMenuItem

def getQMenuSeparatorByName (separatorName):
	globalQMenu_Separators = getGlobalObject("globalQMenu_Separators")
	for oItem in globalQMenu_Separators.Items:
		if oItem.Name == separatorName:
			return oItem
					
def getQMenu_ViewSignatureByName(signatureName):
	globalQMenu_ViewSignatures = getGlobalObject("globalQMenu_ViewSignatures")	
	for oSignature in globalQMenu_ViewSignatures.Items:
		if oSignature.Name == signatureName:
			return oSignature

def getCommandByUID(UID):
	for Cmd in App.Commands:
		if Cmd.UID == UID:
			
			return Cmd
	return None

def getGlobalObject ( in_VariableName ):
	if len(in_VariableName) == 0:
		Print("Invalid argument to getGlobalObject", c.siError)

	dic = getDictionary()
	
	if in_VariableName in dic:
		return dic[in_VariableName]
	else:
		return None

def setGlobalObject( in_VariableName, in_Value ):

	if len(in_VariableName) == 0:
		Print("Invalid argument to setGlobalObject", c.siError)

	dic = getDictionary()		
	dic[in_VariableName] = in_Value		

def getDictionary():
	thisPlugin = Application.Plugins("QMenuConfigurator")
	if thisPlugin.UserData == None:
		# Create the dictionary on the fly.  Once created
		# it will remain active as long as Softimage is running.
		# (Unless you manually Unload or Reload this plugin)

		dict = d.Dispatch( "Scripting.Dictionary" )
		thisPlugin.UserData = dict

	g_dictionary = thisPlugin.UserData
	return g_dictionary
	
def userQuery(strCaption, lsItems):
	oDial = win32com.client.Dispatch( "XSIDial.XSIDialog" )
	result = oDial.Combo( strCaption, lsItems );
	return result

def getQMenuConfiguratorCustomProperty():
	for prop in Application.ActiveSceneRoot.Properties:
		if prop.Type == "QMenuConfigurator":
			return prop
	return None

def getQMenuPreferencesCustomProperty():
	colQMenuConfigurator = XSIFactory.CreateActiveXObject( "XSI.Collection" )
	
	#CommandLoggingState = Application.Preferences.GetPreferenceValue("scripting.cmdlog")
	#Application.Preferences.SetPreferenceValue("scripting.cmdlog", False)  #Disable command logging
	
	CustomProperties = App.FindObjects( "", "{76332571-D242-11d0-B69C-00AA003B3EA6}" ) #Find all Custom Properties
	for oProp in CustomProperties:
		if oProp.Type == ("QMenuPreferences"): #Find all Custom Properties of Type "QMenuConfigurator"
			break

	#Application.Preferences.SetPreferenceValue("scripting.cmdlog", CommandLoggingState)
	
	return o	
#=========================================================================================================================	
#========================================== Old and experimental Stuff ===================================================
#=========================================================================================================================	

"""

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

"""

#AutoCenter for new objects feature - useless because also objects are affected when duplicated - not good :-(
def AutoCenterNewObjects_OnEvent(in_ctxt):
	addedObjects = in_ctxt.GetAttribute("Objects")
	Print("Objcts added: " + str(addedObjects))
	#for obj in addedObjects:
	Application.Rotate(addedObjects, 0, 0, 0, "siAbsolute", "siObjCtr", "siObj", "siXYZ", "", "", "", "", "", "", "", 0, "")
	Application.Translate(addedObjects, 0, 0, 0, "siAbsolute", "siObjCtr", "siObj", "siXYZ", "", "", "", "", "", "", "", "", "", 0, "")
