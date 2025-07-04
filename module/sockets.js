// type Class = new (...args: any[]) => Class;
// type Constructor = { new (...args: any[]): any; };
export class SocketInterface {
    /** Example MOduel name "module.gm-paranoia-taragnor"
    */
    #socketpath;
    #sessionConstructors;
    #sessions;
    constructor(moduleOrSystemName) {
        this.#socketpath = moduleOrSystemName;
        this.#sessionConstructors = new Map();
        game.socket.on(this.#socketpath, this.socketHandler.bind(this));
        this.#sessions = new Map();
    }
    async send(typeStr, userIdArr, sessionId, sessionType, dataObj = {}, metaObj = {}) {
        const meta = {
            SendTime: Date.now(),
            senderId: game.user.id,
            sessionId,
            from: game.user.id,
            ...metaObj,
        };
        const data = {
            type: typeStr,
            data: dataObj,
            to: userIdArr,
            sessionId,
            sessionType,
            meta,
        };
        return game.socket.emit(this.#socketpath, data);
    }
    socketHandler(msg) {
        if (!msg.to.includes(game.user.id))
            return;
        const sId = msg.sessionId;
        if (this.#sessions.has(sId)) {
            this.#sessions.get(sId).handleMessage(msg);
            return;
        }
        else {
            if (this.#sessionConstructors.has(msg.sessionType)) {
                const sessionConstructor = this.#sessionConstructors.get(msg.sessionType);
                const newSession = new sessionConstructor(msg.sessionId, msg.meta.from);
                newSession.setSocketInterface(this);
                this.#sessions.set(newSession.id, newSession);
                newSession.handleMessage(msg);
                return;
            }
            else {
                console.warn(`Unhandled Data Object Type in socket  ${msg.type} in session ${msg.sessionType}, ID: ${sId}`);
            }
        }
    }
    /** arguments to factory (data, sender, metadata)
    */
    addSlaveSessionConstructor(SessionClass, SessionConstructor) {
        const mainSessionName = SessionClass.name;
        if (!mainSessionName) {
            throw new Error(`Couldn't resolve name for ${SessionClass}. Are you passing a class?`);
        }
        this.#sessionConstructors.set(mainSessionName, SessionConstructor);
    }
    /** starts a Master Session
    */
    async execSession(masterSession) {
        this.#sessions.set(masterSession.id, masterSession);
        masterSession.setSocketInterface(this);
        masterSession.setStarted();
        let ret = null;
        try {
            ret = await masterSession.start();
        }
        catch (e) {
            console.error(e);
        }
        masterSession.setEnded();
        masterSession.destroy();
        this.removeSession(masterSession);
        return ret;
    }
    removeSession(session) {
        this.#sessions.delete(session.id);
    }
    getSession(id) {
        return this.#sessions.get(id);
    }
}
export class Session {
    #handlers;
    #notificationHandlers;
    static codes = {
        request: "__REQUEST__",
        reply: "__REPLY__",
        createNewSession: "__NEWSESSION__",
        destroySession: "__DESTROYSESSION__",
        timeExtension: "__TIMEREQUEST__",
        replyError: "__REPLYERROR__",
        notify: "__NOTIFY__",
    };
    sender;
    id;
    sessionType;
    name;
    timestamp;
    unresolvedEvents;
    active;
    promise;
    reject;
    conf;
    value;
    error;
    subscribers;
    constructor(name = "Unnamed Session", id, userIdList) {
        if (userIdList) {
            this.registerSubscribers(userIdList);
        }
        this.sender = null;
        if (!id)
            id = Session.newId();
        this.id = id;
        this.sessionType = this.constructor.name;
        this.name = name;
        this.timestamp = Date.now();
        this.unresolvedEvents = [];
        this.active = true;
        this.promise = null;
        this.conf = null;
        this.reject = null;
        this.value = null;
        this.error = null;
        this.#handlers = new Map();
        this.#notificationHandlers = new Map();
        const promise = new Promise((conf, reject) => {
            this.conf = conf;
            this.reject = reject;
        });
        this.promise = promise
            .then((x) => {
            this.value = x;
            this.error = null;
            this.active = false;
        }).catch(x => {
            this.active = false;
            this.value = null;
            this.error = x;
        });
        this.setHandlers();
    }
    setHandlers() {
        //extensible virtual function
        this.#handlers.set(Session.codes.notify, this.onNotify.bind(this));
    }
    async start() {
        return true;
    }
    setSocketInterface(socketInterface) {
        this.sender = socketInterface;
    }
    /** sends a notification handled by addNotifyHandler which is a sort of oneway message **/
    async notify(notifyType, dataObj = {}, metaObj = {}) {
        metaObj.notifyType = notifyType;
        await this.send(Session.codes.notify, dataObj, metaObj);
    }
    static counter = 0;
    static newId() {
        return game.user.id + "_" + Date.now() + "_" + this.counter++;
    }
    defaultTimeOut(userId) {
        const user = game.users.find(x => x.id == userId);
        if (user && user.isGM)
            return Infinity;
        else
            return 60;
    }
    registerSubscribers(subListBase) {
        const subListArray = subListBase;
        // if (subListBase.values) {
        // 	subListArray = Array.from(subListBase.values());
        // } else {
        // 	subListArray = subListBase;
        // }
        const subList = subListArray.filter(x => x.id != game.user.id && x.active);
        this.subscribers = subList.map(user => {
            return new Subscriber(user.id, this);
        });
    }
    tickTimeout() {
        this.subscribers.forEach(sub => {
            if (sub.tickTimeout()) {
                this.onTimeOut(sub);
            }
        });
    }
    onTimeOut(_subscriber) {
        //designed to be overriden
    }
    get liveSubscribers() {
        return this.subscribers.filter(x => !x.finished);
    }
    get subscriberIds() {
        return this.subscribers.map(x => x.id);
    }
    async send(typeStr, dataObj, metaObj = {}) {
        if (this.active && this.sender)
            return await this.sender.send(typeStr, this.subscriberIds, this.id, this.sessionType, dataObj, metaObj);
        else {
            console.debug("inacitve session can't send");
        }
    }
    addHandler(type, handlerFn) {
        if (!type)
            throw new Error(`Passed bad handler Type: ${type}`);
        this.#handlers.set(type, handlerFn);
    }
    addNotifyHandler(notifyType, handlerFn) {
        this.#notificationHandlers.set(notifyType, handlerFn);
    }
    handleMessage({ type, data, meta }) {
        if (this.#handlers.has(type)) {
            this.#handlers.get(type)(data, meta);
        }
        else {
            console.warn(`Unhandled Data Object Type in socekt ${type}`);
        }
    }
    onNotify(data, meta) {
        const notifyType = meta.notifyType;
        const handler = this.#notificationHandlers.get(notifyType);
        if (!handler) {
            console.warn(`No notification for type: ${notifyType}`);
            return;
        }
        else {
            handler(data, meta);
        }
    }
    destroy() {
        // console.debug("Destorying session");
        this.active = false;
    }
    onDestroy() {
        //virtual
    }
}
export class MasterSession extends Session {
    #started;
    replyHandlers = new Map();
    constructor(name = "Unnamed Master Session", id = undefined, userIdList = undefined) {
        super(name, id, userIdList);
        if (!name)
            name = `${this.constructor.name} Session`;
        this.name = name;
        this.#started = false;
        this.setReplyHandlers();
    }
    isRunning() {
        return this.#started;
    }
    setStarted() {
        if (this.#started)
            throw new Error("Session already started? Can't start twice");
        this.#started = true;
    }
    setEnded() {
        if (!this.#started)
            throw new Error("Session not started. can't end twice");
        this.#started = false;
    }
    setHandlers() {
        super.setHandlers();
        this.addHandler(Session.codes.reply, this.recieveReply.bind(this));
        this.addHandler(Session.codes.replyError, this.recieveErrorReply.bind(this));
        this.addHandler(Session.codes.timeExtension, this.extendTime.bind(this));
    }
    /** sends request to subscribers
    dataObj is sent to subscribers
    subscribers can return the request using reply
    */
    async request(requestCode, dataObj, timeoutFn = (userId) => this.defaultTimeOut(userId)) {
        this.subscribers.forEach(sub => {
            const timeout = timeoutFn(sub.id);
            sub.awaitReply(timeout);
        });
        const meta = { requestCode };
        await this.send(Session.codes.request, dataObj, meta);
        const promises = this.subscribers
            .filter(x => x.promise != null)
            .map(x => x.promise);
        await Promise.allSettled(promises);
        return this.subscribers.map(x => {
            return {
                id: x.id,
                value: x.value ?? null,
                error: x.error ?? null,
            };
        });
        //TODO: clean up session
    }
    handleMessage(d) {
        if (d.type == Session.codes.reply) {
            this.recieveReply(d.data, d.meta);
        }
        else {
            super.handleMessage(d);
        }
    }
    /** when a reply is recieved for any one subscriber, it calls this routine,useful if yo want to use partial results as they're recieved, otherwise just await the main promise from execSession
    */
    setReplyHandler(codeStr, handlerFn) {
        this.replyHandlers.set(codeStr, handlerFn);
    }
    async recieveReply(data, meta) {
        const senderId = meta.from;
        const handler = this.replyHandlers.get(meta.replyCode);
        if (handler) {
            const sub = this.subscribers.find(x => x.id == senderId);
            if (sub && sub.awaitingReply && sub.resolve) {
                sub.resolve(data);
                return await handler(data, meta, senderId);
            }
        }
        else {
            console.debug(`No handler for reply ${meta.replyCode}`);
        }
    }
    async recieveErrorReply(error, meta) {
        console.log(`Error recieved (see below)`);
        console.log(error);
        const senderId = meta.from;
        const sub = this.subscribers.find(x => x.id == senderId);
        if (sub && sub.awaitingReply && sub.reject) {
            sub.reject(new Error(error));
        }
    }
    extendTime(data, meta) {
        const from = meta.from;
        const amount = data.amount;
        if (!from || !amount)
            throw new Error("Malformed time request");
        const sub = this.subscribers.find(x => x.id == from);
        if (!sub)
            throw new Error("Couldn't find");
        sub.timeExtend(amount);
    }
    destroy() {
        // console.debug("Sending destroy code");
        this.send(Session.codes.destroySession, {});
        super.destroy();
        this.onDestroy();
    }
}
export class SlaveSession extends Session {
    replyCode = null;
    interactionNum = 0;
    requestHandlers = new Map();
    constructor(id, sender) {
        const name = "Slave Session";
        if (typeof sender == "string")
            sender = game.users.find(x => x.id == sender);
        if (!sender)
            throw new Error("No sender Id Given?!");
        const userIdList = [sender];
        super(name, id, userIdList);
        this.setRequestHandlers();
    }
    setHandlers() {
        super.setHandlers();
        this.addHandler(Session.codes.request, this.recieveRequest.bind(this));
        this.addHandler(Session.codes.destroySession, this.destroy.bind(this));
    }
    handleMessage(d) {
        if (d.type == Session.codes.request) {
            this.recieveRequest(d.data, d.meta);
        }
        else {
            super.handleMessage(d);
        }
    }
    setRequestHandler(codeStr, handlerFn) {
        this.requestHandlers.set(codeStr, handlerFn);
    }
    //TODO: shift this to not use the replyFn and conventional try/catch
    async recieveRequest(data, meta) {
        const requestCode = meta.requestCode;
        if (!requestCode) {
            throw new Error("Request Code can't be null");
        }
        const handler = this.requestHandlers.get(requestCode);
        if (handler) {
            this.replyCode = requestCode;
            const interactionNum = ++this.interactionNum;
            try {
                const dataObj = await handler(data, meta);
                if (interactionNum == this.interactionNum)
                    return await this.reply(dataObj, null);
                else {
                    console.debug("invalid interaction num");
                    return;
                }
            }
            catch (e) {
                console.log("Caught an error");
                return await this.reply({}, { error: e.toString() });
            }
        }
        else {
            throw new Error(`No handler for ${requestCode}`);
        }
    }
    async reply(dataObj = {}, error = null) {
        const meta = {
            replyCode: this.replyCode ? this.replyCode : undefined
        };
        if (!error) {
            await this.send(Session.codes.reply, dataObj, meta);
        }
        else {
            console.log(`replying Error (error below)`);
            console.log(error);
            await this.send(Session.codes.replyError, error, meta);
        }
        // this.replyCode = null;
    }
    async getTimeExtension(amount) {
        await this.send(Session.codes.timeExtension, { amount });
    }
    destroy() {
        super.destroy();
        this.onDestroy();
        this.sender?.removeSession(this);
    }
}
class Subscriber {
    #timeoutIntervalId = null;
    awaitingReply = false;
    replied = false;
    id;
    reject;
    promise = null;
    timeout = 0;
    error = null;
    value = null;
    session;
    replyFunction = null;
    resolve = null;
    finished = false;
    constructor(id, session) {
        this.id = id;
        this.session = session;
        // this.replied= false;
        // this.awaitingReply = false;
        // this.error= null;
        // this.value= null;
        // this.timeout= 0;
        // this.replyFunction = null;
        // this.resolve= null;
        // this.reject= null;
        // this.promise = null;
        // this.#timeoutIntervalId= null;
    }
    /** returns true on a timeout
    */
    tickTimeout() {
        // console.debug("Ticking Timeout");
        if (this.#timeoutIntervalId == null)
            return false;
        if (!this.awaitingReply) {
            window.clearInterval(this.#timeoutIntervalId);
            this.#timeoutIntervalId = null;
            return false;
        }
        if (--this.timeout == 0) {
            this.awaitingReply = false;
            this.reject(new Error("Timeout"));
            // console.debug("Timeout");
            window.clearInterval(this.#timeoutIntervalId);
            this.#timeoutIntervalId = null;
            return true;
        }
        return false;
    }
    awaitReply(timeout = Infinity) {
        // console.debug(`Timeout set: ${timeout}`);
        const subscriber = this;
        this.timeout = timeout;
        this.error = null;
        this.value = null;
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        })
            .then(x => subscriber.value = x)
            .catch(err => {
            // console.debug(`Rejected ${err}`);
            subscriber.error = err.message;
        })
            .finally(() => {
            subscriber.awaitingReply = false;
            subscriber.resolve = null;
            subscriber.promise = null;
            subscriber.reject = null;
        });
        this.awaitingReply = true;
        if (!this.#timeoutIntervalId)
            this.#timeoutIntervalId = window.setInterval(this.tickTimeout.bind(this), 1000);
    }
    /**grants more time before timeout
    */
    timeExtend(amount) {
        // console.debug("considering time extend");
        if (this.awaitingReply && this.timeout > 0) {
            // console.debug(`Time extension granted: ${amount}`);
            this.timeout += amount;
        }
    }
}
