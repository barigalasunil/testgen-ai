import { MODEL_PRIORITY } from "./modelConfig";

function matchesModel(priorityName: string, installedName: string) {
    return installedName === priorityName || installedName.startsWith(`${priorityName}:`) || installedName.startsWith(priorityName);
}

export function resolveAutoModelOrder(installedModels: string[]) {
    const ordered = MODEL_PRIORITY
        .map((priorityName) => installedModels.find((installedName) => matchesModel(priorityName, installedName)))
        .filter((model): model is string => Boolean(model));

    const remaining = installedModels.filter((model) => !ordered.includes(model));
    return [...ordered, ...remaining];
}

export function resolveManualModel(model: string, installedModels: string[]) {
    return installedModels.find((installedName) => matchesModel(model, installedName)) || model;
}
