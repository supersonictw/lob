// (c) 2020 SuperSonic (https://github.com/supersonictw)

// Auto Redirect
(function () {
    const search = location.search;
    const params = new URLSearchParams(search);
    switch (params.get("profile")) {
        case "default":
        case "linux":
            break;
        case null:
            window.location.href = "?profile=default";
            break;
        default:
            alert("Unknown Operating System");
    }
})();

// State
const lobState = (function () {
    const store = function () {
        this.memory = {};
    };
    store.prototype.get = (name) => {
        return this.memory[name];
    };
    store.prototype.set = (name, value) => {
        this.memory[name] = value;
    };
})();
