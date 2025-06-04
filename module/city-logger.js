import { CitySettings } from "./settings.js";
import { Logger } from "./tools/logger.js";
export class CityLogger extends Logger {
    static async logToChat(actor, action, object = null, aftermsg = "") {
        if (action != undefined) {
            const object_part = object ? `${object.type} ${object.getDisplayedName()}` : "";
            const afterMsgString = Array.isArray(aftermsg) ? aftermsg.join(" ,") : aftermsg;
            const after_message = afterMsgString ? `(${afterMsgString})` : "";
            const message = await renderTemplate("systems/city-of-mist/templates/modification-log-post.hbs", { object_part, after_message, actor, action });
            try {
                return await this.gmMessage(message, actor);
            }
            catch (e) {
                console.error(e);
            }
        }
        else {
            console.warn(`Deprecated usage of modification Log: ${actor}`);
            try {
                return await this.gmMessage("Deprecated Use of Modification Log: ", actor);
            }
            catch (e) {
                console.error(e);
            }
        }
    }
    static async modificationLog(...args) {
        if (!CitySettings.get("loggedActions"))
            return;
        try {
            return await this.logToChat(...args);
        }
        catch (e) {
            console.error(e);
        }
    }
    static async rawHTMLLog(actor, html, gmOnly = true) {
        if (gmOnly) {
            await this.gmMessage(html, actor);
        }
        else {
            const speaker = ChatMessage.getSpeaker({ alias: actor.getDisplayedName() });
            await Logger.sendToChat(html, speaker);
        }
    }
}
