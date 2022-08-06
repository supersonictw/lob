// LOB Engine
// (c) 2022 SuperSonic (https://github.com/supersonictw)

var app = new Vue({
    el: '#console',
    data: () => ({
        emulator: null,
        emulatorExtendedInfo: {},
        systemProfile: {
            default: {
                memory_size: 64 * 1024 * 1024,
                vga_memory_size: 8 * 1024 * 1024,
                cdrom: {
                    url: "./images/system.iso",
                    size: 19922944,
                }
            },
            vanilla: {
                memory_size: 8 * 1024 * 1024,
                vga_memory_size: 2 * 1024 * 1024,
                cdrom: {
                    url: "./images/vanilla.iso",
                    size: 8638464,
                }
            }
        },
    }),
    computed: {
        screenContainer() {
            return this.$refs.screenContainer;
        },
        emulatorEventMethods() {
            return [
                {
                    name: "mouse-enable",
                    method: (isEnabled) => {
                        this.emulatorExtendedInfo.mouseEnabled = isEnabled;
                    }
                }
            ];
        },
    },
    methods: {
        boot(baseProfile) {
            const system = { ...baseProfile };
            // Setup WASM
            system.wasm_path = "./engine/v86.wasm";
            // Setup BIOS
            system.bios = {
                url: "./bios/seabios.bin",
            };
            system.vga_bios = {
                url: "./bios/vgabios.bin",
            };
            // Setup Network Relay
            system.network_relay_url = "wss://relay.widgetry.org/";
            // Setup Screen Container
            system.screen_container = this.screenContainer;
            // Setup Auto Start
            system.autostart = true;
            // Mount Machine
            this.emulator = new V86Starter(system);
            // Return Machine
            return this.emulator;
        },
        setupMachineEventListener(machine) {
            for (const e of this.emulatorEventMethods) {
                machine.add_listener(e.name, e.method);
            }
        },
        lockMouse() {
            const body = document.body;
            const method = body.requestPointerLock
                || body.mozRequestPointerLock
                || body.webkitRequestPointerLock
                || body.msRequestPointerLock;
            if (method) {
                method.call(body);
            } else {
                console.warn("The browser is not support requestPointerLock");
            }
        },
        requestFullScreen() {
            const element = this.screenContainer;
            const method = element.requestFullscreen
                || element.mozRequestFullScreen
                || element.webkitRequestFullscreen
                || element.msRequestFullscreen;
            if (method) {
                method.call(element);
            } else {
                console.warn("The browser is not support requestFullscreen");
            }
        },
        requestExitFullScreen() {
            const method = document.exitFullscreen
                || document.mozCancelFullScreen
                || document.webkitExitFullscreen
                || document.msExitFullscreen;
            if (method) {
                method.call(document);
            } else {
                console.warn("The browser is not support exitFullscreen");
            }
        },
        saveFile() {
            if (!this.emulator) {
                console.error('No emulator loaded');
                return;
            }

            this.emulator.save_state(function (error, new_state) {
                if (error) {
                    throw error;
                }

                var a = document.createElement("a");
                a.download = "v86state.bin";
                a.href = window.URL.createObjectURL(new Blob([new_state]));
                a.dataset.downloadurl = "application/octet-stream:" + a.download + ":" + a.href;
                a.click();
            });
        },
        restoreFile() {
            if (this.files.length) {
                var filereader = new FileReader();
                this.emulator.stop();

                filereader.onload = function (e) {
                    this.emulator.restore_state(e.target.result);
                    this.emulator.run();
                };

                filereader.readAsArrayBuffer(this.files[0]);

                // ToDo: File reset
            }
        },
        handleClickOnBox() {
            if (this.emulatorExtendedInfo.mouseEnabled) {
                this.lockMouse();
            }
        },
    },
    mounted() {
        const params = new URLSearchParams(window.location.search);
        const profileName = params.get("profile");
        const baseProfile = this.systemProfile[profileName] || this.systemProfile.default;
        const machine = this.boot(baseProfile);
        this.setupMachineEventListener(machine);
    },
});
