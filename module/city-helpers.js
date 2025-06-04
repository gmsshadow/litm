import { DOWNTIME_CHOICES } from "./datamodel/downtime-choices.js";
import { CitySettings } from "./settings.js";
import { localize } from "./city.js";
import { CityRoll } from "./city-roll.js";
import { CityDB } from "./city-db.js";
import { HTMLTools } from "./tools/HTMLTools.js";
import { CityLogger } from "./city-logger.js";
import { Sounds } from "./tools/sounds.js";
import { TokenTools } from "./tools/token-tools.js";
import { CityDialogs } from "./city-dialogs.js";
import { SceneTags } from "./scene-tags.js";
import { DowntimeSessionM } from "./city-sessions.js";
import { CitySockets } from "./city-sockets.js";
export class CityHelpers {
    static get dangerTemplates() { return CityDB.dangerTemplates; }
    static getAllActorsByType(item_type = "") { return CityDB.filterActorsByType(item_type); }
    static getAllItemsByType(item_type = "") { return CityDB.filterItemsByType(item_type); }
    static findAllById(id, type = "Actor") {
        const x = CityDB.findById(id, type);
        if (x) {
            return x;
        }
        throw new Error(`Can't find Actor Id ${id}`);
    }
    static getThemebooks() { return CityDB.themebooks; }
    static getMoves() { return CityDB.movesList; }
    static getDangerTemplate(id) { return CityDB.getDangerTemplate(id); }
    static getThemebook(tname, id) { return CityDB.getThemebook(tname, id); }
    static async modificationLog(...args) { return await CityLogger.modificationLog(...args); }
    static async logToChat(actor, action, object = null, aftermsg = "") { return await CityLogger.logToChat(actor, action, object, aftermsg); }
    static async sendToChat(text, sender = {}) {
        return await CityLogger.sendToChat(text, sender);
    }
    static getMoveById(moveId) {
        return this.getMoves().find(x => x.id == moveId);
    }
    static async asyncwait(sec) {
        return await new Promise((succ, _fail) => {
            setTimeout(() => succ(true), sec * 1000);
        });
    }
    static async sleep(sec) {
        return await this.asyncwait(sec);
    }
    static async getUserId() {
        if (game.user.id != null)
            return game.user.id;
        else
            throw new Error("Unknown User");
    }
    static async cacheSounds() {
        console.log("Caching sounds");
        const lowVolume = 0.001;
        this.playSound("lock.mp3", lowVolume);
        this.playSound("burn-tag.mp3", lowVolume);
        this.playSound("button-on.mp3", lowVolume);
        this.playSound("button-off.mp3", lowVolume);
        this.playSound("beep.wav", lowVolume);
    }
    static async playLockOpen() {
        return await this.playSound("lock.mp3", 0.3);
    }
    static async playLockClosed() {
        return await this.playSound("lock.mp3", 0.5);
    }
    static async playBurn() {
        return await this.playSound("burn-tag.mp3", 0.5);
    }
    static async playTagOn() {
        return await this.playSound("button-on.mp3");
    }
    static async playTagOff() {
        return await this.playSound("button-off.mp3");
    }
    static async playTagOnSpecial() {
        //TODO: find another sound for this
        return await this.playSound("button-on.mp3");
    }
    static async playPing() {
        return await this.playSound("beep.wav");
    }
    static async playWriteJournal() {
        return await this.playSound("button-on.mp3");
    }
    static async playLoadoutToggle(state) {
        if (state)
            await this.playTagOn();
        else
            await this.playTagOff();
    }
    static async playSound(filename, volume = 1.0) {
        return await Sounds.playSound(filename, volume);
    }
    static getTagOwnerById(tagOwnerId) {
        return CityDB.getTagOwnerById(tagOwnerId);
    }
    /** returns the actor owner based on ownerId, tokenId, sceneId
    @param  {string} ownerId
    @param  {string | undefined } tokenId
    @param  {string | undefined } sceneId
    @return {CityActor}
    */
    static getOwner(ownerId, tokenId, sceneId) {
        if (!ownerId)
            throw new Error(`No owner Id provided to CityHelpers.getOwner`);
        if (!tokenId) {
            const actorOrItem = CityHelpers.findAllById(ownerId);
            if (!actorOrItem)
                throw new Error(`Can't find owner for ownerId ${ownerId}`);
            return actorOrItem;
        }
        else {
            const scene = game.scenes.find(x => x.id == sceneId) ??
                game.scenes.find(scene => scene.tokens.contents.some(token => token.id == tokenId && !token.isLinked));
            if (!scene)
                return this.getOwner(ownerId);
            if (!tokenId)
                throw new Error(` No Token Id provided`);
            const token = scene.tokens.get(tokenId);
            if (!token)
                throw new Error("Can't find token");
            return token.actor;
            // const sceneTokenActors = this.getSceneTokenActors(scene);
            // return sceneTokenActors.find( x=> x?.token?.id == tokenId);
        }
    }
    static getActiveScene() {
        return TokenTools.getActiveScene();
    }
    static getActiveSceneTokens() {
        return TokenTools.getActiveSceneTokens();
    }
    static getSceneTokens(scene) {
        return TokenTools.getSceneTokens(scene);
    }
    static getActiveSceneTokenActors() {
        return TokenTools.getActiveSceneTokenActors();
    }
    static getVisibleActiveSceneTokenActors() {
        return TokenTools.getVisibleActiveSceneTokenActors();
    }
    static getSceneTokenActors(scene) {
        return TokenTools.getSceneTokenActors(scene);
    }
    static getActiveUnlinkedSceneTokens() {
        return TokenTools.getActiveUnlinkedSceneTokens();
    }
    static async getBuildUpImprovements() {
        return CityDB.getBuildUpImprovements();
    }
    static async narratorDialog() {
        const text = await CityDialogs.narratorDialog();
        if (!text)
            return;
        const { html: modified_html, taglist, statuslist } = CityHelpers.unifiedSubstitution(text);
        await this.processTextTagsStatuses(taglist, statuslist, null);
        await CityHelpers.sendNarratedMessage(modified_html);
    }
    /**applies tags and statuses in lists where actor is the active actor

*/
    static async processTextTagsStatuses(taglist, statuslist, actor = null) {
        for (const { name: tagname, options } of taglist) {
            if (options.scene) {
                await SceneTags.createSceneTag(tagname.trim(), true, options);
                continue;
            }
            if (options.autoApply) {
                if (actor)
                    await actor.createStoryTag(tagname.trim(), true, options);
                else
                    await SceneTags.createSceneTag(tagname.trim(), true, options);
            }
        }
        for (const { name, tier, options } of statuslist) {
            if (options.scene) {
                await SceneTags.createSceneStatus(name.trim(), tier, 0, options);
                continue;
            }
            if (options.autoApply) {
                if (actor)
                    await actor.addOrCreateStatus(name.trim(), tier, 0, options);
                else
                    await SceneTags.createSceneStatus(name.trim(), tier, 0, options);
            }
        }
    }
    static parseTags(text) {
        let retarr = [];
        const regex = /\[([^\]]*)\]/gm;
        let match = regex.exec(text);
        while (match != null) {
            let tagName = match[1];
            tagName = tagName.replaceAll('[', '');
            tagName = tagName.replaceAll(']', '');
            retarr.push(tagName);
            match = regex.exec(text);
        }
        return retarr;
    }
    /**Replaces text following a $ with the appropriate term in key,value in replaceObj
    example: nameSubstitution("#name", {name: "Tom"})
    */
    static nameSubstitution(text, replaceObj = {}) {
        const regex = /\$([\w]+[\d]*)\b/gm;
        let match = regex.exec(text);
        //TODO: FIX THIS
        while (match != null) {
            let replacetext = match[1];
            let lowerify = replacetext.toLowerCase();
            if (!replaceObj[lowerify]) {
                console.warn(`String ${replacetext} not found in replacement Object`);
                text = text.replace('$' + replacetext, '?????');
                match = regex.exec(text);
                continue;
            }
            text = text.replace('$' + replacetext, replaceObj[lowerify]);
            match = regex.exec(text);
        }
        return text;
    }
    /** swap out text newlines for <br> **/
    static newlineSubstitution(inputText) {
        return inputText.split("\n").join("<br>").trim();
    }
    /** removes text that are between braces{}
    **/
    static removeWithinBraces(text = "") {
        while (text.includes("{")) {
            const parts = text.split("{");
            const before = parts.shift();
            const rest = parts.join("{");
            if (!rest.includes("}")) {
                ui.notifications.error("No closing brace on GMMove");
                return before ?? "";
            }
            const parts2 = rest.split("}");
            parts2.shift();
            const after = parts2.join("}");
            text = before + after;
        }
        return text.trim();
    }
    /** Adds HTML span tag in polace of braces marking it as secret text
    **/
    static formatWithinBraces(text = "") {
        while (text.includes("{")) {
            const parts = text.split("{");
            const before = parts.shift();
            const rest = parts.join("{");
            if (!rest.includes("}")) {
                ui.notifications.error("No closing brace on GMMove");
                return before ?? "";
            }
            const parts2 = rest.split("}");
            const inner = parts2.shift();
            const after = parts2.join("}");
            text = `${before} <span class="secret">${inner}</span> ${after}`;
        }
        return text.trim();
    }
    static unifiedSubstitution(text, status_mod = 0) {
        const regex = /\[([ \w,]*:)?([\p{Letter}\d\- ]+)\]/gmu;
        let match = regex.exec(text);
        let taglist = [];
        let statuslist = [];
        let loop = 0;
        while (match != null) {
            if (loop++ > 1000)
                break;
            let options = CityHelpers.parseOptions(match[1]);
            const name = match[2].trim();
            if (CityHelpers.isStatusParseable(name)) {
                const formatted_statusname = CityHelpers.replaceSpaces(name.substring(0, name.length - 2));
                let tierstr = name.at(-1);
                let tier = Number(tierstr);
                if (Number.isNaN(tier))
                    tier = 0;
                if (!options.ignoreCollective) {
                    tier = Number(tier) + status_mod;
                }
                const autoStatus = options.autoApply ? "auto-status" : "";
                const newtext = `<span draggable="true" class="narrated-status-name draggable ${autoStatus}" data-draggable-type="status" data-options='${JSON.stringify(options)}'>${formatted_statusname}-<span class="status-tier">${tier}</span></span>`;
                text = text.replace(match[0], newtext);
                statuslist.push({
                    name: formatted_statusname,
                    tier,
                    options
                });
            }
            else {
                taglist.push({
                    name,
                    options
                });
                const newtext = `<span draggable="true" class="narrated-story-tag draggable" data-draggable-type="tag" data-options='${JSON.stringify(options)}'>${name}</span>`;
                text = text.replace(match[0], newtext);
            }
            match = regex.exec(text);
        }
        return {
            html: text,
            taglist,
            statuslist
        };
    }
    static parseOptions(optionString) {
        if (!optionString?.length)
            return {};
        optionString = optionString.trim().substring(0, optionString.length - 1); //shave off the colon
        const splitString = optionString.split(",")
            .map(option => {
            switch (option.trim()) {
                case "a":
                    return "autoApply";
                case "i":
                    return "ignoreCollective";
                case "s":
                    return "scene";
                case "p":
                    return "permanent";
                case "t":
                    return "temporary";
                default:
                    console.warn(`Unrecognized option: ${option}`);
                    return "";
            }
        });
        return splitString.reduce((acc, item) => {
            acc[item] = true;
            return acc;
        }, {});
    }
    static isStatusParseable(name) {
        const secondToLast = name.at(-2);
        if (secondToLast != " " && secondToLast != "-")
            return false;
        const lastval = name.at(-1);
        const number_test = !Number.isNaN(Number(lastval));
        return number_test || lastval == "X";
    }
    static autoAddstatusClassSubstitution(text) {
        const regex = /\|\|([^|]+)\|\|/gm;
        let statuslist = [];
        let match = regex.exec(text);
        while (match != null) {
            const statusname = match[1];
            const formatted_statusname = CityHelpers.replaceSpaces(statusname.trim());
            const newtext = `<span class="narrated-status-name auto-status">${formatted_statusname}</span>`;
            text = text.replace('|' + statusname + '|', newtext);
            match = regex.exec(text);
            statuslist.push(formatted_statusname);
        }
        const statuslistMod = statuslist.map(x => {
            const regex = /(\D+)-(\d+)/gm;
            let match = regex.exec(x);
            while (match != null) {
                const name = match[1];
                const tier = Number(match[2]);
                return {
                    name,
                    tier: Number.isNaN(tier) ? 0 : tier,
                    options: { autoApply: true }
                };
            }
            return null;
        }).filter(x => x != null);
        return { html: text, statuslist: statuslistMod };
    }
    static statusClassSubstitution(text) {
        //Change {TAG} into <span class="status-name"> TAG </span>
        const regex = /\|([^|]+)\|/gm;
        let match = regex.exec(text);
        while (match != null) {
            const statusname = match[1];
            const formatted_statusname = CityHelpers.replaceSpaces(statusname.trim());
            const newtext = `<span draggable="true" class="narrated-status-name draggable" data-draggable-type="status">${formatted_statusname}</span>`;
            text = text.replace('|' + statusname + '|', newtext);
            match = regex.exec(text);
        }
        return text;
    }
    static replaceSpaces(text) {
        //for formatting statuses
        return text.replaceAll(" ", "-");
    }
    static async parseStatusString(str) {
        const last = str.substring(str.length - 1);
        const tier = Number(last);
        if (Number.isNaN(tier))
            throw new Error(`Malformed status ${str}`);
        const name = str.substring(0, str.length - 2);
        return { name, tier };
    }
    static async sendNarratedMessage(text) {
        const templateData = { text };
        const html = await renderTemplate("systems/city-of-mist/templates/narration-box.html", templateData);
        const speaker = { alias: "Narration" };
        const messageData = {
            speaker: speaker,
            content: html,
            type: CONST.CHAT_MESSAGE_TYPES.OOC,
        };
        ChatMessage.create(messageData, {});
        // CONFIG.ChatMessage.documentClass.create(messageData, {})
    }
    static async itemDialog(item) {
        return await CityDialogs.itemEditDialog(item);
    }
    static async refreshTokenActorsInScene(scene) {
        const scenetokens = scene.tokens;
        const characterActors = scenetokens
            .filter(x => x.isLinked &&
            x.actor != undefined &&
            x.actor.type == "character")
            .map(x => x.actor);
        for (const dep of characterActors) {
            const state = dep.sheet._state;
            if (state > 0) {
                CityHelpers.refreshSheet(dep);
            }
        }
        return true;
    }
    static refreshSheet(actor) {
        setTimeout(() => actor.sheet.render(false), 1);
    }
    static async ensureTokenLinked(_scene, token) {
        if (token.actorLink)
            return;
        await token.update({ actorLink: true });
        return true;
    }
    static getTokenDisplayedName(token) {
        return token.name;
    }
    static modArray(array, amount = 1, arrlen = 3) {
        let improvements = 0;
        let breaker = 0;
        while (amount > 0) {
            if (breaker++ > 100)
                throw new Error("Endless Loop");
            array = array.map((i) => {
                if (i == 0 && amount > 0) {
                    amount--;
                    return 1;
                }
                else
                    return i;
            });
            if (array[arrlen - 1] == 1) {
                array = new Array(arrlen).fill(0);
                improvements++;
            }
        }
        while (amount < 0) {
            if (breaker++ > 100)
                throw new Error("Endless Loop");
            array = array.reverse().map((i) => {
                if (i == 1 && amount < 0) {
                    amount++;
                    return 0;
                }
                else
                    return i;
            });
            if (array[arrlen - 1] == 0 && amount < 0) {
                array = new Array(arrlen).fill(1);
                improvements--;
            }
            array = array.reverse();
        }
        return [array, improvements];
    }
    static middleClick(handler) { return HTMLTools.middleClick(handler); }
    static rightClick(handler) { return HTMLTools.rightClick(handler); }
    static async sessionEnd() {
        if (!game.user.isGM)
            return;
        const eos = localize("CityOfMist.dialog.endOfSession.name");
        const eosQuery = localize("CityOfMist.dialog.endOfSession.query");
        if (await HTMLTools.confirmBox(eos, eosQuery)) {
            const move = CityHelpers.getMoves()
                .find(x => x.system.effect_class.includes("SESSION_END"));
            if (!move) {
                throw new Error("Can't find Session end move");
            }
            await CityRoll.execMove(move.id, null);
            for (let actor of game.actors)
                await actor.sessionEnd();
        }
    }
    static async startDowntime() {
        if (!game.user.isGM)
            return;
        await this.PCDowntime();
        await this.promptDowntimeMovesList();
    }
    static async PCDowntime() {
        const PCList = await this.selectPCsForDowntime();
        if (PCList.length > 0) {
            const s = new DowntimeSessionM(PCList);
            CitySockets.execSession(s);
        }
    }
    /** displays dialog for selecting which PCs get downtime. Can return [actor], empty array for no one or null indicating a cancel
     */
    static async selectPCsForDowntime() {
        const downtime = localize("CityOfMist.moves.downtime.name");
        // const downtimeQuery = localize("CityOfMist.dialog.downtime.query");
        const PCList = game.actors.filter((x) => x.system.type == "character");
        const idList = await HTMLTools.PCSelector(PCList, downtime);
        return idList
            .map(id => PCList.find(actor => actor.id == id))
            .filter(x => x);
    }
    static async promptDowntimeMovesList() {
        if (!game.user.isGM)
            return;
        const tokens = TokenTools.getActiveSceneTokenActors();
        const actorWithMovesList = tokens
            .filter(actor => actor.is_danger_or_extra())
            .map(actor => ({
            movelist: actor.getGMMoves()
                .filter(gmmove => gmmove.isDowntimeTriggeredMove()),
            actor: actor,
        }))
            .filter(({ movelist }) => movelist.length > 0)
            .flat(1);
        await CityDialogs.downtimeGMMoveDialog(actorWithMovesList);
    }
    static async downtimeActionChoice(choice, actor) {
        let moveText = DOWNTIME_CHOICES[choice];
        if (!moveText) {
            ui.notifications.warn(`Unknown Downtime Action ${choice}`);
            return;
        }
        moveText = localize(moveText);
        const html = await renderTemplate("systems/city-of-mist/templates/pc-downtime-move.hbs", { actor, moveText });
        const messageOptions = {};
        const messageData = {
            // speaker: ChatMessage.getSpeaker(),
            speaker: { alias: actor.displayedName },
            content: html,
            user: game.user,
            type: CONST.CHAT_MESSAGE_TYPES.OOC,
        };
        await ChatMessage.create(messageData, messageOptions);
    }
    static applyColorization() {
        // const colorsetting = game.settings.get("city-of-mist", "color-theme") ;
        // if (colorsetting) {
        // 	document.documentElement.style.setProperty(
        // 		"--COM-COLOR-SCHEME",
        // 		colorsetting
        // 	);
        //NOTE: TEST CODE
        // document.documentElement.style.setProperty(
        // "--mythos-pink",
        // colorsetting
        // );
        // }
    }
    static async centerOnActorToken(actor) {
        let position = null;
        if (actor.isToken) {
            //@ts-ignore
            position = actor.parent._object.center;
        }
        else {
            const token = actor.getLinkedTokens().filter(x => x.scene == game.scenes.active)[0];
            if (!token)
                return;
            position = token.center;
        }
        if (position)
            await canvas.animatePan(position);
    }
    static entranceMovesEnabled() {
        const setting = game.settings.get("city-of-mist", "execEntranceMoves");
        return setting != "none";
    }
    static autoExecEntranceMoves() {
        const setting = game.settings.get("city-of-mist", "execEntranceMoves");
        return setting == "auto";
    }
    static statusTierToBoxes(tier, pips = 0) {
        while (tier > 0) {
            pips += Math.max(--tier, 1);
        }
        return pips;
    }
    static statusBoxesToTiers(boxes) {
        let pips = boxes;
        let tier = 0;
        while (pips >= tier && pips > 0) {
            pips -= Math.max(tier++, 1);
        }
        if (tier == 0)
            pips = 0;
        return { pips, tier };
    }
    static getMaxWeaknessTags() {
        return CitySettings.get("maxWeaknessTags").valueOf() ?? 999;
    }
    static getRollCap() {
        return CitySettings.get("maxRollCap").valueOf();
    }
    static delay(time) {
        return new Promise(resolve => setTimeout(resolve, time));
    }
    static async _statusAddSubDialog(status, title, _type = "addition") {
        const templateData = { status, data: status.system };
        const html = await renderTemplate("systems/city-of-mist/templates/dialogs/status-addition-dialog.html", templateData);
        return new Promise((conf, _reject) => {
            const options = {};
            const returnfn = function (html, tier) {
                conf({
                    name: $(html).find(".status-name-input").val(),
                    tier
                });
            };
            const dialog = new Dialog({
                title: `${title}`,
                content: html,
                buttons: {
                    cancel: {
                        label: "Cancel",
                        callback: () => conf(null)
                    },
                    one: {
                        label: "1",
                        callback: (html) => returnfn(html, 1)
                    },
                    two: {
                        label: "2",
                        callback: (html) => returnfn(html, 2)
                    },
                    three: {
                        label: "3",
                        callback: (html) => returnfn(html, 3)
                    },
                    four: {
                        label: "4",
                        callback: (html) => returnfn(html, 4)
                    },
                    five: {
                        label: "5",
                        callback: (html) => returnfn(html, 5)
                    },
                    six: {
                        label: "6",
                        callback: (html) => returnfn(html, 6)
                    },
                },
                default: "cancel"
            }, options);
            dialog.render(true);
        });
    }
    static async sendToChatBox(title, text, options = {}) {
        const label = options?.label ?? localize("CityOfMist.command.send_to_chat");
        const render = options?.disable ? (...args) => {
            console.log("Trying to disable");
            $(args[2]).find(".one").prop('disabled', true).css("opacity", 0.5);
        } : () => 0;
        let sender = options?.speaker ?? {};
        if (!sender?.alias && sender.actor) {
            sender.alias = sender.actor.getDisplayedName();
        }
        return new Promise((conf, _rej) => {
            const options = {};
            let dialog = new Dialog({
                title: `${title}`,
                content: text,
                buttons: {
                    one: {
                        icon: '<i class="fas fa-check"></i>',
                        label: label,
                        callback: async () => conf(CityHelpers.sendToChat(text, sender)),
                    },
                    two: {
                        icon: '<i class="fas fa-times"></i>',
                        label: localize("CityOfMist.command.cancel"),
                        callback: async () => conf(null)
                    }
                },
                default: "two",
                render
            }, options);
            dialog.render(true);
        });
    }
    static async GMMoveTextBox(title, text, options = {}) {
        CityDialogs.GMMoveTextBox(title, text, options);
    }
    static gmReviewEnabled() {
        if (!game.users.contents.some(x => x.isGM && x.active))
            return false;
        return game.settings.get('city-of-mist', "tagReview") ?? false;
    }
    static sceneTagWindowEnabled() {
        const setting = game.settings.get('city-of-mist', "sceneTagWindow");
        return setting != "none" ?? false;
    }
    static sceneTagWindowFilterEmpty() {
        const setting = game.settings.get('city-of-mist', "sceneTagWindow");
        return setting == "omitEmpty" ?? false;
    }
    static altPowerEnabled() {
        return game.settings.get('city-of-mist', "altPower") ?? false;
    }
    static async toggleTokensCombatState(tokens) {
        for (const token of tokens) {
            if (token.inCombat)
                await this.removeTokensFromCombat([token]);
            else
                await this.addTokensToCombat([token]);
        }
    }
    static async addTokensToCombat(tokens) {
        const combat = await this.getOrCreateCombat();
        const createData = tokens.map(t => {
            return {
                tokenId: t.id,
                sceneId: t.scene.id,
                actorId: t.document.actorId,
                hidden: t.document.hidden
            };
        });
        return combat.createEmbeddedDocuments("Combatant", createData);
    }
    static async removeTokensFromCombat(tokens) {
        const combat = await this.getOrCreateCombat();
        const tokenIds = new Set(tokens.map(t => t.id));
        const combatantIds = combat.combatants.contents.reduce((ids, c) => {
            if (tokenIds.has(c.tokenId))
                ids.push(c.id);
            return ids;
        }, []);
        return combat.deleteEmbeddedDocuments("Combatant", combatantIds);
    }
    static async getOrCreateCombat() {
        //@ts-ignore
        let combat = game.combats.viewed;
        if (!combat) {
            if (game.user.isGM) {
                //@ts-ignore
                const cls = getDocumentClass("Combat");
                const state = false;
                combat = await cls.create({ scene: canvas.scene.id, active: true }, { render: !state });
            }
            else {
                //@ts-ignore
                ui.notifications.warn("COMBAT.NoneActive", { localize: true });
                throw new Error("No combat active");
            }
        }
        return combat;
    }
    static async toggleCombat(event) {
        const tokenId = HTMLTools.getClosestData(event, "tokenId");
        if (!tokenId)
            throw new Error("No token ID given");
        // const sceneId = HTMLTools.getClosestData(event, "sceneId");
        // const token = game.scenes.active.tokens.get(tokenId);
        const token = game.scenes.contents
            .flatMap(sc => sc.tokens)
            .find(tokens => tokens.get(tokenId))
            .get(tokenId);
        if (!token)
            throw new Error(`Can't find token id ${tokenId}`);
        await CityHelpers.toggleTokensCombatState([token.object]);
        if (token.inCombat)
            await CityHelpers.playTagOn();
        else
            await CityHelpers.playTagOff();
    }
    static async resetVersion() {
        await CitySettings.set("version", "");
    }
} //end of class
