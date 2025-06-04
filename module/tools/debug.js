export class DebugTools {
    static DEBUG = true;
    static _DList = [];
    static Debug(str) {
        if (this._DList == null)
            this._DList = [];
        this._DList.unshift(str);
        // console.warn("Added to Debug");
    }
    static DLog(num) {
        if (num == null)
            return this._DList;
        else
            return this._DList[num];
    }
    static setDebugMode(bool) {
        if (typeof bool != "boolean")
            throw new Error(`Expected boolean and got ${typeof bool} :${bool}`);
        this.DEBUG = bool;
        console.log(`Debug mode set to ${bool}`);
    }
}
window.Debug = DebugTools.Debug.bind(DebugTools);
window.DLog = DebugTools.DLog.bind(DebugTools);
