// ==UserScript==
// @name           XxxZooTitleFix
// @version        1.0.1.20221122
// @namespace      https://github.com/han844017104/TamperMonkeyPlugins
// @description    优化xxxzoo视频列表的显示,使视频标题可以直接展示在预览图片上,省去放置鼠标查看名称的繁琐
// @author         MrHan
// @icon           
// @match          https://xxxsexzoo.com/*
// @run-at         document-end
// @grant          GM_addStyle
// @grant          GM_addValueChangeListener
// @grant          GM_deleteValue
// @grant          GM_download
// @grant          GM_getResourceText
// @grant          GM_getResourceURL
// @grant          GM_getTab
// @grant          GM_getTabs
// @grant          GM_getValue
// @grant          GM_listValues
// @grant          GM_log
// @grant          GM_notification
// @grant          GM_openInTab
// @grant          GM_registerMenuCommand
// @grant          GM_removeValueChangeListener
// @grant          GM_saveTab
// @grant          GM_setClipboard
// @grant          GM_setValue
// @grant          GM_unregisterMenuCommand
// @grant          GM_xmlhttpRequest
// @grant          unsafeWindow
// ==/UserScript==

(function () {
    "use strict";

    //------------------------------------------------  pre js load ↓↓↓↓  --------------------------------------------------//

    /**
     * 动态加载js
     * @param {string} url js路径或地址
     * @param {function} callback js加载完成后的回调函数
     */
    const loadJs = (url, callback) => {
        var script = document.createElement("script"),
            fn = callback || function () {};
        script.type = "text/javascript";
        //IE
        if (script.readyState) {
            script.onreadystatechange = function () {
                if (
                    script.readyState == "loaded" ||
                    script.readyState == "complete"
                ) {
                    script.onreadystatechange = null;
                    fn();
                }
            };
        } else {
            //其他浏览器
            script.onload = function () {
                fn();
            };
        }
        script.src = url;
        document.getElementsByTagName("head")[0].appendChild(script);
    };

    var BASE_SCRIPT_JS_LIST = [];
    // list = [[url, callback],...]
    // BASE_SCRIPT_JS_LIST.push(

    // );
    BASE_SCRIPT_JS_LIST.forEach((js) => loadJs(js[0], js[1]));

    //------------------------------------------------  class info ↓↓↓↓  --------------------------------------------------//

    class Objects {
        static isExist = (value) => {
            return value != null && value != undefined;
        };
    }

    /**
     * Cookie工具类
     */
    class CookieUtil {

        getCookies = () => {
            var cookies = {};
            document.cookie.split('; ').forEach(str => {
                let idx = str.indexOf('=');
                if (idx <= 0) {
                    return;
                }
                cookies[str.substring(0, idx)] = str.substring(idx + 1);
            })
            return cookies;
        }

        /**
         * 获取cookie
         * @param {string} key
         */
        getCookie = (key) => {
            return !Objects.isExist(key) ? null : this.getCookies()[key];
        };

        /**
         * 写入cookie
         * @param {string} key
         * @param {string} value
         */
        writeCookie = (key, value) => {
            var cookies = this.getCookies();
            cookies[key] = value;
            this.overrideAllCookie(cookies);
        };

        /**
         * 移除Cookie
         * @param {string} key
         */
        removeCookie = (key) => {
            this.writeCookie(key, null);
        };

        overrideAllCookie(allCookies) {
            let str = "";
            for (const key in allCookies) {
                let value = allCookies[key];
                if (value) {
                    str += key + "=" + value + "; "
                }
            }
            document.cookie = str;
        }
    }

    /**
     * 时间工具类
     */
    class DateFormatUtil {
        /**
         * @param {string} formater
         */
        constructor(formater) {
            this.defFormater = formater;
            this.inject();
        }

        /**
         * 注入Date转换属性
         */
        inject = () => {
            Date.prototype.FormatSimple = function (fmt) {
                var o = {
                    "M+": this.getMonth() + 1,
                    "d+": this.getDate(),
                    "h+": this.getHours(),
                    "m+": this.getMinutes(),
                    "s+": this.getSeconds(),
                    "q+": Math.floor((this.getMonth() + 3) / 3),
                    S: this.getMilliseconds(),
                };
                if (/(y+)/.test(fmt)) {
                    fmt = fmt.replace(
                        RegExp.$1,
                        (this.getFullYear() + "").substr(4 - RegExp.$1.length)
                    );
                }

                for (var k in o) {
                    if (new RegExp("(" + k + ")").test(fmt))
                        fmt = fmt.replace(
                            RegExp.$1,
                            RegExp.$1.length == 1 ?
                            o[k] :
                            ("00" + o[k]).substr(("" + o[k]).length)
                        );
                }

                return fmt;
            };
        };

        /**
         * 获取当前时间，默认格式"yyyy-MM-dd hh:mm:ss"
         * @param {string} fmt format 格式
         */
        currentTime = (fmt) => {
            if (fmt == undefined || fmt == null || fmt == "") {
                fmt = this.defFormater;
            }
            return new Date().FormatSimple(fmt);
        };
    }

    const HR_HOOK_BREAK_FLAG = "HR_HOOK_BREAK";

    const HR_HOOK_INTERCEPT_FLAG = "HR_HOOK_INTERCEPT";

    /**
     * 请求钩子类
     * 已实装: XmlHttpRequest
     */
    class HttpRequestHook {

        constructor() {
            HttpRequestHook.inject();
        }

        static beforeSendHandlers = [];

        static afterComplateHandlers = [];

        static inject() {
            if (!XMLHttpRequest.prototype._oldSend) {
                XMLHttpRequest.prototype._oldSend =
                    XMLHttpRequest.prototype.send;
            }

            if (!XMLHttpRequest.prototype._open) {
                XMLHttpRequest.prototype._open = XMLHttpRequest.prototype.open;
            }

            XMLHttpRequest.prototype.open = function () {
                this._method = arguments[0];
                this._url = arguments[1];
                return this._open(...arguments);
            };

            XMLHttpRequest.prototype.send = function () {
                let intercepted = false;
                let context = {
                    instance: this,
                    args: arguments,
                };

                try {
                    HttpRequestHook.beforeSendHandlers.forEach((handler) => {
                        if (handler.when(context) == true) {
                            handler.then(context);
                        }
                    });
                } catch (e) {
                    if (e == HR_HOOK_BREAK_FLAG) {
                        //处理执行链已断开, 不做任何操作
                    } else if (e == HR_HOOK_INTERCEPT_FLAG) {
                        intercepted = true;
                    } else {
                        //未知异常直接上抛
                        throw e;
                    }
                }

                //当触发到send时, 再对onreadystatechange进行修改, 避免被覆盖
                this._onreadystatechange = this.onreadystatechange;
                this.onreadystatechange = function () {
                    let intercepted = false;
                    if (this.readyState === 4) {
                        try {
                            HttpRequestHook.afterComplateHandlers.forEach(
                                (handler) => {
                                    if (handler.when(context) == true) {
                                        handler.then(context);
                                    }
                                }
                            );
                        } catch (e) {
                            if (e == HR_HOOK_BREAK_FLAG) {
                                //处理执行链已断开, 不做任何操作
                            } else if (e == HR_HOOK_INTERCEPT_FLAG) {
                                //拦截标记在此处用于判断是否允许原onreadystatechange方法
                                intercepted = true;
                            } else {
                                //未知异常直接上抛
                                throw e;
                            }
                        }
                    }
                    if (
                        intercepted == false &&
                        Objects.isExist(this._onreadystatechange)
                    ) {
                        this._onreadystatechange(...arguments);
                    }
                };

                if (intercepted == false) {
                    this._oldSend(...context.args);
                }
            };
        }

        static revert() {
            if (XMLHttpRequest.prototype._oldSend) {
                XMLHttpRequest.prototype.send = XMLHttpRequest.prototype._oldSend;
            }
            if (XMLHttpRequest.prototype._open) {
                XMLHttpRequest.prototype.open = XMLHttpRequest.prototype._open;
            }
        }

        beforeSend(when, then) {
            HttpRequestHook.beforeSendHandlers.push({
                when: when,
                then: then
            });
        }

        afterComplate(when, then) {
            HttpRequestHook.afterComplateHandlers.push({
                when: when,
                then: then
            });
        }
    }

    /**
     * 运行策略辅助器
     */
    class StarterRunPolicyHelper {

        static scheduleTaskList = [];

        /**
         * 清理所有在辅助器内注册过的定时任务
         */
        static clearAllInterval() {
            StarterRunPolicyHelper.scheduleTaskList.forEach((task) => {
                if (Objects.isExist(task)) {
                    try {
                        clearInterval(task);
                    } catch (error) {
                        console.error('clean task error', error)
                    }
                }
            });
        }

        /**
         * 单次运行
         * @param {Function} 要运行的函数或匿名函数
         */
        static runSingle = (task) => {
            task();
        };

        /**
         * 在等待一定时间后运行一次
         * @param {Function} task 要运行的函数或匿名函数
         * @param {Number} waitTime 等待时长(ms)
         */
        static runSingleAfterWait = (task, waitTime) => {
            setTimeout(task, waitTime);
        };

        /**
         * 定时连续运行
         * @param {Function} task 要运行的函数或匿名函数
         * @param {Number} interval 运行间隔时间(ms)
         */
        static runSchedule = (task, interval) => {
            var oneTask = setInterval(task, interval);
            StarterRunPolicyHelper.scheduleTaskList.push(oneTask);
            return oneTask;
        };

        /**
         * 在等待一定时间后定时连续运行
         * @param {Function} task 要运行的函数或匿名函数
         * @param {Number} interval 运行间隔时间(ms)
         * @param {Number} waitTime 等待时长(ms)
         */
        static runScheduleAfterWait = (task, interval, waitTime) => {
            setTimeout(() => {
                this.runSchedule(task, interval);
            }, waitTime);
        };

        /**
         * 当某个条件为真时运行， 固定检测间隔100ms
         * @param {function: boolean} when 条件判断函数， 必须返回boolean
         * @param {function: void} then 满足时触发的函数
         */
        static runWhen = (when, then) => {
            var timer = StarterRunPolicyHelper.runSchedule(function () {
                let check = when();
                if (check == true) {
                    clearInterval(timer);
                    then();
                }
            }, 100);
        };

        /**
         * 当满足某个条件时运行,条件检测间隔为100ms, 且运行时总是进行判断
         * @param {*} when 
         * @param {*} then 
         */
        static runAlwaysWhen = (when, then) => {
            var alwaysWhen = () => {
                then();
                StarterRunPolicyHelper.runWhen(when, alwaysWhen);
            }
            StarterRunPolicyHelper.runWhen(when, alwaysWhen);
        }
    }

    window.onload = () => {
        //------------------------------------------------  common function ↓↓↓↓  --------------------------------------------------//

        /**
         * 发起请求
         * @param {string} url
         * @param {object} paramObj 参数，这里送入对象,不是字符串
         */
        async function request(url, method = 'GET', paramObj = {}, callBack) {
            let isGetOrHead = method === 'GET' || method === 'HEAD';
            if (isGetOrHead) {
                url = buildRequestGetUrl(url, paramObj);
            }
            await fetch(url, {
                method: method,
                headers: {
                    "Content-Type": `${isGetOrHead ? "application/x-www-form-urlencoded" : "application/json"}`,
                    "charset": "utf-8"
                },
                body: isGetOrHead ? undefined : JSON.stringify(paramObj)
            }).then(response => {
                let success = response.status === 200;
                console.log(`request complate - [${success ? "Y" : "N"}]: ${response.url}`)
                if (!success) {
                    GM_notification(response, "Request error!");
                    console.error('request error: ', response)
                } else {
                    if (callBack) {
                        callBack(response.body);
                    }
                }
            })
        }

        async function httpGet(url, paramObj, callBack) {
            return request(url, 'GET', paramObj, callBack);
        }

        async function httpPost(url, paramObj, callBack) {
            return request(url, 'POST', paramObj, callBack);
        }

        function buildRequestGetUrl(url, paramObj) {
            let retUrl = url;
            if (url.indexOf('?') > -1) {
                retUrl += '&';
            } else {
                retUrl += '?';
            }
            for (let k in paramObj) {
                retUrl += k + "=" + encodeURIComponent(paramObj[k])
            }
            return retUrl;
        }

        /**
         * 检测当前页面是否处于iframe中
         */
        function iframeCheck() {
            if (self.frameElement && self.frameElement.tagName == "IFRAME") {
                return false;
            }
            if (window.frames.length != parent.frames.length) {
                return false;
            }
            if (self != top) {
                return false;
            }
            return true;
        }

        //------------------------------------------------  biz function ↓↓↓↓  --------------------------------------------------//


        function doFixDom(dom) {
            let span = dom?.firstChild?.firstChild;
            let img = dom?.firstChild?.childNodes[1];
            span.innerText = img.alt + " - " + span.innerText;
            dom.setAttribute('mark', '1')
        }

        //------------------------------------------------  Starter ↓↓↓↓  --------------------------------------------------//

        //日期转换工具实例
        const TMP_DATE_FORMAT_UTIL = new DateFormatUtil(
            "yyyy-MM-dd hh:mm:ss"
        );

        //cookie工具实例
        const TMP_COOKIE_UTIL = new CookieUtil();

        //请求钩子
        const TMP_HTTP_REQUEST_HOOK = new HttpRequestHook();

        class Starter {
            static start = () => {
                if (!iframeCheck()) {
                    console.log(
                        "Current page is inner of a iframe"
                    );
                    return;
                }

                // http hook demo
                // ctx: { args: [], instance: xhr}
                TMP_HTTP_REQUEST_HOOK.afterComplate((ctx) => {
                    return true;
                }, (ctx) => {
                    console.log('ctx', ctx)
                })

                //start, 选择需要的运行策略
                // runWhen demo
                var times = 1;
                StarterRunPolicyHelper.runAlwaysWhen(
                    () => {
                        return true;
                    },
                    () => {
                        let targetList = document.querySelectorAll('#content > ul > li');
                        if (!targetList || targetList.length == 0) {
                            return;
                        }
                        let realTargetList = [];
                        targetList.forEach(e => {
                            if (e.getAttribute('mark') != '1') {
                                realTargetList.push(e);
                            }
                        })
                        if (realTargetList.length == 0) {
                            return;
                        }
                        realTargetList.forEach(e => doFixDom(e))

                    }
                );
            };
        }

        Starter.start();
    };
})();