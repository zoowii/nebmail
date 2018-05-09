"use strict";

var MailItem = function(text) {
	if (text) {
		var obj = JSON.parse(text);
        this.from = obj.from; // from domain host
        this.fromAddress = obj.fromAddress;
        this.to = obj.to; // to domain host
        this.toAddress = obj.toAddress;
        this.time = obj.time;
        this.content = obj.content;
	} else {
	    this.from = '';
        this.fromAddress = '';
        this.to = '';
        this.toAddress = '';
        this.time = '';
        this.content = '';
	}
};

MailItem.prototype = {
    toString: function() {
        return JSON.stringify(this);
    }
};

var DomainItem = function(text) {
    // TODO: owner pubkey
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

var MailService = function () {
    // host => domain
    LocalContractStorage.defineMapProperty(this, "domainRepo", {
        parse: function (text) {
            return new DomainItem(text);
        },
        stringify: function (o) {
            return o.toString();
        }
    });
    // ownerAddress => domainHostsArray
    LocalContractStorage.defineMapProperty(this, "ownedDomainHostRepo", {
        parse: function (text) {
            return JSON.parse(text);
        },
        stringify: function (o) {
            return JSON.stringify(o);
        }
    });
    // receiveDomainHost => mailsArray
    LocalContractStorage.defineMapProperty(this, "mailRepo", {
        parse: function (text) {
            var items = JSON.parse(text);
            var result = [];
            for(var i=0;i<items.length;i++) {
                result.push(new MailItem(JSON.stringify(items[i])));
            }
            return result;
        },
        stringify: function (o) {
            return JSON.stringify(o);
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

MailService.prototype = {
    init: function () {
        // todo
    },

    // 发送前在前端用对方的公钥（通过ns查询）进行加密
    sendMail: function(fromDomain, toDomain, content) {
        var toDomainItem = this.domainRepo.get(toDomain);
        if(!toDomainItem) {
            throw new Error("Can't find domain " + toDomain);
        }
        var fromDomainItem = this.domainRepo.get(fromDomain);
        if(!fromDomainItem) {
            throw new Error("Can't find domain " + fromDomain);
        }
        var fromAddress = Blockchain.transaction.from;
        if(fromDomainItem.owner !==fromAddress) {
            throw new Error("you aren't owner of domain " + fromDomain);
        }
        if(toDomainItem.owner===fromAddress) {
            throw new Error("Can't send mail to yourself");
        }
        var mailItem = new MailItem();
        mailItem.from = fromDomain;
        mailItem.to = toDomain;
        mailItem.fromAddress = fromAddress;
        mailItem.toAddress = toDomain.owner;
        mailItem.time = Blockchain.transaction.timestamp;
        mailItem.content = content;

        var mails = this.mailRepo.get(toDomain) || [];
        mails.push(mailItem);
        this.mailRepo.put(toDomain, mails);
    },

    getHostReceivedMails: function(host) {
        // 获取某个域名收到的邮件列表
        var domainItem = this.domainRepo.get(host);
        if(!domainItem) {
            throw new Error("Can't find domain " + host);
        }
        var mails = this.mailRepo.get(domainItem.host) || [];
        return mails;
    },

    getHostSentMails: function(host) {
        // 获取某个域名发送的邮件列表
        // TODO
    },

    transferDomain: function(host, to) {
        if(!to || !Blockchain.verifyAddress(to)) {
            throw new Error("Invalid target address");
        }
        host = host.trim().toLowerCase();
        var from = Blockchain.transaction.from;
        var domainItem = this.domainRepo.get(host);
        if (!domainItem){
            throw new Error("domain host has not been registered");
        }
        if(domainItem.owner !== from) {
            throw new Error("you are not owner of this domain");
        }

        // update old owner's hosts
        var oldOwnerHosts = this.ownedDomainHostRepo.get(from) || [];
        var indexToRemove = oldOwnerHosts.indexOf(host);
        if(indexToRemove>=0) {
            oldOwnerHosts.splice(indexToRemove, 1);
        }
        this.ownedDomainHostRepo.put(from, oldOwnerHosts);

        domainItem.owner = to;
        
        this.domainRepo.put(host, domainItem);

        var ownedHosts = this.ownedDomainHostRepo.get(to) || [];
        ownedHosts.push(host);
        this.ownedDomainHostRepo.put(to, ownedHosts);
    },

    updateDomainContent: function(host, content) {
        host = host.trim().toLowerCase();
        content = content.trim();
        var from = Blockchain.transaction.from;
        var domainItem = this.domainRepo.get(host);
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

        this.domainRepo.put(host, domainItem);
    },

    // 注册域名后需要把{pubKey: 公钥, address: 地址}写入domain content才可以接收邮件
    registerDomain: function(host, content) {
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
        var domainItem = this.domainRepo.get(host);
        if (domainItem){
            throw new Error("domain host has been registered");
        }

        domainItem = new DomainItem();
        domainItem.owner = from;
        domainItem.host = host;
        domainItem.content = content;

        this.domainRepo.put(host, domainItem);
        var ownedHosts = this.ownedDomainHostRepo.get(from) || [];
        ownedHosts.push(domainItem.host);
        this.ownedDomainHostRepo.put(from, ownedHosts);
    },

    getDomain: function (host) {
        host = host.trim().toLowerCase();
        if ( host === "" ) {
            throw new Error("empty host")
        }
        return this.domainRepo.get(host);
    },
    getDomains: function(hosts) {
        var result = [];
        for(var i=0;i<hosts.length;i++) {
            var host = hosts[i].trim().toLowerCase();
            if ( host === "" ) {
                throw new Error("empty host")
            }
            result.push(this.domainRepo.get(host));
        }
        return result;
    },
    getDomainsUserOwned: function(owner) {
        var ownedHosts = this.ownedDomainHostRepo.get(owner) || [];
        var domains = [];
        for(var i=0;i<ownedHosts.length;i++) {
            var domain = this.domainRepo.get(ownedHosts[i]);
            if(domain) {
                domains.push(domain);
            }
        }
        return domains;
    }
};
module.exports = MailService;
