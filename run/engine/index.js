// LOB Engine
// (c) 2022 SuperSonic (https://github.com/supersonictw)

var app = new Vue({
    el: '#console',
    data: () => ({
        emulator: null,
    }),
    methods: {
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
        const screenContainer = document.getElementById("screen-container");
        this.emulator = new V86Starter({
            memory_size: 128 * 1024 * 1024,
            vga_memory_size: 2 * 1024 * 1024,
            screen_container: screenContainer,
            bios: {
                url: "./bios/seabios.bin",
            },
            vga_bios: {
                url: "./bios/vgabios.bin",
            },
            cdrom: {
                url: "./images/system.iso",
                size: 37748736,
            },
            autostart: true,
        });
    }
});
