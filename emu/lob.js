// (c) 2020 SuperSonic (https://github.com/supersonictw)

// Auto Redirect
switch (function () {
    var reg = new RegExp("(^|&)profile=([^&]*)(&|$)");
    var r = window.location.search.substr(1).match(reg);
    if (r != null) return unescape(r[2]);
    return null;
}()) {
    case null:
        window.location.href = "?profile=linux";
        break;
}