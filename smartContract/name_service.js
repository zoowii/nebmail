"use strict";

var DomainItem = function(text) {
	if (text) {
		var obj = JSON.parse(text);
		this.content = obj.content; // 一级域名指向的内容
		this.host = obj.host; // 一级域名
		this.owner = obj.owner;
	} else {
	    this.content = "";
	    this.host = "";
	    this.owner = "";
	}
};

DomainItem.prototype = {
	toString: function () {
		return JSON.stringify(this);
	}
};

var NameService = function () {
    LocalContractStorage.defineMapProperty(this, "repo", {
        parse: function (text) {
            return new DomainItem(text);
        },
        stringify: function (o) {
            return o.toString();
        }
    });
};

function isLetter(str) {
    return str.length === 1 && str.match(/[a-z]/i);
}

function isDigit(str) {
    return str.length === 1 && str.match(/\d/i);
}

function isValidHostFormat(host) {
    if (host === '') {
        return false;
    }
    if(host.length > 20) {
        return false;
    }
    if(!isLetter(host[0])) {
        return false;
    }
    for(var i=1;i<host.length;i++) {
        if(!isLetter(host[i]) && !isDigit(host[i])) {
            return false;
        }
    }
    return true;
}

NameService.prototype = {
    init: function () {
        // todo
    },

    transfer: function(host, to) {
        if(!to || !Blockchain.verifyAddress(to)) {
            throw new Error("Invalid target address");
        }
        host = host.trim().toLowerCase();
        var from = Blockchain.transaction.from;
        var domainItem = this.repo.get(host);
        if (!domainItem){
            throw new Error("domain host has not been registered");
        }
        if(domainItem.owner !== from) {
            throw new Error("you are not owner of this domain");
        }
        domainItem.owner = to;
        
        this.repo.put(host, domainItem);
    },

    updateContent: function(host, content) {
        host = host.trim().toLowerCase();
        content = content.trim();
        var from = Blockchain.transaction.from;
        var domainItem = this.repo.get(host);
        if (!domainItem){
            throw new Error("domain host has not been registered");
        }
        if(domainItem.owner !== from) {
            throw new Error("you are not owner of this domain");
        }
        if(content.length > 1024) {
            throw new Error("domain content exceed limit length");
        }
        domainItem.content = content;

        this.repo.put(host, domainItem);
    },

    register: function(host, content) {
        host = host.trim().toLowerCase();
        content = content.trim();
        if (host === '') {
            throw new Error("empty host");
        }
        if(content.length > 1024) {
            throw new Error("domain content exceed limit length");
        }
        if(!isValidHostFormat(host)) {
            throw new Error("Invalid domain host");
        }
        
        var from = Blockchain.transaction.from;
        var domainItem = this.repo.get(host);
        if (domainItem){
            throw new Error("domain host has been registered");
        }

        domainItem = new DomainItem();
        domainItem.owner = from;
        domainItem.host = host;
        domainItem.content = content;

        this.repo.put(host, domainItem);
    },

    get: function (host) {
        host = host.trim().toLowerCase();
        if ( host === "" ) {
            throw new Error("empty host")
        }
        return this.repo.get(host);
    }
};
module.exports = NameService;