/*
# 京东比价脚本 - 独立版
# 不依赖慢慢买APP，使用京东官方API
# 支持 Quantumult X / Loon / Surge
# 作者：基于公开API编写
*/

const $ = new Env("京东比价独立版");
const consolelog = true;

// 京东价格API配置
const JD_PRICE_API = {
    base: "https://cd.jd.com/promotion/v2",
    params: "&area=1_72_2799_0&cat=1,2,3&venderId=0&shopId=0&qx=1"
};

// 商品信息API
const JD_PRODUCT_API = "https://item.jd.com/";

// 主函数
(async () => {
    try {
        const url = $request.url;
        
        // 匹配商品ID
        const skuMatch = url.match(/graphext\/(\d+)\.html/);
        if (!skuMatch) {
            $.log("未找到商品ID");
            $done({});
            return;
        }
        
        const skuId = skuMatch[1];
        $.log(`检测到商品ID: ${skuId}`);
        
        // 获取价格信息
        const priceInfo = await getPriceInfo(skuId);
        if (priceInfo) {
            await showPriceNotification(skuId, priceInfo);
        }
        
    } catch (error) {
        $.log(`脚本执行错误: ${error}`);
    }
    
    $done({});
})();

// 获取价格信息
async function getPriceInfo(skuId) {
    try {
        const apiUrl = `${JD_PRICE_API.base}?skuId=${skuId}${JD_PRICE_API.params}`;
        
        const response = await $.http.get({
            url: apiUrl,
            headers: {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
                "Referer": `https://item.jd.com/${skuId}.html`
            }
        });
        
        if (response.status === 200 && response.body) {
            return parsePriceData(response.body);
        }
    } catch (error) {
        $.log(`获取价格信息失败: ${error}`);
        // 尝试备用方案
        return await getBackupPriceInfo(skuId);
    }
    return null;
}

// 解析价格数据
function parsePriceData(data) {
    try {
        const jsonData = JSON.parse(data);
        const priceInfo = {
            currentPrice: jsonData.p || jsonData.pc || "未知",
            originalPrice: jsonData.op || jsonData.oc || "未知",
            discount: jsonData.d || "无",
            plusPrice: jsonData.pp || "未知",
            stock: jsonData.stock || "未知",
            venderId: jsonData.venderId || "未知"
        };
        
        // 计算折扣信息
        if (priceInfo.currentPrice !== "未知" && priceInfo.originalPrice !== "未知") {
            const current = parseFloat(priceInfo.currentPrice);
            const original = parseFloat(priceInfo.originalPrice);
            if (original > current) {
                const discountRate = ((original - current) / original * 100).toFixed(1);
                priceInfo.discountRate = `${discountRate}%`;
                priceInfo.saveAmount = (original - current).toFixed(2);
            }
        }
        
        return priceInfo;
    } catch (error) {
        $.log(`解析价格数据失败: ${error}`);
        return null;
    }
}

// 备用价格获取方案
async function getBackupPriceInfo(skuId) {
    try {
        // 方法1：通过商品页面API
        const productUrl = `https://item.jd.com/${skuId}.html`;
        const response = await $.http.get({
            url: productUrl,
            headers: {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1"
            }
        });
        
        if (response.status === 200) {
            // 从页面HTML中提取价格信息
            const priceMatch = response.body.match(/"price":"([\d.]+)"/);
            const origPriceMatch = response.body.match(/"origPrice":"([\d.]+)"/);
            
            if (priceMatch) {
                return {
                    currentPrice: priceMatch[1],
                    originalPrice: origPriceMatch ? origPriceMatch[1] : priceMatch[1],
                    discount: "从页面提取",
                    plusPrice: "未知",
                    stock: "未知"
                };
            }
        }
    } catch (error) {
        $.log(`备用方案失败: ${error}`);
    }
    return null;
}

// 获取商品名称
async function getProductName(skuId) {
    try {
        const response = await $.http.get({
            url: `https://item.jd.com/${skuId}.html`,
            headers: {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1"
            }
        });
        
        if (response.status === 200) {
            const nameMatch = response.body.match(/<title>([^<]+)<\/title>/);
            if (nameMatch) {
                return nameMatch[1].replace(/【.*】/g, "").trim();
            }
        }
    } catch (error) {
        $.log(`获取商品名称失败: ${error}`);
    }
    return `商品${skuId}`;
}

