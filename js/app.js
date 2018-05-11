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


// nebPay的交易结果查询的最大尝试次数
var maxQueryCount = 6;

// TODO: use CancelablePromise
function waitTxResponse(serialNumber) {
    var handler = null;
    var promiseResolver = null;
    var promiseRejector = null;
    var promise = new Promise(function(resolve, reject) {
        promiseResolver = resolve;
        promiseRejector = reject;
        var tryCount = 0;
        handler = setInterval(function () {
                if(promise.canceledReason) {
                    clearInterval(handler);
                    handler = null;
                    reject(promise.canceledReason);
                    return;
                }
                tryCount += 1;
                if(tryCount > maxQueryCount) {
                    clearInterval(handler);
                    handler = null;
                    reject(data);
                }
                funcIntervalQuery2(serialNumber, function(data) {
                    clearInterval(handler);
                    handler = null;
                    resolve(data);
                }, function(arg) {
                    var data = arg.data;
                    var queryReturn = arg.queryReturn;
                    if(queryReturn) {
                        clearInterval(handler);
                        handler = null;
                        reject(data);
                    } else {
                        // 还可以继续尝试，不结束
                    }
                });
            }, 5000);
    });
    promise.reject = function(err) {
        if(handler && promiseRejector) {
            clearInterval(handler);
            handler = null;
            promiseRejector(err);
        }
    };
    promise.resolve = function(data) {
        if(handler && promiseResolver) {
            clearInterval(handler);
            handler = null;
            promiseResolver(data);
        }
    };
    return promise;
}

function funcIntervalQuery2(serialNumberArg, resolve, reject) {
    nebPay.queryPayInfo(serialNumberArg || serialNumber)   //search transaction result from server (result upload to server by app)
        .then(function (resp) {
            var respObject = JSON.parse(resp);
            console.log("tx result: " + resp);   //resp is a JSON string
            if (respObject.code === 0) {
                resolve({data: respObject, queryReturn: true});
                return;
            }
            reject({data: respObject, queryReturn: true});
        })
        .catch(function (err) {
            reject({data: err, queryReturn: false});
        });
}

window.waitTxResponse = waitTxResponse;

function callOnChainTx(simulateFromAddress, toAddress, value, simulateAddressNonce, gasPrice, gasLimit, callFunction, callArgs, sendTxHandler, txConfirmHandler, errorHandler) {
    var contract = callFunction ? {
        "function": callFunction,
        "args": callArgs
    } : null;
    errorHandler = errorHandler || showErrorInfo;

    neb.api.call(simulateFromAddress, toAddress, value, simulateAddressNonce, gasPrice, gasLimit, contract).then(function (resp) {
        console.log(resp);
        if (resp.execute_err.length > 0) {
            throw new Error(resp.execute_err);
        }

        var serialNumber = nebPay.call(toAddress, value, callFunction, callArgs, {
            listener: function(data) {
                if(data.txhash) {
                    (sendTxHandler || showSuccessInfo)(data); // 不结束promise，为了等待链上确认结果
                } else {
                    promise.reject(data);
                }
            }
        });
        var promise = waitTxResponse(serialNumber);
        promise.then(function(data) {
                if(txConfirmHandler) {
                    txConfirmHandler(data);
                }
            }, function(err) {
                errorHandler(err);
            });
    }).catch(function (err) {
        errorHandler(err.message || err);
    });
}

window.callOnChainTx = callOnChainTx;