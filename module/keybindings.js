import { CityHelpers } from "./city-helpers.js";
function localize(str) {
    return game.i18n.localize(str);
}
export class CityKeyBinds {
    static init() {
        //done during the init step on foundry
        console.log("Initializing Keybinds");
        this.init_narration();
        this.init_downtime();
        this.init_sessionEnd();
    }
    static init_narration() {
        game.keybindings.register("city-of-mist", "narratorBox", {
            name: localize("CityOfMist.keybinds.narration.name"),
            hint: localize("CityOfMist.keybinds.narration.hint"),
            uneditable: [],
            editable: [
                { key: "KeyN", modifiers: ["Alt"] }
            ],
            onDown: () => { CityHelpers.narratorDialog(); },
            onUp: () => { },
            restricted: true, // GM only?
            reservedModifiers: [],
            precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
        });
    }
    static init_downtime() {
        game.keybindings.register("city-of-mist", "startDowntime", {
            name: localize("CityOfMist.keybinds.startDowntime.name"),
            hint: localize("CityOfMist.keybinds.startDowntime.hint"),
            uneditable: [],
            editable: [
                { key: "KeyD", modifiers: ["Alt"] }
            ],
            onDown: () => { CityHelpers.startDowntime(); },
            onUp: () => { },
            restricted: true, // GM only?
            reservedModifiers: [],
            precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
        });
    }
    static init_sessionEnd() {
        game.keybindings.register("city-of-mist", "sessionEnd", {
            name: localize("CityOfMist.keybinds.sessionEnd.name"),
            hint: localize("CityOfMist.keybinds.sessionEnd.hint"),
            uneditable: [],
            editable: [
                { key: "KeyE", modifiers: ["Alt"] }
            ],
            onDown: () => { CityHelpers.sessionEnd(); },
            onUp: () => { },
            restricted: true, // GM only?
            reservedModifiers: [],
            precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
        });
    }
}
