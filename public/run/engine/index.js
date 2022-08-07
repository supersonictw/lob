// LOB Engine
// (c) 2022 SuperSonic (https://github.com/supersonictw)

const app = new Vue({
    el: '#console',
    data: () => ({
        isPowerPressed: false,
        isDownloadCompleted: false,
        isShowOptionsMenu: false,
        isShowRestoreModal: false,
        progressTicks: -1,
        progressState: "",
        emulator: null,
        emulatorExtendedInfo: {
            isPaused: false,
            mouseEnabled: false,
        },
        restoreFile: null,
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
        isShowInitPowerButton() {
            return (!this.isDownloadCompleted && !this.isPowerPressed)
                || (this.isDownloadCompleted && !this.isEmulatorRunning);
        },
        isShowModal() {
            return this.isShowRestoreModal;
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
        powerPauseText() {
            return this.emulatorExtendedInfo.isPaused ? "Resume" : "Pause";
        },
        powerResetText() {
            return "Reset";
        },
        powerPowerText() {
            return this.isEmulatorRunning ? "Power OFF" : "Power ON";
        },
        operationBoxClass() {
            return {
                'fade': true,
                'show': this.isEmulatorRunning,
            };
        },
        optionsMenuClass() {
            return {
                'dropdown-menu': true,
                'dropdown-menu-right': true,
                'd-block': this.isShowOptionsMenu
            };
        },
        restoreModalClass() {
            return {
                'modal': true,
                'fade': true,
                'show': this.isShowRestoreModal,
                'd-block': this.isShowRestoreModal,
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
                            this.progressState = "Download completed!";
                            if (!this.isPowerPressed) {
                                this.progressState += " Click power button to start."
                            }
                            setTimeout(() => {
                                this.progressTicks = -1;
                                this.progressState = "";
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
            system.wasm_path = "./engine/v86/v86.wasm";
            // Setup BIOS
            system.bios = {
                url: "./bios/seabios.bin",
            };
            system.vga_bios = {
                url: "./bios/vgabios.bin",
            };
            // Setup Network Relay
            system.network_relay_url = system.network_relay_url || "wss://relay.widgetry.org/";
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
            const state = await machine.save_state();
            const stateObject = new Blob([state]);
            // Get current datetime string
            const timezone = dayjs().format("ZZ");
            const reformatTimezone = timezone.startsWith("+")
                ? timezone.replace("+", "P")
                : timezone.replace("-", "N");
            const datetime = dayjs().format(
                `YYYY-MM-DDTHH-mm-ss[${reformatTimezone}Z]`
            );
            // Create virtual download link
            const a = document.createElement("a");
            a.download = `lobState_${datetime}.bin`;
            a.href = window.URL.createObjectURL(stateObject);
            a.dataset.downloadurl = `application/octet-stream:${a.download}:${a.href}`;
            // Trigger virtual download link
            a.click();
        },
        machineStateRestore(machine, file) {
            machine.stop();

            const filereader = new FileReader();

            filereader.onload = function (e) {
                machine.restore_state(e.target.result);
                machine.run();
            };

            filereader.readAsArrayBuffer(file);
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
        documentHandleChangeRestoreFile(e) {
            this.restoreFile = e.target.files[0];
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
        documentHandleClickButtonOptionsRestore() {
            this.isShowRestoreModal = true;
            this.isShowOptionsMenu = false;
        },
        documentHandleClickButtonOptionsSave() {
            this.machineStateSave(this.emulator);
            this.isShowOptionsMenu = false;
        },
        documentHandleClickButtonRestoreCancel() {
            this.restoreFile = null;
            this.isShowRestoreModal = false;
        },
        documentHandleClickButtonRestoreImport() {
            this.machineStateRestore(this.emulator, this.restoreFile);
            this.isShowRestoreModal = false;
        }
    },
    mounted() {
        const params = new URLSearchParams(window.location.search);
        const profileName = params.get("profile");
        const baseProfile = this.systemProfile[profileName] || this.systemProfile.default;
        if (params.get("network_relay_url")) {
            baseProfile.network_relay_url = params.get("network_relay_url");
        }
        const machine = this.machineSetup(baseProfile);
        this.machineSetupEventListener(machine);
    },
});
