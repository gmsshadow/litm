import { SPECTRUM_VALUES } from "./datamodel/spectrum-values.js";
import { localize } from "./city.js";
import { CityActor } from "./city-actor.js";
import { HandlebarsHelpers } from "./tools/handlebars-helpers.js";
import { SelectedTagsAndStatus } from "./selected-tags.js";
import { CityHelpers } from "./city-helpers.js";
import { CitySettings } from "./settings.js";
export class CityHandlebarsHelpers extends HandlebarsHelpers {
    static getObject = function () {
        return {
            ...this._cityhelpers,
            ...HandlebarsHelpers.getObject()
        };
    };
    static _cityhelpers = {
        "getGMMoveTypes": function () {
            const data = [
                localize("CityOfMist.terms.soft"),
                localize("CityOfMist.terms.hard"),
                localize("CityOfMist.terms.intrusion"),
                localize("CityOfMist.terms.custom"),
                localize("CityOfMist.terms.enterScene"),
                // "Soft", "Hard", "Intrusion", "Custom", "Enter Scene"];
            ];
            return data.map(x => {
                return {
                    id: x.toLowerCase(),
                    name: x
                };
            });
        },
        'hasGMMoveOfType': function (actor, subtype) {
            return actor.gmmoves.some(x => x.type == "gmmove" && x.system.subtype == subtype && !x.system.superMoveId);
        },
        "displayAlias": (actor) => {
            return actor.getDisplayedName(); //might be easier
            // return game.actors.get(actor.id).getDisplayedName();
        },
        "isHelpHurt": (juice) => {
            return juice.isHelpHurt();
        },
        "helpHurtTarget": (juice) => {
            return juice.getTargetName();
        },
        "getHurtList": (actor) => {
            return actor.items.filter(i => i.isHurt());
        },
        "getHelpList": (actor) => {
            return actor.items.filter(i => i.isHelp());
        },
        "getJuiceList": (actor) => {
            return actor.juice.filter(x => !x.isHurt() && !x.isHelp());
            return actor.items.filter(i => i.isJuice());
        },
        "PCList": (_actor) => {
            return game.actors.filter(x => x.type == "character" && x.permission > 0);
        },
        "getHelpFor": (targetactor) => {
            return game.actors.filter(x => x.type == "character" &&
                x.items.find(i => i.isHelp() && i.getTarget() == targetactor)).map(x => x.items
                .filter(i => i.isHelp() && i.getTarget() == targetactor)
                .map(i => {
                return {
                    owner: x,
                    id: i.id,
                    amount: i.system.amount
                };
            })).flat();
        },
        "formatGMMoveText": (move, actor, showPrivate = false) => {
            const { html } = move.formatGMMoveText(actor, { showPrivate });
            return new Handlebars.SafeString(html);
        },
        'getDirection': function (tag) {
            const tagId = tag.id;
            const tokenId = tag?.parent?.tokenId;
            return SelectedTagsAndStatus.getActivatedDirection(tagId, tokenId);
        },
        'defaultTagDirection': function (_tagName, tagOwnerId, tagId, tokenId = null) {
            if (typeof tokenId == "object") {
                tokenId = null;
                //Fix for handlebars overcall with arguments
            }
            let tagowner;
            try {
                tagowner = CityHelpers.getOwner(tagOwnerId, tokenId ? tokenId : undefined);
            }
            catch (e) {
                console.log(`Trouble finding tag owner ${tagOwnerId}, tokenID = ${tokenId}`);
                console.log(e);
                return;
            }
            if (!tagowner) {
                console.warn("null tag owner passed into defualtTagDirection Handlebars helper");
            }
            if (tagowner?.documentName == "Scene") {
                return -1;
            }
            try {
                if (!(tagowner instanceof CityActor)) {
                    throw new Error("Tag owner is not an actor");
                }
                const tag = tagowner.items.find(x => x.id == tagId);
                return SelectedTagsAndStatus.getDefaultTagDirection(tag, tagowner);
            }
            catch (e) {
                throw e;
            }
        },
        'hasActivatedItem': function (tag) {
            const tagId = tag.id;
            const tokenId = tag?.parent?.tokenId;
            return SelectedTagsAndStatus.getPlayerActivatedTagsAndStatus().find(x => x.id == tagId && x.tokenId == tokenId);
        },
        'hasActivatedTag': function (_sheetownerId, _actorId, tagId, tokenId = null) {
            console.warn("hasActivatedTag is a deprecated helper, use hasActivatedItem instead");
            //TODO: actorId isn't used but is there for compatibility with older version
            return SelectedTagsAndStatus.getPlayerActivatedTagsAndStatus().find(x => x.id == tagId && x.tokenId == tokenId);
        },
        'devMode': function () {
            return CitySettings.isDevMode();
        },
        'isOldFormQuestion': function (question) {
            return typeof question == "string";
        },
        'showcasePossible': function (tagOrStatus) {
            if (!CityHelpers.sceneTagWindowEnabled())
                return false;
            const isTokenActor = !!tagOrStatus?.parent?.token;
            switch (tagOrStatus.system.type) {
                case "status":
                    return !isTokenActor;
                case "tag":
                    return !isTokenActor && tagOrStatus.isStoryTag();
                default:
                    return false;
            }
        },
        'shouldBurn': function (rollModifierType) {
            const modifier = rollModifierType;
            if (!modifier?.ownerId)
                return false;
            try {
                const { ownerId, id, tokenId } = modifier;
                const item = CityHelpers.getOwner(ownerId, tokenId).getItem(id);
                return item?.expendsOnUse() ?? false;
            }
            catch (e) {
                console.error(e);
                return false;
            }
        },
        'grantsAttention': function (rollModifierType) {
            const modifier = rollModifierType;
            if (modifier?.strikeout)
                return false;
            return modifier?.type == "tag"
                && modifier?.amount < 0
                && modifier?.subtype == "weakness";
        },
        'autoAttention': function () {
            if (CitySettings.awardAttentionForWeakness())
                return true;
            return false;
        },
        'getTBQuestion': function (tb, letter, type) {
            if (!type || typeof type != "string") {
                console.error(`Must provide type, type provided ${type}`);
                return "ERROR";
            }
            if (type != "power" && type != "weakness") {
                console.error(`type provided must be power or weakness, given: ${type}`);
                return "ERROR";
            }
            try {
                if (!tb)
                    throw new Error("No themebook provided");
                return tb.getQuestion(type, letter);
            }
            catch (e) {
                console.log(`Can't get question for ${this?.themebook?.name} ${type} ${letter}`);
                console.error(e);
                return "ERROR";
            }
        },
        'hasMist': function (actor) {
            return actor.getNumberOfThemes("Mist") >= 1;
        },
        'hasMythos': function (actor) {
            return actor.getNumberOfThemes("Mythos") >= 1;
        },
        'loadoutThemeEnabled': function () {
            return CitySettings.get("loadoutTheme");
        },
        'getLoadoutThemeName': function () {
            return CitySettings.getLoadoutThemeName();
        },
        'isUsingStoryList': function () {
            return CitySettings.sceneTagWindowUsed();
        },
        'eqStr': function (a, b) {
            if (!a)
                a = "";
            if (!b)
                b = "";
            if (typeof a != "string")
                a = String(a);
            if (typeof b != "string")
                b = String(b);
            return a == b;
        },
        'canTakeLoadoutWeakness': function (tag) {
            if (tag.system.subtype != "loadout")
                return false;
            if (tag.parent.loadout.tags().some(x => x.system.parentId == tag.id)) {
                return false;
            }
            return true;
        },
        'getThemePropertyName': function (term, theme) {
            switch (term) {
                case "attention":
                case "fade":
                    return new Handlebars.SafeString(theme.getThemePropertyTerm(term));
                default:
                    throw new Error(`Unknown Theme Term ${term}`);
            }
        },
        'themeDisplayis': function (str) {
            const style = CitySettings.get("themeStyle");
            switch (str) {
                case "city-of-mist":
                    return str == style;
                case "mist-engine":
                    return str == style;
                default:
                    str;
                    ui.notifications.error(`invalid type passed to themeDisplayis Helper ${str}`);
                    return false;
            }
        },
        'isThemeKit': function (theme) {
            if (theme.themebook) {
                return theme.themebook.isThemeKit();
            }
            return false;
        },
        'setFlipped': function (actor, cardNum) {
            if (cardNum == undefined) {
                ui.notifications.error("Card Number is undefined in Set Flipped");
                return false;
            }
            const sheet = actor.sheet;
            const flipState = sheet.flipped[cardNum];
            if (flipState) {
                return new Handlebars.SafeString("flipped");
            }
            else
                return "";
        },
        'isCoM': function () {
            return CitySettings.getBaseSystem() == "city-of-mist";
        },
        'isMistEngine': function () {
            return CitySettings.getBaseSystem() != "city-of-mist";
        },
        'spectrumConvert': function (x) {
            return new Handlebars.SafeString(SPECTRUM_VALUES[x]);
        },
        'allowTagDelete': function (tag) {
            if (tag.system.subtype == "story")
                return true;
            if (!tag.parent)
                return false;
            if (tag.parent.system.locked)
                return false;
            return (tag.parent.isOwner);
        },
        'getImprovements': function (theme) {
            Debug(theme);
            return theme.improvements();
        },
        'allowThemeSwitch': function (theme, sheetowner) {
            if (sheetowner.system.type != "character")
                return false;
            if (!theme.parent)
                return false;
            switch (theme.parent.system.type) {
                case "crew":
                    return sheetowner.getCrewThemes().length > 1;
                case "character":
                    if (!theme.isExtraTheme())
                        return false;
                    return sheetowner.allLinkedExtraThemes.length > 1;
                case "threat":
                    return sheetowner.allLinkedExtraThemes.length > 1;
                default:
                    theme.parent.system;
                    return false;
            }
        },
        'flashyLevelUp': function (theme) {
            if (!CitySettings.get("flashyLevelUp"))
                return false;
            return theme.system.unspent_upgrades > 0;
        },
        'mainFourThemes': function (actor) {
            const themes = actor.mainThemes;
            while (themes.length < 4) {
                themes.push(undefined);
            }
            return themes;
        },
        'hasCustomThemebook': function (theme) {
            return theme.hasCustomThemebook();
        },
    }; //end of object holding helpers
} // end of class
