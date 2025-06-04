import { localizeS } from "./tools/handlebars-helpers.js";
import { HTMLTools } from "./tools/HTMLTools.js";
import { localize } from "./city.js";
import { CityDialogs } from "./city-dialogs.js";
import { CityHelpers } from "./city-helpers.js";
import { CitySheet } from "./city-sheet.js";
import { HTMLHandlers } from "./universal-html-handlers.js";
import { CitySettings } from "./settings.js";
export class CityActorSheet extends CitySheet {
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["city", "sheet", "actor"],
            template: "systems/city-of-mist/templates/actor-sheet.html",
            width: 990,
            height: 1070,
            tabs: [{ navSelector: ".tabs", contentSelector: ".sheet-body", initial: "themes" }]
        });
    }
    /** @override */
    activateListeners(html) {
        super.activateListeners(html);
        if (!this.options.editable)
            return;
        //Everything below here is only needed if the sheet is editable
        HTMLHandlers.applyBasicHandlers(html);
        html.find('.theme-name-input').on("change", this._themebookNameInput.bind(this));
        html.find('.theme-name-input').on("focusout", this._themebookNameInput.bind(this));
        html.find('.theme-create-power-tag').on("click", this._createTagOrImprovement.bind(this));
        html.find('.theme-create-weakness-tag').on("click", this._createTagOrImprovement.bind(this));
        html.find('.theme-create-bonus-tag').on("click", this._createBonusTag.bind(this));
        html.find('.theme-create-improvement').on("click", this._createTagOrImprovement.bind(this));
        html.find('.imp-delete').on("click", this._deleteImprovement.bind(this));
        html.find('.theme-delete').on("click", this._deleteTheme.bind(this));
        html.find('.theme-add-attention').on("click", this._addAttentionOrFade.bind(this));
        html.find('.theme-remove-attention').on("click", this._removeAttentionOrFade.bind(this));
        html.find('.theme-add-fade').on("click", this._addAttentionOrFade.bind(this));
        html.find('.theme-remove-fade').on("click", this._removeAttentionOrFade.bind(this));
        html.find('.improvement-name').on("click", this._sendImprovementToChat.bind(this));
        html.find('.improvement-edit').on("click", this._improvementEdit.bind(this));
        html.find('.theme-reset-fade').on("click", this._resetFade.bind(this));
        html.find('.motivation-input').on("change", this._themeChangeInput.bind(this));
        html.find('.active-extra-drop-down').on("change", this._activeExtraChange.bind(this));
        html.find('.status-text-list-header').middleclick(this._createStatus.bind(this));
        html.find('.create-clue').on("click", this._createClue.bind(this));
        html.find('.clue-delete').on("click", this._deleteClue.bind(this));
        html.find('.clue-journal-delete').on("click", this._deleteJournalClue.bind(this));
        html.find('.create-juice').on("click", this._createJuice.bind(this));
        html.find('.juice-delete').on("click", this._deleteJuice.bind(this));
        html.find('.create-help').on("click", this._createHelp.bind(this));
        html.find('.create-hurt').on("click", this._createHurt.bind(this));
        html.find('.clue-name').on("click", this._clueEdit.bind(this));
        html.find('.clue-name').middleclick(this._clueEdit.bind(this));
        html.find('.juice-name').on("click", this._juiceEdit.bind(this));
        html.find('.juice-name').middleclick(this._juiceEdit.bind(this));
        html.find('.story-tags-header').middleclick(this._createStoryTag.bind(this));
        html.find('.clue-use-button').on("click", this._useClue.bind(this));
        // this.testHandlers(html);
    }
    async getData() {
        let data = await super.getData();
        data.storyTags = this.getStoryTags();
        const object = {
            secrets: this.actor.isOwner,
            async: true,
            relativeTo: this.actor
        };
        data.gmnotes = await TextEditor.enrichHTML(this.actor.system.gmnotes, object);
        data.description = await TextEditor.enrichHTML(this.actor.system.description, object);
        data.biography = await TextEditor.enrichHTML(this.actor.system.biography, object);
        return data;
    }
    getPersonalStoryTags() {
        return this.actor.getStoryTags();
    }
    getStoryTags() {
        return this.getPersonalStoryTags();
    }
    /* -------------------------------------------- */
    /** override */
    get template() {
        if (!game.user.isGM && this.actor.limited)
            return "systems/city-of-mist/templates/limited-actor.html";
        return this.options.template;
    }
    async _themeChangeInput(event) {
        const id = HTMLTools.getClosestData(event, "themeId");
        const field = HTMLTools.getClosestData(event, "property");
        const val = $(event.currentTarget).val();
        const actorId = HTMLTools.getClosestData(event, "ownerId");
        const actor = this.getOwner(actorId);
        const theme = actor.getTheme(id);
        if (!theme) {
            throw new Error(`Can't find Theme: ${id}`);
        }
        await theme.setField(field, val);
    }
    async _themebookNameInput(event) {
        const id = HTMLTools.getClosestData(event, "themeId");
        const name = $(event.currentTarget).val();
        const actorId = HTMLTools.getClosestData(event, "ownerId");
        const actor = this.getOwner(actorId);
        const theme = actor.getTheme(id);
        if (!theme) {
            throw new Error(`Can't find Theme: ${id}`);
        }
        await theme.update({ name });
    }
    async _createTagOrImprovement(event, bonus = false) {
        //TODO: allow for text string attachment to improvements
        const ownerId = HTMLTools.getClosestData(event, "ownerId");
        const owner = this.getOwner(ownerId);
        const themeId = HTMLTools.getClosestData(event, "themeId");
        const itemtype = HTMLTools.getClosestData(event, "itemType");
        const subtype = HTMLTools.getClosestData(event, "subType", null);
        if (itemtype != "tag" && itemtype != "improvement") {
            throw new Error(`Bad Item type: ${itemtype}`);
        }
        const theme = owner.getTheme(themeId);
        if (subtype != null && subtype != "power" && subtype != "weakness") {
            throw new Error(`Bad subtype: ${subtype}`);
        }
        let idChoice = null;
        if (!theme) {
            throw new Error(`Can't find Theme: ${themeId}`);
        }
        if (!bonus) {
            idChoice = await CityDialogs.improvementOrTagChoiceList(owner, theme, itemtype, subtype ? subtype : undefined);
            if (idChoice == null)
                return;
        }
        let retobj = null;
        let improvement;
        if (itemtype == "tag") {
            const subtype = bonus ? "bonus" : HTMLTools.getClosestData(event, "subType");
            const awardImprovement = subtype == "weakness"
                && theme.weaknessTags.length >= 1
                ? (CitySettings.autoAwardImpForWeakness()
                    || await HTMLTools.confirmBox(localize("CityOfMist.dialog.addTag.confirmExtraImprovementOnWeakness.title"), localize("CityOfMist.dialog.addTag.confirmExtraImprovementOnWeakness.body"), { onClose: "reject" })) : false;
            const options = {
                awardImprovement
            };
            const subLower = subtype.toLowerCase();
            switch (subLower) {
                case "power":
                case "weakness":
                case "bonus":
                    retobj = await owner.addTag(themeId, subLower, idChoice, options);
                    break;
                default:
                    throw new Error(`Subtype ${subtype} not recognized`);
            }
        }
        else {
            retobj = await owner.addImprovement(themeId, Number(idChoice));
            improvement = owner.getImprovement(retobj.id);
            await this.improvementDialog(improvement);
            await CityHelpers.modificationLog(owner, "Created", improvement);
            return;
        }
    }
    async _createBonusTag(event) {
        await this._createTagOrImprovement(event, true);
    }
    async _deleteTag(event) {
        await HTMLHandlers.deleteTag(event);
    }
    async _deleteImprovement(event) {
        const actorId = HTMLTools.getClosestData(event, "ownerId");
        const actor = this.getOwner(actorId);
        const impId = HTMLTools.getClosestData(event, "impId");
        if (!impId)
            throw new Error("No improvement Id");
        const imp = actor.getImprovement(impId);
        const impName = imp.name;
        if (await this.confirmBox("Confirm Delete", `Delete ${impName}`)) {
            await actor.deleteImprovement(impId);
            await CityHelpers.modificationLog(actor, `Deleted`, imp);
        }
    }
    async tagDialog(obj) {
        return await CityHelpers.itemDialog(obj);
    }
    async improvementDialog(obj) {
        return await CityHelpers.itemDialog(obj);
    }
    async _improvementEdit(event) {
        const id = HTMLTools.getClosestData(event, "impId");
        const actorId = HTMLTools.getClosestData(event, "ownerId");
        const owner = this.getOwner(actorId);
        const imp = owner.getImprovement(id);
        if (!imp.system.chosen)
            await imp.reloadImprovementFromCompendium();
        await this.improvementDialog(imp);
    }
    async _deleteTheme(event) {
        const themeId = HTMLTools.getClosestData(event, "themeId");
        const actorId = HTMLTools.getClosestData(event, "ownerId");
        const actor = this.getOwner(actorId);
        const theme = actor.getTheme(themeId);
        const themeName = theme.name;
        if (actor.isNewCharacter()) {
            if (await this.confirmBox("Confirm Delete", `Delete Theme ${themeName}`)) {
                await actor.deleteTheme(themeId, false);
                await CityHelpers.modificationLog(actor, "Deleted", theme);
            }
        }
        else {
            let ret;
            if (ret = await this.themeDeleteChoicePrompt(themeName)) {
                switch (ret) {
                    case "replace":
                        await actor.deleteTheme(themeId, true);
                        break;
                    case "delete":
                        if (await this.confirmBox(localize("CityOfMist.dialog.actorSheet.deleteTheme.title"), localize("CityOfMist.dialog.actorSheet.deleteTheme.title"))) {
                            await actor.deleteTheme(themeId, false);
                        }
                        break;
                    default:
                        return true;
                }
            }
        }
    }
    async _burnTag(event) {
        await HTMLHandlers.burnTag(event);
    }
    async _unburnTag(event) {
        await HTMLHandlers.unburnTag(event);
    }
    async _addAttentionOrFade(event) {
        const id = HTMLTools.getClosestData(event, "themeId");
        const type = HTMLTools.getClosestData(event, "type");
        const actorId = HTMLTools.getClosestData(event, "ownerId");
        const actor = this.getOwner(actorId);
        // const theme =  actor.getTheme(id)!;
        // const themeName = theme.name;
        switch (type) {
            case "attention":
                await actor.addAttention(id);
                break;
            case "crack":
                await actor.addFade(id);
                break;
            default:
                throw new Error(`Unrecognized Type ${type}`);
        }
    }
    async _removeAttentionOrFade(event) {
        const id = HTMLTools.getClosestData(event, "themeId");
        const type = HTMLTools.getClosestData(event, "type");
        const actorId = HTMLTools.getClosestData(event, "ownerId");
        const actor = this.getOwner(actorId);
        // const theme =  actor.getTheme(id)!;
        switch (type) {
            case "attention":
                await actor.removeAttention(id);
                break;
            case "crack":
                await actor.removeFade(id);
                break;
            default:
                throw new Error(`Unrecognized Type ${type}`);
        }
    }
    async _resetFade(event) {
        const id = HTMLTools.getClosestData(event, "themeId");
        const actorId = HTMLTools.getClosestData(event, "ownerId");
        const actor = this.getOwner(actorId);
        const theme = actor.getTheme(id);
        const themename = theme.name;
        if (await HTMLTools.confirmBox("Reset Fade", `spend an improvement to reset Fade/Crack on theme: ${themename}`)) {
            actor.resetFade(id);
            await CityHelpers.modificationLog(actor, `Spent Theme Upgrade to Reset Fade`, theme);
        }
    }
    async _sendImprovementToChat(event) {
        const impId = HTMLTools.getClosestData(event, "impId");
        const actorId = HTMLTools.getClosestData(event, "ownerId");
        const actor = this.getOwner(actorId);
        const imp = actor.getImprovement(impId);
        const impName = imp.name;
        const templateData = { improvement: imp, data: imp.system };
        const html = await renderTemplate("systems/city-of-mist/templates/improvement-chat-description.html", templateData);
        const uses = imp.getImprovementUses();
        const uses_str = (uses < 9999) ? `(uses left ${uses})` : "";
        const disable = (uses <= 0);
        const options = {
            label: `${localize("CityOfMist.command.use")} ${uses_str}`,
            disable,
            speaker: { actor: this.actor, alias: this.actor.getDisplayedName() }
        };
        if (await this.sendToChatBox(localizeS(impName), html, options)) {
            if (uses < 9999)
                await imp.decrementImprovementUses();
        }
    }
    async _activeExtraChange(_event) {
        if (this.actor.system.type != "character")
            return;
        const elem = $(this.form).find('.active-extra-drop-down');
        const val = elem.val();
        if (val == undefined)
            throw new Error("value is undefined!");
        if (this.actor.system.activeExtraId != val) {
            await this.actor.setExtraThemeId(String(val));
            const extra = game.actors.find(x => x.id == val);
            // const name  = extra ? extra.name : "None";
            if (extra)
                await CityHelpers.modificationLog(this.actor, `Activated Extra ${extra.name}`);
            else
                await CityHelpers.modificationLog(this.actor, `deactivated extra Theme`);
        }
    }
    async _createStatus(_event) {
        const owner = this.actor;
        const obj = await this.actor.createNewStatus("Unnamed Status");
        const status = owner.getStatus(obj.id);
        const updateObj = await this.statusDialog(status);
        if (updateObj) {
            CityHelpers.modificationLog(owner, "Created", updateObj, `tier  ${updateObj.system.tier}`);
        }
        else {
            await owner.deleteStatus(obj.id);
        }
    }
    async _deleteStatus(event, autodelete = false) {
        await HTMLHandlers.deleteStatus(event, autodelete);
    }
    async _createClue(_event) {
        const owner = this.actor;
        const obj = await this.actor.createNewClue({ name: "Unnamed Clue" });
        const clue = owner.getClue(obj.id);
        const updateObj = await this.CJDialog(clue);
        if (updateObj) {
            const partialstr = clue.system.partial ? ", partial" : "";
            CityHelpers.modificationLog(owner, "Created", clue, `${clue.system.amount}${partialstr}`);
        }
        else {
            await owner.deleteClue(obj.id);
        }
    }
    async _deleteClue(event) {
        event.stopPropagation();
        const clue_id = HTMLTools.getClosestData(event, "clueId");
        const actorId = HTMLTools.getClosestData(event, "ownerId");
        const owner = this.getOwner(actorId);
        const clue = owner.getClue(clue_id);
        await owner.deleteClue(clue_id);
        CityHelpers.modificationLog(owner, "Removed", clue);
        // }
    }
    async _deleteJournalClue(event) {
        const clue_id = HTMLTools.getClosestData(event, "clueId");
        const actorId = HTMLTools.getClosestData(event, "ownerId");
        const owner = this.getOwner(actorId);
        // const clue =  owner.getJournalClue(clue_id);
        await owner.deleteClue(clue_id);
        // CityHelpers.modificationLog(owner, "Removed", clue );
    }
    async _createJuice(_event) {
        return await this._createJuiceOfType("Unnamed Juice");
    }
    async _createHelp(_event) {
        return await this._createJuiceOfType("Help", "help");
    }
    async _createHurt(_event) {
        return await this._createJuiceOfType("hurt", "hurt");
    }
    async _createJuiceOfType(basename, subtype = "") {
        const owner = this.actor;
        const obj = await owner.createNewJuice(basename, subtype);
        const juice = owner.getJuice(obj.id);
        const updateObj = await this.CJDialog(juice);
        if (updateObj) {
            CityHelpers.modificationLog(owner, "Created", juice, `${juice.system.amount}`);
        }
        else {
            await owner.deleteJuice(obj.id);
        }
    }
    async _deleteJuice(event) {
        const juice_id = HTMLTools.getClosestData(event, "juiceId");
        const actorId = HTMLTools.getClosestData(event, "ownerId");
        const owner = this.getOwner(actorId);
        const juice = owner.getJuice(juice_id);
        await owner.deleteJuice(juice_id);
        CityHelpers.modificationLog(owner, "Removed", juice);
        // }
    }
    async _statusAdd(event) {
        //adds a second status to existing
        await HTMLHandlers.statusAdd(event);
    }
    async statusDrop({ name, tier }) {
        if (!tier)
            throw new Error(`Tier is not valid ${tier}`);
        const retval = await CityDialogs.statusDropDialog(this.actor, name, tier);
        if (retval == null)
            return null;
        switch (retval.action) {
            case 'create':
                const status = await this.actor.addOrCreateStatus(retval.name, retval.tier, retval.pips);
                await CityHelpers.modificationLog(this.actor, "Created", status, `tier  ${retval.tier}`);
                return status;
            case 'merge':
                const origStatus = this.actor.getStatus(retval.statusId);
                await origStatus.addStatus(retval.tier, retval.name);
                await HTMLHandlers.reportStatusAdd(this.actor, retval.tier, { name: origStatus.name, tier: origStatus.system.tier, pips: origStatus.system.pips }, origStatus);
                return origStatus;
            default:
                retval.action;
                throw new Error(`Unknown action : ${retval.action}`);
        }
    }
    async _statusSubtract(event) {
        return HTMLHandlers.statusSubtract(event);
    }
    async _statusEdit(event) {
        const status_id = HTMLTools.getClosestData(event, "statusId");
        const ownerId = HTMLTools.getClosestData(event, "ownerId");
        const owner = this.getOwner(ownerId);
        const status = owner.getStatus(status_id);
        const oldtier = status.system.tier;
        const oldpips = status.system.pips;
        const oldname = status.name;
        const updateObj = await this.statusDialog(status);
        if (updateObj) {
            const oldpipsstr = +oldpips ? `.${oldpips}` : "";
            const pipsstr = +status.system.pips ? `.${status.system.pips}` : "";
            CityHelpers.modificationLog(owner, "Edited", status, `${oldname}-${oldtier}${oldpipsstr} edited --> ${status.name}-${status.system.tier}${pipsstr})`);
        }
    }
    async _juiceEdit(event) {
        const juice_id = HTMLTools.getClosestData(event, "juiceId");
        const ownerId = HTMLTools.getClosestData(event, "ownerId");
        const owner = this.getOwner(ownerId);
        const juice = owner.getJuice(juice_id);
        const oldname = juice.name;
        const oldamount = juice.system.amount;
        const updateObj = await this.CJDialog(juice);
        if (updateObj) {
            CityHelpers.modificationLog(owner, "Edited", juice, `${oldname} (${oldamount}) edited --> ${updateObj.name} (${updateObj.system.amount})`);
        }
    }
    async _createStoryTag(_event) {
        const owner = this.actor;
        const retobj = await owner.createStoryTag();
        if (!retobj)
            return;
        const tag = owner.getTag(retobj.id);
        await this.tagDialog(tag);
        await CityHelpers.modificationLog(owner, "Created", tag);
    }
    async _useClue(event) {
        if (game.user.isGM) {
            ui.notifications.warn("only players can use clues");
            return;
        }
        const clue_id = HTMLTools.getClosestData(event, "clueId");
        const actorId = HTMLTools.getClosestData(event, "ownerId");
        const owner = this.getOwner(actorId);
        const clue = owner.getClue(clue_id);
        if (await this.confirmBox("Use Clue", "Use Clue?"))
            await clue.spendClue();
    }
    async _clueEdit(event) {
        const clue_id = HTMLTools.getClosestData(event, "clueId");
        const ownerId = HTMLTools.getClosestData(event, "ownerId");
        const owner = this.getOwner(ownerId);
        const clue = owner.getClue(clue_id);
        const oldname = clue.name;
        const oldamount = clue.system.amount;
        const updateObj = await this.CJDialog(clue);
        if (updateObj) {
            CityHelpers.modificationLog(owner, "Edited", clue, `${oldname} (${oldamount}) edited --> ${updateObj.name} (${updateObj.system.amount})`);
        }
    }
    async chooseImprovement() {
        const choiceList = ["Reset Fade", "Add New Tag", "Add Improvement"];
        const inputList = choiceList.map(x => {
            const data = [x];
            return {
                id: x, data
            };
        });
        const choice = await HTMLTools.singleChoiceBox(inputList, "Choose Item");
        switch (choice) {
            case "Reset Fate":
                throw new Error("Not Yet implemented");
            case "Add New Tag":
                throw new Error("Not Yet implemented");
            case "Add Improvement":
                throw new Error("Not Yet implemented");
            default:
                throw new Error(`Unrecognized choice ${choice}`);
        }
    }
    async statusDialog(obj) {
        return await CityHelpers.itemDialog(obj);
    }
    async CJDialog(obj) {
        return await CityHelpers.itemDialog(obj);
    }
}
