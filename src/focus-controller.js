(function(root, Bitwig, _) {
    'use strict';
    // imports
    var utils = root.KompleteKontrol.utils;
    var KK_VST_ID = root.KompleteKontrol.vstID;

    // constants
    var MAX_CHARS = 28,
        SID_START = 20,
        SID_NAV_UP = 20,
        SID_NAV_DOWN = 21,
        SID_END = 21,
        KK_ID_PARAM_PREFIX = 'NIKB',
        PLUGIN_PREFIX = 'Komplete Kontrol',
        SYSEX_HEADER = 'f0 00 00 66 14 12 ',
        SYSEX_SEP = '19 ',
        SYSEX_EOX = 'f7';

    // constructor
    var FocusController = function(midiOut, cursorTrack, kkDeviceMatcher) {
        // instance variables
        this.midiOut = midiOut;
        this.track = cursorTrack;
        this.deviceBank = cursorTrack.createDeviceBank(3);
        this.kkDeviceMatcher = kkDeviceMatcher;
        this.status = {
            track: undefined,   // current selected track name
            device: undefined,  // current selected device name
            id: undefined,      // Komplete Kontrol device id
            hasChanged: false
        };
        this.elements = [];
        this.elements.length = SID_END - SID_START + 1;
        // initialize
        this.initialize();
    };

    FocusController.prototype = {
        initialize: function() {
            var track = this.track,
                deviceBank = this.deviceBank,
                status = this.status;
            
            deviceBank.setDeviceMatcher(this.kkDeviceMatcher);


            track.addNameObserver(MAX_CHARS, '', function(value) {
                status.track = value;
                status.hasChanged = true;
            });

            track.addPositionObserver(function(value) {
                deviceBank.getDevice(0).selectInEditor();
                status.trackPosition = value;
                status.hasChanged = true;
            });

            deviceBank.getDevice(0)
                .addNameObserver(MAX_CHARS, '', function(value) {
                    if (value) {
                    status.device = value;
                    status.hasChanged = true;
                    }
                });

            deviceBank.getDevice(0)
                .createSpecificVst2Device(KK_VST_ID)
                // Komplete Kontrol MIKBnn paramater is always the first
                .createParameter(0)
                // MIKBnn:  nn = id of Komplete Kontrol instance.
                .addNameObserver(MAX_CHARS, '', function(value) {
                  status.id = value.substring(KK_ID_PARAM_PREFIX.length);
                  status.hasChanged = true;
                });

            this.createElement(SID_NAV_UP, {
                on: function() {track.selectPrevious();}
            });

            this.createElement(SID_NAV_DOWN, {
                on: function() {track.selectNext();}
            });
        },

        flush: function() {
            this.sendStatus();
        },

        exit: function() {
        },

        onMidi1: function(s, d1, d2) {
            if (s === 0xB0) {this.onMidiCC(d1, d2);}
        },

        onMidiCC: function(d1, d2) {
            var btn = (d1 >= SID_START && d1 <= SID_END) ? this.elements[d1 - SID_START] : undefined;
            btn && (d2 !== 0 ? (btn.on && btn.on.call(this)) : (btn.off && btn.off.call(this)));
        },

        createElement: function(cc, button) {
            this.elements[cc - SID_START] = button;
        },

        sendStatus: function() {
            var status = this.status;
            if(status.hasChanged && status.trackPosition >= 0) {
                var d = [];
                root.println('## flush track:[' + status.track + 
                             '] position:[' + status.trackPosition + 
                             '] device:[' + status.device + 
                             '] id:[' + status.id + ']');
                d.push(status.track);
                d.push(status.trackPosition.toString());
                // add device name
                if (status.device && status.device.length > 0) {
                    d.push(status.device);
                    // add komplete kontrol instance id.
                    if (status.id) {
                        d.push(status.id);
                    }
                }
                this.midiOut.sendSysex(utils.statusMessage(d));
                status.hasChanged = false;
            }
        }
    };
    // export
    root.KompleteKontrol || (root.KompleteKontrol = {});
    root.KompleteKontrol.FocusController = FocusController;
}(this, host, _));
