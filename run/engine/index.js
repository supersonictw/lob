// LOB Engine
// (c) 2022 SuperSonic (https://github.com/supersonictw)

var app = new Vue({
    el: '#console',
    data: () => ({
        emulator: null,
        systemProfile: {
            default: {
                memory_size: 64 * 1024 * 1024,
                vga_memory_size: 8 * 1024 * 1024,
                cdrom: {
                    url: "./images/system.iso",
                    size: 37748736,
                },
                autostart: true,
            },
            vanilla: {
                memory_size: 8 * 1024 * 1024,
                vga_memory_size: 2 * 1024 * 1024,
                cdrom: {
                    url: "./images/vanilla.iso",
                    size: 37748736,
                },
                autostart: true,
            }
        }
    }),
    methods: {
        boot(baseProfile) {
            const system = { ...baseProfile };
            // BIOS Setup
            system.bios = {
                url: "./bios/seabios.bin",
            };
            system.vga_bios = {
                url: "./bios/vgabios.bin",
            };
            // Screen Container
            system.screen_container = document.getElementById("screen-container");
            // Mount Machine
            this.emulator = new V86Starter(system);
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
        }
    },
    mounted() {
        const params = new URLSearchParams(window.location.search);
        const profileName = params.get("profile");
        const baseProfile = this.systemProfile[profileName] || this.systemProfile.default;
        this.boot(baseProfile);
    }
});
