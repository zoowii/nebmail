var originSubtle = null;
var browserCrypto = window.crypto || window.msCrypto; //for IE11
if(browserCrypto) {
    originSubtle = browserCrypto.subtle || browserCrypto.webkitSubtle
}

var crypto = require("crypto");
var eccrypto = require("eccrypto");

window.crypto = crypto;
if(!crypto.subtle) {
    crypto.subtle = originSubtle;
}
window.eccrypto = eccrypto;

function convertHexToBinary(hex) {
    return Buffer(new Uint8Array(hex.match(/[\da-f]{2}/gi).map(function (h) {
        return parseInt(h, 16)
      })));
}
window.convertHexToBinary = convertHexToBinary;

window.Buffer = Buffer;
