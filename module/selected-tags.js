import { localize } from "./city.js";
import { HTMLTools } from "./tools/HTMLTools.js";
import { CityHelpers } from "./city-helpers.js";
export class SelectedTagsAndStatus {
    static _playerActivatedStuff = [];
    static clearAllActivatedItems() {
        this._playerActivatedStuff = [];
        Hooks.callAll("TagOrStatusSelectChange");
    }
    /** returns -1, 0, 1 for which direction activateabley is set in
    */
    static toggleSelectedItem(tagOrStatus, direction = 1) {
        const item = this._playerActivatedStuff.find(x => x.id == tagOrStatus.id && x.tokenId == tagOrStatus.parent.tokenId);
        if (item) {
            if (item.amount * direction >= 0) { //tests if sign of these is the same
                this.removeSelectedItem(tagOrStatus.id, tagOrStatus.parent.tokenId);
                return 0;
            }
            else {
                item.amount *= -1;
                return item.amount;
            }
        }
        else {
            if (this.activateSelectedItem(tagOrStatus, direction))
                return direction;
            else
                return null;
        }
    }
    static removeSelectedItem(tagOrStatusId, tokenId) {
        this._playerActivatedStuff = this._playerActivatedStuff.filter(x => !(x.id == tagOrStatusId && x.tokenId == tokenId));
        Hooks.callAll("TagOrStatusSelectChange");
    }
    static toActivatedTagFormat(tagOrStatus, direction = 1, amountUsed = 1) {
        const x = tagOrStatus;
        const tagOwner = tagOrStatus?.parent;
        const tokenId = tagOwner?.token?.id ?? "";
        const tag = x.type == "tag" ? tagOrStatus : null;
        let subtype = tag ? tag.system.subtype : "";
        subtype = tagOrStatus.type == "juice" && direction > 0 ? "help" : subtype;
        subtype = tagOrStatus.type == "juice" && direction < 0 ? "hurt" : subtype;
        const base_amount = tagOrStatus.isStatus() ? tagOrStatus.system.tier : 1;
        const amount = direction * base_amount * Math.abs(amountUsed);
        const crispy = (tagOrStatus.system?.crispy || tagOrStatus.system?.temporary) ?? false;
        return {
            name: x.displayedName,
            id: x.id,
            amount,
            ownerId: tagOwner?.id ?? "",
            tagId: tag ? x.id : "",
            type: (tagOrStatus.system.type == "status" && tagOrStatus.system.specialType == "collective") ? "modifier" : x.type,
            description: tag ? tag.system.description : "",
            subtype,
            strikeout: false,
            review: "pending",
            tokenId,
            crispy
        };
    }
    static activateSelectedItem(tagOrStatus, direction = 1, amountUsed = 1) {
        const newItem = SelectedTagsAndStatus.toActivatedTagFormat(tagOrStatus, direction);
        const noInterruptions = Hooks.call("preTagOrStatusSelected", tagOrStatus, direction, amountUsed);
        if (noInterruptions) {
            this._playerActivatedStuff.push(newItem);
            Hooks.callAll("TagOrStatusSelected", tagOrStatus, direction, amountUsed);
            return true;
        }
        return false;
    }
    /** returns shorthand version of tags and statuses
    */
    static getPlayerActivatedTagsAndStatus() {
        //TODO: return only valid tags and status (not on deleted tokens)
        return this._playerActivatedStuff
            .filter(({ id, ownerId, tokenId, type }) => {
            try {
                const owner = CityHelpers.getOwner(ownerId, tokenId);
                if (!owner)
                    return false;
                if (tokenId) {
                    const found = game.scenes
                        .find((scene) => scene.tokens.contents
                        .some(token => token.id == tokenId));
                    if (!found)
                        return false;
                }
                const tagsAndStatuses = owner.getTags().concat(owner.getStatuses());
                return tagsAndStatuses.some(x => x.id == id && !x.isBurned());
            }
            catch (e) {
                console.warn(`Couldn't verify ${type} tag on ${id}`);
                // Debug({id, ownerId, tokenId, type, subtype});
                return false;
            }
        });
    }
    /** returns full foundry objects for tags and statuses
    */
    static getPlayerActivatedTagsAndStatusItems() {
        return this.getPlayerActivatedTagsAndStatus()
            .map(tagShortHand => this.resolveTagAndStatusShorthand(tagShortHand));
    }
    static resolveTagAndStatusShorthand({ id, ownerId, tokenId }) {
        return CityHelpers.getOwner(ownerId, tokenId).getItem(id);
    }
    static fullTagOrStatusToShorthand(tag) {
        return {
            id: tag.id,
            ownerId: tag.parent?.id ?? "",
            tokenId: tag?.parent?.token?.id ?? "",
            type: tag.type,
            amount: 1,
        };
    }
    static getDefaultTagDirection(tag, tagowner, _actor) {
        const subtype = tag?.system?.subtype;
        try {
            switch (subtype) {
                case "power": return 1;
                case "story":
                    if (tagowner.type == "character")
                        return 1;
                    break;
                case null: throw new Error(`Resolution Error subtype ${subtype}, tag name: ${tag?.name}, owner: ${tagowner}`);
                case "loadout":
                    return 1;
                case "weakness":
                    return -1;
                default:
                    subtype;
                    return -1;
            }
        }
        catch (e) {
            // Debug(tag);
            // Debug(tagowner);
            console.warn(e);
        }
        return -1;
    }
    static activateTag(tag, direction = 1) { return this.activateSelectedItem(tag, direction); }
    static activateStatus(status, direction = 1) { return this.activateSelectedItem(status, direction); }
    static async selectTagHandler_invert(event) {
        return await SelectedTagsAndStatus._selectTagHandler(event, true);
    }
    static async selectTagHandler(event) {
        return await SelectedTagsAndStatus._selectTagHandler(event, false);
    }
    static async _selectTagHandler(event, invert = false) {
        const id = HTMLTools.getClosestData(event, "tagId");
        const tagownerId = HTMLTools.getClosestData(event, "ownerId");
        const tokenId = HTMLTools.getClosestData(event, "tokenId");
        const sceneId = HTMLTools.getClosestData(event, "sceneId");
        const owner = CityHelpers.getOwner(tagownerId, tokenId, sceneId);
        if (!owner)
            throw new Error(`Owner not found for tagId ${id}, token: ${tokenId}`);
        const tag = owner.getTag(id);
        if (!tag) {
            throw new Error(`Tag ${id} not found for owner ${owner.name} (sceneId: ${sceneId}, token: ${tokenId})`);
        }
        if (tag.system.subtype == "loadout" && !tag.system.activated_loadout) {
            const msg = localize("General.error.LOTagNotLoaded");
            ui.notifications.notify(msg);
            return;
        }
        let direction = this.getDefaultTagDirection(tag, owner);
        if (invert)
            direction *= -1;
        const activated = this.toggleSelectedItem(tag, direction);
        if (activated === null)
            return;
        //@ts-ignore
        const html = $(event.currentTarget);
        html.removeClass("positive-selected");
        html.removeClass("negative-selected");
        if (activated != 0) {
            CityHelpers.playTagOn();
            if (activated > 0)
                html.addClass("positive-selected");
            else
                html.addClass("negative-selected");
        }
        else {
            CityHelpers.playTagOff();
        }
    }
    static async selectStatusHandler_invert(event) {
        return await SelectedTagsAndStatus._statusSelect(event, true);
    }
    static async selectStatusHandler(event) {
        return await SelectedTagsAndStatus._statusSelect(event, false);
    }
    static async _statusSelect(event, invert = false) {
        const id = HTMLTools.getClosestData(event, "statusId");
        const tagownerId = HTMLTools.getClosestData(event, "ownerId");
        const tokenId = HTMLTools.getClosestData(event, "tokenId");
        const sceneId = HTMLTools.getClosestData(event, "sceneId");
        if (!tagownerId || tagownerId.length < 0)
            console.warn(`No ID for status owner : ${tagownerId}`);
        let direction = -1;
        if (invert)
            direction *= -1;
        const owner = CityHelpers.getOwner(tagownerId, tokenId, sceneId);
        const status = owner.getStatus(id);
        if (!status) {
            console.error(`Couldn't find status ${id}`);
            return;
        }
        const activated = SelectedTagsAndStatus.toggleSelectedItem(status, direction);
        if (activated === null)
            return;
        //@ts-ignore
        const html = $(event.currentTarget);
        html.removeClass("positive-selected");
        html.removeClass("negative-selected");
        if (activated != 0) {
            if (activated > 0)
                html.addClass("positive-selected");
            else
                html.addClass("negative-selected");
            await CityHelpers.playTagOn();
        }
        else {
            await CityHelpers.playTagOff();
        }
    }
    static getActivatedDirection(tagId, tokenId) {
        const amount = SelectedTagsAndStatus.getPlayerActivatedTagsAndStatus().find(x => x.id == tagId && x.tokenId == tokenId)?.amount ?? 0;
        if (amount > 0)
            return 1;
        if (amount < 0)
            return -1;
        return 0;
    }
}
//@ts-ignore
window.SelectedTagsAndStatus = SelectedTagsAndStatus;
