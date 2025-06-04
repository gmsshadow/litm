import { CityItem } from "./city-item.js";
import { localizeS } from "./tools/handlebars-helpers.js";
import { localize } from "./city.js";
import { HTMLTools } from "./tools/HTMLTools.js";
import { CityDialogs } from "./city-dialogs.js";
import { DragAndDrop } from "./dragAndDrop.js";
import { CityHelpers } from "./city-helpers.js";
import { CityDB } from "./city-db.js";
export class CitySheet extends ActorSheet {
    scrollTop = 0;
    flipped = [false, false, false, false, false, false, false, false];
    /* -------------------------------------------- */
    async getData() {
        await CityDB.waitUntilLoaded();
        let data = await super.getData();
        data.items = this.actor.items.contents.map(x => x);
        return data;
    }
    /** @override */
    activateListeners(html) {
        super.activateListeners(html);
        if (!this.options.editable)
            return;
        html.find(".item-create-theme").on("click", this._addThemeBook.bind(this));
        html.find(".add-theme").on("click", this._addThemeBook.bind(this));
        html.find(".edit-themekit").on("click", this._editThemeKit.bind(this));
        html.find(".edit-themebook").on("click", this._editThemeBook.bind(this));
        html.find('.sheet-lock-button').on("click", this._toggleLockState.bind(this));
        html.scroll(this._scrollSheet.bind(this));
        DragAndDrop.addDragFunctionality(html);
        html.on("drop", this._dragDropEvent.bind(this));
        html.find('.flip-button').on("click", this.#flipCard.bind(this));
        //Restore Scroll positon
        if (this.scrollTop)
            html.scrollTop(this.scrollTop);
    }
    /* -------------------------------------------- */
    async _onDropItem(_event, o) {
        //@ts-ignore
        const item = await Item.implementation.fromDropData(o);
        switch (item.system.type) {
            case "themekit":
                const choice = await this.getCreationLocation();
                if (!choice)
                    break;
                await this.actor.addThemeKit(item, choice == "extra");
                break;
            case "themebook":
                const tb = await super._onDropItem(_event, o);
                if (tb && tb[0] && tb[0] instanceof CityItem) {
                    const choice = await this.getCreationLocation();
                    if (!choice) {
                        break;
                    }
                    await this.actor.createNewTheme("Unnamed Theme", tb[0], choice == "extra");
                    return tb[0];
                }
                break;
            default:
                console.log("Unsupported Drop Type: ${item.system.type}");
                break;
        }
    }
    async getCreationLocation() {
        if (this.actor.type != "character")
            return "main";
        const choices = [
            { id: "main", data: [localize("CityOfMist.terms.mainTheme")] },
            { id: "extra", data: [localize("CityOfMist.terms.extra")] },
        ];
        const choice = await HTMLTools.singleChoiceBox(choices, "Choose");
        switch (choice) {
            case "main":
            case "extra":
                return choice;
            default:
                return undefined;
        }
    }
    async _toggleLockState(_event) {
        // const actorId = HTMLTools.getClosestData(event, "ownerId");
        // const actor = await this.getOwner(actorId);
        const actor = this.actor;
        await actor.toggleLockState();
    }
    async _editThemeKit(event) {
        event.stopImmediatePropagation();
        const themeId = HTMLTools.getClosestData(event, "themeId");
        const ownerId = HTMLTools.getClosestData(event, "ownerId");
        // const TKId = HTMLTools.getClosestData(event, "tkId");
        const owner = this.getOwner(ownerId);
        const theme = owner.getTheme(themeId);
        const tk = theme.themebook;
        if (!tk)
            throw new Error(`Can't find Themekit for ${theme.displayedName}`);
        if (!tk.isThemeKit()) {
            ui.notifications.error("THeme kit isn't a theme kit");
            return;
        }
        // const tk = this.actor.getThemeKit(TKId);
        if (this.actor.type != "character" && !game.user.isGM) {
            const msg = localize("CityOfMist.error.MCEditOnly");
            ui.notifications.warn(msg);
            return;
        }
        await CityDialogs.itemEditDialog(tk);
    }
    async _editThemeBook(event) {
        event.stopPropagation();
        const themeId = HTMLTools.getClosestData(event, "themeId");
        const ownerId = HTMLTools.getClosestData(event, "ownerId");
        const owner = this.getOwner(ownerId);
        const theme = owner.getTheme(themeId);
        const tkOrTB = theme.themebook;
        if (!tkOrTB)
            return;
        switch (tkOrTB.system.type) {
            case "themebook":
                return CityDialogs.itemEditDialog(tkOrTB);
            case "themekit":
                const tb = tkOrTB.themebook;
                if (!tb)
                    return;
                return CityDialogs.itemEditDialog(tb);
            default:
                tkOrTB.system;
        }
    }
    async _addThemeBook(_event) {
        // const themebook = await this.themeBookSelector();
        const themebook = await CityDialogs.themeBookSelector(this.actor);
        if (themebook)
            await this.actor.createNewTheme("Unnamed Theme", themebook);
    }
    async _scrollSheet(_event) {
        this.scrollTop = $(".actor-sheet").scrollTop() ?? 0;
    }
    async confirmBox(title, text, options = {}) {
        const loc_title = localizeS(title);
        return await HTMLTools.confirmBox(loc_title, text, options);
    }
    themeDeleteChoicePrompt(themename) {
        return new Promise((conf, _rej) => {
            const options = {};
            let dialog = new Dialog({
                title: `Destroy ${themename}`,
                content: `Destroy ${themename}`,
                buttons: {
                    one: {
                        label: localize("CityOfMist.dialog.actorSheet.deleteTheme.option.0"),
                        callback: () => conf("delete")
                    },
                    two: {
                        label: localize("CityOfMist.dialog.actorSheet.deleteTheme.option.1"),
                        callback: () => conf("replace")
                    },
                    cancel: {
                        label: localize("CityOfMist.dialog.actorSheet.deleteTheme.option.2"),
                        callback: () => conf(null)
                    }
                },
                default: "two",
            }, options);
            dialog.render(true);
        });
    }
    async sendToChatBox(title, text, options = {}) {
        return CityHelpers.sendToChatBox(title, text, options);
    }
    async _dragDropEvent(_event) {
        const dragging = $(document).find(".dragging");
        if (dragging.length != 1) {
            console.warn("Something went wrong with dragging");
            return;
        }
        const actor = this.actor;
        DragAndDrop.dropDraggableOnActor(dragging, actor);
    }
    /** returns the owner of the given id, tokenId and sceneId
    @return {CityActor}
    */
    getOwner(id, tokenId, sceneId) {
        if (!id || id == this.actor.id)
            return this.actor;
        else
            return CityHelpers.getOwner(id, tokenId, sceneId);
    }
    async #flipCard(event) {
        const cardId = Number(HTMLTools.getClosestData(event, "cardId"));
        if (Number.isNaN(cardId))
            throw new Error("Coudlkn't get card Id to flip!");
        const flipElement = $(event.currentTarget).closest(".flip-card-inner");
        if (flipElement.hasClass("flipped")) {
            flipElement.removeClass("flipped");
        }
        else {
            flipElement.addClass("flipped");
        }
        this.flipped[cardId] = !this.flipped[cardId];
    }
}
