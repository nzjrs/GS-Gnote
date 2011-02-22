const Main = imports.ui.main;
const Panel = imports.ui.panel;
const Clutter = imports.gi.Clutter;
const DBus = imports.dbus;
const Lang = imports.lang;
const Shell = imports.gi.Shell;
const Util = imports.misc.util;
const Signals = imports.signals;
const St = imports.gi.St;
const Scripting = imports.ui.scripting;
const Mainloop = imports.mainloop;

const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const Gettext = imports.gettext.domain('gnote');
const _ = Gettext.gettext;

const GNOTE_DBUS_NAME = "org.gnome.Gnote";
const GNOTE_DBUS_REMOTECONTROL_NAME = GNOTE_DBUS_NAME + ".RemoteControl";
const GNOTE_DBUS_REMOTECONTROL_PATH = "/org/gnome/Gnote/RemoteControl";

const GnoteInterface = {
	name: GNOTE_DBUS_REMOTECONTROL_NAME,
	methods: [
		{ name: 'CreateNote', inSignature: '', outSignature: 's'},
		{ name: 'CreateNamedNote', inSignature: 's', outSignature: 's' },
		{ name: 'DisplayNote', inSignature: 's', outSignature: '' },
		{ name: 'GetNoteTitle', inSignature: 's', outSignature: 's' },
		{ name: 'ListAllNotes', inSignature: '', outSignature: 'as' },
	],
	signals: [
		{ name: 'NoteAdded', inSignature: '', outSignature: 's' },
		{ name: 'NoteDeleted', inSignature: '', outSignature: 's' }
	],
	properties: [
	]
};
let GnoteProxy = DBus.makeProxyClass(GnoteInterface);

function Indicator() {
	this._init.apply(this, arguments);
}

Indicator.prototype = {
	__proto__: PanelMenu.SystemStatusButton.prototype,

	_init: function() {
		PanelMenu.SystemStatusButton.prototype._init.call(this, 'text-x-generic-symbolic');

		Util.killall('gnote');
		Util.spawn(['gnote']);

		this._dbus = new GnoteProxy(DBus.session, GNOTE_DBUS_NAME, GNOTE_DBUS_REMOTECONTROL_PATH);

		Mainloop.timeout_add(2000, Lang.bind(this, this._refreshNotes));

		this._dbus.connect('NoteAdded', Lang.bind(this, this._noteAdded));
		this._dbus.connect('NoteDeleted', Lang.bind(this, this._noteDeleted));
	},

	_refreshNotes: function() {
		this.menu.removeAll();
		this._dbus.ListAllNotesRemote(Lang.bind(this, this._addNotesSyncWrapper));
	},

	_addNotesSyncWrapper: function(list, i) {
		if ( !i ) i = 0;
		if ( i < list.length )
		{
			let uri = list[i];
			this._dbus.GetNoteTitleRemote(uri, Lang.bind(this, function(name) {
				let note = new PopupMenu.PopupMenuItem(name);
				note.connect('activate', Lang.bind(this, function(actor, event) {
					this._dbus.DisplayNoteRemote(uri);
				}));
				this.menu.addMenuItem(note);
				this._addNotesSyncWrapper(list, i+1);
			}));

		}
		else
		{
			this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
			this.menu.addAction(_("Create a new Note"), Lang.bind(this, function() { this._dbus.CreateNoteRemote(); }));
		}
	},

	_noteAdded: function(uri) {
		this._refreshNotes();
	},

	_noteDeleted: function(uri) {
		this._refreshNotes();
	}
};

function main() {
	Main.StatusIconDispatcher.STANDARD_TRAY_ICON_IMPLEMENTATIONS['gnote'] = 'gnote';
	Panel.STANDARD_TRAY_ICON_ORDER.unshift('gnote');
	Panel.STANDARD_TRAY_ICON_SHELL_IMPLEMENTATION['gnote'] = Indicator;
}
