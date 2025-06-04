export const defaultTKPowerTags = "ABCDEFGHIJ"
    .split('')
    .map((letter, _i) => ({
    tagname: "", letter, description: ""
}));
export const defaultTKWeaknessTags = "ABCD"
    .split('')
    .map((letter) => ({
    tagname: "", letter, description: ""
}));
export const defaultTKImprovementData = "ABCDE".
    split('').
    map(_x => ({
    name: "",
    uses: 0,
    description: "",
    effect_class: "",
}));