// 显示价格通知
async function showPriceNotification(skuId, priceInfo) {
    const productName = await getProductName(skuId);
    
    let subtitle = `当前: ¥${priceInfo.currentPrice}`;
    let message = "";
    
    if (priceInfo.originalPrice !== "未知" && priceInfo.originalPrice !== priceInfo.currentPrice) {
        subtitle += ` | 原价: ¥${priceInfo.originalPrice}`;
        
        if (priceInfo.discountRate) {
            message += `优惠: ${priceInfo.discountRate}，节省¥${priceInfo.saveAmount}\n`;
        }
    }
    
    if (priceInfo.plusPrice !== "未知" && priceInfo.plusPrice !== priceInfo.currentPrice) {
        message += `Plus价: ¥${priceInfo.plusPrice}\n`;
    }
    
    message += `库存: ${priceInfo.stock}\n`;
    message += `优惠信息: ${priceInfo.discount || "无"}`;
    
    $.msg(productName, subtitle, message);
}

// 环境适配代码
function Env(t, e) {
    class s {
        constructor(t) { this.env = t }
        send(t, e = "GET") {
            t = "string" == typeof t ? { url: t } : t;
            let s = this.get;
            return "POST" === e && (s = this.post),
            new Promise((e, i) => {
                s.call(this, t, (t, s, r) => { t ? i(t) : e(s) })
            })
        }
        get(t) { return this.send.call(this.env, t) }
        post(t) { return this.send.call(this.env, t, "POST") }
    }
    return new class {
        constructor(t, e) {
            this.name = t,
            this.http = new s(this),
            this.data = null,
            this.dataFile = "box.dat",
            this.logs = [],
            this.isMute = !1,
            this.isNeedRewrite = !1,
            this.logSeparator = "\n",
            this.startTime = (new Date).getTime(),
            Object.assign(this, e),
            this.log("", `🔔${this.name}, 开始!`)
        }
        getEnv() { return "undefined" != typeof $environment && $environment["surge-version"] ? "Surge" : "undefined" != typeof $environment && $environment["stash-version"] ? "Stash" : "undefined" != typeof module && module.exports ? "Node.js" : "undefined" != typeof $task ? "Quantumult X" : "undefined" != typeof $loon ? "Loon" : "undefined" != typeof $rocket ? "Shadowrocket" : void 0 }
        isNode() { return "Node.js" === this.getEnv() }
        isQuanX() { return "Quantumult X" === this.getEnv() }
        isSurge() { return "Surge" === this.getEnv() }
        isLoon() { return "Loon" === this.getEnv() }
        isShadowrocket() { return "Shadowrocket" === this.getEnv() }
        isStash() { return "Stash" === this.getEnv() }
        toObj(t, e = null) { try { return JSON.parse(t) } catch { return e } }
        toStr(t, e = null) { try { return JSON.stringify(t) } catch { return e } }
        getjson(t, e) {
            let s = e;
            const i = this.getdata(t);
            if (i) try { s = JSON.parse(i) } catch {}
            return s
        }
        setjson(t, e) { try { return this.setdata(JSON.stringify(t), e) } catch { return !1 } }
        getScript(t) { return new Promise(e => { this.get({ url: t }, (t, s, i) => e(i)) }) }
        runScript(t, e) {
            return new Promise(s => {
                let i = this.getdata("@chavy_boxjs_userCfgs.httpapi");
                i = i ? i.replace(/\n/g, "").trim() : i;
                let o = this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");
                o = o ? 1 * o : 20, o = e && e.timeout ? e.timeout : o;
                const [r, h] = i.split("@"), n = { url: `http://${h}/v1/scripting/evaluate`, body: { script_text: t, mock_type: "cron", timeout: o }, headers: { "X-Key": r, Accept: "*/*" } };
                this.post(n, (t, e, i) => s(i))
            }).catch(t => this.logErr(t))
        }
        loaddata() {
            if (!this.isNode()) return {};
            {
                this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path");
                const t = this.path.resolve(this.dataFile),
                    e = this.path.resolve(process.cwd(), this.dataFile),
                    s = this.fs.existsSync(t),
                    i = !s && this.fs.existsSync(e);
                if (!s && !i) return {};
                { const s = i ? e : t; try { return JSON.parse(this.fs.readFileSync(s)) } catch (t) { return {} } }
            }
        }
        writedata() {
            if (this.isNode()) {
                this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path");
                const t = this.path.resolve(this.dataFile),
                    e = this.path.resolve(process.cwd(), this.dataFile),
                    s = this.fs.existsSync(t),
                    i = !s && this.fs.existsSync(e),
                    o = JSON.stringify(this.data);
                s ? this.fs.writeFileSync(t, o) : i ? this.fs.writeFileSync(e, o) : this.fs.writeFileSync(t, o)
            }
        }
        lodash_get(t, e, s) {
            const i = e.replace(/\[(\d+)\]/g, ".$1").split(".");
            let o = t;
            for (const t of i) if (o = Object(o)[t], void 0 === o) return s;
            return o
        }
        lodash_set(t, e, s) {
            return Object(t) !== t ? t : (Array.isArray(e) || (e = e.toString().match(/[^.[\]]+/g) || []), e.slice(0, -1).reduce((t, s, i) => Object(t[s]) === t[s] ? t[s] : t[s] = Math.abs(e[i + 1]) >> 0 == +e[i + 1] ? [] : {}, t)[e[e.length - 1]] = s, t)
        }
        getdata(t) {
            let e = this.getval(t);
            if (/^@/.test(t)) {
                const [, s, i] = /^@(.*?)\.(.*?)$/.exec(t), o = s ? this.getval(s) : "";
                if (o) try { const t = JSON.parse(o); e = t ? this.lodash_get(t, i, "") : e } catch (t) { e = "" }
            }
            return e
        }
        setdata(t, e) {
            let s = !1;
            if (/^@/.test(e)) {
                const [, i, o] = /^@(.*?)\.(.*?)$/.exec(e), r = this.getval(i), h = i ? "null" === r ? null : r || "{}" : "{}";
                try { const e = JSON.parse(h); this.lodash_set(e, o, t), s = this.setval(JSON.stringify(e), i) } catch (e) { const r = {}; this.lodash_set(r, o, t), s = this.setval(JSON.stringify(r), i) }
            } else s = this.setval(t, e);
            return s
        }
        getval(t) {
            switch (this.getEnv()) {
                case "Surge":
                case "Loon":
                case "Stash":
                case "Shadowrocket":
                    return $persistentStore.read(t);
                case "Quantumult X":
                    return $prefs.valueForKey(t);
                case "Node.js":
                    return this.data = this.loaddata(), this.data[t];
                default:
                    return this.data && this.data[t] || null
            }
        }
        setval(t, e) {
            switch (this.getEnv()) {
                case "Surge":
                case "Loon":
                case "Stash":
                case "Shadowrocket":
                    return $persistentStore.write(t, e);
                case "Quantumult X":
                    return $prefs.setValueForKey(t, e);
                case "Node.js":
                    return this.data = this.loaddata(), this.data[e] = t, this.writedata(), !0;
                default:
                    return this.data && this.data[e] || null
            }
        }
        initGotEnv(t) {
            this.got = this.got ? this.got : require("got"), this.cktough = this.cktough ? this.cktough : require("tough-cookie"), this.ckjar = this.ckjar ? this.ckjar : new this.cktough.CookieJar, t && (t.headers = t.headers ? t.headers : {}, void 0 === t.headers.Cookie && void 0 === t.cookieJar && (t.cookieJar = this.ckjar))
        }
        get(t, e = (() => { })) {
            if (t.headers && (delete t.headers["Content-Type"], delete t.headers["Content-Length"]), this.isSurge() || this.isLoon() || this.isStash() || this.isShadowrocket()) this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })), $httpClient.get(t, (t, s, i) => {!t && s && (s.body = i, s.statusCode = s.status), e(t, s, i) });
            else if (this.isQuanX()) t.method = "GET", this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then(t => { const { statusCode: s, statusCode: i, headers: r, body: h } = t; e(null, { status: s, statusCode: i, headers: r, body: h }, h) }, t => e(t));
            else if (this.isNode()) {
                let s = require("iconv-lite");
                this.initGotEnv(t), this.got(t).on("redirect", (t, e) => { try { if (t.headers["set-cookie"]) { const s = t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString(); s && this.ckjar.setCookieSync(s, null), e.cookieJar = this.ckjar } } catch (t) { this.logErr(t) } }).then(t => { const { statusCode: i, statusCode: r, headers: h, body: n } = t; e(null, { status: i, statusCode: r, headers: h, body: n }, n) }, t => { const { message: i, response: r } = t; e(i, r, r && s.decode(r.rawBody, this.encoding)) })
            }
        }
        post(t, e = (() => { })) {
            const s = t.method ? t.method.toLocaleLowerCase() : "post";
            if (t.body && t.headers && !t.headers["Content-Type"] && (t.headers["Content-Type"] = "application/x-www-form-urlencoded"), t.headers && delete t.headers["Content-Length"], this.isSurge() || this.isLoon() || this.isStash() || this.isShadowrocket()) this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })), $httpClient[s](t, (t, s, i) => {!t && s && (s.body = i, s.statusCode = s.status), e(t, s, i) });
            else if (this.isQuanX()) t.method = "POST", this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then(t => { const { statusCode: s, statusCode: i, headers: r, body: h } = t; e(null, { status: s, statusCode: i, headers: r, body: h }, h) }, t => e(t));
            else if (this.isNode()) {
                let i = require("iconv-lite");
                this.initGotEnv(t);
                const { url: r, ...h } = t;
                this.got[s](r, h).then(t => { const { statusCode: s, statusCode: r, headers: h, body: n } = t; e(null, { status: s, statusCode: r, headers: h, body: n }, n) }, t => { const { message: s, response: r } = t; e(s, r, r && i.decode(r.rawBody, this.encoding)) })
            }
        }
        time(t, e = null) { const s = e ? new Date(e) : new Date; let i = { "M+": s.getMonth() + 1, "d+": s.getDate(), "H+": s.getHours(), "m+": s.getMinutes(), "s+": s.getSeconds(), "q+": Math.floor((s.getMonth() + 3) / 3), S: s.getMilliseconds() }; /(y+)/.test(t) && (t = t.replace(RegExp.$1, (s.getFullYear() + "").substr(4 - RegExp.$1.length))); for (let e in i) new RegExp("(" + e + ")").test(t) && (t = t.replace(RegExp.$1, 1 == RegExp.$1.length ? i[e] : ("00" + i[e]).substr(("" + i[e]).length))); return t }
        msg(e = t, s = "", i = "", o = {}) {
            const r = t => { if (!t) return t; if ("string" == typeof t) return this.isLoon() ? t : this.isQuanX() ? { "open-url": t } : this.isSurge() ? { url: t } : void 0; if ("object" == typeof t) { if (this.isLoon()) { let e = t.openUrl || t.url || t["open-url"], s = t.mediaUrl || t["media-url"]; return { openUrl: e, mediaUrl: s } } if (this.isQuanX()) { let e = t["open-url"] || t.url || t.openUrl, s = t["media-url"] || t.mediaUrl, i = t["update-pasteboard"] || t.updatePasteboard; return { "open-url": e, "media-url": s, "update-pasteboard": i } } if (this.isSurge()) { let e = t.url || t.openUrl || t["open-url"]; return { url: e } } } };
            if (!this.isMute) {
                this.isSurge() || this.isLoon() || this.isStash() || this.isShadowrocket() ? $notification.post(e, s, i, r(o)) : this.isQuanX() && $notify(e, s, i, r(o));
                const h = ["", "==============📣系统通知📣=============="];
                h.push(e), s && h.push(s), i && h.push(i), h.push(""), console.log(h.join("\n")), this.logs = this.logs.concat(h)
            }
        }
        log(...t) { t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(t.join(this.logSeparator)) }
        logErr(t, e) {
            const s = !this.isSurge() && !this.isQuanX() && !this.isLoon();
            s ? this.log("", `❗️${this.name}, 错误!`, t.stack) : this.log("", `❗️${this.name}, 错误!`, e, t)
        }
        wait(t) { return new Promise(e => setTimeout(e, t)) }
        done(t = {}) { const e = (new Date).getTime() - this.startTime; this.log("", `🔔${this.name}, 结束! 🕛 ${e} 秒`), this.log(), (this.isSurge() || this.isLoon() || this.isStash() || this.isShadowrocket()) && $done(t) }
    }(t, e)
}