import { SocketInterface, } from "./sockets.js";
import { JuiceMasterSession, JuiceSlaveSession, TagReviewMasterSession, TagReviewSlaveSession, JuiceSpendingSessionM, JuiceSpendingSessionS, TagAndStatusCleanupSessionS, TagAndStatusCleanupSessionM, DowntimeSessionM, DowntimeSessionS } from "./city-sessions.js";
export class CitySockets {
    static timeoutDuration = 60; //time in seconds
    static codes = {
        startRoll: "startRoll",
        onPreRoll: "onPreRoll",
        giveJuice: "giveJuice",
        tagVerify: "tagVerify",
        requestJuiceTime: "requestJuiceTime",
    };
    static sockets;
    static init() {
        this.sockets = new SocketInterface("system.city-of-mist");
        this.sockets.addSlaveSessionConstructor(JuiceMasterSession, JuiceSlaveSession);
        this.sockets.addSlaveSessionConstructor(JuiceSpendingSessionM, JuiceSpendingSessionS);
        this.sockets.addSlaveSessionConstructor(TagReviewMasterSession, TagReviewSlaveSession);
        this.sockets.addSlaveSessionConstructor(TagAndStatusCleanupSessionM, TagAndStatusCleanupSessionS);
        this.sockets.addSlaveSessionConstructor(DowntimeSessionM, DowntimeSessionS);
    }
    // static async test() {
    // 	return this.execSession( new DummyMasterSession())
    // }
    static async execSession(session) {
        return this.sockets.execSession(session);
    }
    // static async send(typeStr: string, dataObj: unknown = {}) {
    // 	if (!this.sockets)
    // 		throw new Error(" Sockets not initialized, make sure to run CitySockets.init()");
    // 	const userIds = game.users.contents.map( x=> x.id);
    // 	return await this.sockets.send(typeStr,userIds,  dataObj);
    // }
    // static #createNewPromiseData(userArr, gmTimeOut = this.timeoutDuration, playerTimeOut=this.timeoutDuration) {
    // 	return userArr.map(user => {
    // 		const data = {
    // 			pending: true,
    // 			value: null,
    // 			user,
    // 			userId: user.id,
    // 			timeout: user.isGM ? gmTimeOut : playerTimeOut,
    // 			error: null,
    // 			promise : null,
    // 			conf: null,
    // 			reject: null,
    // 		};
    // 		const promise =
    // 			 new Promise ( (conf, reject) => {
    // 				data.conf = conf;
    // 				data.reject = reject;
    // 				window.setTimeout(() => this.timeoutFn(data, reject) , 1000);
    // 			}).then( val => {
    // 				data.pending = false, data.value= val;
    // 			}).catch( err=> {
    // 				data.pending = false; data.value = null; data.error = err;
    // 			});
    // 		data.promise = promise;
    // 		return data;
    // 	});
    // 	}
    // static async #awaitResolution(promiseDataArr) {
    // 	const promises = promiseDataArr.map( x=> x.promise);
    // 	await Promise.allSettled( promises);
    // 	return promiseDataArr.filter( x=> x.value !== null);
    // }
    static timeoutFn(dataObj, reject) {
        if (dataObj.pending === false)
            return; //promise is resolved elsewhere
        if (dataObj.timeout <= 0) {
            reject("timeout");
            return;
        }
        else {
            dataObj.timeout -= 1;
            window.setTimeout(() => CitySockets.timeoutFn(dataObj, reject), 1000);
        }
    }
}
// class RollSession extends Session {
// 	static codes = {
// 		startRoll: "startRoll",
// 		onPreRoll : "onPreRoll",
// 		giveJuice : "giveJuice",
// 		tagVerify: "tagVerify",
// 		requestJuiceTime: "requestJuiceTime",
// 	}
// 	constructor (id, msgData, msgMeta) {
// 		super (id);
// 		this.addHandler(this.codes.onPreRoll, this.onPreRollHandler.bind(this));
// 		this.addHandler(this.codes.giveJuice, this.onGiveJuice.bind(this));
// 		this.addHandler(this.codes.tagVerify, this.onTagVerify.bind(this));
// 		this.addHandler(this.codes.requestJuiceTime, this.onJuiceTimeRequest.bind(this));
// 	}
// 	static async onPreRollHandler(dataObj, metaData) {
// 		const user = game.users.find(user => user.id == metaData.senderId);
// 		if (game.user.isGM) {
// 			// const verify = await CityDialogs.tagVerify(dataObj);
// 			const verify = {amount : 1}; //test code
// 			return await this.send(this.codes.tagVerify, verify);
// 		} else {
// 			console.log("Trying to get help hurt");
// 			// const juice = await CityDialogs.getHelpHurt(dataObj);
// 			const juice = {amount : 1}; //test code
// 			return await this.send(this.codes.giveJuice, juice);
// 		}
// 	}
// }
