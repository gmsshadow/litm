export class HandlebarsHelpers {
    static init() {
        console.log("Initializing Handlebars Helpers");
        this.addHelpers(this.getObject());
    }
    static addHelpers(helperObj) {
        for (const [key, fn] of Object.entries(helperObj)) {
            // console.log(`Init helper ${key}`);
            Handlebars.registerHelper(key, fn);
        }
    }
    static getObject() {
        return {
            'noteq': (a, b) => {
                return (a !== b);
            },
            'neq': (a, b) => {
                return (a !== b);
            },
            // Not helper
            'not': (a) => {
                return a ? false : true;
            },
            'and': (a, b) => {
                return a && b;
            },
            'or': (a, b) => {
                return a || b;
            },
            //concat handler
            'cat': (a, b) => {
                return a + b;
            },
            "isGM": () => {
                return game.user.isGM;
            },
            "localizeS": (string) => {
                return localizeS(string);
            },
        };
    }
} // end of class
export function localizeS(string) {
    if (!string.startsWith("#"))
        //@ts-ignore
        return new Handlebars.SafeString(string);
    const localizeCode = string.substring(1);
    const localized = game.i18n.localize(localizeCode);
    //@ts-ignore
    return new Handlebars.SafeString(localized);
}
