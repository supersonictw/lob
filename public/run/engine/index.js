// LOB Engine
// (c) 2022 SuperSonic (https://github.com/supersonictw)

const app = new Vue({
    el: '#console',
    data: () => ({
        isPowerPressed: false,
        isDownloadCompleted: false,
        isShowOptionsMenu: false,
        progressTicks: -1,
        progressState: 'Downloading...',
        emulator: null,
        emulatorExtendedInfo: {
            isPaused: false,
            mouseEnabled: false,
        },
        systemProfile: {
            default: {
                memory_size: 64 * 1024 * 1024,
                vga_memory_size: 8 * 1024 * 1024,
                cdrom: {
                    url: "./images/system.iso",
                    size: 23068672,
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
    watch: {
        isDownloadCompleted(isCompleted) {
            if (isCompleted && this.isPowerPressed) {
                this.machinePowerBoot(this.emulator);
            }
        }
    },
    computed: {
        isEmulatorRunning() {
            if (this.emulatorExtendedInfo.isPaused) return true;
            return this.emulator && this.emulator.is_running();
        },
        isInFullScreen() {
            return !!document.fullscreenElement;
        },
        isShowProgressBar() {
            return this.progressTicks >= 0;
        },
        optionsMenuStyle() {
            const value = this.isShowOptionsMenu ? 'block' : 'none';
            return {
                display: `${value} !important`,
            };
        },
        progressPercentage() {
            const progressValue = this.progressTicks < 1
                ? this.progressTicks
                : 1;
            return progressValue * 100;
        },
        progressPercentageString() {
            const value = this.progressPercentage;
            return `${value.toFixed(0)}%`;
        },
        progressBarStyle() {
            return {
                width: this.progressPercentageString
            };
        },
        emulatorEventMethods() {
            return [
                {
                    name: "download-progress",
                    method: (e) => {
                        this.progressTicks = 0;

                        if (e.file_name.endsWith(".wasm")) {
                            const filenameRaw = e.file_name.split("/");
                            const filename = filenameRaw[filenameRaw.length - 1];
                            this.progressState = `Fetching "${filename}" ...`;
                            return;
                        }

                        if (e.file_index === e.file_count - 1 && e.loaded >= e.total - 2048) {
                            this.isDownloadCompleted = true;
                            this.progressState = "Download completed! Click power button to start.";
                            setTimeout(() => {
                                this.progressTicks = -1;
                            }, 3000);
                            return;
                        }

                        if (typeof e.file_index === "number" && e.file_count) {
                            this.progressState = `Downloading images (${e.file_index + 1}/${e.file_count}) ...`;
                        }

                        if (e.total && typeof e.loaded === "number") {
                            this.progressTicks = e.loaded / e.total;
                        } else {
                            this.progressState += ".".repeat(this.progressTicks++ % 50);
                        }
                    }
                },
                {
                    name: "download-error",
                    method: (e) => {
                        this.progressTicks = 0;
                        this.progressState = `
                            Error: Loading "${e.file_name}" failed.
                            Check your connection and reload the page to try again later.
                        `;
                    }
                },
                {
                    name: "mouse-enable",
                    method: (isEnabled) => {
                        this.emulatorExtendedInfo.mouseEnabled = isEnabled;
                    }
                },
                {
                    name: "emulator-stopped",
                    method: () => {
                        if (!this.isInFullScreen) return;
                        this.documentRequestExitFullScreen();

                    }
                },
            ];
        },
    },
    methods: {
        machineSetup(baseProfile) {
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
            system.screen_container = this.$refs.screenContainer;
            // Mount Machine
            this.emulator = new V86Starter(system);
            // Return Machine
            return this.emulator;
        },
        machineSetupEventListener(machine) {
            for (const e of this.emulatorEventMethods) {
                machine.add_listener(e.name, e.method);
            }
        },
        async machineStateSave(machine) {
            // Save the state of the machine
            const state = machine.save_state();
            const stateObject = new Blob([state]);
            // Create virtual download link
            const a = document.createElement("a");
            a.download = "v86state.bin";
            a.href = window.URL.createObjectURL(stateObject);
            a.dataset.downloadurl = `application/octet-stream:${a.download}:${a.href}`;
            // Trigger virtual download link
            a.click();
        },
        machineStateRestore(machine) {
            if (this.files.length) return;

            const filereader = new FileReader();
            machine.stop();

            filereader.onload = function (e) {
                machine.restore_state(e.target.result);
                machine.run();
            };

            filereader.readAsArrayBuffer(this.files[0]);

            // ToDo: File reset
        },
        machinePowerBoot(machine) {
            this.isPowerPressed = true;
            if (!this.isDownloadCompleted) return;
            if (this.isEmulatorRunning) {
                machine.stop();
                machine.restart();
            } else {
                machine.run();
            }
        },
        machinePowerPause(machine) {
            if (this.emulatorExtendedInfo.isPaused) {
                machine.run();
                this.emulatorExtendedInfo.isPaused = false;
            } else {
                machine.stop();
                this.emulatorExtendedInfo.isPaused = true;
            }
        },
        machinePowerReset(machine) {
            machine.restart();
        },
        documentLockMouse() {
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
        documentRequestFullScreen() {
            const element = this.$refs.screenContainer;
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
        documentRequestExitFullScreen() {
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
        documentHandleClickBox() {
            if (this.emulatorExtendedInfo.mouseEnabled) {
                this.documentLockMouse();
            }
        },
        documentHandleClickButtonPower() {
            this.machinePowerBoot(this.emulator);
        },
        documentHandleClickButtonPause() {
            this.machinePowerPause(this.emulator);
        },
        documentHandleClickButtonReset() {
            this.machinePowerReset(this.emulator);
        },
        documentHandleClickButtonFullScreen() {
            this.documentRequestFullScreen();
        },
        documentHandleClickButtonOptions() {
            this.isShowOptionsMenu = !this.isShowOptionsMenu;
        },
        documentHandleClickButtonOptionsSave() {
            this.machineStateSave(this.emulator);
        }
    },
    mounted() {
        const params = new URLSearchParams(window.location.search);
        const profileName = params.get("profile");
        const baseProfile = this.systemProfile[profileName] || this.systemProfile.default;
        const machine = this.machineSetup(baseProfile);
        this.machineSetupEventListener(machine);
    },
});
